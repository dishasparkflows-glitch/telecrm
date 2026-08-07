const test = require('node:test');
const assert = require('node:assert/strict');
const {
    assertForwardable,
    buildBaileysForwardPayload,
    buildBaileysQuotedMessage,
    buildBaileysReactionPayload,
    buildMetaReactionPayload,
    buildMetaReplyPayload,
    canNativeForwardBaileys,
    extractBaileysReplyContext,
    validateReactionEmoji,
} = require('../src/services/messageActions.service');

const source = {
    waMessageId: 'BAE5123456789',
    direction: 'inbound',
    from: '919876543210',
    to: '911234567890',
    type: 'text',
    content: 'original text',
    provider: 'baileys',
    providerMetadata: { remoteJid: '919876543210@s.whatsapp.net' },
};

test('validates a single emoji grapheme and permits reaction removal', () => {
    assert.equal(validateReactionEmoji('👍🏽'), '👍🏽');
    assert.equal(validateReactionEmoji('👨‍👩‍👧‍👦'), '👨‍👩‍👧‍👦');
    assert.equal(validateReactionEmoji(''), '');
    assert.throws(() => validateReactionEmoji('ok'), /single grapheme|valid emoji/);
    assert.throws(() => validateReactionEmoji('👍🔥'), /single grapheme/);
});

test('builds a reconstructed Baileys quoted message with the provider key', () => {
    assert.deepEqual(buildBaileysQuotedMessage(source, source.from), {
        key: {
            remoteJid: '919876543210@s.whatsapp.net',
            id: 'BAE5123456789',
            fromMe: false,
        },
        message: { conversation: 'original text' },
    });
    assert.deepEqual(buildBaileysReactionPayload(source, '❤️', source.from), {
        react: {
            text: '❤️',
            key: {
                remoteJid: '919876543210@s.whatsapp.net',
                id: 'BAE5123456789',
                fromMe: false,
            },
        },
    });
});

test('uses native Baileys forwarding only for safely reconstructable Baileys text', () => {
    assert.equal(canNativeForwardBaileys(source), true);
    assert.equal(canNativeForwardBaileys({ ...source, provider: 'cloud' }), false);
    assert.equal(canNativeForwardBaileys({ ...source, type: 'image' }), false);
    assert.deepEqual(buildBaileysForwardPayload(source), {
        forward: buildBaileysQuotedMessage(source, source.from),
    });
    assert.throws(() => buildBaileysForwardPayload({ ...source, type: 'image' }), /safely reconstructed/);
});

test('builds Cloud API reply context and reaction payloads', () => {
    assert.deepEqual(buildMetaReplyPayload('919876543210', 'wamid.source', {
        type: 'text', text: { body: 'reply' },
    }), {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: '919876543210',
        context: { message_id: 'wamid.source' },
        type: 'text',
        text: { body: 'reply' },
    });
    assert.deepEqual(buildMetaReactionPayload('919876543210', 'wamid.source', '🔥'), {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: '919876543210',
        type: 'reaction',
        reaction: { message_id: 'wamid.source', emoji: '🔥' },
    });
});

test('extracts Baileys inbound quoted context without retaining a raw provider payload', () => {
    assert.deepEqual(extractBaileysReplyContext({
        message: {
            extendedTextMessage: {
                text: 'new reply',
                contextInfo: {
                    stanzaId: 'quoted-id',
                    participant: '919999999999@s.whatsapp.net',
                    quotedMessage: { conversation: 'quoted text' },
                },
            },
        },
    }), {
        waMessageId: 'quoted-id',
        participant: '919999999999@s.whatsapp.net',
        snapshot: {
            type: 'text',
            content: 'quoted text',
            mediaName: null,
            mediaMimeType: null,
            direction: 'inbound',
            from: '919999999999',
        },
    });
});

test('rejects unsupported or unavailable forwarding sources', () => {
    assert.throws(() => assertForwardable({ type: 'template' }), /cannot be forwarded/);
    assert.throws(() => assertForwardable({ type: 'image' }), /no longer available/);
    assert.equal(assertForwardable({ type: 'document', mediaUrl: 'https://example.test/file' }), true);
});
