const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeMobileCallEntry } = require('../src/controllers/call.controller');

test('normalizes native mobile call types, timestamps, and duration', () => {
    const call = normalizeMobileCallEntry({ deviceCallId: ' call-1 ', phone: ' +91 999 ', type: 'ReJeCtEd', timestamp: '2026-01-02T03:04:05.000Z', duration: '-4' });
    assert.equal(call.externalCallId, 'call-1');
    assert.equal(call.remoteNumber, '+91 999');
    assert.equal(call.type.direction, 'inbound');
    assert.equal(call.type.status, 'missed');
    assert.equal(call.startedAt.toISOString(), '2026-01-02T03:04:05.000Z');
    assert.equal(call.duration, 0);
});

test('requires the device call ID that forms the mobile idempotency key', () => {
    assert.throws(() => normalizeMobileCallEntry({ phone: '12345678', type: 'incoming', timestamp: Date.now() }), /deviceCallId/);
    assert.throws(() => normalizeMobileCallEntry({ deviceCallId: '1', phone: '12345678', type: 'unknown', timestamp: Date.now() }), /valid call type/);
    assert.throws(() => normalizeMobileCallEntry({ deviceCallId: '1', phone: '12345678', type: 'outgoing', timestamp: 'invalid' }), /valid startedAt/);
});
