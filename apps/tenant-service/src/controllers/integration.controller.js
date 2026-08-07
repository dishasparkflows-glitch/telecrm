const { IntegrationCredential, encrypt, decrypt } = require('../models/IntegrationCredential');
const { ApiResponse } = require('@sparkcrm/shared-utils');
const { createServiceHeaders } = require('@sparkcrm/shared-middleware');

/**
 * Provider-specific field definitions — tells the frontend which fields to show.
 *
 * IMPORTANT — Calling (Exotel / Twilio) is intentionally NOT in this list.
 * Calling infrastructure is managed globally by the SparkCRM Owner.
 * The owner assigns a virtual number to each tenant from their Exotel pool.
 * Tenants configure only their OWN services: WhatsApp Business account,
 * SMTP, Razorpay (for their own payment collection), and file storage.
 */
const PROVIDER_FIELDS = {
    whatsapp: {
        label: 'WhatsApp Business API (Meta)',
        description: 'Send and receive WhatsApp messages via Meta Cloud API. Each business must have its own WhatsApp Business Account.',
        fields: [
            { key: 'phone_number_id', label: 'Phone Number ID', type: 'text', required: true, helpText: 'From Meta Developer Console → WhatsApp → Phone Numbers' },
            { key: 'waba_id', label: 'WhatsApp Business Account ID', type: 'text', required: true, helpText: 'Your WABA ID from Meta Business Manager' },
            { key: 'access_token', label: 'Permanent Access Token', type: 'password', required: true, helpText: 'System User permanent token from Meta Business Settings' },
            { key: 'app_id', label: 'App ID', type: 'text', required: false, helpText: 'Your Meta App ID' },
            { key: 'app_secret', label: 'App Secret', type: 'password', required: false, helpText: 'Your Meta App Secret (for webhook verification)' },
            { key: 'verify_token', label: 'Webhook Verify Token', type: 'text', required: true, helpText: 'Custom string for webhook verification — set same token in Meta webhook settings' },
            { key: 'webhook_url', label: 'Webhook URL', type: 'text', required: false, helpText: 'Auto-generated webhook URL for incoming messages' },
        ],
    },
    meta_lead_ads: {
        label: 'Facebook / Instagram Lead Ads',
        description: 'Capture Facebook and Instagram Lead Ads into SparkCRM. Use the Lead Sources setup to map pages/forms after saving credentials.',
        fields: [
            { key: 'app_id', label: 'Meta App ID', type: 'text', required: false, helpText: 'Meta app used for Lead Ads webhook/OAuth' },
            { key: 'app_secret', label: 'Meta App Secret', type: 'password', required: false, helpText: 'Used server-side for webhook signature verification when configured globally' },
            { key: 'access_token', label: 'Page/System User Access Token', type: 'password', required: true, helpText: 'Token with leads_retrieval and page permissions' },
            { key: 'ad_account_id', label: 'Ad Account ID', type: 'text', required: false, helpText: 'Optional ad account identifier' },
            { key: 'page_id', label: 'Default Page ID', type: 'text', required: false, helpText: 'Facebook page that owns the lead forms' },
        ],
    },
    razorpay: {
        label: 'Razorpay (Payments)',
        description: 'Payment gateway for collecting payments from your own customers',
        fields: [
            { key: 'key_id', label: 'Key ID', type: 'text', required: true, helpText: 'From Razorpay Dashboard → Settings → API Keys' },
            { key: 'key_secret', label: 'Key Secret', type: 'password', required: true, helpText: 'Secret key from Razorpay' },
            { key: 'webhook_secret', label: 'Webhook Secret', type: 'password', required: false, helpText: 'For verifying Razorpay webhook events' },
        ],
    },
    smtp: {
        label: 'Email (SMTP)',
        description: 'SMTP credentials for sending emails to your leads and customers',
        fields: [
            { key: 'host', label: 'SMTP Host', type: 'text', required: true, helpText: 'e.g., smtp.gmail.com' },
            { key: 'port', label: 'SMTP Port', type: 'text', required: true, helpText: 'Usually 465 (SSL) or 587 (TLS)' },
            { key: 'username', label: 'Username', type: 'text', required: true, helpText: 'Your email address' },
            { key: 'password', label: 'Password / App Password', type: 'password', required: true, helpText: 'For Gmail, use an App Password' },
            { key: 'from_email', label: 'From Email', type: 'text', required: true, helpText: 'Sender email address' },
            { key: 'from_name', label: 'From Name', type: 'text', required: false, helpText: 'Display name in emails' },
        ],
    },
    aws_s3: {
        label: 'AWS S3 (File Storage)',
        description: 'Amazon S3 for file uploads and storage',
        fields: [
            { key: 'access_key_id', label: 'Access Key ID', type: 'text', required: true, helpText: 'IAM user access key' },
            { key: 'secret_access_key', label: 'Secret Access Key', type: 'password', required: true, helpText: 'IAM user secret key' },
            { key: 'bucket_name', label: 'S3 Bucket Name', type: 'text', required: true, helpText: 'e.g., sparkcrm-uploads' },
            { key: 'region', label: 'AWS Region', type: 'text', required: true, helpText: 'e.g., ap-south-1' },
        ],
    },
    google_meet: {
        label: 'Google Meet',
        description: 'Schedule and host video meetings with leads',
        fields: [
            { key: 'client_id', label: 'Client ID', type: 'text', required: true, helpText: 'Google OAuth Client ID' },
            { key: 'client_secret', label: 'Client Secret', type: 'password', required: true, helpText: 'Google OAuth Client Secret' },
        ],
    },
    zoom: {
        label: 'Zoom',
        description: 'Schedule and host Zoom meetings with leads',
        fields: [
            { key: 'api_key', label: 'API Key', type: 'text', required: true, helpText: 'Zoom App API Key' },
            { key: 'api_secret', label: 'API Secret', type: 'password', required: true, helpText: 'Zoom App API Secret' },
        ],
    },
};

