/**
 * WhatsApp API Service — Multi-Mode Routing
 *
 * ARCHITECTURE (per-tenant, 3 modes):
 *   meta_shared    → one registered business number, all agents use it
 *   meta_per_agent → multiple business numbers, each agent has own assigned number
 *   qr             → each agent scans QR code (Baileys — Phase 4)
 *
 * Config is read from TenantWhatsAppConfig (this service's own DB).
 * Cached per-tenant with a 5-minute TTL.
 * Cache cleared when Super Admin saves new config.
 */
const axios = require('axios');
const TenantWhatsAppConfig = require('../models/TenantWhatsAppConfig');
const baileysService = require('./baileysSession.service');
const { buildMetaReactionPayload, buildMetaReplyPayload } = require('./messageActions.service');

const META_API_BASE = 'https://graph.facebook.com/v21.0';

// Per-tenant resolved config cache
// Map<tenantId, { ...resolvedConfig, expiresAt }>
const configCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Normalize phone number to E.164 format required by Meta.
 * Strips spaces, dashes, parentheses. Adds +91 country code if bare 10-digit Indian number.
 * Returns number without leading + as Meta API expects digits only.
 * Examples:
 *   "9328780020"   → "919328780020"
 *   "+919328780020" → "919328780020"
 *   "919328780020"  → "919328780020"
 *   "+1 (555) 234-5678" → "15552345678"
 */
const normalizePhone = (phone) => {
    if (phone === null || phone === undefined) throw new Error('Phone number is required');
    const input = String(phone).trim();
    if (!/^\+?[\d\s().-]+$/.test(input)) throw new Error('Invalid phone number');

    const hasCountryCode = input.startsWith('+');
    const digits = input.replace(/\D/g, '');
    const normalized = !hasCountryCode && /^\d{10}$/.test(digits) ? `91${digits}` : digits;
    if (!/^[1-9]\d{7,14}$/.test(normalized)) throw new Error('Invalid phone number');
    return normalized;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Build a Meta-ready config object from TenantWhatsAppConfig document.
 * Returns { configured: true, mode, accessToken, phoneNumberId, wabaId }
 * or     { configured: false, reason }
 */
const buildMetaConfig = (doc, userId = null) => {
    // mode = 'qr' — Baileys handles sending. Mark as configured so send functions are called.
    // QR mode does not require Meta API access tokens.
    if (doc.mode === 'qr') {
        return { configured: true, mode: 'qr' };
    }

    const accessToken = doc.getDecryptedAccessToken();
    if (!accessToken) {
        return { configured: false, reason: 'Access token missing — save credentials in WhatsApp Setup' };
    }

    if (doc.mode === 'meta_shared') {
        if (!doc.sharedPhoneNumberId) {
            return { configured: false, reason: 'Shared phone number ID missing in WhatsApp Setup' };
        }
        return {
            configured:    true,
            mode:          'meta_shared',
            accessToken,
            phoneNumberId: doc.sharedPhoneNumberId,
            wabaId:        doc.wabaId,
        };
    }

    if (doc.mode === 'meta_per_agent') {
        // Find the number assigned to this specific agent
        const entry = userId
            ? doc.phonePool.find(p => p.assignedUserId?.toString() === userId.toString())
            : null;

        if (entry) {
            return {
                configured:    true,
                mode:          'meta_per_agent',
                accessToken,
                phoneNumberId: entry.phoneNumberId,
                wabaId:        doc.wabaId,
            };
        }

        // Agent has no assigned number — fall back to first available unassigned, or fail
        const fallback = doc.phonePool.find(p => !p.assignedUserId);
        if (fallback) {
            return {
                configured:    true,
                mode:          'meta_per_agent',
                accessToken,
                phoneNumberId: fallback.phoneNumberId,
                wabaId:        doc.wabaId,
                fallback:      true,
            };
        }

        return {
            configured: false,
            reason: 'No WhatsApp number assigned to this agent. Ask your Super Admin to assign one.',
        };
    }

    return { configured: false, reason: 'Invalid WhatsApp mode configured' };
};

// ─── Core config resolver ─────────────────────────────────────────────────────

/**
 * Get resolved WhatsApp config for a tenant (and optionally specific agent).
 * Cached per tenantId+userId combination for 5 minutes.
 *
 * @param {string} tenantId
 * @param {string} [userId]  — required for meta_per_agent to pick the right number
 * @returns {{ configured: boolean, mode?, accessToken?, phoneNumberId?, wabaId? }}
 */
const getConfig = async (tenantId, userId = null) => {
    if (!tenantId) return { configured: false, reason: 'No tenantId' };

    const cacheKey = `${tenantId}:${userId || 'shared'}`;
    const cached   = configCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) return cached;

    try {
        const doc = await TenantWhatsAppConfig.findOne({ tenantId, isActive: true });
        if (!doc) {
            return {
                configured: false,
                reason: 'WhatsApp not set up — go to Settings → WhatsApp Setup',
            };
        }

        const resolved = buildMetaConfig(doc, userId);
        if (resolved.configured) {
            resolved.expiresAt = Date.now() + CACHE_TTL;
            configCache.set(cacheKey, resolved);
        }
        return resolved;

    } catch (err) {
        console.warn(`⚠️  [whatsapp-service] getConfig error for tenant ${tenantId}: ${err.message}`);
        return { configured: false, reason: err.message };
    }
};

