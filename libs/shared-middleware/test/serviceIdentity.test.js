const test = require('node:test');
const assert = require('node:assert/strict');

process.env.INTERNAL_SERVICE_SECRET = 'test-internal-service-secret-at-least-32-chars';

const {
    applyVerifiedIdentity,
    createServiceHeaders,
    requireServiceIdentity,
    verifyServiceContext,
    stripUntrustedIdentityHeaders,
} = require('../src/serviceIdentity');

test('signed service context is request- and audience-bound', () => {
    const headers = createServiceHeaders({
        issuer: 'api-gateway',
        audience: 'auth-service',
        method: 'GET',
        path: '/internal/session/123',
        identity: { userId: '123', tenantId: 'tenant-1' },
    });
    const req = {
        method: 'GET',
        originalUrl: '/internal/session/123',
        headers: {
            'x-service-context': headers['X-Service-Context'],
            'x-service-signature': headers['X-Service-Signature'],
        },
    };
    const context = verifyServiceContext(req, 'auth-service');
    assert.equal(context.identity.userId, '123');
    assert.throws(() => verifyServiceContext({ ...req, originalUrl: '/internal/session/456' }, 'auth-service'));
    assert.throws(() => verifyServiceContext(req, 'tenant-service'));
});

test('service identity rejects unsigned direct requests', () => {
    let statusCode;
    let responseBody;
    const res = {
        status(code) { statusCode = code; return this; },
        json(body) { responseBody = body; },
    };

    requireServiceIdentity('auth-service', {
        requireUser: true,
        allowedIssuers: ['api-gateway'],
    })({ method: 'GET', originalUrl: '/api/users', headers: {} }, res, () => {
        assert.fail('unsigned request reached the route');
    });

    assert.equal(statusCode, 401);
    assert.match(responseBody.message, /signed service identity/i);
});

test('service identity enforces an allowed issuer', () => {
    const headers = createServiceHeaders({
        issuer: 'untrusted-service',
        audience: 'auth-service',
        method: 'GET',
        path: '/api/users',
        identity: { userId: '123' },
    });
    const req = {
        method: 'GET',
        originalUrl: '/api/users',
        headers: {
            'x-service-context': headers['X-Service-Context'],
            'x-service-signature': headers['X-Service-Signature'],
        },
    };
    let statusCode;
    const res = {
        status(code) { statusCode = code; return this; },
        json() {},
    };

    requireServiceIdentity('auth-service', {
        requireUser: true,
        allowedIssuers: ['api-gateway'],
    })(req, res, () => assert.fail('untrusted issuer reached the route'));

    assert.equal(statusCode, 401);
});

test('service identity rejects an excessive validity window', () => {
    const path = '/internal/example';
    const headers = createServiceHeaders({
        issuer: 'auth-service',
        audience: 'tenant-service',
        method: 'GET',
        path,
        ttlMs: 60_000,
    });
    assert.throws(() => verifyServiceContext({
        method: 'GET',
        originalUrl: path,
        headers: {
            'x-service-context': headers['X-Service-Context'],
            'x-service-signature': headers['X-Service-Signature'],
        },
    }, 'tenant-service'), /expired/i);
});

test('verified identity replaces unsigned sensitive headers', () => {
    const req = { headers: {
        'x-user-id': 'forged',
        'x-is-trial': 'true',
        'x-tenant-calling-number': 'forged-number',
    } };
    applyVerifiedIdentity(req, { identity: {
        userId: 'verified-user',
        isTrial: false,
        tenantCallingNumber: 'verified-number',
    } });
    assert.equal(req.headers['x-user-id'], 'verified-user');
    assert.equal(req.headers['x-is-trial'], 'false');
    assert.equal(req.headers['x-tenant-calling-number'], 'verified-number');
});

test('external identity headers are removed while branch selection remains', () => {
    const req = { headers: {
        'x-user-id': 'forged',
        'x-tenant-id': 'forged',
        'x-user-permissions': '{"leads":{"isGlobal":true}}',
        'x-service-signature': 'forged',
        'x-branch-id': 'selected-branch',
    } };
    stripUntrustedIdentityHeaders(req, {}, () => {});
    assert.equal(req.headers['x-user-id'], undefined);
    assert.equal(req.headers['x-user-permissions'], undefined);
    assert.equal(req.headers['x-service-signature'], undefined);
    assert.equal(req.headers['x-branch-id'], 'selected-branch');
});
