const crypto = require('node:crypto');
const express = require('express');
const router = express.Router();
const { WhatsappMessage, ChatbotRule } = require('../models/WhatsappModels');
const TenantWhatsAppConfig = require('../models/TenantWhatsAppConfig');
const { publishEvent, EVENTS } = require('@sparkcrm/shared-events');
const { asyncHandler } = require('@sparkcrm/shared-utils');
const { env } = require('@sparkcrm/shared-config');
const whatsappApi = require('../services/whatsappApi.service');
const realtime = require('../services/realtime.service');
const { snapshotMessage } = require('../services/messageActions.service');
const { findLeadByPhone } = require('../services/leadLookup.service');

/**
 * GET /webhooks/whatsapp
 * Meta webhook verification challenge
 */
router.get('/whatsapp', (req, res) => {
    const mode      = req.query['hub.mode'];
    const token     = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const verifyToken = env.WABA_WEBHOOK_VERIFY_TOKEN || process.env.WABA_WEBHOOK_VERIFY_TOKEN;

    if (!verifyToken) {
        console.error('WhatsApp webhook challenge verification is not configured');
        return res.sendStatus(503);
    }
    if (mode === 'subscribe' && token === verifyToken) {
        console.log('✅ WhatsApp webhook verified');
        return res.status(200).send(challenge);
    }
    console.warn('WhatsApp webhook challenge verification failed');
    return res.sendStatus(403);
});

// ─── Phone number ID → tenant cache ──────────────────────────────────────────
// Avoids DB hit on every webhook event. TTL: 5 minutes.
const phoneCache = new Map(); // phoneNumberId → { tenantId, branchId, expiresAt }
const CACHE_TTL  = 5 * 60 * 1000;
const MAX_SIGNATURE_CONFIG_LOOKUPS = 20;

const rawMetaJson = express.raw({
    type: 'application/json',
    limit: '2mb',
});

const extractPhoneNumberIds = (body) => {
    const ids = new Set();
    for (const entry of body?.entry || []) {
        for (const change of entry?.changes || []) {
            const phoneNumberId = change?.value?.metadata?.phone_number_id;
            if (phoneNumberId) ids.add(String(phoneNumberId));
            if (ids.size >= MAX_SIGNATURE_CONFIG_LOOKUPS) return [...ids];
        }
    }
    return [...ids];
};

const configuredGlobalAppSecret = () => (
    process.env.WABA_APP_SECRET
    || process.env.META_APP_SECRET
    || process.env.FACEBOOK_APP_SECRET
    || ''
);

const resolveWebhookSecrets = async (body) => {
    const globalSecret = configuredGlobalAppSecret();
    if (globalSecret) return [globalSecret];

    const secrets = new Set();
    for (const phoneNumberId of extractPhoneNumberIds(body)) {
        const config = await TenantWhatsAppConfig.findOne({
            isActive: true,
            $or: [
                { sharedPhoneNumberId: phoneNumberId },
                { 'phonePool.phoneNumberId': phoneNumberId },
            ],
        });
        const secret = config?.getDecryptedAppSecret?.();
        if (secret) secrets.add(secret);
    }
    return [...secrets];
};

const verifyMetaSignature = (rawBody, signatureHeader, secrets) => {
    const match = /^sha256=([a-f\d]{64})$/i.exec(String(signatureHeader || '').trim());
    if (!Buffer.isBuffer(rawBody) || !match || !Array.isArray(secrets)) return false;

    const supplied = Buffer.from(match[1], 'hex');
    return secrets.some((secret) => {
        const expected = crypto.createHmac('sha256', secret).update(rawBody).digest();
        return supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);
    });
};

