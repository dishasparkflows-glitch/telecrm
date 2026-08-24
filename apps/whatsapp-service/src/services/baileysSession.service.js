/**
 * baileysSession.service.js
 * 
 * Manages per-agent WhatsApp Web sessions using Baileys.
 * Each agent (identified by tenantId + userId) gets their own session.
 * Sessions persist across server restarts via saved auth files.
 */

const path = require('path');
const fs   = require('fs');

// Baileys uses ESM — import it dynamically to stay CJS-compatible
let makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers, fetchLatestWaWebVersion, jidNormalizedUser, generateMessageIDV2, downloadMediaMessage, extractMessageContent;
let cachedWaVersion = null;
let cachedWaVersionAt = 0;

const loadBaileys = async () => {
    if (makeWASocket) return; // already loaded
    const baileys = await import('@whiskeysockets/baileys');
    makeWASocket         = baileys.default;
    useMultiFileAuthState = baileys.useMultiFileAuthState;
    DisconnectReason      = baileys.DisconnectReason;
    Browsers              = baileys.Browsers;
    fetchLatestWaWebVersion = baileys.fetchLatestWaWebVersion;
    jidNormalizedUser      = baileys.jidNormalizedUser;
    generateMessageIDV2    = baileys.generateMessageIDV2;
    downloadMediaMessage   = baileys.downloadMediaMessage;
    extractMessageContent  = baileys.extractMessageContent;
};

const getCurrentWaVersion = async () => {
    const oneHour = 60 * 60 * 1000;
    if (cachedWaVersion && Date.now() - cachedWaVersionAt < oneHour) return cachedWaVersion;

    try {
        const result = await fetchLatestWaWebVersion();
        if (Array.isArray(result?.version) && result.version.length === 3) {
            cachedWaVersion = result.version;
            cachedWaVersionAt = Date.now();
            // console.log(`ℹ️ [Baileys] WhatsApp Web version ${result.version.join('.')} (latest=${result.isLatest})`);
            return cachedWaVersion;
        }
    } catch (error) {
        console.warn(`⚠️ [Baileys] Could not fetch current WhatsApp Web version: ${error.message}`);
    }
    return null;
};

const QRCode = require('qrcode');
const { WhatsappMessage, ChatbotRule } = require('../models/WhatsappModels');
const mediaStorage = require('./mediaStorage.service');
const {
    buildBaileysForwardPayload,
    buildBaileysQuotedMessage,
    buildBaileysReactionPayload,
    canNativeForwardBaileys,
    extractBaileysReplyContext,
} = require('./messageActions.service');

// ── In-memory session map ──────────────────────────────────────────────────────
// key: `${tenantId}:${userId}` → { sock, status, phone, connectedAt, retryCount }
const sessions = new Map();

// ── Mock IO for Redis Pub/Sub ──────────────────────────────────────────────────
const { publishRealtimeEvent } = require('@sparkcrm/shared-config');
const io = {
    to: (room) => ({
        emit: (event, data) => {
            // room format: 'qr:tenantId:userId'
            const parts = room.split(':');
            if (parts.length < 3 || !parts[1] || !parts[2]) {
                console.warn(`⚠️ [Baileys] Unexpected room format for socket emit: "${room}" — event ${event} dropped`);
                return;
            }
            const tenantId = parts[1];
            const userId = parts[2];

            let type = 'WHATSAPP_EVENT';
            if (event === 'wa:qr') type = 'WHATSAPP_QR_UPDATED';
            if (event === 'wa:message') type = 'WHATSAPP_MESSAGE_RECEIVED';
            if (event === 'wa:connected') type = 'WHATSAPP_CONNECTED';
            if (event === 'wa:disconnected') type = 'WHATSAPP_DISCONNECTED';
            if (event === 'wa:reconnecting') type = 'WHATSAPP_RECONNECTING';

            publishRealtimeEvent({ type, tenantId, userId, event, data });
        }
    })
};

// ── Auth files storage ─────────────────────────────────────────────────────────
const SESSIONS_DIR = path.join(__dirname, '../../sessions');

