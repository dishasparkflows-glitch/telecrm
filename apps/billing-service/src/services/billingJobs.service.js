const Invoice = require('../models/Invoice');
const Subscription = require('../models/Subscription');
const FeatureTransaction = require('../models/FeatureTransaction');
const { generateInvoicePdf } = require('./invoicePdf.service');
const { uploadPrivateInvoice } = require('./privateInvoiceStorage.service');
const {
    ensureLocalEntitlement,
    processOutboxBatch,
    finalizeInvoicePayment,
} = require('./paymentLifecycle.service');
const { getActivePaymentConfig, getProviderCredentials } = require('./paymentConfig.service');
const stripeService = require('./stripe.service');
const razorpayService = require('./razorpay.service');

let timer = null;
let running = false;

const formatBillingJobError = (error) => {
    const providerError = error?.error || error?.response?.data?.error;
    const message = error?.message
        || providerError?.description
        || error?.description
        || (typeof error === 'string' ? error : 'Unknown provider error');
    const code = error?.code || providerError?.code;
    const status = error?.statusCode || error?.status || error?.response?.status;
    return [message, code ? `code=${code}` : null, status ? `status=${status}` : null]
        .filter(Boolean)
        .join(' ')
        .slice(0, 1000);
};

const reconciliationDelayMs = (attempts = 0) => (
    Math.min(6 * 60 * 60 * 1000, (2 ** Math.min(Math.max(attempts, 0), 10)) * 60 * 1000)
);

const schedulePaymentReconciliation = async (invoice, error = null) => {
    const attempts = Number(invoice.reconciliationAttempts) || 0;
    await Invoice.updateOne(
        { _id: invoice._id, status: 'pending', checkoutStatus: 'ready' },
        {
            $inc: { reconciliationAttempts: 1 },
            $set: {
                nextReconciliationAt: new Date(Date.now() + reconciliationDelayMs(attempts)),
                lastReconciliationError: error ? formatBillingJobError(error) : null,
            },
        }
    );
};

const queueEvent = async (invoice, eventType, payload) => {
    const eventId = `${invoice._id}:${eventType}:${Date.now()}`;
    await Invoice.updateOne({ _id: invoice._id }, {
        $push: { outboxEvents: {
            eventId,
            eventType,
            payload,
            status: 'pending',
            attempts: 0,
            nextAttemptAt: new Date(),
        } },
    });
};

const expireFeatures = async () => {
    const expired = await FeatureTransaction.find({
        action: 'purchased',
        isActive: true,
        expiresAt: { $ne: null, $lte: new Date() },
    }).limit(100);

    for (const transaction of expired) {
        const updated = await FeatureTransaction.findOneAndUpdate(
            { _id: transaction._id, isActive: true },
            { $set: { isActive: false, deactivatedAt: new Date() } },
            { new: true }
        );
        if (!updated) continue;
        await FeatureTransaction.create({
            tenantId: updated.tenantId,
            featureId: updated.featureId,
            featureSlug: updated.featureSlug,
            action: 'expired',
            amount: 0,
            relatedTransactionId: updated._id,
            activatedAt: new Date(),
            deactivatedAt: new Date(),
            isActive: false,
        });
        const invoice = updated.invoiceId ? await Invoice.findById(updated.invoiceId) : null;
        if (invoice) await queueEvent(invoice, 'billing.feature.cancelled', {
            tenantId: String(updated.tenantId),
            featureSlug: updated.featureSlug,
            transactionId: String(updated._id),
            reason: 'expired',
        });
    }
};

const expireSubscriptions = async () => {
    const expired = await Subscription.find({
        status: 'active',
        currentPeriodEnd: { $lte: new Date() },
    }).limit(100);

    for (const subscription of expired) {
        const updated = await Subscription.findOneAndUpdate(
            { _id: subscription._id, status: 'active' },
            { $set: { status: 'expired' } },
            { new: true }
        );
        if (!updated) continue;
        const invoice = await Invoice.findById(updated.sourceInvoiceId);
        if (invoice) await queueEvent(invoice, 'billing.plan.downgraded', {
            tenantId: String(updated.tenantId),
            subscriptionId: String(updated._id),
            expiredAt: new Date().toISOString(),
        });
    }
};

