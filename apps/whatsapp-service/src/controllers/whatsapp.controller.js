const { WhatsappMessage, Template, ChatbotRule } = require('../models/WhatsappModels');
const { ApiResponse, ApiError, asyncHandler, buildScopeFilter } = require('@sparkcrm/shared-utils');
const { publishEvent, EVENTS } = require('@sparkcrm/shared-events');
const mongoose = require('mongoose');
const whatsappApi = require('../services/whatsappApi.service');
const baileysService = require('../services/baileysSession.service');
const mediaStorage = require('../services/mediaStorage.service');
const realtime = require('../services/realtime.service');
const {
    assertForwardable,
    messagePeerPhone,
    snapshotMessage,
    validateReactionEmoji,
} = require('../services/messageActions.service');

// ─── Message Controller ───

const disableMessageCache = (res) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
};

const sendMessage = asyncHandler(async (req, res) => {
    const tenantId    = req.headers['x-tenant-id'];
    const userId      = req.headers['x-user-id'];
    const branchId    = req.headers['x-user-branch-id'] || req.headers['x-branch-id'];
    const userWhatsapp = req.headers['x-user-whatsapp'];

    const {
        to, content, type, leadId, mediaUrl, mediaObjectKey, mediaName,
        mediaMimeType, mediaSize, templateName, templateComponents, languageCode,
    } = req.body;

    if (!to) throw ApiError.badRequest('Phone number is required');
    if (!content && !mediaUrl && !mediaObjectKey && !templateName) {
        throw ApiError.badRequest('content, mediaUrl, mediaObjectKey, or templateName is required');
    }
    const normalizedTo = whatsappApi.normalizePhone(to);
    let resolvedMediaUrl = mediaUrl;
    let normalizedMediaMimeType = mediaMimeType || null;
    let normalizedMediaSize = mediaSize == null ? null : Number(mediaSize);
    try {
        if (normalizedMediaMimeType) normalizedMediaMimeType = mediaStorage.validateMimeType(normalizedMediaMimeType);
        if (normalizedMediaSize != null) mediaStorage.validateMediaSize(normalizedMediaSize);
        if (mediaObjectKey) {
            const metadata = await mediaStorage.assertMediaExists(mediaObjectKey, tenantId);
            if (metadata.ContentType) normalizedMediaMimeType = mediaStorage.validateMimeType(metadata.ContentType);
            if (metadata.ContentLength != null) normalizedMediaSize = mediaStorage.validateMediaSize(Number(metadata.ContentLength));
            resolvedMediaUrl = await mediaStorage.createSignedMediaUrl(mediaObjectKey, tenantId, {
                mimeType: normalizedMediaMimeType,
                name: mediaName,
            });
        }
    } catch (error) {
        throw ApiError.badRequest(`Invalid media: ${error.message}`);
    }

    // ─── Step 1: Try to send via WhatsApp (Meta API or QR depending on tenant mode) ───
    let waResult = { waMessageId: null, status: 'queued', offline: true };
    try {
        const msgType = type || 'text';
        if (msgType === 'template') {
            if (!templateName) throw new Error('templateName is required for template messages');
            waResult = await whatsappApi.sendTemplateMessage(
                to, templateName, languageCode || 'en', templateComponents || [], tenantId, userId
            );
        } else if (['image', 'video', 'document', 'audio'].includes(msgType)) {
            if (!resolvedMediaUrl) throw new Error('mediaUrl or mediaObjectKey is required for media messages');
            waResult = await whatsappApi.sendMediaMessage(
                to, msgType, resolvedMediaUrl, content || '', tenantId, userId,
                { fileName: mediaName, mimeType: normalizedMediaMimeType }
            );
        } else {
            waResult = await whatsappApi.sendTextMessage(to, content, tenantId, userId);
        }
    } catch (err) {
        // Classify Meta errors for clear user feedback
        const statusCode = err.response?.status;
        let friendlyError = err.message;
        if (statusCode === 401) {
            friendlyError = 'WhatsApp access token has expired. Go to Settings → WhatsApp Setup and enter a new access token.';
        } else if (statusCode === 400) {
            const metaMsg = err.response?.data?.error?.message || err.message;
            friendlyError = `Invalid request: ${metaMsg}`;
        } else if (statusCode === 429) {
            friendlyError = 'WhatsApp rate limit hit — please wait a minute before sending again.';
        }
        waResult = err.deliveryUncertain
            ? { waMessageId: err.waMessageId, status: 'queued', error: friendlyError, offline: false, deliveryUncertain: true }
            : { waMessageId: null, status: 'failed', error: friendlyError, offline: false };
        console.error(`❌ WhatsApp send failed (tenant: ${tenantId}) [HTTP ${statusCode || 'N/A'}]:`, err.message);
    }

    // ─── Step 2: Always save to DB ───
    // Guard: userId must be a valid ObjectId — otherwise store null to avoid validation crash
    const safeUserId = userId && mongoose.Types.ObjectId.isValid(userId) ? userId : null;

    if (waResult.waMessageId && baileysService.consumeMessageConfirmation(tenantId, userId, waResult.waMessageId)) {
        waResult.status = 'sent';
        waResult.deliveryUncertain = false;
    }

    const message = await WhatsappMessage.create({
        tenantId,
        branchId: branchId || null,
        leadId,
        userId: safeUserId,
        direction: 'outbound',
        from: userWhatsapp || 'business',
        to: normalizedTo,
        type: type || 'text',
        content: content || '',
        mediaUrl,
        mediaObjectKey,
        mediaName: mediaName ? mediaStorage.sanitizeMediaName(mediaName) : null,
        mediaMimeType: normalizedMediaMimeType,
        mediaSize: normalizedMediaSize,
        templateName,
        status: waResult.status,
        waMessageId: waResult.waMessageId,
        lastError: waResult.deliveryUncertain ? `Awaiting WhatsApp confirmation: ${waResult.error}` : (waResult.error || ''),
    });

    // Update the connected agent's chat immediately. The dashboard also keeps
    // polling as a fallback if the Socket.IO connection is unavailable.
    baileysService.emitMessageUpdate(tenantId, userId, message);

    // ─── Step 3: Publish events ───
    await publishEvent(EVENTS.WHATSAPP_MESSAGE_SENT, { tenantId, messageId: message._id, leadId });
    if (leadId) {
        await publishEvent(EVENTS.LEAD_UPDATED, {
            tenantId, leadId,
            changes: { lastContactedAt: new Date(), lastActivityAt: new Date() },
        });
    }

    // ─── Step 4: Return appropriate response ───
    if (waResult.status === 'queued') {
        const queuedMessage = waResult.deliveryUncertain
            ? 'Message submitted to WhatsApp; delivery confirmation is pending.'
            : '💾 Message saved. Will be delivered once WhatsApp integration is configured.';
        return ApiResponse.created(res, message, queuedMessage);
    }
    if (waResult.status === 'failed') {
        return ApiResponse.success(res, message, `Message saved but delivery failed: ${waResult.error || 'Unknown error'}`, 207);
    }

    ApiResponse.created(res, message, 'Message sent via WhatsApp');
});