const sessionKey = (tenantId, userId) => `${tenantId}:${userId}`;
const statusFromBaileysAck = (status) => {
    const value = Number(status);
    if (value >= 4) return 'read';
    if (value === 3) return 'delivered';
    if (value === 2) return 'sent';
    return null;
};
const sessionDir = (tenantId, userId) => {
    const tenantPart = String(tenantId);
    const userPart = String(userId);
    if (!/^[a-f\d]{24}$/i.test(tenantPart) || !/^[a-f\d]{24}$/i.test(userPart)) {
        throw new Error('Invalid tenant or user identifier');
    }

    const root = path.resolve(SESSIONS_DIR);
    const resolved = path.resolve(root, tenantPart, userPart);
    if (!resolved.startsWith(`${root}${path.sep}`)) {
        throw new Error('Invalid session path');
    }
    return resolved;
};

const applyBaileysReaction = async ({ tenantId, userId, actorPhone, direction, reaction, room }) => {
    if (!reaction?.key?.id) return null;
    const source = await WhatsappMessage.findOne({ tenantId, 'provider.waMessageId': reaction.key.id });
    if (!source) return null;
    const actorId = direction === 'outbound' ? String(userId) : null;
    source.reactions = (source.reactions || []).filter((entry) => {
        if (direction === 'outbound') return !(entry.direction === direction && String(entry.actorUserId || '') === actorId);
        return !(entry.direction === direction && entry.actorPhone === actorPhone);
    });
    if (reaction.text) {
        source.reactions.push({
            actorUserId: direction === 'outbound' ? userId : null,
            actorPhone: actorPhone || null,
            direction,
            emoji: String(reaction.text).slice(0, 32),
            provider: 'baileys',
            reactedAt: new Date(Number(reaction.senderTimestampMs || 0) || Date.now()),
        });
    }
    await source.save();
    io.to(room).emit('wa:message', { message: source.toJSON() });
    return source;
};

