const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { env } = require('@sparkcrm/shared-config');
const { createServiceHeaders } = require('@sparkcrm/shared-middleware');
const {
    authenticate,
    requireAdmin,
    internalServiceAuth,
} = require('../src/middleware/security');
const { parsePagination, escapeRegex, pick } = require('../src/utils/request');
const { encrypt, decrypt } = require('../src/models/IntegrationCredential');
const { PLAN_CATALOG } = require('../src/seeds/planCatalog');
const { signImpersonationToken } = require('../src/utils/impersonationToken');
const { filterModulesForTenantPlan } = require('../src/utils/moduleAccess');
const { verifyGatewayToken } = require('../../api-gateway/src/middlewares/auth.middleware');

test('tenant modules are restricted to plan and explicitly granted module keys', () => {
    const modules = [
        { key: 'dashboard', requiredFeature: null },
        { key: 'leads', requiredFeature: 'lead_management' },
        { key: 'calls', requiredFeature: 'calling_basic' },
        { key: 'recordings', parentKey: 'calls', requiredFeature: 'call_recording' },
        { key: 'whatsapp', requiredFeature: 'whatsapp_session' },
    ];
    const tenant = {
        planId: { moduleKeys: ['leads'], features: ['lead_management'] },
        extraModuleKeys: ['calls'],
        extraFeatures: [],
    };

    assert.deepEqual(
        filterModulesForTenantPlan(modules, tenant).map((module) => module.key),
        ['dashboard', 'leads', 'calls', 'recordings'],
    );
});

test('tenant module filtering falls back to plan features for legacy plans', () => {
    const modules = [
        { key: 'dashboard', requiredFeature: null },
        { key: 'leads', requiredFeature: 'lead_management' },
        { key: 'calls', requiredFeature: 'calling_basic' },
    ];
    const tenant = {
        planId: { moduleKeys: [], features: ['lead_management'] },
        extraModuleKeys: [],
        extraFeatures: [],
    };

    assert.deepEqual(
        filterModulesForTenantPlan(modules, tenant).map((module) => module.key),
        ['dashboard', 'leads'],
    );
});

test('tenant impersonation tokens satisfy gateway purpose validation', () => {
    const token = signImpersonationToken({
        userId: 'owner-1',
        tenantId: 'tenant-1',
        role: 'superadmin',
        originalRole: 'owner',
        isImpersonating: true,
    });

    const decoded = verifyGatewayToken(token);
    assert.equal(decoded.iss, 'sparkcrm-tenant-service');
    assert.equal(decoded.aud, 'sparkcrm-tenant-impersonation');
    assert.equal(decoded.tenantId, 'tenant-1');
});

function responseRecorder() {
    return {
        statusCode: 200,
        body: null,
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; },
    };
}

test('internal service authentication rejects unsigned compatibility headers', () => {
    let nextCalled = false;
    const res = responseRecorder();
    internalServiceAuth({
        method: 'GET',
        originalUrl: '/internal/example',
        headers: { 'x-service-auth-token': 'legacy-static-token' },
    }, res, () => { nextCalled = true; });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
    assert.match(res.body.message, /signed service identity/i);
});

test('signed shared service identity is accepted and applied', () => {
    const original = env.INTERNAL_SERVICE_SECRET;
    env.INTERNAL_SERVICE_SECRET = 'unit-test-internal-service-secret-at-least-32-chars';
    try {
        const path = '/internal/example';
        const signed = createServiceHeaders({
            issuer: 'unit-test-service',
            audience: 'tenant-service',
            method: 'GET',
            path,
            identity: { tenantId: 'tenant-1' },
        });
        const req = {
            method: 'GET',
            originalUrl: path,
            headers: Object.fromEntries(Object.entries(signed).map(([key, value]) => [key.toLowerCase(), value])),
        };
        let called = false;
        internalServiceAuth(req, responseRecorder(), () => { called = true; });
        assert.equal(called, true);
        assert.equal(req.headers['x-tenant-id'], 'tenant-1');
        assert.equal(req.serviceName, 'unit-test-service');
    } finally {
        env.INTERNAL_SERVICE_SECRET = original;
    }
});

test('JWT authentication overwrites spoofed identity headers', () => {
    const originalSecret = env.JWT_SECRET;
    env.JWT_SECRET = 'unit-test-jwt-secret';
    try {
        const token = jwt.sign({ userId: 'user-1', role: 'admin', tenantId: 'tenant-1' }, env.JWT_SECRET);
        const req = {
            headers: {
                authorization: `Bearer ${token}`,
                'x-user-id': 'spoofed',
                'x-tenant-id': 'spoofed',
            },
        };
        let called = false;
        authenticate(req, responseRecorder(), () => { called = true; });
        assert.equal(called, true);
        assert.equal(req.headers['x-user-id'], 'user-1');
        assert.equal(req.headers['x-tenant-id'], 'tenant-1');

        const adminCalled = { value: false };
        requireAdmin(req, responseRecorder(), () => { adminCalled.value = true; });
        assert.equal(adminCalled.value, true);
    } finally {
        env.JWT_SECRET = originalSecret;
    }
});

test('credential encryption is authenticated and fails closed', () => {
    const original = process.env.CREDENTIAL_ENCRYPTION_KEY;
    process.env.CREDENTIAL_ENCRYPTION_KEY = 'unit-test-credential-key-material-32-chars-minimum';
    try {
        const ciphertext = encrypt('top-secret');
        assert.match(ciphertext, /^v2:/);
        assert.equal(decrypt(ciphertext), 'top-secret');
        const tampered = `${ciphertext.slice(0, -1)}${ciphertext.endsWith('0') ? '1' : '0'}`;
        assert.throws(() => decrypt(tampered));
        assert.throws(() => decrypt('plaintext'));
    } finally {
        if (original === undefined) delete process.env.CREDENTIAL_ENCRYPTION_KEY;
        else process.env.CREDENTIAL_ENCRYPTION_KEY = original;
    }
});

test('request utilities bound pagination and prevent regex injection', () => {
    assert.deepEqual(parsePagination({ page: '-1', limit: '9999' }, { defaultLimit: 20, maxLimit: 100 }), {
        page: 1, limit: 100, skip: 0,
    });
    assert.equal(escapeRegex('a.*(b)'), 'a\\.\\*\\(b\\)');
    assert.deepEqual(pick({ safe: 1, unsafe: 2 }, ['safe']), { safe: 1 });
});

test('canonical plan catalog has unique slugs and exactly one trial plan', () => {
    const slugs = PLAN_CATALOG.map((plan) => plan.slug);
    assert.equal(new Set(slugs).size, slugs.length);
    assert.equal(PLAN_CATALOG.filter((plan) => plan.isTrial).length, 1);
    assert.ok(PLAN_CATALOG.every((plan) => Array.isArray(plan.moduleKeys) && Array.isArray(plan.features)));
});