const requireActionIdentity = (req) => {
    const tenantId = req.headers['x-tenant-id'];
    const userId = req.headers['x-user-id'];
    if (!mongoose.isValidObjectId(tenantId) || !mongoose.isValidObjectId(userId)) {
        throw ApiError.unauthorized('Authenticated tenant user identity is required');
    }
    return {
        tenantId,
        userId,
        branchId: req.headers['x-user-branch-id'] || req.headers['x-branch-id'] || null,
        from: req.headers['x-user-whatsapp'] || 'business',
    };
};

const findActionSource = async (req) => {
    if (!mongoose.isValidObjectId(req.params.id)) throw ApiError.badRequest('Invalid source message ID');
    const scope = buildScopeFilter(req, { ownerField: 'userId', module: 'whatsapp' });
    const source = await WhatsappMessage.findOne({ _id: req.params.id, ...scope }).select('+mediaObjectKey');
    if (!source) throw ApiError.notFound('Source message not found in your WhatsApp scope');
    return source;
};

const resolveReplyPayload = async (body, tenantId) => {
    const type = body.type || 'text';
    if (!['text', 'image', 'video', 'audio', 'document'].includes(type)) throw ApiError.badRequest('Unsupported reply type');
    if (type === 'text') {
        const content = String(body.content || '').trim();
        if (!content) throw ApiError.badRequest('Reply content is required');
        return { type, content };
    }

    let mediaUrl = body.mediaUrl || null;
    let mediaMimeType = body.mediaMimeType || null;
    let mediaSize = body.mediaSize == null ? null : Number(body.mediaSize);
    try {
        if (mediaMimeType) mediaMimeType = mediaStorage.validateMimeType(mediaMimeType);
        if (mediaSize != null) mediaSize = mediaStorage.validateMediaSize(mediaSize);
        if (body.mediaObjectKey) {
            const metadata = await mediaStorage.assertMediaExists(body.mediaObjectKey, tenantId);
            if (metadata.ContentType) mediaMimeType = mediaStorage.validateMimeType(metadata.ContentType);
            if (metadata.ContentLength != null) mediaSize = mediaStorage.validateMediaSize(Number(metadata.ContentLength));
            mediaUrl = await mediaStorage.createSignedMediaUrl(body.mediaObjectKey, tenantId, {
                mimeType: mediaMimeType,
                name: body.mediaName,
            });
        }
    } catch (error) {
        throw ApiError.badRequest(`Invalid media: ${error.message}`);
    }
    if (!mediaUrl) throw ApiError.badRequest('mediaUrl or mediaObjectKey is required for a media reply');
    return {
        type,
        content: String(body.content || ''),
        mediaUrl,
        persistedMediaUrl: body.mediaUrl || null,
        mediaObjectKey: body.mediaObjectKey || null,
        mediaName: body.mediaName ? mediaStorage.sanitizeMediaName(body.mediaName) : null,
        mediaMimeType,
        mediaSize,
    };
};

