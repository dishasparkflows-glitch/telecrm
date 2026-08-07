const Invoice = require('../models/Invoice');
const Subscription = require('../models/Subscription');
const FeatureTransaction = require('../models/FeatureTransaction');
const PaymentEvent = require('../models/PaymentEvent');
const { INVOICE_STATUS } = require('@sparkcrm/shared-utils');
const { getRedisClient, isRedisReady } = require('@sparkcrm/shared-config');
const { createTenantServiceHeaders } = require('../middleware/serviceAuth.middleware');

const addBillingPeriod = (start, billingCycle) => {
    const end = new Date(start);
    if (billingCycle === 'yearly') end.setUTCFullYear(end.getUTCFullYear() + 1);
    else end.setUTCMonth(end.getUTCMonth() + 1);
    return end;
};

const makeOutboxEvent = (invoice, eventType, payload) => ({
    eventId: `${invoice._id}:${eventType}`,
    eventType,
    payload,
    status: 'pending',
    attempts: 0,
    nextAttemptAt: new Date(),
});

const buildPaymentOutbox = (invoice, periodStart, periodEnd) => {
    const base = {
        tenantId: String(invoice.tenantId),
        invoiceId: String(invoice._id),
        type: invoice.type,
        amount: invoice.total,
        amountMinor: invoice.totalMinor,
        currency: invoice.currency,
    };
    const events = [makeOutboxEvent(invoice, 'billing.payment.success', base)];

    if (invoice.type === 'subscription') {
        events.push(makeOutboxEvent(invoice, 'billing.plan.upgraded', {
            tenantId: String(invoice.tenantId),
            invoiceId: String(invoice._id),
            planId: invoice.planId,
            planSlug: invoice.planSlug,
            billingCycle: invoice.billingCycle,
            periodStart: periodStart.toISOString(),
            periodEnd: periodEnd.toISOString(),
        }));
    }

    if (invoice.type === 'feature_purchase') {
        events.push(makeOutboxEvent(invoice, 'billing.feature.purchased', {
            tenantId: String(invoice.tenantId),
            invoiceId: String(invoice._id),
            featureId: String(invoice.featureId),
            featureSlug: invoice.featureSlug,
            periodEnd: periodEnd ? periodEnd.toISOString() : null,
        }));
    }

    return events;
};

const assertFeatureInvoiceInvariant = (invoice) => {
    if (invoice.type !== 'feature_purchase') return;
    if (!invoice.tenantId || !invoice.featureId || !invoice.featureSlug) {
        const error = new Error('Feature purchase invoice is missing tenant or feature identity');
        error.code = 'INVALID_FEATURE_INVOICE';
        throw error;
    }
    if (invoice.status !== INVOICE_STATUS.PAID || !invoice.paidAt) {
        const error = new Error('Feature entitlement requires a paid invoice');
        error.code = 'FEATURE_INVOICE_NOT_PAID';
        throw error;
    }
};

