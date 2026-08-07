const test = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRET = 'test-jwt-secret-that-is-at-least-32-characters';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-at-least-32-characters';
process.env.INTERNAL_SERVICE_SECRET = 'test-service-secret-at-least-32-characters';

const {
    generateTokenPair,
    verifyAccessToken,
    verifyRefreshToken,
    hashRefreshToken,
} = require('../src/services/jwt.service');

test('token pairs carry session version and constrained claims', () => {
    const account = {
        _id: 'user-1', tenantId: 'tenant-1', role: 'agent', email: 'user@example.org', tokenVersion: 4,
    };
    const tokens = generateTokenPair(account);
    assert.equal(verifyAccessToken(tokens.accessToken).tokenVersion, 4);
    assert.equal(verifyRefreshToken(tokens.refreshToken).type, 'user');
    assert.equal(hashRefreshToken(tokens.refreshToken), hashRefreshToken(tokens.refreshToken));
    assert.notEqual(hashRefreshToken(tokens.refreshToken), tokens.refreshToken);
});