// ── Create / restart a session ─────────────────────────────────────────────────
const createSession = async (tenantId, userId, options = {}) => {
    await loadBaileys();

    const { fresh = false, retryCount = 0 } = options;
    const key  = sessionKey(tenantId, userId);
    const room = `qr:${tenantId}:${userId}`;
    const dir  = sessionDir(tenantId, userId);

    // Close any existing socket cleanly
    const existing = sessions.get(key);
    if (existing?.retryTimer) clearTimeout(existing.retryTimer);
    if (existing?.sock) {
        // Remove the old entry before closing so its late close event cannot
        // schedule a competing reconnect for the replacement socket.
        sessions.delete(key);
        try { existing.sock.end(undefined); } catch {}
    }
    if (fresh) _deleteSessionFiles(tenantId, userId);

    fs.mkdirSync(dir, { recursive: true });

    const { state, saveCreds } = await useMultiFileAuthState(dir);
    const waVersion = await getCurrentWaVersion();

    const sock = makeWASocket({
        ...(waVersion ? { version: waVersion } : {}),
        auth:               state,
        logger:             (await import('pino')).default({ level: 'silent' }),
        printQRInTerminal:  false,
        browser:            Browsers.ubuntu('SparkCRM'),
        connectTimeoutMs:   60_000,
        defaultQueryTimeoutMs: 30_000,
        keepAliveIntervalMs: 10_000,
        syncFullHistory:    false,
    });

    sessions.set(key, {
        sock,
        status: 'connecting',
        phone: null,
        connectedAt: null,
        retryCount,
        qr: null,
        retryTimer: null,
        tenantId,
        userId,
        io,
        confirmedMessageIds: new Set(),
    });

    // ── Event: connection state changes ──────────────────────────────────────
    sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
        const session = sessions.get(key);
        // Ignore events from a socket that has already been replaced.
        if (!session || session.sock !== sock) return;

        // New QR code generated — convert to base64 PNG and push to browser
        if (qr) {
            session.status = 'qr_pending';
            try {
                const qrBase64 = await QRCode.toDataURL(qr, { width: 256, margin: 2 });
                session.qr = qrBase64;
                io.to(room).emit('wa:qr', { qr: qrBase64 });
                // console.log(`📱 [Baileys] QR emitted to room ${room}`);
            } catch (err) {
                console.error('❌ [Baileys] QR generation failed:', err.message);
            }
        }

        if (connection === 'open') {
            const phone = sock.user?.id?.split(':')[0] || sock.user?.id || 'unknown';
            session.status      = 'connected';
            session.qr          = null;
            session.phone       = phone;
            session.connectedAt = new Date();
            session.retryCount  = 0;
            io.to(room).emit('wa:connected', { phone, connectedAt: session.connectedAt });
            // console.log(`✅ [Baileys] Agent ${userId} connected via number: ${phone}`);
        }

        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const loggedOut  = statusCode === DisconnectReason.loggedOut;
            
            // console.log(`⚠️ [Baileys] Session ${key} closed. Code: ${statusCode}. LoggedOut: ${loggedOut}`);
            
            if (loggedOut) {
                // User logged out from their phone — clean up completely
                session.status = 'disconnected';
                sessions.delete(key);
                _deleteSessionFiles(tenantId, userId);
                io.to(room).emit('wa:disconnected', { reason: 'logged_out' });
            } else {
                // Network error / timeout — auto-retry up to 3 times
                const retryCount = (session.retryCount || 0) + 1;
                if (retryCount <= 3) {
                    // console.log(`🔄 [Baileys] Reconnecting... attempt ${retryCount}`);
                    session.retryCount = retryCount;
                    session.status = 'reconnecting';
                    session.qr = null;
                    io.to(room).emit('wa:reconnecting', { attempt: retryCount });
                    session.retryTimer = setTimeout(() => {
                        const current = sessions.get(key);
                        if (current !== session || current.status !== 'reconnecting') return;
                        // FIXED: was createSession(tenantId, userId, io, { retryCount })
                        // createSession signature is (tenantId, userId, options={}) — the io
                        // arg was silently swallowed, reconnects ran without socket events.
                        createSession(tenantId, userId, { retryCount }).catch((error) => {
                            console.error(`❌ [Baileys] Reconnect failed ${key}:`, error.message);
                        });
                    }, 3000 * retryCount);
                } else {
                    session.status = 'disconnected';
                    session.sock = null;
                    session.qr = null;
                    session.retryTimer = null;
                    io.to(room).emit('wa:disconnected', { reason: 'connection_failed' });
                }
            }
        }
    });

    // ── Event: save credentials after each auth state update ─────────────────
    sock.ev.on('creds.update', saveCreds);

    // ── Event: incoming messages ──────────────────────────────────────────────
    sock.ev.on('messages.upsert', async ({ messages: msgs, type }) => {
        if (type !== 'notify') return;

        for (const msg of msgs) {
            if (msg.key.fromMe) {
                if (msg.message?.reactionMessage) {
                    await applyBaileysReaction({
                        tenantId, userId, actorPhone: sessions.get(key)?.phone || null,
                        direction: 'outbound', reaction: msg.message.reactionMessage, room
                    });
                    continue;
                }
                if (!msg.key.id) continue;
                const confirmed = await WhatsappMessage.findOneAndUpdate(
                    { tenantId, userId, 'provider.waMessageId': msg.key.id },
                    { $set: { 'delivery.status': 'sent', 'queue.lastError': '' } },
                    { new: true }
                );
                if (confirmed) io.to(room).emit('wa:message', { message: confirmed.toJSON() });
                else sessions.get(key)?.confirmedMessageIds?.add(msg.key.id);
                continue;
            }

            const jidCandidates = [msg.key.remoteJidAlt, msg.key.participantAlt, msg.key.remoteJid, msg.key.participant].filter(Boolean);

            // ── Skip group & broadcast messages early ────────────────────────
            // In groups, remoteJid is @g.us but participant is @s.whatsapp.net;
            // check ALL candidates for group/broadcast before resolving sender.
            if (jidCandidates.some((jid) => jid.endsWith('@g.us') || jid.endsWith('@broadcast'))) continue;

            let remoteJid = jidCandidates.find((jid) => jid.endsWith('@s.whatsapp.net')) || '';
            if (!remoteJid) {
                const lidJid = jidCandidates.find((jid) => jid.endsWith('@lid'));
                if (lidJid) remoteJid = await sock.signalRepository.lidMapping.getPNForLID(lidJid) || '';
            }
            if (!remoteJid) continue;
            const from = jidNormalizedUser(remoteJid).split('@')[0];
            if (!from || from === 'status') continue;

            if (msg.message?.reactionMessage) {
                try {
                    await applyBaileysReaction({
                        tenantId, userId, actorPhone: from, direction: 'inbound',
                        reaction: msg.message.reactionMessage, room,
                    });
                } catch (error) {
                    console.error('❌ [Baileys] Failed to persist inbound reaction:', error.message);
                }
                continue;
            }

            const actualMsg = extractMessageContent(msg.message) || msg.message;
            const mediaEntries = [
                ['image', actualMsg?.imageMessage],
                ['video', actualMsg?.videoMessage],
                ['audio', actualMsg?.audioMessage],
                ['document', actualMsg?.documentMessage],
            ];
            const [messageType, mediaMessage] = mediaEntries.find(([, value]) => value) || ['text', null];
            const caption = mediaMessage?.caption || '';
            const content =
                actualMsg?.conversation ||
                actualMsg?.extendedTextMessage?.text ||
                caption ||
                (messageType !== 'text' ? `[${messageType[0].toUpperCase()}${messageType.slice(1)}]` : '[Message]');

            try {
                // ── Resolve phone → leadId via direct DB query ──────────────
                const { findLeadByPhone } = require('./leadLookup.service');
                const lead = await findLeadByPhone(tenantId, from);
                const leadId = lead?._id || null;
                if (!leadId) {
                    // console.log(`📩 [Baileys] Ignored message from ${from} (not a lead)`);
                    continue;
                }

                let mediaObjectKey = null;
                const mediaMimeType = mediaMessage?.mimetype ? mediaStorage.normalizeMimeType(mediaMessage.mimetype) : null;
                const mediaName = mediaStorage.sanitizeMediaName(mediaMessage?.fileName || `${messageType}-message`);
                let mediaSize = Number(mediaMessage?.fileLength || 0) || null;
                if (mediaMessage && downloadMediaMessage) {
                    try {
                        const buffer = await downloadMediaMessage(msg, 'buffer', {}, {
                            reuploadRequest: sock.updateMediaMessage,
                        });
                        mediaObjectKey = await mediaStorage.uploadPrivateMedia({
                            buffer,
                            tenantId,
                            mimeType: mediaMimeType,
                        });
                        mediaSize = buffer.length;
                    } catch (mediaError) {
                        console.warn(`⚠️ [Baileys] Inbound media retained as placeholder: ${mediaError.message}`);
                    }
                }

                const replyContext = extractBaileysReplyContext(msg);
                const referencedMessage = replyContext?.waMessageId
                    ? await WhatsappMessage.findOne({ tenantId, 'provider.waMessageId': replyContext.waMessageId })
                    : null;
                const contextNode = msg.message?.extendedTextMessage || mediaMessage;
                const forwardScore = Number(contextNode?.contextInfo?.forwardingScore || 0);

                const savedMessage = await WhatsappMessage.create({
                    tenantId,
                    leadId:      leadId || undefined,
                    userId:      userId || undefined,   // agent who owns the session
                    message: {
                        direction:   'inbound',
                        from,
                        to:          sessions.get(key)?.phone || userId,
                        type:        messageType,
                        content,
                    },
                    media: {
                        mediaObjectKey,
                        mediaName: mediaMessage ? mediaName : null,
                        mediaMimeType,
                        mediaSize,
                    },
                    provider: {
                        waMessageId: msg.key.id,
                        name: 'baileys',
                        providerMetadata: {
                            remoteJid: msg.key.remoteJid || remoteJid,
                            participant: msg.key.participant || null,
                            fromMe: false,
                        }
                    },
                    replyTo: replyContext ? {
                        messageId: referencedMessage?._id || null,
                        waMessageId: replyContext.waMessageId,
                        participant: replyContext.participant,
                        snapshot: referencedMessage ? {
                            waMessageId: referencedMessage.provider?.waMessageId,
                            direction: referencedMessage.message?.direction || referencedMessage.direction,
                            from: referencedMessage.message?.from || referencedMessage.from,
                            to: referencedMessage.message?.to || referencedMessage.to,
                            type: referencedMessage.message?.type || referencedMessage.type,
                            content: referencedMessage.message?.content || referencedMessage.content,
                            mediaName: referencedMessage.media?.mediaName || referencedMessage.mediaName,
                            mediaMimeType: referencedMessage.media?.mediaMimeType || referencedMessage.mediaMimeType,
                            provider: referencedMessage.provider?.name || referencedMessage.provider,
                        } : replyContext.snapshot,
                    } : null,
                    isForwarded: Boolean(contextNode?.contextInfo?.isForwarded || forwardScore > 0),
                    delivery: { status: 'received' },
                    readState: { isRead: false },
                });
                io.to(room).emit('wa:message', { message: savedMessage.toJSON() });
                // console.log(`📩 [Baileys] Inbound from ${from} → lead ${leadId || 'unknown'}: ${content.substring(0, 60)}`);

                // ─── Chatbot auto-reply (text messages only) ─────────────────
                if (messageType === 'text' && content.trim()) {
                    try {
                        const incomingText = content.trim().toLowerCase();
                        const matchedRule = await ChatbotRule.findOne({
                            tenantId,
                            isActive: true,
                            $or: [
                                {
                                    'rule.matchType': 'exact',
                                    'rule.triggerKeyword': incomingText,
                                },
                                {
                                    'rule.matchType': 'contains',
                                    $expr: {
                                        $gt: [
                                            { $indexOfCP: [incomingText, { $toLower: '$rule.triggerKeyword' }] },
                                            -1,
                                        ],
                                    },
                                },
                                {
                                    'rule.matchType': 'startsWith',
                                    $expr: {
                                        $eq: [
                                            { $indexOfCP: [incomingText, { $toLower: '$rule.triggerKeyword' }] },
                                            0,
                                        ],
                                    },
                                },
                            ],
                        }).sort({ priority: -1 });

                        if (matchedRule) {
                            console.log(`🤖 [Baileys] Chatbot matched: "${matchedRule.rule?.triggerKeyword}" → sending auto-reply`);
                            const replyJid = `${String(from).replace(/\D/g, '')}@s.whatsapp.net`;
                            const replyText = matchedRule.rule?.responseContent || '';
                            const currentSession = sessions.get(key);
                            if (replyText && currentSession?.sock) {
                                const replyMessageId = generateMessageIDV2(currentSession.sock.user?.id);
                                try {
                                    const sent = await currentSession.sock.sendMessage(replyJid, { text: replyText }, { messageId: replyMessageId });
                                    const autoReplyMsg = await WhatsappMessage.create({
                                        tenantId,
                                        leadId: leadId || undefined,
                                        userId: userId || undefined,
                                        message: {
                                            direction: 'outbound',
                                            from: sessions.get(key)?.phone || userId,
                                            to: from,
                                            type: 'text',
                                            content: replyText,
                                        },
                                        provider: {
                                            waMessageId: sent?.key?.id || replyMessageId,
                                            name: 'baileys',
                                        },
                                        delivery: { status: 'sent' },
                                        automation: {
                                            automationType: 'chatbot',
                                            automationId: String(matchedRule._id),
                                        },
                                    });
                                    io.to(room).emit('wa:message', { message: autoReplyMsg.toJSON() });
                                    console.log(`🤖 [Baileys] Chatbot auto-reply sent to ${from}: "${replyText.substring(0, 60)}"`);
                                } catch (sendErr) {
                                    console.error(`❌ [Baileys] Chatbot auto-reply send failed:`, sendErr.message);
                                }
                            }
                        }
                    } catch (chatbotErr) {
                        // Chatbot errors must never break the inbound flow
                        console.error('❌ [Baileys] Chatbot auto-reply error:', chatbotErr.message);
                    }
                }
            } catch (err) {
                console.error('❌ [Baileys] Failed to save inbound message:', err.message);
            }
        }
    });


    // Baileys emits aggregate acknowledgement state for outbound messages.
    sock.ev.on('messages.update', async (updates) => {
        for (const { key: msgKey, update } of updates) {
            if (!msgKey?.id) continue;
            const newStatus = statusFromBaileysAck(update?.status);
            if (!newStatus) continue;
            const updateFields = { 'delivery.status': newStatus };
            if (newStatus === 'sent') updateFields['delivery.sentAt'] = new Date();
            if (newStatus === 'delivered') updateFields['delivery.deliveredAt'] = new Date();
            if (newStatus === 'read') {
                updateFields['readState.isRead'] = true;
                updateFields['readState.readAt'] = new Date();
                updateFields['delivery.whatsappReadAt'] = new Date();
            }

            const updatedMessage = await WhatsappMessage.findOneAndUpdate(
                { 'provider.waMessageId': msgKey.id, tenantId },
                { $set: updateFields },
                { new: true }
            );
            if (updatedMessage) io.to(room).emit('wa:message', { message: updatedMessage.toJSON() });
        }
    });

    // ── Event: per-recipient delivered/read receipts ─────────────────────────
    sock.ev.on('message-receipt.update', async (updates) => {
        for (const { key: msgKey, receipt } of updates) {
            if (!msgKey.id) continue;
            const newStatus = receipt?.readTimestamp ? 'read' : receipt?.receiptTimestamp ? 'delivered' : null;
            if (!newStatus) continue;
            try {
                const updateFields = { 'delivery.status': newStatus };
                if (newStatus === 'sent') updateFields['delivery.sentAt'] = new Date();
                if (newStatus === 'delivered') updateFields['delivery.deliveredAt'] = new Date();
                if (newStatus === 'read') {
                    updateFields['readState.isRead'] = true;
                    updateFields['readState.readAt'] = new Date();
                    updateFields['delivery.whatsappReadAt'] = new Date();
                }

                const updatedMessage = await WhatsappMessage.findOneAndUpdate(
                    { 'provider.waMessageId': msgKey.id, tenantId },
                    { $set: updateFields },
                    { new: true }
                );
                if (updatedMessage) io.to(room).emit('wa:message', { message: updatedMessage.toJSON() });
            } catch {}
        }
    });

    return sessions.get(key);
};