/**
 * Invalidate cached config for a tenant (call after config update).
 * @param {string} tenantId
 */
const invalidateCache = (tenantId) => {
    // Clear all cache entries for this tenant (all userId variants)
    for (const key of configCache.keys()) {
        if (key.startsWith(`${tenantId}:`)) configCache.delete(key);
    }
    console.log(`🗑️  [whatsapp-service] Config cache cleared for tenant ${tenantId}`);
};

// ─── Meta API send helpers ────────────────────────────────────────────────────

const metaPost = async (phoneNumberId, payload, accessToken) => {
    try {
        return await axios.post(
            `${META_API_BASE}/${phoneNumberId}/messages`,
            payload,
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                timeout: 15000,
            }
        );
    } catch (err) {
        // Log the full Meta error response for debugging
        if (err.response) {
            const metaErr = err.response.data;
            console.error(`❌ [Meta API ${err.response.status}] Error:`, JSON.stringify(metaErr, null, 2));
        }
        throw err;
    }
};

// ─── Public send functions ────────────────────────────────────────────────────

/**
 * Send a text message.
 * @param {string} toPhoneNumber
 * @param {string} text
 * @param {string} tenantId
 * @param {string} [userId]  — agent sending (needed for meta_per_agent)
 */
const sendTextMessage = async (toPhoneNumber, text, tenantId, userId = null) => {
    const config = await getConfig(tenantId, userId);
    const to = normalizePhone(toPhoneNumber);

    if (!config.configured) {
        console.log(`📥 [queued] Text to ${to}: ${config.reason}`);
        return { waMessageId: null, status: 'queued', offline: true };
    }

    // QR mode — send via Baileys (agent's personal WhatsApp Web session)
    if (config.mode === 'qr') {
        console.log(`📤 [Baileys] Sending text to ${to} for agent ${userId}`);
        return await baileysService.sendTextViaQR(tenantId, userId, to, text);
    }

    console.log(`📤 [Meta] Sending text to ${to} via phone ${config.phoneNumberId}`);
    const res = await metaPost(config.phoneNumberId, {
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: text },
    }, config.accessToken);

    const waMsgId = res.data?.messages?.[0]?.id;
    console.log(`✅ [Meta] Text sent — waMessageId: ${waMsgId}`);
    return { waMessageId: waMsgId, status: 'sent' };
};

/**
 * Send a template message.
 */
const sendTemplateMessage = async (toPhoneNumber, templateName, languageCode = 'en', components = [], tenantId, userId = null) => {
    const config = await getConfig(tenantId, userId);
    const to = normalizePhone(toPhoneNumber);

    if (!config.configured) {
        console.log(`📥 [queued] Template "${templateName}" to ${to}: ${config.reason}`);
        return { waMessageId: null, status: 'queued', offline: true };
    }

    if (config.mode === 'qr') {
        // Template messages not supported in QR mode — send as plain text
        console.log(`📤 [Baileys/template] Sending "${templateName}" as text to ${to}`);
        const body = components?.[0]?.parameters?.map(p => p.text || '').join(' ') || templateName;
        return await baileysService.sendTextViaQR(tenantId, userId, to, body);
    }

    console.log(`📤 [Meta] Sending template "${templateName}" to ${to}`);
    const res = await metaPost(config.phoneNumberId, {
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: { name: templateName, language: { code: languageCode }, components },
    }, config.accessToken);

    return { waMessageId: res.data?.messages?.[0]?.id, status: 'sent' };
};

