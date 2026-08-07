const axios = require('axios');
const PaymentConfig = require('../models/PaymentConfig');
const { env } = require('@sparkcrm/shared-config');
const { createTenantServiceHeaders } = require('../middleware/serviceAuth.middleware');

const METHOD_METADATA = {
    'card:razorpay': {
        displayName: 'Razorpay credit/debit cards',
        description: 'Pay with supported domestic credit and debit cards through Razorpay.',
    },
    'card:stripe': {
        displayName: 'Stripe credit/debit cards',
        description: 'Pay with supported credit and debit cards through Stripe.',
    },
    'international_card:razorpay': {
        displayName: 'International cards via Razorpay',
        description: 'Pay with an international card through Razorpay when enabled on the provider account.',
    },
    'international_card:stripe': {
        displayName: 'International card payments',
        description: 'Pay with an international credit or debit card through Stripe.',
    },
    'google_pay_qr:razorpay': {
        displayName: 'Google Pay QR scan',
        description: 'Scan a single-use UPI QR code with Google Pay to complete payment.',
    },
};

const toMethod = ({ type, provider }) => {
    const id = `${type}:${provider}`;
    return {
        id,
        type,
        provider,
        ...(METHOD_METADATA[id] || {
            displayName: type.replaceAll('_', ' '),
            description: `Secure payment through ${provider}.`,
        }),
    };
};

const getTenantPaymentMethods = async (tenantId) => {
    const tenantServiceUrl = env.SERVICES.TENANT || 'http://localhost:8002';
    const path = `/internal/tenants/${encodeURIComponent(String(tenantId))}`;
    const headers = createTenantServiceHeaders('GET', path, { tenantId: String(tenantId) });

    const [tenantResponse, activeConfigs] = await Promise.all([
        axios.get(`${tenantServiceUrl}${path}`, { timeout: 5000, headers }),
        PaymentConfig.find({ isActive: true }).select('provider').lean(),
    ]);

    const tenant = tenantResponse.data?.data;
    if (!tenant) throw new Error('Tenant payment settings could not be loaded');

    const activeProviders = new Set(activeConfigs.map((config) => config.provider));
    let configuredMethods;

    if (tenant.paymentMethodsConfigured) {
        configuredMethods = (tenant.paymentMethods || []).filter((method) => method.enabled !== false);
    } else {
        // Backward-compatible behavior for existing tenants: every globally
        // active provider remains available as its existing card checkout.
        configuredMethods = [...activeProviders].map((provider) => ({
            type: 'card',
            provider,
            enabled: true,
        }));
    }

    const seen = new Set();
    const methods = configuredMethods
        .filter((method) => activeProviders.has(method.provider))
        .filter((method) => {
            const id = `${method.type}:${method.provider}`;
            if (!METHOD_METADATA[id] || seen.has(id)) return false;
            seen.add(id);
            return true;
        })
        .map(toMethod);

    return {
        configured: Boolean(tenant.paymentMethodsConfigured),
        methods,
    };
};

const assertTenantPaymentMethod = async (tenantId, type, provider) => {
    const availability = await getTenantPaymentMethods(tenantId);
    const method = availability.methods.find(
        (candidate) => candidate.type === type && candidate.provider === provider
    );

    if (!method) {
        const error = new Error('This payment method is not enabled for your account');
        error.code = 'PAYMENT_METHOD_NOT_AVAILABLE';
        throw error;
    }

    return method;
};

module.exports = {
    getTenantPaymentMethods,
    assertTenantPaymentMethod,
};