const consumeMessageConfirmation = (tenantId, userId, messageId) => {
    if (!messageId) return false;
    const session = sessions.get(sessionKey(tenantId, userId));
    if (!session?.confirmedMessageIds?.has(messageId)) return false;
    session.confirmedMessageIds.delete(messageId);
    return true;
};

const emitMessageUpdate = (tenantId, userId, message) => {
    const session = sessions.get(sessionKey(tenantId, userId));
    if (!session?.io || !message) return false;
    const room = `qr:${tenantId}:${userId}`;
    const payload = typeof message.toJSON === 'function' ? message.toJSON() : message;
    session.io.to(room).emit('wa:message', { message: payload });
    return true;
};

// ── Get session status ─────────────────────────────────────────────────────────
const getSessionStatus = (tenantId, userId) => {
    const key     = sessionKey(tenantId, userId);
    const session = sessions.get(key);

    if (session) {
        return {
            status:      session.status,
            phone:       session.phone,
            connectedAt: session.connectedAt,
            qr:           session.qr || null,
        };
    }

    // Check if auth files exist (can reconnect without new QR)
    const credsFile = path.join(sessionDir(tenantId, userId), 'creds.json');
    if (fs.existsSync(credsFile)) {
        return { status: 'saved', phone: null, connectedAt: null, qr: null };
    }

    return { status: 'disconnected', phone: null, connectedAt: null, qr: null };
};

