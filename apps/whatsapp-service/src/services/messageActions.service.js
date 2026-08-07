const SUPPORTED_FORWARD_TYPES = new Set(['text', 'image', 'video', 'audio', 'document']);

const messagePeerPhone = (message) => String(message.direction === 'inbound' ? message.from : message.to);
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
        waMessageId: message.waMessageId || null,
        direction: message.direction,
        from: message.from,
        to: message.to,
        type: message.type || 'text',
        content: String(message.content || '').slice(0, 2000),
        mediaName: message.mediaName || null,
        mediaMimeType: message.mediaMimeType || null,
        provider: message.provider || null,
    };
}

function quotedContent(source) {
    switch (source.type) {
        case 'image': return { imageMessage: { caption: source.content || '', mimetype: source.mediaMimeType || undefined } };
        case 'video': return { videoMessage: { caption: source.content || '', mimetype: source.mediaMimeType || undefined } };
        case 'audio': return { audioMessage: { mimetype: source.mediaMimeType || 'audio/ogg' } };
        case 'document': return { documentMessage: { caption: source.content || '', fileName: source.mediaName || undefined, mimetype: source.mediaMimeType || undefined } };
        default: return { conversation: String(source.content || '') };
    }
}

function buildBaileysQuotedMessage(source, targetPhone) {
    if (!source?.waMessageId) throw new Error('Source message has no WhatsApp message ID');
    const remoteJid = source.providerMetadata?.remoteJid || phoneJid(targetPhone || messagePeerPhone(source));
    const participant = source.providerMetadata?.participant;
    return {
        key: {
            remoteJid,
            id: source.waMessageId,
            fromMe: source.direction === 'outbound',
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
    return Boolean(source?.provider === 'baileys' && source.waMessageId && source.type === 'text' && String(source.content || '').trim());
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
    if (!SUPPORTED_FORWARD_TYPES.has(source?.type)) throw new Error(`Messages of type ${source?.type || 'unknown'} cannot be forwarded`);
    if (source.type === 'text' && !String(source.content || '').trim()) throw new Error('Source text message is empty');
    if (source.type !== 'text' && !source.mediaObjectKey && !source.mediaUrl) throw new Error('Source media is no longer available');
    return true;
}

function extractBaileysContent(message) {
    if (!message) return { type: 'text', content: '' };
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
    const content = waMessage?.message || {};
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
