const crypto = require('crypto');
const { ApiError, asyncHandler, INVOICE_STATUS } = require('@sparkcrm/shared-utils');
const { publishEvent, EVENTS } = require('@sparkcrm/shared-events');
const Invoice = require('../models/Invoice');
const stripeService = require('../services/stripe.service');
const razorpayService = require('../services/razorpay.service');
const { getActivePaymentConfig, getWebhookSecret } = require('../services/paymentConfig.service');
const {
    claimPaymentEvent,
    completePaymentEvent,
    finalizeInvoicePayment,
} = require('../services/paymentLifecycle.service');
const { toMinorUnits } = require('../services/money.service');

const expectedTotalMinor = (invoice) => (
    Number.isInteger(invoice.totalMinor)
        ? invoice.totalMinor
        : toMinorUnits(invoice.total, invoice.currency)
);

const assertPaymentMatchesInvoice = (invoice, amountMinor, currency) => {
    const amountMatches = Number(amountMinor) === expectedTotalMinor(invoice);
    const currencyMatches = String(currency || '').toUpperCase() === String(invoice.currency).toUpperCase();
    if (!amountMatches || !currencyMatches) {
        throw ApiError.badRequest('Webhook payment details do not match invoice');
    }
};

/**
 * POST /api/billing/webhooks/stripe
 * Verify and process Stripe events against the exact request bytes.
 */
const handleStripeWebhook = asyncHandler(async (req, res) => {
    const signature = req.headers['stripe-signature'];
    const config = await getActivePaymentConfig('stripe');
    const event = stripeService.verifyWebhookSignature(
        req.body,
        signature,
        getWebhookSecret(config)
    );

    const eventRecord = await claimPaymentEvent({
        provider: 'stripe',
        eventId: event.id,
        eventType: event.type,
    });
    if (!eventRecord) return res.status(200).json({ received: true });

    let invoice = null;
    try {
        if (event.type !== 'checkout.session.completed') {
            await completePaymentEvent(eventRecord, 'ignored');
            return res.status(200).json({ received: true });
        }

        const session = event.data.object;
        invoice = await Invoice.findOne({ stripeSessionId: session.id });
        if (!invoice || session.payment_status !== 'paid') {
            await completePaymentEvent(eventRecord, 'ignored', invoice?._id);
            return res.status(200).json({ received: true });
        }

        assertPaymentMatchesInvoice(invoice, session.amount_total, session.currency);
        if (String(session.client_reference_id) !== String(invoice.tenantId)) {
            throw ApiError.badRequest('Webhook tenant does not match invoice');
        }

        const paymentIntentId = typeof session.payment_intent === 'string'
            ? session.payment_intent
            : session.payment_intent?.id;
        if (!paymentIntentId) throw ApiError.badRequest('Stripe payment intent is missing');

        await finalizeInvoicePayment(invoice, {
            provider: 'stripe',
            paymentId: paymentIntentId,
            paymentMethod: 'card',
        });
        await completePaymentEvent(eventRecord, 'processed', invoice._id);
        return res.status(200).json({ received: true });
    } catch (error) {
        await completePaymentEvent(eventRecord, 'failed', invoice?._id, error);
        throw error;
    }
});

/**
 * POST /api/billing/webhooks/razorpay and /webhooks/razorpay
 * Verify and process Razorpay order and single-use QR events.
 */
const handleRazorpayWebhook = asyncHandler(async (req, res) => {
    const signature = req.headers['x-razorpay-signature'];
    const rawBody = req.body;
    const config = await getActivePaymentConfig('razorpay');
    const isValid = razorpayService.verifyWebhookSignature(
        rawBody,
        signature,
        getWebhookSecret(config)
    );
    if (!isValid) return res.status(400).send('Invalid Razorpay Webhook Signature');

    let event;
    try {
        event = JSON.parse(rawBody.toString('utf8'));
    } catch {
        return res.status(400).send('Invalid Razorpay webhook payload');
    }

    const eventId = event.id || crypto.createHash('sha256').update(rawBody).digest('hex');
    const eventRecord = await claimPaymentEvent({
        provider: 'razorpay',
        eventId,
        eventType: event.event || 'unknown',
    });
    if (!eventRecord) return res.status(200).json({ status: 'ok' });

    let invoice = null;
    try {
        const paymentData = event.payload?.payment?.entity;

        if (event.event === 'qr_code.credited') {
            const qrCodeId = event.payload?.qr_code?.entity?.id;
            invoice = qrCodeId ? await Invoice.findOne({ razorpayQrCodeId: qrCodeId }) : null;
            if (!invoice || !paymentData) {
                await completePaymentEvent(eventRecord, 'ignored', invoice?._id);
                return res.status(200).json({ status: 'ok' });
            }

            assertPaymentMatchesInvoice(invoice, paymentData.amount, paymentData.currency);
            await finalizeInvoicePayment(invoice, {
                provider: 'razorpay',
                paymentId: paymentData.id,
                paymentMethod: paymentData.method || 'upi',
            });
        } else if (event.event === 'payment.captured' || event.event === 'order.paid') {
            const orderId = paymentData?.order_id;
            invoice = orderId ? await Invoice.findOne({ razorpayOrderId: orderId }) : null;
            if (!invoice || !paymentData) {
                await completePaymentEvent(eventRecord, 'ignored', invoice?._id);
                return res.status(200).json({ status: 'ok' });
            }

            assertPaymentMatchesInvoice(invoice, paymentData.amount, paymentData.currency);
            await finalizeInvoicePayment(invoice, {
                provider: 'razorpay',
                paymentId: paymentData.id,
                paymentMethod: paymentData.method || 'card',
            });
        } else if (event.event === 'payment.failed') {
            const orderId = paymentData?.order_id;
            invoice = orderId ? await Invoice.findOne({ razorpayOrderId: orderId }) : null;
            if (invoice && invoice.status !== INVOICE_STATUS.PAID) {
                await Invoice.updateOne(
                    { _id: invoice._id, status: { $ne: INVOICE_STATUS.PAID } },
                    {
                        $set: {
                            status: INVOICE_STATUS.FAILED,
                            checkoutStatus: 'failed',
                            gatewayPaymentMethod: paymentData?.method || null,
                        },
                    }
                );
                await publishEvent(EVENTS.PAYMENT_FAILED, {
                    tenantId: invoice.tenantId,
                    invoiceId: invoice._id,
                    error: paymentData?.error_description,
                });
            }
        } else {
            await completePaymentEvent(eventRecord, 'ignored');
            return res.status(200).json({ status: 'ok' });
        }

        await completePaymentEvent(eventRecord, 'processed', invoice?._id);
        return res.status(200).json({ status: 'ok' });
    } catch (error) {
        await completePaymentEvent(eventRecord, 'failed', invoice?._id, error);
        throw error;
    }
});

module.exports = {
    handleStripeWebhook,
    handleRazorpayWebhook,
};