const authenticateAndParseMetaWebhook = async (req, res, next) => {
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
        return res.status(400).json({ success: false, message: 'A raw Meta webhook body is required' });
    }

    const signature = req.headers['x-hub-signature-256'];
    if (!/^sha256=[a-f\d]{64}$/i.test(String(signature || '').trim())) {
        return res.status(401).json({ success: false, message: 'Invalid Meta webhook signature' });
    }

    let parsedBody;
    try {
        parsedBody = JSON.parse(req.body.toString('utf8'));
    } catch {
        return res.status(400).json({ success: false, message: 'Meta webhook body must be valid JSON' });
    }

    try {
        const secrets = await resolveWebhookSecrets(parsedBody);
        if (secrets.length === 0) {
            return res.status(503).json({
                success: false,
                message: 'Meta webhook signature verification is not configured',
            });
        }
        if (!verifyMetaSignature(req.body, signature, secrets)) {
            return res.status(401).json({ success: false, message: 'Invalid Meta webhook signature' });
        }
    } catch (error) {
        console.error('Meta webhook signature configuration lookup failed:', error.message);
        return res.status(503).json({
            success: false,
            message: 'Meta webhook signature verification is temporarily unavailable',
        });
    }

    req.rawBody = req.body;
    req.body = parsedBody;
    return next();
};

/**
 * Resolve tenantId from a Meta phoneNumberId using TenantWhatsAppConfig.
 * Supports both meta_shared and meta_per_agent modes.
 */
const resolveTenantFromPhoneNumberId = async (phoneNumberId) => {
    if (!phoneNumberId) return null;

    // Cache hit
    const cached = phoneCache.get(phoneNumberId);
    if (cached && Date.now() < cached.expiresAt) return cached;

    try {
        // Search for a tenant whose config references this phoneNumberId
        const config = await TenantWhatsAppConfig.findOne({
            isActive: true,
            $or: [
                { sharedPhoneNumberId: phoneNumberId },
                { 'phonePool.phoneNumberId': phoneNumberId },
            ],
        }).lean();

        if (!config) {
            console.warn(`⚠️ Webhook: no tenant found for phoneNumberId=${phoneNumberId}`);
            return null;
        }

        const assignedEntry = config.phonePool?.find(entry => entry.phoneNumberId === phoneNumberId);
        const entry = {
            tenantId: String(config.tenantId),
            branchId: config.branchId ? String(config.branchId) : null,
            userId: assignedEntry?.assignedUserId ? String(assignedEntry.assignedUserId) : null,
            expiresAt: Date.now() + CACHE_TTL,
        };
        phoneCache.set(phoneNumberId, entry);
        console.log(`✅ Webhook resolved phoneNumberId ${phoneNumberId} → tenantId ${entry.tenantId}`);
        return entry;
    } catch (err) {
        console.error(`❌ Webhook tenant lookup error for phoneNumberId ${phoneNumberId}:`, err.message);
        return null;
    }
};

/**
 * Extract text content from a Meta message object regardless of type.
 */
const extractContent = (msg) => {
    switch (msg.type) {
        case 'text':        return msg.text?.body || '';
        case 'image':       return msg.image?.caption || '[Image]';
        case 'video':       return msg.video?.caption || '[Video]';
        case 'audio':       return '[Voice message]';
        case 'document':    return msg.document?.filename || '[Document]';
        case 'sticker':     return '[Sticker]';
        case 'location':    return `[Location: ${msg.location?.latitude}, ${msg.location?.longitude}]`;
        case 'contacts':    return '[Contact card]';
        case 'interactive': return msg.interactive?.button_reply?.title || msg.interactive?.list_reply?.title || '[Interactive reply]';
        default:            return '';
    }
};

/**
 * Extract a media URL from a Meta message (if any).
 * The real download URL requires a separate API call with the media ID —
 * we store the media ID here and can resolve it later.
 */
const extractMediaUrl = (msg) => {
    const media = msg.image || msg.video || msg.audio || msg.document || msg.sticker;
    if (!media) return null;
    // Store as a retrievable reference: `meta:/<mediaId>`
    return media.url || (media.id ? `meta:/media/${media.id}` : null);
};

/**
 * POST /webhooks/whatsapp
 * Receive all events from Meta: inbound messages + status updates.
 * ALWAYS returns 200 immediately so Meta doesn't retry.
 */
