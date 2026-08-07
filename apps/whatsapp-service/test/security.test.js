const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { normalizePhone } = require('../src/services/whatsappApi.service');
const { sessionDir, statusFromBaileysAck } = require('../src/services/baileysSession.service');

test('normalizes and validates WhatsApp phone numbers', () => {
    assert.equal(normalizePhone('9876543210'), '919876543210');
    assert.equal(normalizePhone('+1 (555) 234-5678'), '15552345678');
    assert.throws(() => normalizePhone('../bad'));
});

test('maps Baileys acknowledgements to WhatsApp receipt states', () => {
    assert.equal(statusFromBaileysAck(2), 'sent');
    assert.equal(statusFromBaileysAck(3), 'delivered');
    assert.equal(statusFromBaileysAck(4), 'read');
    assert.equal(statusFromBaileysAck(5), 'read');
    assert.equal(statusFromBaileysAck(1), null);
});

test('contains Baileys paths under the session root', () => {
    const tenantId = '507f1f77bcf86cd799439011';
    const userId = '507f1f77bcf86cd799439012';
    const result = sessionDir(tenantId, userId);
    assert.match(result, new RegExp(`${tenantId}[/\\\\]${userId}$`));
    assert.equal(path.isAbsolute(result), true);
    assert.throws(() => sessionDir('../outside', userId));
    assert.throws(() => sessionDir(tenantId, '..\\outside'));
});