const reconcilePendingPayments = async () => {
    const now = new Date();
    const invoices = await Invoice.find({
        status: 'pending',
        checkoutStatus: 'ready',
        createdAt: { $lte: new Date(now.getTime() - 2 * 60 * 1000) },
        $or: [
            { nextReconciliationAt: null },
            { nextReconciliationAt: { $lte: now } },
        ],
    })
        .select('+reconciliationAttempts +nextReconciliationAt')
        .sort({ 'meta.createdAt': 1 })
        .limit(20);

    for (const invoice of invoices) {
        try {
            const config = await getActivePaymentConfig(invoice.paymentProvider);
            const credentials = getProviderCredentials(config);
            if (invoice.paymentProvider === 'stripe' && invoice.stripeSessionId) {
                const session = await stripeService.retrieveCheckoutSession(
                    credentials.secretKey,
                    invoice.stripeSessionId
                );
                if (session.payment_status !== 'paid') {
                    await schedulePaymentReconciliation(invoice);
                    continue;
                }
                if (Number(session.amount_total) !== invoice.totalMinor
                    || String(session.currency).toUpperCase() !== invoice.currency
                    || String(session.client_reference_id || session.metadata?.tenantId) !== String(invoice.tenantId)) {
                    throw new Error('Stripe reconciliation data does not match invoice');
                }
                const paymentIntentId = typeof session.payment_intent === 'string'
                    ? session.payment_intent
                    : session.payment_intent?.id;
                if (!paymentIntentId) throw new Error('Paid Stripe session has no payment intent');
                await finalizeInvoicePayment(invoice, {
                    provider: 'stripe',
                    paymentId: paymentIntentId,
                    paymentMethod: 'card',
                });
                continue;
            }

            if (invoice.paymentProvider === 'razorpay' && invoice.razorpayOrderId) {
                const order = await razorpayService.fetchOrder(
                    credentials.keyId,
                    credentials.keySecret,
                    invoice.razorpayOrderId
                );
                if (order.status !== 'paid') {
                    await schedulePaymentReconciliation(invoice);
                    continue;
                }
                const payments = await razorpayService.fetchOrderPayments(
                    credentials.keyId,
                    credentials.keySecret,
                    invoice.razorpayOrderId
                );
                const payment = payments.items?.find((item) => item.status === 'captured');
                if (!payment) {
                    await schedulePaymentReconciliation(invoice);
                    continue;
                }
                if (Number(payment.amount) !== invoice.totalMinor
                    || String(payment.currency).toUpperCase() !== invoice.currency) {
                    throw new Error('Razorpay reconciliation data does not match invoice');
                }
                await finalizeInvoicePayment(invoice, {
                    provider: 'razorpay',
                    paymentId: payment.id,
                    paymentMethod: payment.method || 'razorpay',
                });
                continue;
            }

            throw new Error('Invoice has no supported payment checkout reference');
        } catch (error) {
            const message = formatBillingJobError(error);
            try {
                await schedulePaymentReconciliation(invoice, error);
            } catch (scheduleError) {
                console.error(
                    `[billing-jobs] Reconciliation ${invoice._id} failed: ${message}; backoff update failed: ${formatBillingJobError(scheduleError)}`
                );
                continue;
            }
            console.error(`[billing-jobs] Reconciliation ${invoice._id} failed: ${message}`);
        }
    }
};

const reconcileMissingFeatureEntitlements = async () => {
    const invoices = await Invoice.find({
        type: 'feature_purchase',
        status: 'paid',
        entitlementGrantedAt: null,
        featureId: { $ne: null },
        featureSlug: { $nin: [null, ''] },
    }).sort({ paidAt: 1 }).limit(20);

    for (const invoice of invoices) {
        try {
            await ensureLocalEntitlement(invoice);
        } catch (error) {
            console.error(`[billing-jobs] Feature entitlement ${invoice._id} failed: ${formatBillingJobError(error)}`);
        }
    }
};

const generateMissingPdfs = async () => {
    const invoices = await Invoice.find({ status: 'paid', pdfObjectKey: null })
        .select('+pdfObjectKey')
        .limit(5);
    for (const invoice of invoices) {
        try {
            const { env } = require('@sparkcrm/shared-config');
            const axios = require('axios');
            const { createTenantServiceHeaders } = require('../middleware/serviceAuth.middleware');
            const path = `/internal/tenants/${encodeURIComponent(String(invoice.tenantId))}`;
            const headers = createTenantServiceHeaders('GET', path, {
                tenantId: String(invoice.tenantId),
            });
            const tenantResponse = await axios.get(
                `${env.SERVICES.TENANT}${path}`,
                { timeout: 5000, headers }
            );
            if (!tenantResponse.data?.data) continue;
            const buffer = await generateInvoicePdf(invoice, tenantResponse.data.data);
            const objectKey = await uploadPrivateInvoice(buffer, invoice);
            await Invoice.updateOne(
                { _id: invoice._id, pdfObjectKey: null },
                { $set: { pdfObjectKey: objectKey } }
            );
        } catch (error) {
            console.error(`[billing-jobs] Invoice PDF ${invoice._id} failed: ${formatBillingJobError(error)}`);
        }
    }
};

const runBillingJobs = async () => {
    if (running) return;
    running = true;
    try {
        await reconcilePendingPayments();
        await reconcileMissingFeatureEntitlements();
        await processOutboxBatch();
        await expireFeatures();
        await expireSubscriptions();
        await generateMissingPdfs();
    } catch (error) {
        console.error(`[billing-jobs] Background run failed: ${formatBillingJobError(error)}`);
    } finally {
        running = false;
    }
};

const startBillingJobs = () => {
    if (timer) return;
    timer = setInterval(runBillingJobs, 30_000);
    timer.unref?.();
    setImmediate(runBillingJobs);
};

const stopBillingJobs = () => {
    if (timer) clearInterval(timer);
    timer = null;
};

module.exports = {
    formatBillingJobError,
    reconciliationDelayMs,
    schedulePaymentReconciliation,
    runBillingJobs,
    reconcilePendingPayments,
    reconcileMissingFeatureEntitlements,
    startBillingJobs,
    stopBillingJobs,
};
