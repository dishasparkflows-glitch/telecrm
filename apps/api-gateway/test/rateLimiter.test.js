const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'test-jwt-secret-that-is-at-least-32-characters';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-at-least-32-characters';
process.env.INTERNAL_SERVICE_SECRET = 'test-service-secret-at-least-32-characters';

const { extractUserKeyFromToken } = require('../src/middlewares/rateLimiter.middleware');

test('rate-limit identity accepts only verified tokens', () => {
    const token = jwt.sign({ userId: 'user-1', tenantId: 'tenant-1' }, process.env.JWT_SECRET);
    assert.equal(extractUserKeyFromToken({ headers: { authorization: `Bearer ${token}` } }), 'tenant-1:user-1');

    const forged = jwt.sign({ userId: 'user-2', tenantId: 'tenant-2' }, 'attacker-secret');
    assert.equal(extractUserKeyFromToken({ headers: { authorization: `Bearer ${forged}` } }), null);
});