const publishActionEvent = async (message) => {
    const eventData = { tenantId: message.tenantId, messageId: message._id, leadId: message.leadId };
    try {
        await publishEvent(EVENTS.WHATSAPP_MESSAGE_SENT, eventData);
    } catch (error) {
        message.pendingEvents.push({ event: EVENTS.WHATSAPP_MESSAGE_SENT, data: eventData, attempts: 1, lastError: String(error.message || error).slice(0, 1000) });
        await message.save();
    }
};

const persistOutboundAction = async ({ identity, source, to, outbound, result, action }) => {
    if (result.waMessageId && baileysService.consumeMessageConfirmation(identity.tenantId, identity.userId, result.waMessageId)) {
        result.status = 'sent';
        result.deliveryUncertain = false;
    }
    const safeUserId = mongoose.Types.ObjectId.isValid(identity.userId) ? identity.userId : null;
    const message = await WhatsappMessage.create({
        tenantId: identity.tenantId,
        branchId: source.branchId || identity.branchId,
        leadId: source.leadId || null,
        userId: safeUserId,
        direction: 'outbound',
        from: identity.from,
        to,
        type: outbound.type,
        content: outbound.content || '',
        mediaUrl: outbound.persistedMediaUrl || null,
        mediaObjectKey: outbound.mediaObjectKey || null,
        mediaName: outbound.mediaName || null,
        mediaMimeType: outbound.mediaMimeType || null,
        mediaSize: outbound.mediaSize || null,
        status: result.status,
        waMessageId: result.waMessageId || null,
        provider: result.provider,
        providerMetadata: result.providerMetadata || {},
        lastError: result.deliveryUncertain ? 'Awaiting WhatsApp confirmation after an uncertain provider response' : '',
        ...(action === 'reply' ? {
            replyTo: { messageId: source._id, waMessageId: source.waMessageId, snapshot: snapshotMessage(source) },
        } : {
            isForwarded: true,
            forwardedFrom: {
                messageId: source._id,
                waMessageId: source.waMessageId || null,
                provider: source.provider || null,
                mode: result.forwardMode || 'resend',
            },
        }),
    });
    realtime.emitMessage(identity.tenantId, identity.userId, message);
    await publishActionEvent(message);
    return message;
};

