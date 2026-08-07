const test = require('node:test');
const assert = require('node:assert/strict');

const {
    DEFAULT_CORS_METHODS,
    createCorsOptions,
    getConfiguredOrigins,
    isOriginAllowed,
} = require('../src/cors');

const productionEnv = {
    NODE_ENV: 'production',
    CORS_ALLOWED_ORIGINS: ' https://app.example.com,https://mobile.example.com/ ',
    FRONTEND_URL: 'https://frontend.example.com',
    DASHBOARD_URL: 'https://dashboard.example.com/',
};

test('combines and normalizes all configured origins', () => {
    assert.deepEqual([...getConfiguredOrigins(productionEnv)], [
        'https://app.example.com',
        'https://mobile.example.com',
        'https://frontend.example.com',
        'https://dashboard.example.com',
    ]);
});

test('allows configured origins and rejects unconfigured origins', () => {
    assert.equal(isOriginAllowed('https://app.example.com', productionEnv), true);
    assert.equal(isOriginAllowed('https://dashboard.example.com', productionEnv), true);
    assert.equal(isOriginAllowed('https://unknown.example.com', productionEnv), false);
});

test('allows loopback origins only outside production', () => {
    assert.equal(isOriginAllowed('http://localhost:5173', { NODE_ENV: 'development' }), true);
    assert.equal(isOriginAllowed('https://127.0.0.1:3000', { NODE_ENV: 'test' }), true);
    assert.equal(isOriginAllowed('http://localhost:5173', productionEnv), false);
    assert.equal(isOriginAllowed('http://127.0.0.1:3000', {
        ...productionEnv,
        CORS_ALLOWED_ORIGINS: 'http://127.0.0.1:3000',
    }), false);
});

test('allows chrome extensions only when explicitly configured', () => {
    const extensionOrigin = 'chrome-extension://abcdefghijklmnop';
    assert.equal(isOriginAllowed(extensionOrigin, productionEnv), false);
    assert.equal(isOriginAllowed(extensionOrigin, {
        ...productionEnv,
        CORS_ALLOWED_ORIGINS: extensionOrigin,
    }), true);
});

test('allows requests without Origin for non-browser clients and webhooks', () => {
    assert.equal(isOriginAllowed(undefined, productionEnv), true);
    assert.equal(isOriginAllowed('', productionEnv), true);
});

test('creates credentialed options with broad methods and reflected request headers', () => {
    const options = createCorsOptions(productionEnv);
    let allowed;
    options.origin('https://frontend.example.com', (error, result) => {
        assert.equal(error, null);
        allowed = result;
    });

    assert.equal(allowed, true);
    assert.equal(options.credentials, true);
    assert.deepEqual(options.methods, DEFAULT_CORS_METHODS);
    assert.equal(Object.prototype.hasOwnProperty.call(options, 'allowedHeaders'), false);
});