/**
 * Send a media message (image, document, video, audio).
 */
const sendMediaMessage = async (toPhoneNumber, mediaType, mediaUrl, caption = '', tenantId, userId = null, media = {}) => {
    const config = await getConfig(tenantId, userId);
    const to = normalizePhone(toPhoneNumber);

    if (!config.configured) {
        console.log(`📥 [queued] Media to ${to}: ${config.reason}`);
        return { waMessageId: null, status: 'queued', offline: true };
    }

    if (config.mode === 'qr') {
        return baileysService.sendMediaViaQR(tenantId, userId, to, mediaType, mediaUrl, {
            caption,
            fileName: media.fileName,
            mimeType: media.mimeType,
        });
    }

    const mediaPayload = { link: mediaUrl };
    if (caption && ['image', 'video', 'document'].includes(mediaType)) mediaPayload.caption = caption;
    if (media.fileName && mediaType === 'document') mediaPayload.filename = media.fileName;

    const res = await metaPost(config.phoneNumberId, {
        messaging_product: 'whatsapp',
        to,
        type: mediaType,
        [mediaType]: mediaPayload,
    }, config.accessToken);

    return { waMessageId: res.data?.messages?.[0]?.id, status: 'sent' };
};

const buildCloudContentPayload = ({ type = 'text', content = '', mediaUrl, mediaName }) => {
    if (type === 'text') return { type: 'text', text: { body: content } };
    if (!['image', 'video', 'audio', 'document'].includes(type) || !mediaUrl) {
        throw new Error('Unsupported or incomplete WhatsApp message payload');
    }
    const media = { link: mediaUrl };
    if (content && ['image', 'video', 'document'].includes(type)) media.caption = content;
    if (type === 'document' && mediaName) media.filename = mediaName;
    return { type, [type]: media };
};

const requireActionConfig = async (tenantId, userId) => {
    const config = await getConfig(tenantId, userId);
    if (!config.configured) throw new Error(`WhatsApp is not connected: ${config.reason}`);
    return config;
};

const sendReplyMessage = async (toPhoneNumber, source, outbound, tenantId, userId = null) => {
    const config = await requireActionConfig(tenantId, userId);
    const to = normalizePhone(toPhoneNumber);
    if (!source?.provider?.waMessageId) throw new Error('The source message cannot be replied to because it has no provider message ID');
    const provider = config.mode === 'qr' ? 'baileys' : 'cloud';
    if (source.provider?.name && source.provider.name !== provider) throw new Error('The source message belongs to a different WhatsApp provider connection');
    if (config.mode === 'qr') return baileysService.sendReplyViaQR(tenantId, userId, to, source, outbound);

    const payload = buildMetaReplyPayload(to, source.provider.waMessageId, buildCloudContentPayload(outbound));
    const res = await metaPost(config.phoneNumberId, payload, config.accessToken);
    return {
        waMessageId: res.data?.messages?.[0]?.id,
        status: 'sent',
        provider: 'cloud',
        providerMetadata: { phoneNumberId: config.phoneNumberId, contextMessageId: source.provider.waMessageId },
    };
};

const sendReaction = async (source, emoji, tenantId, userId = null) => {
    const config = await requireActionConfig(tenantId, userId);
    const to = normalizePhone(source.message?.direction === 'inbound' ? source.message?.from : source.message?.to);
    const provider = config.mode === 'qr' ? 'baileys' : 'cloud';
    if (source.provider?.name && source.provider.name !== provider) throw new Error('The source message belongs to a different WhatsApp provider connection');
    if (config.mode === 'qr') return baileysService.sendReactionViaQR(tenantId, userId, to, source, emoji);

    const payload = buildMetaReactionPayload(to, source.provider.waMessageId, emoji);
    const res = await metaPost(config.phoneNumberId, payload, config.accessToken);
    return {
        waMessageId: res.data?.messages?.[0]?.id || null,
        status: 'sent',
        provider: 'cloud',
        providerMetadata: { phoneNumberId: config.phoneNumberId, reactionToMessageId: source.provider.waMessageId },
    };
};