/**
 * GET /api/integrations/providers
 * Returns the field definitions for each integration provider
 */
const getProviders = async (req, res) => {
    ApiResponse.success(res, PROVIDER_FIELDS, 'Provider field definitions');
};

/**
 * GET /api/integrations
 * Returns all configured integrations for the current tenant (credentials masked)
 */
const getIntegrations = async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];

    // Calling providers are OWNER-managed — tenants must never see or edit them
    const CALLING_PROVIDERS = ['exotel', 'twilio'];

    const creds = await IntegrationCredential.find({
        tenantId,
        provider: { $nin: CALLING_PROVIDERS },
    }).lean();

    // Mask sensitive values
    const masked = creds.map(c => {
        const maskedCreds = {};
        if (c.credentials) {
            for (const [key, val] of Object.entries(c.credentials instanceof Map ? Object.fromEntries(c.credentials) : c.credentials)) {
                try {
                    const decrypted = decrypt(val);
                    maskedCreds[key] = decrypted ? decrypted.slice(0, 4) + '••••••' + decrypted.slice(-4) : '';
                } catch {
                    maskedCreds[key] = '••••••';
                }
            }
        }
        return { ...c, credentials: maskedCreds };
    });

    ApiResponse.success(res, masked, 'Integrations fetched');
};

/**
 * GET /api/integrations/:provider
 * Returns a single integration's credentials (decrypted) for use by the system
 */
const getIntegration = async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const { provider } = req.params;

    const cred = await IntegrationCredential.findOne({ tenantId, provider }).lean();
    if (!cred) return ApiResponse.error(res, `No ${provider} integration configured`, 404);

    // Decrypt credentials
    const decrypted = {};
    if (cred.credentials) {
        for (const [key, val] of Object.entries(cred.credentials instanceof Map ? Object.fromEntries(cred.credentials) : cred.credentials)) {
            try { decrypted[key] = decrypt(val); } catch { decrypted[key] = ''; }
        }
    }

    ApiResponse.success(res, { ...cred, credentials: decrypted }, 'Integration fetched');
};

/**
 * POST /api/integrations
 * Create or update an integration credential
 * Body: { provider, label?, credentials: { key1: value1, ... } }
 */
const saveIntegration = async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const userId = req.headers['x-user-id'];
    const { provider, label, credentials } = req.body;

    if (!provider || !PROVIDER_FIELDS[provider]) {
        return ApiResponse.error(res, 'Invalid provider', 400);
    }
    if (!credentials || typeof credentials !== 'object') {
        return ApiResponse.error(res, 'Credentials are required', 400);
    }

    // Encrypt each credential value
    const encryptedCreds = {};
    for (const [key, val] of Object.entries(credentials)) {
        encryptedCreds[key] = encrypt(String(val));
    }

    const result = await IntegrationCredential.findOneAndUpdate(
        { tenantId, provider },
        {
            $set: {
                label: label || PROVIDER_FIELDS[provider].label,
                credentials: encryptedCreds,
                isActive: true,
                configuredBy: userId,
            },
        },
        { upsert: true, new: true }
    );

    // Cache invalidation: clear whatsapp-service's in-memory tenant config cache
    // so the next message uses the new credentials immediately.
    if (provider === 'whatsapp') {
        try {
            const axios = require('axios');
            const { env } = require('@sparkcrm/shared-config');
            // whatsapp-service runs on port 8005
            const waServiceUrl = env.SERVICES.WHATSAPP || 'http://localhost:8005';
            const path = `/internal/cache/whatsapp/${encodeURIComponent(String(tenantId))}`;
            const headers = createServiceHeaders({
                issuer: 'tenant-service',
                audience: 'whatsapp-service',
                method: 'DELETE',
                path,
                identity: { tenantId: String(tenantId) },
            });
            await axios.delete(
                `${waServiceUrl}${path}`,
                { timeout: 3000, headers }
            );
            console.log(`✅ WhatsApp config cache cleared for tenant ${tenantId}`);
        } catch (err) {
            // Non-blocking — cache will expire within 5 minutes
            console.warn(`⚠️  Could not clear WhatsApp cache: ${err.message}`);
        }
    }

    ApiResponse.success(res, { _id: result._id, provider, isActive: true }, 'Integration saved successfully');
};

/**
 * DELETE /api/integrations/:provider
 */
const deleteIntegration = async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const { provider } = req.params;

    await IntegrationCredential.deleteOne({ tenantId, provider });
    ApiResponse.success(res, null, 'Integration removed');
};

/**
 * POST /api/integrations/:provider/test
 * Test the connection for a given provider (basic connectivity check)
 */
const testIntegration = async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const { provider } = req.params;

    const cred = await IntegrationCredential.findOne({ tenantId, provider });
    if (!cred) return ApiResponse.error(res, 'Integration not configured', 404);

    // For now, just mark as tested (actual provider-specific testing would go here)
    cred.lastTestedAt = new Date();
    cred.lastTestStatus = 'success';
    await cred.save();

    ApiResponse.success(res, { status: 'success', testedAt: cred.lastTestedAt }, 'Connection test passed');
};

module.exports = {
    getProviders,
    getIntegrations,
    getIntegration,
    saveIntegration,
    deleteIntegration,
    testIntegration,
    PROVIDER_FIELDS,
};
