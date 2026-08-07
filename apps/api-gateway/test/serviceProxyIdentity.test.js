'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

process.env.INTERNAL_SERVICE_SECRET = 'test-service-secret-that-is-at-least-32-characters';

const { verifyServiceContext } = require('@sparkcrm/shared-middleware');
const {
    SERVICE_ROUTES,
    createGatewayServiceHeaders,
} = require('../src/proxy/serviceProxy');

function receiverRequest(request, headers) {
    return {
        method: request.method,
        originalUrl: request.originalUrl,
        headers: {
            'x-service-context': headers['X-Service-Context'],
            'x-service-signature': headers['X-Service-Signature'],
        },
    };
}

test('gateway signs protected requests with verified identity and exact query path', () => {
    const request = {
        method: 'GET',
        path: '/api/leads',
        originalUrl: '/api/leads?page=2&limit=25',
        headers: {
            'x-user-permissions': JSON.stringify({ leads: { view: true, isOwn: true } }),
            'x-tenant-calling-number': '+10000000000',
        },
        userId: 'user-1',
        tenantId: 'tenant-1',
        userRole: 'agent',
        userBranchId: 'branch-1',
        userRoleId: 'role-1',
        isTrial: false,
    };

    const headers = createGatewayServiceHeaders(
        SERVICE_ROUTES['/api/leads'],
        'lead-service',
        request,
    );
    const context = verifyServiceContext(receiverRequest(request, headers), 'lead-service', {
        allowedIssuers: ['api-gateway'],
    });

    assert.equal(context.identity.userId, 'user-1');
    assert.equal(context.identity.tenantId, 'tenant-1');
    assert.equal(context.identity.branchId, 'branch-1');
    assert.equal(context.identity.tenantCallingNumber, '+10000000000');
});

test('gateway does not attach service identity to public routes', () => {
    const request = {
        method: 'POST',
        path: '/api/auth/login',
        originalUrl: '/api/auth/login',
        headers: {},
    };

    assert.equal(createGatewayServiceHeaders(
        SERVICE_ROUTES['/api/auth'],
        'auth-service',
        request,
    ), null);
    assert.equal(createGatewayServiceHeaders(
        SERVICE_ROUTES['/webhooks/whatsapp'],
        'whatsapp-service',
        {
            method: 'POST',
            path: '/webhooks/whatsapp',
            originalUrl: '/webhooks/whatsapp',
            headers: {},
        },
    ), null);
    assert.equal(createGatewayServiceHeaders(
        SERVICE_ROUTES['/socket.io'],
        'whatsapp-service',
        {
            method: 'GET',
            path: '/socket.io',
            originalUrl: '/socket.io?EIO=4&transport=polling',
            headers: {},
        },
    ), null);
});
