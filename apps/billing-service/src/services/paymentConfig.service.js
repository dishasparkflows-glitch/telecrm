const PaymentConfig = require('../models/PaymentConfig');
const { ApiError, decrypt } = require('@sparkcrm/shared-utils');

const mapValue = (map, key) => {
    if (!map) return undefined;
    return typeof map.get === 'function' ? map.get(key) : map[key];
};

const decryptValue = (value) => value ? decrypt(value) : '';

const resolveMode = (config) => config.mode || (process.env.NODE_ENV === 'production' ? 'live' : 'test');

const getActivePaymentConfig = async (provider) => {
    const config = await PaymentConfig.findOne({ provider, isActive: true });
    if (!config) throw ApiError.badRequest(`Payment provider '${provider}' is not active or configured`);
    if (!config.credentials) throw ApiError.badRequest(`Payment provider '${provider}' has no credentials`);
    return config;
};

const getProviderCredentials = (config) => {
    const mode = resolveMode(config);
    const credentials = config.credentials;

    if (config.provider === 'razorpay') {
        const keyId = mapValue(credentials, mode === 'live' ? 'liveKeyId' : 'testKeyId') || mapValue(credentials, 'keyId');
        const keySecret = mapValue(credentials, mode === 'live' ? 'liveKeySecret' : 'testKeySecret') || mapValue(credentials, 'keySecret');
        if (!keyId || !keySecret) throw ApiError.badRequest(`Razorpay ${mode} credentials are incomplete`);
        return { mode, keyId: decryptValue(keyId), keySecret: decryptValue(keySecret) };
    }

    if (config.provider === 'stripe') {
        const publishableKey = mapValue(credentials, mode === 'live' ? 'livePublishableKey' : 'testPublishableKey') || mapValue(credentials, 'publishableKey');
        const secretKey = mapValue(credentials, mode === 'live' ? 'liveSecretKey' : 'testSecretKey') || mapValue(credentials, 'secretKey');
        if (!secretKey) throw ApiError.badRequest(`Stripe ${mode} secret key is missing`);
        return {
            mode,
            publishableKey: decryptValue(publishableKey),
            secretKey: decryptValue(secretKey),
        };
    }

    throw ApiError.badRequest(`Unsupported payment provider '${config.provider}'`);
};

const getWebhookSecret = (config) => {
    const mode = resolveMode(config);
    const credentials = config.credentials;
    const legacyCredentialSecret = mapValue(
        credentials,
        mode === 'live' ? 'liveWebhookSecret' : 'testWebhookSecret'
    ) || mapValue(credentials, 'webhookSecret');
    const encryptedOrPlain = config.webhookSecret || legacyCredentialSecret;

    if (encryptedOrPlain) return decryptValue(encryptedOrPlain);

    const environmentFallback = config.provider === 'stripe'
        ? process.env.STRIPE_WEBHOOK_SECRET
        : process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!environmentFallback) throw ApiError.badRequest(`${config.provider} webhook secret is missing`);
    return environmentFallback;
};

module.exports = {
    mapValue,
    resolveMode,
    getActivePaymentConfig,
    getProviderCredentials,
    getWebhookSecret,
};
