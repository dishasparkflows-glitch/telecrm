const TenantWhatsAppConfig = require('../models/TenantWhatsAppConfig');
const { ApiResponse, ApiError, asyncHandler } = require('@sparkcrm/shared-utils');
const { encrypt } = require('@sparkcrm/shared-utils');
const axios = require('axios');


// Sensitive fields that must be encrypted before storing
const SENSITIVE_FIELDS = ['accessToken', 'appSecret'];

// ──────────────────────────────────────────────────────────────────────────────
// GET /whatsapp/config
// Returns this tenant's WhatsApp config (credentials masked for display)
// ──────────────────────────────────────────────────────────────────────────────
const getConfig = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];

    const config = await TenantWhatsAppConfig.findOne({ tenantId });
    if (!config) {
        return ApiResponse.success(res, null, 'No WhatsApp configuration found');
    }

    ApiResponse.success(res, config.toSafeObject(), 'WhatsApp config fetched');
});

// ──────────────────────────────────────────────────────────────────────────────
// PUT /whatsapp/config
// Save or update this tenant's WhatsApp config
// Body: { mode, wabaId?, accessToken?, appId?, appSecret?, verifyToken?,
//         sharedPhoneNumberId?, sharedPhoneDisplay?, isActive? }
// ──────────────────────────────────────────────────────────────────────────────
const saveConfig = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const userId   = req.headers['x-user-id'];

    const {
        mode, wabaId, accessToken, appId, appSecret, verifyToken,
        sharedPhoneNumberId, sharedPhoneDisplay, isActive,
    } = req.body;

    if (!mode || !['meta_shared', 'meta_per_agent', 'qr'].includes(mode)) {
        throw ApiError.badRequest('mode is required: meta_shared | meta_per_agent | qr');
    }

    // Validate required fields per mode
    if (mode === 'meta_shared') {
        if (!sharedPhoneNumberId) throw ApiError.badRequest('sharedPhoneNumberId is required for meta_shared mode');
    }
    if (['meta_shared', 'meta_per_agent'].includes(mode)) {
        if (!wabaId) throw ApiError.badRequest('wabaId is required for Meta API modes');
    }

    let config = await TenantWhatsAppConfig.findOne({ tenantId });
    if (!config) {
        config = new TenantWhatsAppConfig({ tenantId });
    }

    // Always update mode and non-sensitive fields
    config.mode = mode;
    if (wabaId !== undefined) config.wabaId = wabaId;
    if (appId !== undefined)  config.appId  = appId;
    if (verifyToken !== undefined) config.verifyToken = verifyToken;
    if (sharedPhoneNumberId !== undefined) config.sharedPhoneNumberId = sharedPhoneNumberId;
    if (sharedPhoneDisplay !== undefined)  config.sharedPhoneDisplay  = sharedPhoneDisplay;
    if (typeof isActive === 'boolean') config.isActive = isActive;
    config.configuredBy = userId;

    // Encrypt sensitive fields — skip if value is masked (••••••) or empty
    if (accessToken && !accessToken.includes('••••••')) {
        config.accessToken = encrypt(accessToken);
    }
    if (appSecret && !appSecret.includes('••••••')) {
        config.appSecret = encrypt(appSecret);
    }

    // Reset test status when config changes
    config.testStatus  = 'untested';
    config.testMessage = '';

    await config.save();

    // Clear whatsapp-service's in-memory cache for this tenant
    // (done in-process — the controller is inside whatsapp-service)
    try {
        const whatsappApiService = require('../services/whatsappApi.service');
        whatsappApiService.invalidateCache(tenantId);
    } catch {
        // Non-blocking
    }

    ApiResponse.success(res, config.toSafeObject(), 'WhatsApp configuration saved');
});