const replyToMessage = asyncHandler(async (req, res) => {
    const identity = requireActionIdentity(req);
    const source = await findActionSource(req);
    if (!source.waMessageId) throw ApiError.badRequest('Source message has no provider message ID and cannot be quoted');
    const expectedTo = whatsappApi.normalizePhone(messagePeerPhone(source));
    const to = whatsappApi.normalizePhone(req.body.to || expectedTo);
    if (to !== expectedTo) throw ApiError.badRequest('A reply must target the source message conversation');
    const outbound = await resolveReplyPayload(req.body, identity.tenantId);

    let result;
    try {
        result = await whatsappApi.sendReplyMessage(to, source, outbound, identity.tenantId, identity.userId);
    } catch (error) {
        if (!error.deliveryUncertain) throw error;
        result = { waMessageId: error.waMessageId, status: 'queued', provider: 'baileys', deliveryUncertain: true };
    }
    const message = await persistOutboundAction({ identity, source, to, outbound, result, action: 'reply' });
    return ApiResponse.success(res, message, result.deliveryUncertain ? 'Reply submitted; delivery confirmation is pending' : 'Reply sent', result.deliveryUncertain ? 202 : 201);
});

const forwardMessage = asyncHandler(async (req, res) => {
    const identity = requireActionIdentity(req);
    const source = await findActionSource(req);
    if (!req.body.to) throw ApiError.badRequest('Target phone number is required');
    const to = whatsappApi.normalizePhone(req.body.to);
    try { assertForwardable(source); } catch (error) { throw ApiError.badRequest(error.message); }

    let mediaUrl = source.mediaUrl || null;
    if (source.mediaObjectKey) {
        mediaUrl = await mediaStorage.createSignedMediaUrl(source.mediaObjectKey, identity.tenantId, {
            mimeType: source.mediaMimeType,
            name: source.mediaName,
        });
    }
    const outbound = {
        type: source.type,
        content: source.content,
        mediaUrl,
        persistedMediaUrl: source.mediaUrl || null,
        mediaObjectKey: source.mediaObjectKey || null,
        mediaName: source.mediaName || null,
        mediaMimeType: source.mediaMimeType || null,
        mediaSize: source.mediaSize || null,
    };

    let result;
    try {
        result = await whatsappApi.forwardMessage(to, source, outbound, identity.tenantId, identity.userId);
    } catch (error) {
        if (!error.deliveryUncertain) throw error;
        result = { waMessageId: error.waMessageId, status: 'queued', provider: 'baileys', forwardMode: 'resend', deliveryUncertain: true };
    }
    const message = await persistOutboundAction({ identity, source, to, outbound, result, action: 'forward' });
    return ApiResponse.success(res, message, result.deliveryUncertain ? 'Forward submitted; delivery confirmation is pending' : 'Message forwarded', result.deliveryUncertain ? 202 : 201);
});

const reactToMessage = asyncHandler(async (req, res) => {
    const identity = requireActionIdentity(req);
    const source = await findActionSource(req);
    if (!source.waMessageId) throw ApiError.badRequest('Source message has no provider message ID and cannot be reacted to');
    let emoji;
    try { emoji = validateReactionEmoji(req.body.emoji); } catch (error) { throw ApiError.badRequest(error.message); }

    const actorPhone = identity.from === 'business'
        ? null
        : (() => { try { return whatsappApi.normalizePhone(identity.from); } catch { return null; } })();
    const result = await whatsappApi.sendReaction(source, emoji, identity.tenantId, identity.userId);
    const actorId = String(identity.userId);
    source.reactions = (source.reactions || []).filter(reaction => String(reaction.actorUserId || '') !== actorId || reaction.direction !== 'outbound');
    if (emoji) {
        source.reactions.push({
            actorUserId: identity.userId,
            actorPhone,
            direction: 'outbound',
            emoji,
            provider: result.provider,
            providerMessageId: result.waMessageId || null,
            reactedAt: new Date(),
        });
    }
    await source.save();
    realtime.emitMessage(identity.tenantId, identity.userId, source);
    ApiResponse.success(res, source, emoji ? 'Reaction updated' : 'Reaction removed');
});

