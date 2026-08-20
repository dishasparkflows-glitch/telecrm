const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { env } = require('@sparkcrm/shared-config');
const { verifyGatewayToken } = require('../src/middlewares/auth.middleware');
const { featureGuard } = require('../src/middlewares/featureGuard.middleware');

function sign(payload, options) {
    return jwt.sign(payload, env.JWT_SECRET, {
        algorithm: 'HS256',
        expiresIn: '5m',
        ...options,
    });
}

test('accepts normal access and owner impersonation token purposes', () => {
    const accessToken = sign({
        userId: 'user-1', tenantId: 'tenant-1', role: 'super-admin', tokenVersion: 2,
    }, { issuer: 'sparkcrm-auth', audience: 'sparkcrm-api' });
    assert.equal(verifyGatewayToken(accessToken).tenantId, 'tenant-1');

    const impersonationToken = sign({
        userId: 'owner-1', tenantId: 'tenant-1', role: 'super-admin',
        originalRole: 'owner', isImpersonating: true, tokenVersion: 3,
    }, { issuer: 'sparkcrm-tenant-service', audience: 'sparkcrm-tenant-impersonation' });
    assert.equal(verifyGatewayToken(impersonationToken).isImpersonating, true);
});

test('tenant impersonation remains restricted to subscribed features', () => {
    const guard = featureGuard('whatsapp_chatbot');
    let nextCalled = false;
    const response = {
        statusCode: 200,
        body: null,
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; },
    };

    guard({
        isImpersonating: true,
        tenant: {
            _id: 'tenant-1',
            planId: { slug: 'free', features: ['lead_management'] },
            purchasedFeatures: [],
            extraFeatures: [],
        },
    }, response, () => { nextCalled = true; });

    assert.equal(nextCalled, false);
    assert.equal(response.statusCode, 403);
    assert.equal(response.body.code, 'FEATURE_NOT_AVAILABLE');
});

test('rejects tokens that mix normal and impersonation purposes', () => {
    const wrongAudience = sign({
        userId: 'owner-1', tenantId: 'tenant-1', role: 'super-admin',
        originalRole: 'owner', isImpersonating: true, tokenVersion: 3,
    }, { issuer: 'sparkcrm-auth', audience: 'sparkcrm-api' });
    assert.throws(() => verifyGatewayToken(wrongAudience), /Invalid impersonation token purpose/);

    const forgedRole = sign({
        userId: 'owner-1', tenantId: 'tenant-1', role: 'admin',
        originalRole: 'owner', isImpersonating: true, tokenVersion: 3,
    }, { issuer: 'sparkcrm-tenant-service', audience: 'sparkcrm-tenant-impersonation' });
    assert.throws(() => verifyGatewayToken(forgedRole), /Invalid impersonation identity/);
});