// ──────────────────────────────────────────────────────────────────────────────
// POST /whatsapp/config/test
// Test Meta API connection using stored credentials
// ──────────────────────────────────────────────────────────────────────────────
const testConfig = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];

    const config = await TenantWhatsAppConfig.findOne({ tenantId });
    if (!config) throw ApiError.notFound('No WhatsApp config found. Save first.');

    if (config.mode === 'qr') {
        // QR mode has nothing to test via Meta API
        ApiResponse.success(res, {
            testStatus: 'success',
            testMessage: 'QR mode selected — agents connect by scanning QR codes. No API test needed.',
        }, 'Test skipped (QR mode)');
        return;
    }

    const accessToken = config.getDecryptedAccessToken();
    if (!accessToken) {
        throw ApiError.badRequest('Access Token is missing. Save your credentials first.');
    }

    let testStatus  = 'failed';
    let testMessage = '';

    try {
        const phoneId = config.sharedPhoneNumberId ||
            (config.phonePool?.[0]?.phoneNumberId) || config.wabaId;

        const metaRes = await axios.get(
            `https://graph.facebook.com/v21.0/${phoneId}`,
            { headers: { Authorization: `Bearer ${accessToken}` }, timeout: 10000 }
        );

        testStatus  = 'success';
        testMessage = `Connected! Phone: ${metaRes.data.display_phone_number || phoneId} (${metaRes.data.verified_name || 'Business'})`;
    } catch (err) {
        testStatus = 'failed';
        const statusCode = err.response?.status;
        const metaMsg    = err.response?.data?.error?.message || '';

        if (statusCode === 401) {
            testMessage = '⚠️ Access Token Expired — your Meta access token is no longer valid. Go to Meta Developer Console → WhatsApp → API Setup → generate a new System User Access Token (set Never Expire), then paste it here and save.';
        } else if (statusCode === 400) {
            testMessage = `Bad Request — Phone Number ID or WABA ID may be incorrect. Meta says: ${metaMsg}`;
        } else if (statusCode === 403) {
            testMessage = `Permission denied — your app may not have the required WhatsApp permissions. Meta says: ${metaMsg}`;
        } else {
            testMessage = metaMsg || err.message || 'Connection test failed';
        }
    }

    config.testStatus  = testStatus;
    config.testMessage = testMessage;
    config.lastTestedAt = new Date();
    await config.save();

    ApiResponse.success(res, { testStatus, testMessage, lastTestedAt: config.lastTestedAt }, `Test ${testStatus}`);
});

// ──────────────────────────────────────────────────────────────────────────────
// DELETE /whatsapp/config
// Remove WhatsApp configuration for this tenant
// ──────────────────────────────────────────────────────────────────────────────
const deleteConfig = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    await TenantWhatsAppConfig.deleteOne({ tenantId });

    // Clear cache
    try {
        const whatsappApiService = require('../services/whatsappApi.service');
        whatsappApiService.invalidateCache(tenantId);
    } catch {}

    ApiResponse.success(res, null, 'WhatsApp configuration removed');
});

// ──────────────────────────────────────────────────────────────────────────────
// PUT /whatsapp/config/phone-pool
// (meta_per_agent mode) Add/remove numbers and assign to agents
// Body: { action: 'add'|'remove'|'assign'|'unassign', phoneNumberId, phoneDisplay?, userId? }
// ──────────────────────────────────────────────────────────────────────────────
const managePhonePool = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const { action, phoneNumberId, phoneDisplay, userId, userName } = req.body;

    const config = await TenantWhatsAppConfig.findOne({ tenantId });
    if (!config) throw ApiError.notFound('No WhatsApp config found');
    if (config.mode !== 'meta_per_agent') {
        throw ApiError.badRequest('Phone pool is only available in meta_per_agent mode');
    }

    if (action === 'add') {
        if (!phoneNumberId) throw ApiError.badRequest('phoneNumberId is required');
        const exists = config.phonePool.find(p => p.phoneNumberId === phoneNumberId);
        if (exists) throw ApiError.badRequest('This phone number is already in the pool');
        config.phonePool.push({ phoneNumberId, phoneDisplay: phoneDisplay || '' });

    } else if (action === 'remove') {
        config.phonePool = config.phonePool.filter(p => p.phoneNumberId !== phoneNumberId);

    } else if (action === 'assign') {
        const entry = config.phonePool.find(p => p.phoneNumberId === phoneNumberId);
        if (!entry) throw ApiError.notFound('Phone number not found in pool');
        entry.assignedUserId   = userId || null;
        entry.assignedUserName = userName || '';

    } else if (action === 'unassign') {
        const entry = config.phonePool.find(p => p.phoneNumberId === phoneNumberId);
        if (!entry) throw ApiError.notFound('Phone number not found in pool');
        entry.assignedUserId   = null;
        entry.assignedUserName = '';

    } else {
        throw ApiError.badRequest('action must be: add | remove | assign | unassign');
    }

    await config.save();
    ApiResponse.success(res, config.toSafeObject(), 'Phone pool updated');
});

module.exports = { getConfig, saveConfig, testConfig, deleteConfig, managePhonePool };