const uploadMedia = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const userId = req.headers['x-user-id'];
    if (!mongoose.isValidObjectId(tenantId) || !mongoose.isValidObjectId(userId)) {
        throw ApiError.unauthorized('Authenticated tenant user identity is required');
    }
    const { data, mimeType, name } = req.body || {};
    let buffer;
    let normalizedMimeType;
    try {
        buffer = mediaStorage.decodeBase64Media(data);
        normalizedMimeType = mediaStorage.validateMimeType(mimeType);
    } catch (error) {
        throw ApiError.badRequest(error.message);
    }

    const mediaName = mediaStorage.sanitizeMediaName(name);
    const objectKey = await mediaStorage.uploadPrivateMedia({ buffer, tenantId, mimeType: normalizedMimeType });
    const previewUrl = await mediaStorage.createSignedMediaUrl(objectKey, tenantId, {
        mimeType: normalizedMimeType,
        name: mediaName,
    });
    ApiResponse.created(res, {
        objectKey,
        previewUrl,
        expiresIn: mediaStorage.PREVIEW_URL_TTL_SECONDS,
        name: mediaName,
        mimeType: normalizedMimeType,
        size: buffer.length,
    }, 'Media uploaded');
});

const getMessageMedia = asyncHandler(async (req, res) => {
    disableMessageCache(res);
    const tenantId = req.headers['x-tenant-id'];
    const userId = req.headers['x-user-id'];
    if (!mongoose.isValidObjectId(tenantId) || !mongoose.isValidObjectId(userId)) {
        throw ApiError.unauthorized('Authenticated tenant user identity is required');
    }
    const scope = buildScopeFilter(req, { ownerField: 'userId', module: 'whatsapp' });
    const message = await WhatsappMessage.findOne({ _id: req.params.id, ...scope })
        .select('+mediaObjectKey mediaName mediaMimeType');
    if (!message || !message.mediaObjectKey) throw ApiError.notFound('Message media not found');

    const url = await mediaStorage.createSignedMediaUrl(message.mediaObjectKey, tenantId, {
        mimeType: message.mediaMimeType,
        name: message.mediaName,
        download: req.query.download === '1',
    });
    ApiResponse.success(res, { url, expiresIn: mediaStorage.PREVIEW_URL_TTL_SECONDS });
});