// ── Disconnect and clean up a session ─────────────────────────────────────────
const disconnectSession = async (tenantId, userId) => {
    const key     = sessionKey(tenantId, userId);
    const session = sessions.get(key);

    if (session?.sock) {
        try { await session.sock.logout(); } catch {}
        try { session.sock.end(undefined); } catch {}
    }

    sessions.delete(key);
    _deleteSessionFiles(tenantId, userId);
    // console.log(`🗑️  [Baileys] Session deleted for tenant=${tenantId} user=${userId}`);
};

const requireConnectedSession = (tenantId, userId) => {
    const session = sessions.get(sessionKey(tenantId, userId));
    if (!session || session.status !== 'connected' || !session.sock) {
        throw new Error('WhatsApp not connected. Please scan the QR code in the WhatsApp section to connect your phone.');
    }
    return session;
};

const buildQrContentPayload = ({ type = 'text', content = '', mediaUrl, mediaName, mediaMimeType }) => {
    if (type === 'text') return { text: content };
    if (!['image', 'video', 'audio', 'document'].includes(type) || !mediaUrl) {
        throw new Error('Unsupported or incomplete QR message payload');
    }
    const payload = { [type]: { url: mediaUrl } };
    if (content && type !== 'audio') payload.caption = content;
    if (mediaMimeType) payload.mimetype = mediaMimeType;
    if (type === 'document') payload.fileName = mediaStorage.sanitizeMediaName(mediaName);
    if (type === 'audio') payload.ptt = false;
    return payload;
};

