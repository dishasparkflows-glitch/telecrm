const test = require('node:test');
const assert = require('node:assert/strict');
const { buildFirebaseMessage, isInvalidFirebaseTokenError } = require('../src/channels/push.channel');
const { buildReminderClaimFilter, getReminderRetry } = require('../src/jobs/cronJobs');

test('builds Firebase payloads with string-only data values', () => {
    const payload = buildFirebaseMessage({ device: { token: 'token-1' }, title: 'Title', body: 'Body', data: { count: 2, empty: null, enabled: false } });
    assert.deepEqual(payload.message.data, { count: '2', empty: '', enabled: 'false' });
    assert.equal(payload.message.token, 'token-1');
    assert.equal(payload.message.android.priority, 'high');
});

test('classifies only Firebase invalid-token errors for deactivation', () => {
    assert.equal(isInvalidFirebaseTokenError('UNREGISTERED'), true);
    assert.equal(isInvalidFirebaseTokenError('registration-token-not-registered'), true);
    assert.equal(isInvalidFirebaseTokenError('QUOTA_EXCEEDED'), false);
});

test('claims due pending reminders and stale processing reminders', () => {
    const now = new Date('2026-01-01T12:00:00.000Z');
    const filter = buildReminderClaimFilter(now);
    assert.equal(filter.dueAt.$lte, now);
    assert.equal(filter.$or[0].status, 'pending');
    assert.equal(filter.$or[1].processingAt.$lte.toISOString(), '2026-01-01T11:55:00.000Z');
});

test('uses bounded exponential retry and fails on the fifth attempt', () => {
    const now = new Date('2026-01-01T12:00:00.000Z');
    assert.deepEqual(getReminderRetry(1, now), { status: 'pending', dueAt: new Date('2026-01-01T12:01:00.000Z') });
    assert.deepEqual(getReminderRetry(4, now), { status: 'pending', dueAt: new Date('2026-01-01T12:08:00.000Z') });
    assert.deepEqual(getReminderRetry(5, now), { status: 'failed', dueAt: null });
});