const getChat = asyncHandler(async (req, res) => {
    disableMessageCache(res);
    const tenantId = req.headers['x-tenant-id'];
    const { leadId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    // ── Step 1: Get the lead's phone from the leads DB directly ───────────────
    const { findLeadById, phoneVariants } = require('../services/leadLookup.service');
    let phoneList = [];
    try {
        const lead = await findLeadById(tenantId, leadId);
        if (lead?.phone) phoneList = phoneVariants(lead.phone);
    } catch { /* fall through — leadId-only query */ }

    // ── Step 2: Build query — match by leadId OR by phone ─────────────────────
    // Note: we do NOT add userId scope to the phone conditions because inbound
    // messages may be saved under a different agent's userId.
    const baseFilter = buildScopeFilter(req, { ownerField: 'userId', module: 'whatsapp' });

    const conditions = [
        { ...baseFilter, leadId },                           // outbound (has leadId + userId)
    ];

    if (phoneList.length) {
        // Inbound: `from` = lead's number (no leadId, no userId scope)
        conditions.push({ tenantId, from: { $in: phoneList } });
        // Outbound without scope: `to` = lead's number
        conditions.push({ tenantId, to: { $in: phoneList } });
    }

    const filter = conditions.length === 1 ? conditions[0] : { $or: conditions };

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [messages] = await Promise.all([
        WhatsappMessage.find(filter).sort({ 'meta.createdAt': -1 }).skip(skip).limit(parseInt(limit)),
        WhatsappMessage.countDocuments(filter),
    ]);

    // Deduplicate by waMessageId (same message might match multiple conditions)
    const seen = new Set();
    const unique = messages.filter(m => {
        const key = m.waMessageId || m._id.toString();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    ApiResponse.paginated(res, unique.reverse(), {
        page: parseInt(page), limit: parseInt(limit),
        total: unique.length, totalPages: Math.ceil(unique.length / parseInt(limit)),
    });
});

/**
 * GET /api/whatsapp/inbox
 * Team Inbox — grouped conversations with last message & unread count
 * Fixed: proper grouping, lead name lookup, pagination, branch scoping
 */
const getTeamInbox = asyncHandler(async (req, res) => {
    disableMessageCache(res);
    const { page = 1, limit = 25 } = req.query;

    // Build scope filter
    const scope = buildScopeFilter(req, { ownerField: 'userId', module: 'whatsapp' });
    const matchStage = {};
    if (scope.tenantId) matchStage.tenantId = new mongoose.Types.ObjectId(scope.tenantId);
    if (scope.branchId) matchStage.branchId = new mongoose.Types.ObjectId(scope.branchId);
    if (scope.userId) matchStage.userId = new mongoose.Types.ObjectId(scope.userId);

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const conversations = await WhatsappMessage.aggregate([
        { $match: matchStage },
        { $sort: { 'meta.createdAt': -1 } },
        {
            $group: {
                _id: {
                    $cond: [
                        { $eq: ['$direction', 'inbound'] },
                        '$from',
                        '$to'
                    ]
                },
                lastMessage: { $first: '$$ROOT' },
                messageCount: { $sum: 1 },
                unreadCount: {
                    $sum: {
                        $cond: [
                            {
                                $and: [
                                    { $eq: ['$direction', 'inbound'] },
                                    { $ne: ['$isRead', true] }
                                ]
                            },
                            1, 0
                        ]
                    }
                },
                leadId: { $first: '$leadId' },
            }
        },
        { $sort: { 'lastMessage.createdAt': -1 } },
        // Pagination
        {
            $facet: {
                data: [
                    { $skip: skip },
                    { $limit: parseInt(limit) },
                ],
                total: [
                    { $count: 'count' },
                ],
            },
        },
    ]);

    const data = conversations[0]?.data || [];
    const total = conversations[0]?.total[0]?.count || 0;

    ApiResponse.paginated(res, data, {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
    });
});

/**
 * GET /api/whatsapp/inbox-chat/:phone
 * Fetch all messages exchanged with a specific phone number (for Team Inbox chat panel).
 */
const getInboxChat = asyncHandler(async (req, res) => {
    disableMessageCache(res);
    const tenantId = req.headers['x-tenant-id'];
    const { phone } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const filter = {
        tenantId: new mongoose.Types.ObjectId(tenantId),
        $or: [{ from: phone }, { to: phone }],
    };

    const [messages, total] = await Promise.all([
        WhatsappMessage.find(filter).sort({ 'meta.createdAt': -1 }).skip(skip).limit(parseInt(limit)),
        WhatsappMessage.countDocuments(filter),
    ]);

    ApiResponse.paginated(res, messages.reverse(), {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
    });
});

/**
 * POST /api/whatsapp/inbox-chat/:phone/read
 * Mark all inbound messages from this phone number as read.
 */
const markInboxRead = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const { phone } = req.params;

    const result = await WhatsappMessage.updateMany(
        {
            tenantId: new mongoose.Types.ObjectId(tenantId),
            from: phone,
            direction: 'inbound',
            isRead: false,
        },
        { $set: { isRead: true, readAt: new Date() } }
    );

    ApiResponse.success(res, { updated: result.modifiedCount }, 'Marked as read');
});

const broadcast = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const userId   = req.headers['x-user-id'];
    const { templateName, variableMapping, recipients } = req.body;
    // variableMapping: { "1": "name", "2": "company", ... } — maps {{N}} → lead field

    if (!templateName || !recipients?.length) throw ApiError.badRequest('Template and recipients required');

    // Load template to get variable definitions
    const template = await Template.findOne({ tenantId, name: templateName, isActive: true });
    if (!template) throw ApiError.notFound('Template not found');
    if (template.status !== 'approved') throw ApiError.badRequest('Only approved templates can be broadcast');

    const results = { sent: 0, failed: 0, errors: [] };

    // Process each recipient — throttle at 1 msg / 1.5s to avoid Meta rate limits
    for (const lead of recipients) {
        try {
            // Resolve variable values from lead data using variableMapping
            const parameterValues = (template.variables || [])
                .sort((a, b) => a.index - b.index)
                .map(v => {
                    const fieldName = variableMapping?.[String(v.index)] || v.field || '';
                    const value = lead[fieldName] || v.example || `[${v.label || v.index}]`;
                    return { type: 'text', text: String(value) };
                });

            const components = parameterValues.length > 0
                ? [{ type: 'body', parameters: parameterValues }]
                : [];

            await whatsappApi.sendTemplateMessage(
                lead.phone,
                template.name,
                template.language || 'en',
                components,
                tenantId
            );

            // Save outbound record
            await WhatsappMessage.create({
                tenantId,
                leadId: lead._id || lead.leadId,
                userId,
                direction: 'outbound',
                from: 'business',
                to: lead.phone,
                type: 'template',
                content: template.body,
                templateName: template.name,
                status: 'sent',
            });

            results.sent++;
        } catch (err) {
            results.failed++;
            results.errors.push({ phone: lead.phone, error: err.message });
        }

        // 1.5s throttle between sends
        await new Promise(r => setTimeout(r, 1500));
    }

    ApiResponse.success(res, results, `Broadcast complete: ${results.sent} sent, ${results.failed} failed`);
});