router.post(
    '/whatsapp',
    rawMetaJson,
    authenticateAndParseMetaWebhook,
    asyncHandler(async (req, res) => {
        // Respond 200 immediately — Meta will retry if we take too long or return non-200
        res.sendStatus(200);

        const body = req.body;
        if (!body.entry?.[0]?.changes?.[0]?.value) return;

        const value         = body.entry[0].changes[0].value;
        const phoneNumberId = value.metadata?.phone_number_id;
        const bizNumber     = value.metadata?.display_phone_number || '';

        // ─── Resolve tenant ───────────────────────────────────────────────────
        const tenantInfo = await resolveTenantFromPhoneNumberId(phoneNumberId);
        if (!tenantInfo) {
            // No tenant owns this phone number — ignore silently
            return;
        }
        const { tenantId, branchId, userId } = tenantInfo;

        // ─── Status updates (sent → delivered → read) ─────────────────────────
        if (value.statuses?.length) {
            for (const status of value.statuses) {
                const statusMap = { sent: 'sent', delivered: 'delivered', read: 'read', failed: 'failed' };
                const mappedStatus = statusMap[status.status];
                if (!mappedStatus) continue;

                const updateFields = { 'delivery.status': mappedStatus };
                if (mappedStatus === 'sent') updateFields['delivery.sentAt'] = new Date();
                if (mappedStatus === 'delivered') updateFields['delivery.deliveredAt'] = new Date();
                if (mappedStatus === 'failed') updateFields['delivery.failedAt'] = new Date();
                if (mappedStatus === 'read') {
                    updateFields['readState.isRead'] = true;
                    updateFields['readState.readAt'] = new Date();
                    updateFields['delivery.whatsappReadAt'] = new Date();
                }

                try {
                    const updated = await WhatsappMessage.findOneAndUpdate(
                        { tenantId, 'provider.waMessageId': status.id },
                        { $set: updateFields },
                        { new: true }
                    );
                    if (updated) {
                        console.log(`✅ Status update: ${status.id} → ${mappedStatus}`);
                    } else {
                        console.warn(`⚠️ Status update: no message found for waMessageId=${status.id}`);
                    }
                } catch (err) {
                    console.error(`❌ Status update failed for ${status.id}:`, err.message);
                }
            }
        }

        // ─── Inbound messages ─────────────────────────────────────────────────
        if (value.messages?.length) {
            for (const msg of value.messages) {
                if (msg.type === 'reaction' && msg.reaction?.message_id) {
                    try {
                        const source = await WhatsappMessage.findOne({ tenantId, 'provider.waMessageId': msg.reaction.message_id });
                        if (source) {
                            source.reactions = (source.reactions || []).filter(reaction =>
                                !(reaction.direction === 'inbound' && reaction.actorPhone === msg.from)
                            );
                            if (msg.reaction.emoji) {
                                source.reactions.push({
                                    actorPhone: msg.from,
                                    direction: 'inbound',
                                    emoji: String(msg.reaction.emoji).slice(0, 32),
                                    provider: 'cloud',
                                    providerMessageId: msg.id || null,
                                    reactedAt: new Date(),
                                });
                            }
                            await source.save();
                            if (userId) realtime.emitMessage(tenantId, userId, source);
                        }
                    } catch (error) {
                        console.error('❌ Failed to persist Cloud API reaction:', error.message);
                    }
                    continue;
                }

                const content  = extractContent(msg);
                const mediaUrl = extractMediaUrl(msg);

                console.log(`💬 Inbound from ${msg.from} (tenant ${tenantId}): ${msg.type} — "${content.slice(0, 60)}"`);

                // Deduplicate: skip if we already stored this waMessageId
                const exists = await WhatsappMessage.exists({ tenantId, 'provider.waMessageId': msg.id });
                if (exists) {
                    console.log(`⏭️  Duplicate webhook — waMessageId ${msg.id} already stored`);
                    continue;
                }

                const lead = await findLeadByPhone(tenantId, msg.from);
                if (!lead) {
                    console.log(`📩 [Cloud API] Ignored message from ${msg.from} (not a lead)`);
                    continue;
                }

                let savedMessage;
                try {
                    const referencedMessage = msg.context?.id
                        ? await WhatsappMessage.findOne({ tenantId, 'provider.waMessageId': msg.context.id })
                        : null;
                    savedMessage = await WhatsappMessage.create({
                        tenantId,
                        branchId,
                        userId,
                        message: {
                            direction:   'inbound',
                            from:        msg.from,
                            to:          bizNumber,
                            type:        msg.type || 'text',
                            content,
                        },
                        media: {
                            mediaUrl,
                        },
                        provider: {
                            waMessageId: msg.id,
                            name: 'cloud',
                            providerMetadata: { phoneNumberId }
                        },
                        replyTo: msg.context?.id ? {
                            messageId: referencedMessage?._id || null,
                            waMessageId: msg.context.id,
                            snapshot: referencedMessage ? snapshotMessage(referencedMessage) : null,
                        } : null,
                        isForwarded: msg.context?.forwarded || false,
                        delivery: {
                            status: 'received'
                        },
                    });
                } catch (err) {
                    console.error(`❌ Failed to save inbound message from ${msg.from}:`, err.message);
                    continue;
                }

                if (userId) realtime.emitMessage(tenantId, userId, savedMessage);

                // Publish event so other services can react (e.g. notification service)
                try {
                    await publishEvent(EVENTS.WHATSAPP_MESSAGE_RECEIVED, {
                        tenantId,
                        branchId,
                        messageId: savedMessage._id,
                        from:      msg.from,
                        type:      msg.type,
                        content,
                    });
                } catch (err) {
                    console.warn('⚠️ Event publish failed (non-critical):', err.message);
                }

                // ─── Chatbot auto-reply (text only) ──────────────────────────
                if (msg.type === 'text' && content.trim()) {
                    try {
                        const matchedRule = await ChatbotRule.findOne({
                            tenantId,
                            isActive: true,
                            $or: [
                                {
                                    matchType: 'exact',
                                    triggerKeyword: content.trim().toLowerCase(),
                                },
                                {
                                    matchType: 'contains',
                                    $expr: {
                                        $gt: [
                                            { $indexOfCP: [{ $toLower: content }, { $toLower: '$triggerKeyword' }] },
                                            -1,
                                        ],
                                    },
                                },
                                {
                                    matchType: 'startsWith',
                                    $expr: {
                                        $eq: [
                                            { $indexOfCP: [{ $toLower: content }, { $toLower: '$triggerKeyword' }] },
                                            0,
                                        ],
                                    },
                                },
                            ],
                        }).sort({ priority: -1 });

                        if (matchedRule) {
                            console.log(`🤖 Chatbot matched: "${matchedRule.triggerKeyword}" → ${matchedRule.responseType}`);

                            let replyResult = { waMessageId: null, status: 'failed' };
                            if (matchedRule.responseType === 'template' && matchedRule.templateName) {
                                replyResult = await whatsappApi.sendTemplateMessage(
                                    msg.from, matchedRule.templateName, 'en', [], tenantId
                                );
                            } else {
                                replyResult = await whatsappApi.sendTextMessage(
                                    msg.from, matchedRule.responseContent, tenantId
                                );
                            }

                            await WhatsappMessage.create({
                                tenantId,
                                branchId,
                                message: {
                                    direction:    'outbound',
                                    from:         bizNumber,
                                    to:           msg.from,
                                    type:         matchedRule.responseType === 'template' ? 'template' : 'text',
                                    content:      matchedRule.responseContent,
                                },
                                templateName: matchedRule.responseType === 'template' ? matchedRule.templateName : null,
                                delivery: { status: replyResult.status },
                                provider: {
                                    waMessageId: replyResult.waMessageId,
                                    name: 'cloud'
                                },
                            });
                        }
                    } catch (chatbotErr) {
                        // Chatbot errors must never break the inbound flow
                        console.error('❌ Chatbot auto-reply error:', chatbotErr.message);
                    }
                }
            }
        }
    })
);

module.exports = router;
module.exports.authenticateAndParseMetaWebhook = authenticateAndParseMetaWebhook;
module.exports.extractPhoneNumberIds = extractPhoneNumberIds;
module.exports.resolveWebhookSecrets = resolveWebhookSecrets;
module.exports.verifyMetaSignature = verifyMetaSignature;