const ensureLocalEntitlement = async (invoice) => {
    let entitlement = null;
    if (invoice.type === 'subscription') {
        const periodStart = invoice.periodStart || invoice.paidAt || new Date();
        const periodEnd = invoice.periodEnd || addBillingPeriod(periodStart, invoice.billingCycle);
        await Subscription.updateMany(
            { tenantId: invoice.tenantId, status: 'active', sourceInvoiceId: { $ne: invoice._id } },
            { $set: { status: 'cancelled', cancelledAt: new Date() } }
        );
        await Subscription.findOneAndUpdate(
            { sourceInvoiceId: invoice._id },
            {
                $setOnInsert: {
                    tenantId: invoice.tenantId,
                    planId: invoice.planId,
                    planSlug: invoice.planSlug,
                    billingCycle: invoice.billingCycle,
                    provider: invoice.paymentProvider,
                    sourceInvoiceId: invoice._id,
                    currentPeriodStart: periodStart,
                    currentPeriodEnd: periodEnd,
                    amount: invoice.total,
                    amountMinor: invoice.totalMinor,
                    currency: invoice.currency,
                },
                $set: { status: 'active', cancelAtPeriodEnd: false },
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        try {
            const axios = require('axios');
            const { env } = require('@sparkcrm/shared-config');
            const path = `/internal/tenants/${encodeURIComponent(String(invoice.tenantId))}/force-upgrade`;
            const headers = createTenantServiceHeaders('POST', path, {
                tenantId: String(invoice.tenantId),
            });
            await axios.post(
                `${env.SERVICES.TENANT}${path}`,
                {
                    planId: invoice.planId,
                    planSlug: invoice.planSlug,
                    periodEnd: periodEnd.toISOString(),
                    invoiceId: String(invoice._id),
                },
                { timeout: 5000, headers }
            );
        } catch (error) {
            console.error(`[payment-lifecycle] Tenant upgrade for invoice ${invoice._id} failed:`, error.message);
        }
    }

    if (invoice.type === 'feature_purchase') {
        assertFeatureInvoiceInvariant(invoice);
        const expiresAt = invoice.periodEnd || null;
        try {
            entitlement = await FeatureTransaction.findOneAndUpdate(
                { invoiceId: invoice._id },
                {
                    $setOnInsert: {
                        tenantId: invoice.tenantId,
                        featureId: invoice.featureId,
                        featureSlug: invoice.featureSlug,
                        action: 'purchased',
                        amount: invoice.subtotal,
                        invoiceId: invoice._id,
                        activatedAt: invoice.paidAt,
                        expiresAt,
                        isActive: true,
                    },
                },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );
        } catch (error) {
            if (error.code !== 11000) throw error;

            entitlement = await FeatureTransaction.findOne({ invoiceId: invoice._id });
            if (!entitlement) {
                const active = await FeatureTransaction.findOne({
                    tenantId: invoice.tenantId,
                    featureSlug: invoice.featureSlug,
                    isActive: true,
                });
                if (active) {
                    const conflict = new Error('Another paid invoice already owns the active feature entitlement');
                    conflict.code = 'ACTIVE_FEATURE_ENTITLEMENT_CONFLICT';
                    throw conflict;
                }
                throw error;
            }
        }

        if (
            String(entitlement.tenantId) !== String(invoice.tenantId)
            || String(entitlement.featureId) !== String(invoice.featureId)
            || entitlement.featureSlug !== invoice.featureSlug
        ) {
            const error = new Error('Existing invoice entitlement does not match the paid feature invoice');
            error.code = 'FEATURE_ENTITLEMENT_MISMATCH';
            throw error;
        }
    }

    if (!invoice.entitlementGrantedAt) {
        await Invoice.updateOne(
            { _id: invoice._id, entitlementGrantedAt: null },
            { $set: { entitlementGrantedAt: new Date() } }
        );
    }

    return entitlement;
};

const finalizeInvoicePayment = async (invoiceOrId, {
    provider,
    paymentId,
    paymentMethod,
}) => {
    const invoice = typeof invoiceOrId === 'object'
        ? invoiceOrId
        : await Invoice.findById(invoiceOrId);
    if (!invoice) return { invoice: null, newlyFinalized: false };

    if (
        invoice.type === 'feature_purchase'
        && (!invoice.tenantId || !invoice.featureId || !invoice.featureSlug)
    ) {
        const error = new Error('Feature purchase invoice is missing tenant or feature identity');
        error.code = 'INVALID_FEATURE_INVOICE';
        throw error;
    }

    const paidAt = new Date();
    const periodStart = paidAt;
    let periodEnd = null;
    if (invoice.type === 'subscription') {
        periodEnd = addBillingPeriod(periodStart, invoice.billingCycle);
    } else if (invoice.type === 'feature_purchase' && invoice.featureId) {
        const Feature = require('../models/Feature');
        const feature = await Feature.findById(invoice.featureId).select('billingType');
        if (feature?.billingType === 'recurring') periodEnd = addBillingPeriod(periodStart, 'monthly');
    }

    const outboxEvents = buildPaymentOutbox(invoice, periodStart, periodEnd);
    const selectedMethods = new Set(['card', 'international_card', 'google_pay_qr']);
    const setFields = {
        status: INVOICE_STATUS.PAID,
        checkoutStatus: 'completed',
        checkoutOpen: false,
        paidAt,
        periodStart,
        periodEnd,
        paymentProvider: invoice.paymentProvider || provider,
        paymentMethod: selectedMethods.has(invoice.paymentMethod)
            ? invoice.paymentMethod
            : (paymentMethod || provider),
        gatewayPaymentMethod: paymentMethod || null,
    };
    if (provider === 'stripe') setFields.stripePaymentIntentId = paymentId;
    if (provider === 'razorpay') setFields.razorpayPaymentId = paymentId;

    const finalized = await Invoice.findOneAndUpdate(
        { _id: invoice._id, status: { $in: [INVOICE_STATUS.PENDING, INVOICE_STATUS.FAILED] } },
        { $set: setFields, $push: { outboxEvents: { $each: outboxEvents } } },
        { new: true }
    );

    const current = finalized || await Invoice.findById(invoice._id);
    if (current?.status === INVOICE_STATUS.PAID) await ensureLocalEntitlement(current);
    return { invoice: current, newlyFinalized: Boolean(finalized) };
};

const claimPaymentEvent = async ({ provider, eventId, eventType }) => {
    try {
        return await PaymentEvent.create({ provider, eventId, eventType });
    } catch (error) {
        if (error.code !== 11000) throw error;
        const existing = await PaymentEvent.findOne({ provider, eventId });
        if (existing.status === 'processed' || existing.status === 'ignored') return null;
        return PaymentEvent.findOneAndUpdate(
            { _id: existing._id, status: 'failed' },
            { $set: { status: 'processing', lastError: null }, $inc: { attempts: 1 } },
            { new: true }
        );
    }
};

const completePaymentEvent = async (record, status, invoiceId = null, error = null) => {
    if (!record) return;
    await PaymentEvent.updateOne({ _id: record._id }, {
        $set: {
            status,
            invoiceId,
            processedAt: ['processed', 'ignored'].includes(status) ? new Date() : null,
            lastError: error ? String(error.message || error).slice(0, 1000) : null,
        },
    });
};

const publishOneOutboxEvent = async (invoice, event) => {
    const claimed = await Invoice.updateOne(
        {
            _id: invoice._id,
            outboxEvents: {
                $elemMatch: {
                    eventId: event.eventId,
                    status: { $in: ['pending', 'failed'] },
                    nextAttemptAt: { $lte: new Date() },
                },
            },
        },
        {
            $set: { 'outboxEvents.$[entry].status': 'processing' },
            $inc: { 'outboxEvents.$[entry].attempts': 1 },
        },
        { arrayFilters: [{ 'entry.eventId': event.eventId }] }
    );
    if (!claimed.modifiedCount) return false;

    try {
        if (!isRedisReady()) throw new Error('Redis publisher is unavailable');
        const subscriberCount = await getRedisClient().publish(event.eventType, JSON.stringify({
            event: event.eventType,
            data: event.payload,
            timestamp: new Date().toISOString(),
            eventId: event.eventId,
        }));
        if (subscriberCount < 1) throw new Error('No event subscriber acknowledged availability');
        await Invoice.updateOne(
            { _id: invoice._id },
            { $set: {
                'outboxEvents.$[entry].status': 'published',
                'outboxEvents.$[entry].publishedAt': new Date(),
                'outboxEvents.$[entry].lastError': null,
            } },
            { arrayFilters: [{ 'entry.eventId': event.eventId }] }
        );
        return true;
    } catch (error) {
        const attempts = (event.attempts || 0) + 1;
        const delayMs = Math.min(60 * 60 * 1000, (2 ** Math.min(attempts, 10)) * 1000);
        await Invoice.updateOne(
            { _id: invoice._id },
            { $set: {
                'outboxEvents.$[entry].status': 'failed',
                'outboxEvents.$[entry].lastError': String(error.message).slice(0, 1000),
                'outboxEvents.$[entry].nextAttemptAt': new Date(Date.now() + delayMs),
            } },
            { arrayFilters: [{ 'entry.eventId': event.eventId }] }
        );
        return false;
    }
};

const processOutboxBatch = async (limit = 50) => {
    await Invoice.updateMany(
        { 'outboxEvents.status': 'processing', updatedAt: { $lt: new Date(Date.now() - 5 * 60 * 1000) } },
        { $set: { 'outboxEvents.$[entry].status': 'failed', 'outboxEvents.$[entry].nextAttemptAt': new Date() } },
        { arrayFilters: [{ 'entry.status': 'processing' }] }
    );

    const invoices = await Invoice.find({
        outboxEvents: {
            $elemMatch: {
                status: { $in: ['pending', 'failed'] },
                nextAttemptAt: { $lte: new Date() },
            },
        },
    }).select('+outboxEvents').limit(limit);

    for (const invoice of invoices) {
        for (const event of invoice.outboxEvents) {
            if (['pending', 'failed'].includes(event.status) && event.nextAttemptAt <= new Date()) {
                await publishOneOutboxEvent(invoice, event);
            }
        }
    }
};

module.exports = {
    addBillingPeriod,
    assertFeatureInvoiceInvariant,
    ensureLocalEntitlement,
    finalizeInvoicePayment,
    claimPaymentEvent,
    completePaymentEvent,
    processOutboxBatch,
};