// ─── Template Controller ───

const getTemplates = asyncHandler(async (req, res) => {
    const { page = 1, limit = 25 } = req.query;
    // Build scope filter for branch isolation
    const filter = buildScopeFilter(req, { ownerField: null, module: 'whatsapp' });
    filter.isActive = true;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [templates, total] = await Promise.all([
        Template.find(filter).sort({ 'meta.createdAt': -1 }).skip(skip).limit(parseInt(limit)),
        Template.countDocuments(filter),
    ]);
    ApiResponse.paginated(res, templates, { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / parseInt(limit)) });
});

const createTemplate = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const branchId = req.headers['x-user-branch-id'] || req.headers['x-branch-id'];

    // Normalize category to lowercase to match enum
    const category = (req.body.category || 'utility').toLowerCase();

    // Sanitize variables — ensure it's an array of objects
    let variables = req.body.variables || [];
    if (typeof variables === 'string') {
        try { variables = JSON.parse(variables); } catch { variables = []; }
    }
    variables = Array.isArray(variables) ? variables : [];

    const templateData = { ...req.body, category, variables };

    // Save template to DB first with status 'pending'
    const template = await Template.create({
        ...templateData,
        tenantId,
        branchId: branchId || null,
        status: 'pending',
    });

    // Try to submit to Meta for approval
    try {
        const metaResult = await whatsappApi.submitTemplateToMeta(templateData, tenantId);
        template.waTemplateId = metaResult.waTemplateId;
        template.status = metaResult.status || 'pending';
        await template.save();
        ApiResponse.created(res, template, 'Template created and submitted to WhatsApp for approval. It typically takes a few minutes to hours.');
    } catch (metaErr) {
        await Template.findByIdAndUpdate(template._id, { status: 'draft' });
        template.status = 'draft';
        const isConfigError = metaErr.message?.includes('not configured') || metaErr.message?.includes('credentials');
        const msg = isConfigError
            ? 'Template saved as draft. Configure WhatsApp integration to submit for Meta approval.'
            : `Template saved as draft. Meta submission failed: ${metaErr.message}`;
        ApiResponse.created(res, { ...template.toObject(), _metaError: msg }, msg);
    }
});

