const Stripe = require('stripe');

const { env } = require('@sparkcrm/shared-config');
const { toMinorUnits } = require('./money.service');

/**
 * Validates Stripe webhooks using the endpoint secret configured in the environment
 * or optionally directly configured via DB config.
 */
const verifyWebhookSignature = (payload, signature, endpointSecret) => {
    try {
        const secret = endpointSecret || env.STRIPE_WEBHOOK_SECRET;
        if (!secret) throw new Error('Stripe webhook secret is not configured');

        // constructEvent only requires the endpoint secret for HMAC verification,
        // not the API key, so we can use any non-empty string for initialization.
        const stripe = new Stripe(env.STRIPE_SECRET_KEY || 'sk_placeholder');
        return stripe.webhooks.constructEvent(payload, signature, secret);
    } catch (err) {
        throw new Error(`Webhook Signature Verification Failed: ${err.message}`);
    }
};

/**
 * Creates a Stripe Checkout Session dynamically using ad-hoc secure keys from the DB
 */
const createCheckoutSession = async (
    secretKey,
    { amount, currency = 'INR', name, tenantId, planSlug, billingCycle, paymentMethod = 'card', successUrl, cancelUrl }
) => {
    if (!secretKey) throw new Error('Stripe secret key missing');

    // Initialize an ad-hoc stripe instance using the secret key from DB
    const stripe = new Stripe(secretKey, { apiVersion: '2023-10-16' });

    const unitAmount = toMinorUnits(amount, currency);

    const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
            {
                price_data: {
                    currency: currency.toLowerCase(),
                    product_data: {
                        name: name,
                    },
                    unit_amount: unitAmount,
                },
                quantity: 1,
            },
        ],
        mode: 'payment', // Since we're mapping to an invoice record rather than Stripe Subscriptions natively right now
        success_url: successUrl,
        cancel_url: cancelUrl,
        client_reference_id: tenantId,
        metadata: {
            tenantId: tenantId.toString(),
            planSlug,
            billingCycle,
            paymentMethod,
        },
    });

    return session;
};

const retrieveCheckoutSession = async (secretKey, sessionId) => {
    if (!secretKey) throw new Error('Stripe secret key missing');
    const stripe = new Stripe(secretKey, { apiVersion: '2023-10-16' });
    return stripe.checkout.sessions.retrieve(sessionId);
};

module.exports = {
    createCheckoutSession,
    retrieveCheckoutSession,
    verifyWebhookSignature
};