const sendQrAction = async (session, jid, payload, options = {}) => {
    const messageId = generateMessageIDV2(session.sock.user?.id);
    try {
        const sent = await session.sock.sendMessage(jid, payload, { ...options, messageId });
        return { waMessageId: sent?.key?.id || messageId, status: 'sent' };
    } catch (error) {
        error.waMessageId = messageId;
        error.deliveryUncertain = true;
        throw error;
    }
};

const sendReplyViaQR = async (tenantId, userId, to, source, outbound) => {
    const session = requireConnectedSession(tenantId, userId);
    const jid = `${String(to).replace(/\D/g, '')}@s.whatsapp.net`;
    const quoted = buildBaileysQuotedMessage(source, to);
    const result = await sendQrAction(session, jid, buildQrContentPayload(outbound), { quoted });
    return {
        ...result,
        provider: 'baileys',
        providerMetadata: { remoteJid: jid, fromMe: true, quotedMessageId: source.provider?.waMessageId },
    };
};

const sendReactionViaQR = async (tenantId, userId, to, source, emoji) => {
    const session = requireConnectedSession(tenantId, userId);
    const jid = `${String(to).replace(/\D/g, '')}@s.whatsapp.net`;
    const result = await sendQrAction(session, jid, buildBaileysReactionPayload(source, emoji, to));
    return {
        ...result,
        provider: 'baileys',
        providerMetadata: { remoteJid: jid, fromMe: true, reactionToMessageId: source.provider?.waMessageId },
    };
};