// ─── Chatbot Controller ───

const getChatbotRules = asyncHandler(async (req, res) => {
    // Build scope filter for branch isolation
    const filter = buildScopeFilter(req, { ownerField: null, module: 'whatsapp' });
    const rules = await ChatbotRule.find(filter).sort({ priority: -1 });
    ApiResponse.success(res, rules);
});

const createChatbotRule = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const branchId = req.headers['x-user-branch-id'] || req.headers['x-branch-id'];
    const rule = await ChatbotRule.create({ ...req.body, tenantId, branchId: branchId || null });
    ApiResponse.created(res, rule, 'Chatbot rule created');
});

const updateChatbotRuleFn = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const rule = await ChatbotRule.findOneAndUpdate(
        { _id: req.params.id, tenantId }, req.body, { new: true, runValidators: true }
    );
    if (!rule) throw ApiError.notFound('Rule not found');
    ApiResponse.success(res, rule, 'Rule updated');
});

/**
 * POST /api/whatsapp/templates/sync
 * Superadmin-only: Fetch latest template statuses from Meta and update DB.
 */
const syncTemplatesFromMeta = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];

    // Fetch from Meta
    const metaTemplates = await whatsappApi.syncTemplatesFromMeta(tenantId);

    // Update each template's status in the DB
    let updated = 0;
    for (const mt of metaTemplates) {
        const dbStatus = (mt.status || '').toLowerCase(); // 'approved' | 'rejected' | 'pending'
        const result = await Template.findOneAndUpdate(
            { tenantId, waTemplateId: mt.id },
            { status: dbStatus },
            { new: false }
        );
        if (result) updated++;

        // Also try matching by name if waTemplateId isn't set yet
        if (!result) {
            const byName = await Template.findOneAndUpdate(
                { tenantId, name: mt.name, waTemplateId: null },
                { status: dbStatus, waTemplateId: mt.id },
                { new: false }
            );
            if (byName) updated++;
        }
    }

    ApiResponse.success(res, { synced: metaTemplates.length, updated }, `Synced ${metaTemplates.length} templates from Meta, updated ${updated} records.`);
});

// ─── Template Update / Delete ───

const updateTemplate = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];

    // Normalize category and sanitize variables (same as createTemplate)
    const category = req.body.category ? req.body.category.toLowerCase() : undefined;
    let variables = req.body.variables;
    if (typeof variables === 'string') {
        try { variables = JSON.parse(variables); } catch { variables = []; }
    }
    if (!Array.isArray(variables)) variables = undefined;

    const updateData = { ...req.body };
    if (category) updateData.category = category;
    if (variables !== undefined) updateData.variables = variables;

    const template = await Template.findOneAndUpdate(
        { _id: req.params.id, tenantId }, updateData, { new: true }
    );
    if (!template) throw ApiError.notFound('Template not found');
    ApiResponse.success(res, template, 'Template updated');
});

const deleteTemplate = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const template = await Template.findOneAndDelete({ _id: req.params.id, tenantId });
    if (!template) throw ApiError.notFound('Template not found');
    ApiResponse.success(res, null, 'Template deleted');
});

// ─── Chatbot Rule Delete ───

const deleteChatbotRule = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const rule = await ChatbotRule.findOneAndDelete({ _id: req.params.id, tenantId });
    if (!rule) throw ApiError.notFound('Rule not found');
    ApiResponse.success(res, null, 'Rule deleted');
});

module.exports = {
    sendMessage, replyToMessage, forwardMessage, reactToMessage,
    uploadMedia, getMessageMedia, getChat, getTeamInbox, getInboxChat, markInboxRead, broadcast,
    getTemplates, createTemplate, updateTemplate, deleteTemplate, syncTemplatesFromMeta,
    getChatbotRules, createChatbotRule, updateChatbotRuleFn, deleteChatbotRule,
};