const forwardMessage = async (toPhoneNumber, source, outbound, tenantId, userId = null) => {
    const config = await requireActionConfig(tenantId, userId);
    const to = normalizePhone(toPhoneNumber);
    if (config.mode === 'qr') return baileysService.forwardViaQR(tenantId, userId, to, source, outbound);

    // Cloud API has no native forward flag. Sending the original content is the
    // only truthful implementation; durable metadata records that it was a resend.
    const res = await metaPost(config.phoneNumberId, {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        ...buildCloudContentPayload(outbound),
    }, config.accessToken);
    return {
        waMessageId: res.data?.messages?.[0]?.id,
        status: 'sent',
        provider: 'cloud',
        forwardMode: 'resend',
        providerMetadata: { phoneNumberId: config.phoneNumberId },
    };
};

/**
 * Submit a new template to Meta for approval.
 */
const submitTemplateToMeta = async (templateData, tenantId) => {
    const config = await getConfig(tenantId);

    if (!config.configured) {
        throw new Error(`WhatsApp not configured: ${config.reason}`);
    }
    if (!config.wabaId) {
        throw new Error('WhatsApp Business Account ID (wabaId) is not configured.');
    }

    const { name, category = 'UTILITY', language = 'en', body, header, footer, buttons = [] } = templateData;

    const components = [];
    if (header?.text) {
        components.push({ type: 'HEADER', format: 'TEXT', text: header.text });
    }

    const bodyComponent = { type: 'BODY', text: body };
    const variableExamples = (templateData.variables || [])
        .sort((a, b) => (a.index || 0) - (b.index || 0))
        .map(v => v.example || `[${v.label || `var${v.index}`}]`);
    if (variableExamples.length > 0) {
        bodyComponent.example = { body_text: [variableExamples] };
    }
    components.push(bodyComponent);

    if (footer) components.push({ type: 'FOOTER', text: footer });

    if (buttons.length > 0) {
        components.push({
            type: 'BUTTONS',
            buttons: buttons.map(b => ({
                type: b.type || 'QUICK_REPLY',
                text: b.text,
                ...(b.url ? { url: b.url } : {}),
                ...(b.phoneNumber ? { phone_number: b.phoneNumber } : {}),
            })),
        });
    }

    const res = await axios.post(
        `https://graph.facebook.com/v21.0/${config.wabaId}/message_templates`,
        {
            name: name.toLowerCase().replace(/\s+/g, '_'),
            category: category.toUpperCase(),
            language,
            components,
        },
        {
            headers: {
                Authorization: `Bearer ${config.accessToken}`,
                'Content-Type': 'application/json',
            },
            timeout: 20000,
        }
    );

    return {
        waTemplateId: res.data?.id,
        status: (res.data?.status || 'PENDING').toLowerCase(),
    };
};

/**
 * Sync template approval statuses from Meta.
 */
const syncTemplatesFromMeta = async (tenantId) => {
    const config = await getConfig(tenantId);

    if (!config.configured) {
        throw new Error('WhatsApp is not configured. Please set up your WhatsApp Business integration first.');
    }
    if (!config.wabaId) {
        throw new Error('WhatsApp Business Account ID (wabaId) is not configured.');
    }

    const res = await axios.get(
        `https://graph.facebook.com/v21.0/${config.wabaId}/message_templates`,
        {
            params: { fields: 'id,name,status,category,language', limit: 100 },
            headers: { Authorization: `Bearer ${config.accessToken}` },
            timeout: 15000,
        }
    );

    return res.data?.data || [];
};

/**
 * Mark a message as read.
 */
const markAsRead = async (waMessageId, tenantId) => {
    const config = await getConfig(tenantId);
    if (!config.configured || config.mode === 'qr') return;

    await metaPost(config.phoneNumberId, {
        messaging_product: 'whatsapp',
        status:            'read',
        message_id:        waMessageId,
    }, config.accessToken);
};

module.exports = {
    normalizePhone,
    getConfig,
    invalidateCache,
    sendTextMessage,
    sendTemplateMessage,
    sendMediaMessage,
    sendReplyMessage,
    sendReaction,
    forwardMessage,
    buildCloudContentPayload,
    markAsRead,
    submitTemplateToMeta,
    syncTemplatesFromMeta,
};