const forwardViaQR = async (tenantId, userId, to, source, outbound) => {
    const session = requireConnectedSession(tenantId, userId);
    const jid = `${String(to).replace(/\D/g, '')}@s.whatsapp.net`;
    const native = canNativeForwardBaileys(source);
    const payload = native ? buildBaileysForwardPayload(source, to) : buildQrContentPayload(outbound);
    const result = await sendQrAction(session, jid, payload);
    return {
        ...result,
        provider: 'baileys',
        forwardMode: native ? 'native' : 'resend',
        providerMetadata: { remoteJid: jid, fromMe: true, forwardedSourceMessageId: source.provider?.waMessageId || null },
    };
};

// ── Send text through an active Baileys session ────────────────────────────────
const sendTextViaQR = async (tenantId, userId, to, text) => {
    const key     = sessionKey(tenantId, userId);
    const session = sessions.get(key);

    if (!session || session.status !== 'connected') {
        throw new Error('WhatsApp not connected. Please scan the QR code in the WhatsApp section to connect your phone.');
    }

    // Normalise phone number to JID
    const normalised = String(to).replace(/[^0-9]/g, '');
    const jid = `${normalised}@s.whatsapp.net`;
    const messageId = generateMessageIDV2(session.sock.user?.id);

    try {
        const sent = await session.sock.sendMessage(jid, { text }, { messageId });
        // console.log(`📤 [Baileys] Text sent to ${jid}: ${text.substring(0, 60)}`);
        return {
            waMessageId: sent?.key?.id || messageId,
            status: 'sent',
        };
    } catch (error) {
        // WhatsApp can accept a message before the acknowledgement promise
        // rejects. Preserve the deterministic ID so the outbound echo/receipt
        // can reconcile it instead of showing a false permanent failure.
        error.waMessageId = messageId;
        error.deliveryUncertain = true;
        throw error;
    }
};

