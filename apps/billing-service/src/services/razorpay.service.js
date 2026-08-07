const Razorpay = require('razorpay');
const axios = require('axios');
const crypto = require('crypto');
const { env } = require('@sparkcrm/shared-config');
const { toMinorUnits } = require('./money.service');

let razorpayInstance = null;

/**
 * Get or create Razorpay instance (singleton)
 */
const getRazorpay = () => {
    if (!razorpayInstance) {
        if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
            console.warn('⚠️ Razorpay credentials not configured. Payment features will not work.');
            return null;
        }
        razorpayInstance = new Razorpay({
            key_id: env.RAZORPAY_KEY_ID,
            key_secret: env.RAZORPAY_KEY_SECRET,
        });
    }
    return razorpayInstance;
};

/**
 * Create a Razorpay order for one-time payments
 */
const createOrder = async ({ amount, currency = 'INR', receipt, notes = {} }) => {
    const razorpay = getRazorpay();
    if (!razorpay) throw new Error('Razorpay not configured');

    return razorpay.orders.create({
        amount: toMinorUnits(amount, currency),
        currency,
        receipt,
        notes,
    });
};

/**
 * Create a Razorpay order using dynamically provided keys (from DB config)
 */
const createAdhocOrder = async (key_id, key_secret, { amount, currency = 'INR', receipt, notes = {} }) => {
    if (!key_id || !key_secret) throw new Error('Razorpay credentials missing for ad-hoc order');

    const rzp = new Razorpay({ key_id, key_secret });

    return rzp.orders.create({
        amount: toMinorUnits(amount, currency),
        currency,
        receipt,
        notes,
    });
};

const fetchOrder = async (keyId, keySecret, orderId) => {
    if (!keyId || !keySecret) throw new Error('Razorpay credentials missing for order lookup');
    return new Razorpay({ key_id: keyId, key_secret: keySecret }).orders.fetch(orderId);
};

const fetchOrderPayments = async (keyId, keySecret, orderId) => {
    if (!keyId || !keySecret) throw new Error('Razorpay credentials missing for payment lookup');
    return new Razorpay({ key_id: keyId, key_secret: keySecret }).orders.fetchPayments(orderId);
};

/**
 * Create a single-use fixed-amount UPI QR code using Owner-configured keys.
 * Google Pay and other UPI apps can scan the returned image.
 */
const createAdhocQrCode = async (
    keyId,
    keySecret,
    { amount, name, description, notes = {}, expiresInSeconds = 15 * 60 }
) => {
    if (!keyId || !keySecret) throw new Error('Razorpay credentials missing for QR creation');

    const closeBy = Math.floor(Date.now() / 1000) + expiresInSeconds;
    const response = await axios.post(
        'https://api.razorpay.com/v1/payments/qr_codes',
        {
            type: 'upi_qr',
            name,
            usage: 'single_use',
            fixed_amount: true,
            payment_amount: toMinorUnits(amount, 'INR'),
            description,
            close_by: closeBy,
            notes,
        },
        {
            auth: { username: keyId, password: keySecret },
            timeout: 15000,
        }
    );

    return response.data;
};

/**
 * Create a Razorpay subscription
 */
const createSubscription = async ({ planId, totalCount = 12, notes = {} }) => {
    const razorpay = getRazorpay();
    if (!razorpay) throw new Error('Razorpay not configured');

    return razorpay.subscriptions.create({
        plan_id: planId,
        total_count: totalCount,
        notes,
    });
};

/**
 * Cancel a Razorpay subscription
 */
const cancelSubscription = async (subscriptionId, cancelAtEnd = true) => {
    const razorpay = getRazorpay();
    if (!razorpay) throw new Error('Razorpay not configured');

    return razorpay.subscriptions.cancel(subscriptionId, cancelAtEnd);
};

/**
 * Verify Razorpay payment signature
 */
const verifyPaymentSignature = ({ orderId, paymentId, signature, secret }) => {
    const body = `${orderId}|${paymentId}`;
    const hmacSecret = secret || env.RAZORPAY_KEY_SECRET;

    if (!hmacSecret) throw new Error('Razorpay secret not available for verification');

    const expectedSignature = crypto
        .createHmac('sha256', hmacSecret)
        .update(body)
        .digest('hex');
    if (typeof signature !== 'string' || signature.length !== expectedSignature.length) return false;
    return crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(signature));
};

/**
 * Verify Razorpay webhook signature
 */
const verifyWebhookSignature = (body, signature, secret) => {
    const webhookSecret = secret || env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret) throw new Error('Razorpay webhook secret not available for verification');

    const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(body)
        .digest('hex');
    if (typeof signature !== 'string' || signature.length !== expectedSignature.length) return false;
    return crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(signature));
};

module.exports = {
    getRazorpay,
    createOrder,
    createAdhocOrder,
    createAdhocQrCode,
    fetchOrder,
    fetchOrderPayments,
    createSubscription,
    cancelSubscription,
    verifyPaymentSignature,
    verifyWebhookSignature,
};
