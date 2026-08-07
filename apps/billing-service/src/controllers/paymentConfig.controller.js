const { asyncHandler, ApiResponse, ApiError, encrypt, decrypt } = require('@sparkcrm/shared-utils');
const PaymentConfig = require('../models/PaymentConfig');
const stripe = require('stripe');
const Razorpay = require('razorpay');

/**
 * Encrypt sensitive credentials before saving.
 */
const encryptMapOrObject = (data) => {
    if (!data) return data;
    const encryptedData = {};
    for (const [key, value] of Object.entries(data)) {
        if (value && typeof value === 'string') {
            encryptedData[key] = encrypt(value);
        } else {
            encryptedData[key] = value;
        }
    }
    return encryptedData;
};

/**
 * @desc    Get all payment configs
 * @route   GET /api/payments/configs
 * @access  Private/Owner
 */
exports.getConfigs = asyncHandler(async (req, res) => {
    const configs = await PaymentConfig.find({}).select('-__v').lean();

    // We intentionally DO NOT send back decrypted credentials
    // We only send a flag indicating if the config exists
    const sanitizedConfigs = configs.map(doc => {
        let safeCredentials = {};

        if (doc.credentials) {
            for (const key of Object.keys(doc.credentials)) {
                safeCredentials[key] = true;
            }
        }


        return {
            ...doc,
            credentials: safeCredentials,
            webhookSecret: doc.webhookSecret ? '********' : undefined
        };
    });

    res.status(200).json(new ApiResponse(200, sanitizedConfigs, 'Payment configs retrieved'));
});

/**
 * @desc    Create or Update a payment config
 * @route   POST /api/payments/configs
 * @access  Private/Owner
 */
exports.saveConfig = asyncHandler(async (req, res) => {
    const { provider, isActive, displayName, credentials, webhookSecret, settings } = req.body;

    if (!provider || !['razorpay', 'stripe', 'paypal'].includes(provider)) {
        throw ApiError.badRequest('Valid provider is required');
    }

    if (!credentials || Object.keys(credentials).length === 0) {
        throw ApiError.badRequest('Credentials are required');
    }

    // Encrypt sensitive data
    const encryptedCredentials = encryptMapOrObject(credentials);
    const encryptedWebhook = webhookSecret ? encrypt(webhookSecret) : '';

    let config = await PaymentConfig.findOne({ provider });

    if (config) {
        // Update existing (merge new credentials if provided, otherwise keep old encrypted ones)
        // Since frontend might send `true` for masked fields, we need to ignore those
        const newCredentials = { ...config.credentials.toObject() };
        for (const [key, value] of Object.entries(credentials)) {
            if (value !== true && value !== false && value !== '********' && typeof value === 'string') {
                newCredentials[key] = encrypt(value);
            }
        }

        config.displayName = displayName || config.displayName;
        config.isActive = isActive !== undefined ? isActive : config.isActive;
        config.credentials = newCredentials;
        if (webhookSecret && webhookSecret !== '********') {
            config.webhookSecret = encrypt(webhookSecret);
        }
        if (settings) config.settings = settings;

        await config.save();
    } else {
        // Create new
        config = await PaymentConfig.create({
            provider,
            isActive: isActive || false,
            displayName: displayName || provider.charAt(0).toUpperCase() + provider.slice(1),
            credentials: encryptedCredentials,
            webhookSecret: encryptedWebhook,
            settings: settings || {}
        });
    }

    res.status(200).json(new ApiResponse(200, {
        provider: config.provider,
        isActive: config.isActive
    }, 'Payment config saved successfully'));
});

/**
 * @desc    Test connection for a payment provider
 * @route   POST /api/payments/configs/:provider/test
 * @access  Private/Owner
 */
exports.testConnection = asyncHandler(async (req, res) => {
    const { provider } = req.params;

    const config = await PaymentConfig.findOne({ provider });
    if (!config) {
        throw ApiError.notFound('Payment config not found. Please save it first.');
    }

    if (!config.credentials) {
        throw ApiError.badRequest('Credentials not configured');
    }

    try {
        if (provider === 'stripe') {
            const secretKey = decrypt(config.credentials.get('secretKey'));
            if (!secretKey) throw new Error('Decrypted Stripe Secret Key missing');

            const stripeClient = stripe(secretKey);
            // Verify by fetching the account details
            const account = await stripeClient.accounts.retrieve();

            return res.status(200).json(new ApiResponse(200, {
                connected: true,
                accountId: account.id,
                country: account.country
            }, 'Stripe connection successful'));

        } else if (provider === 'razorpay') {
            const keyId = decrypt(config.credentials.get('keyId'));
            const keySecret = decrypt(config.credentials.get('keySecret'));

            if (!keyId || !keySecret) throw new Error('Decrypted Razorpay Key ID or Secret missing');

            const instance = new Razorpay({
                key_id: keyId,
                key_secret: keySecret,
            });

            // Razorpay doesn't have a simple "ping" endpoint, so we can fetch customers or orders as a test
            // Fetching a single customer list page with limit=1 to verify auth
            await instance.customers.all({ count: 1 });

            return res.status(200).json(new ApiResponse(200, {
                connected: true,
            }, 'Razorpay connection successful'));

        } else {
            throw ApiError.badRequest('Provider test not supported yet');
        }
    } catch (error) {
        console.error(`[Payment Test Error - ${provider}]:`, error.message);
        throw ApiError.badRequest(`Connection failed: ${error.message}`);
    }
});

/**
 * @desc    Get active payment methods (PUBLIC / TENANTS)
 * @route   GET /api/payments/active-methods
 * @access  Public
 */
exports.getActiveMethods = asyncHandler(async (req, res) => {
    const configs = await PaymentConfig.find({ isActive: true }).select('provider displayName credentials').lean();

    const methods = configs.map(doc => {
        let safeConfig = {
            provider: doc.provider,
            displayName: doc.displayName,
        };

        if (doc.credentials) {
            // Expose ONLY the public-safe key required to initialize SDKs
            // Must decrypt since credentials are encrypted at rest
            try {
                if (doc.provider === 'razorpay' && doc.credentials.keyId) {
                    safeConfig.keyId = decrypt(doc.credentials.keyId);
                } else if (doc.provider === 'stripe' && doc.credentials.publishableKey) {
                    safeConfig.publishableKey = decrypt(doc.credentials.publishableKey);
                }
            } catch (e) {
                console.error(`[getActiveMethods] Failed to decrypt credentials for ${doc.provider}:`, e.message);
                // Do NOT fall back to encrypted text — omit the key entirely
            }
        }

        return safeConfig;
    });

    res.status(200).json(new ApiResponse(200, methods, 'Active payment methods retrieved'));
});