const sendMediaViaQR = async (tenantId, userId, to, mediaType, media, options = {}) => {
    const session = sessions.get(sessionKey(tenantId, userId));
    if (!session || session.status !== 'connected') {
        throw new Error('WhatsApp not connected. Please scan the QR code in the WhatsApp section to connect your phone.');
    }
    if (!['image', 'video', 'audio', 'document'].includes(mediaType)) throw new Error('Unsupported QR media type');

    const jid = `${String(to).replace(/[^0-9]/g, '')}@s.whatsapp.net`;
    const messageId = generateMessageIDV2(session.sock.user?.id);
    const source = Buffer.isBuffer(media) ? media : { url: media };
    const payload = { [mediaType]: source };
    if (options.caption && mediaType !== 'audio') payload.caption = options.caption;
    if (options.mimeType) payload.mimetype = options.mimeType;
    if (mediaType === 'document') payload.fileName = mediaStorage.sanitizeMediaName(options.fileName);
    if (mediaType === 'audio') payload.ptt = false;

    try {
        const sent = await session.sock.sendMessage(jid, payload, { messageId });
        return { waMessageId: sent?.key?.id || messageId, status: 'sent' };
    } catch (error) {
        error.waMessageId = messageId;
        error.deliveryUncertain = true;
        throw error;
    }
};

// ── Auto-restore saved sessions on server startup ─────────────────────────────
const restoreAllSessions = async (io) => {
    if (!fs.existsSync(SESSIONS_DIR)) return;

    const tenants = fs.readdirSync(SESSIONS_DIR, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name);

    for (const tenantId of tenants) {
        const tenantPath = path.join(SESSIONS_DIR, tenantId);
        const users = fs.readdirSync(tenantPath, { withFileTypes: true })
            .filter(d => d.isDirectory())
            .map(d => d.name);

        for (const userId of users) {
            const credsFile = path.join(tenantPath, userId, 'creds.json');
            if (fs.existsSync(credsFile)) {
                // console.log(`🔄 [Baileys] Restoring session tenant=${tenantId} user=${userId}`);
                createSession(tenantId, userId, io).catch(err => {
                    console.error(`❌ [Baileys] Restore failed ${tenantId}/${userId}:`, err.message);
                });
            }
        }
    }
};

// ── Internal helper ────────────────────────────────────────────────────────────
const _deleteSessionFiles = (tenantId, userId) => {
    const dir = sessionDir(tenantId, userId);
    if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
};

module.exports = {
    sessionDir,
    statusFromBaileysAck,
    createSession,
    getSessionStatus,
    disconnectSession,
    sendTextViaQR,
    sendMediaViaQR,
    sendReplyViaQR,
    sendReactionViaQR,
    forwardViaQR,
    buildQrContentPayload,
    emitMessageUpdate,
    consumeMessageConfirmation,
    restoreAllSessions,
};
