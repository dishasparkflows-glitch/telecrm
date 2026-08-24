const SUPPORTED_FORWARD_TYPES = new Set(['text', 'image', 'video', 'audio', 'document']);

const messagePeerPhone = (message) => String(message.message?.direction === 'inbound' ? message.message?.from : message.message?.to);
const phoneJid = (phone) => `${String(phone).replace(/\D/g, '')}@s.whatsapp.net`;

function validateReactionEmoji(value, { allowEmpty = true } = {}) {
    if (typeof value !== 'string') throw new Error('emoji must be a string');
    const emoji = value.trim();
    if (!emoji && allowEmpty) return '';
    if (!emoji) throw new Error('emoji is required');
    if (emoji.length > 32 || Buffer.byteLength(emoji, 'utf8') > 64) throw new Error('emoji is too long');

    const graphemes = typeof Intl.Segmenter === 'function'
        ? [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(emoji)].map(part => part.segment)
        : [emoji];
    if (graphemes.length !== 1) throw new Error('emoji must be a single grapheme');
    if (!(/\p{Extended_Pictographic}/u.test(emoji) || /\p{Regional_Indicator}/u.test(emoji) || /[0-9#*]\uFE0F?\u20E3/u.test(emoji))) {
        throw new Error('emoji must be a valid emoji grapheme');
    }
    return emoji;
}

function snapshotMessage(message) {
    if (!message) return null;
    return {
        waMessageId: message.provider?.waMessageId || null,
        direction: message.message?.direction,
        from: message.message?.from,
        to: message.message?.to,
        type: message.message?.type || 'text',
        content: String(message.message?.content || '').slice(0, 2000),
        mediaName: message.media?.mediaName || null,
        mediaMimeType: message.media?.mediaMimeType || null,
        provider: message.provider || null,
    };
}

function quotedContent(source) {
    const type = source.message?.type || 'text';
    const content = source.message?.content || '';
    const mediaName = source.media?.mediaName || undefined;
    const mediaMimeType = source.media?.mediaMimeType || undefined;
    
    switch (type) {
        case 'image': return { imageMessage: { caption: content, mimetype: mediaMimeType } };
        case 'video': return { videoMessage: { caption: content, mimetype: mediaMimeType } };
        case 'audio': return { audioMessage: { mimetype: mediaMimeType || 'audio/ogg' } };
        case 'document': return { documentMessage: { caption: content, fileName: mediaName, mimetype: mediaMimeType } };
        default: return { conversation: String(content) };
    }
}

function buildBaileysQuotedMessage(source, targetPhone) {
    if (!source?.provider?.waMessageId) throw new Error('Source message has no WhatsApp message ID');
    const remoteJid = source.provider?.providerMetadata?.remoteJid || phoneJid(targetPhone || messagePeerPhone(source));
    const participant = source.provider?.providerMetadata?.participant;
    return {
        key: {
            remoteJid,
            id: source.provider?.waMessageId,
            fromMe: source.message?.direction === 'outbound',
            ...(participant ? { participant } : {}),
        },
        message: quotedContent(source),
    };
}

function buildBaileysReactionPayload(source, emoji, targetPhone) {
    const quoted = buildBaileysQuotedMessage(source, targetPhone);
    return { react: { text: validateReactionEmoji(emoji), key: quoted.key } };
}

function canNativeForwardBaileys(source) {
    return Boolean(source?.provider?.name === 'baileys' && source.provider?.waMessageId && source.message?.type === 'text' && String(source.message?.content || '').trim());
}

function buildBaileysForwardPayload(source) {
    if (!canNativeForwardBaileys(source)) throw new Error('Source message cannot be safely reconstructed for native forwarding');
    return { forward: buildBaileysQuotedMessage(source, messagePeerPhone(source)) };
}

function buildMetaReplyPayload(to, sourceWaMessageId, messagePayload) {
    if (!sourceWaMessageId) throw new Error('Source message has no WhatsApp message ID');
    return {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        context: { message_id: sourceWaMessageId },
        ...messagePayload,
    };
}

function buildMetaReactionPayload(to, sourceWaMessageId, emoji) {
    if (!sourceWaMessageId) throw new Error('Source message has no WhatsApp message ID');
    return {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'reaction',
        reaction: { message_id: sourceWaMessageId, emoji: validateReactionEmoji(emoji) },
    };
}

function assertForwardable(source) {
    const type = source?.message?.type;
    if (!SUPPORTED_FORWARD_TYPES.has(type)) throw new Error(`Messages of type ${type || 'unknown'} cannot be forwarded`);
    if (type === 'text' && !String(source.message?.content || '').trim()) throw new Error('Source text message is empty');
    if (type !== 'text' && !source.media?.mediaObjectKey && !source.media?.mediaUrl) throw new Error('Source media is no longer available');
    return true;
}

function unwrapBaileysMessage(msg) {
    if (!msg) return msg;
    if (msg.ephemeralMessage?.message) return unwrapBaileysMessage(msg.ephemeralMessage.message);
    if (msg.viewOnceMessage?.message) return unwrapBaileysMessage(msg.viewOnceMessage.message);
    if (msg.viewOnceMessageV2?.message) return unwrapBaileysMessage(msg.viewOnceMessageV2.message);
    if (msg.viewOnceMessageV2Extension?.message) return unwrapBaileysMessage(msg.viewOnceMessageV2Extension.message);
    if (msg.documentWithCaptionMessage?.message) return unwrapBaileysMessage(msg.documentWithCaptionMessage.message);
    return msg;
}

function extractBaileysContent(message) {
    if (!message) return { type: 'text', content: '' };
    message = unwrapBaileysMessage(message);
    const mediaEntries = [
        ['image', message.imageMessage],
        ['video', message.videoMessage],
        ['audio', message.audioMessage],
        ['document', message.documentMessage],
    ];
    const [type, media] = mediaEntries.find(([, value]) => value) || ['text', null];
    return {
        type,
        content: message.conversation || message.extendedTextMessage?.text || media?.caption || '',
        mediaName: media?.fileName || null,
        mediaMimeType: media?.mimetype || null,
    };
}

function extractBaileysReplyContext(waMessage) {
    const content = unwrapBaileysMessage(waMessage?.message || {});
    const node = content.extendedTextMessage || content.imageMessage || content.videoMessage || content.audioMessage || content.documentMessage;
    const contextInfo = node?.contextInfo;
    if (!contextInfo?.stanzaId) return null;
    const snapshot = extractBaileysContent(contextInfo.quotedMessage);
    return {
        waMessageId: contextInfo.stanzaId,
        participant: contextInfo.participant || null,
        snapshot: {
            ...snapshot,
            direction: contextInfo.participant ? 'inbound' : null,
            from: contextInfo.participant ? String(contextInfo.participant).split('@')[0] : null,
        },
    };
}

module.exports = {
    assertForwardable,
    buildBaileysForwardPayload,
    buildBaileysQuotedMessage,
    buildBaileysReactionPayload,
    buildMetaReactionPayload,
    buildMetaReplyPayload,
    canNativeForwardBaileys,
    extractBaileysContent,
    extractBaileysReplyContext,
    messagePeerPhone,
    phoneJid,
    snapshotMessage,
    validateReactionEmoji,
};
