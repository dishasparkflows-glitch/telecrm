'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const {
    extractPhoneNumberIds,
    resolveWebhookSecrets,
    verifyMetaSignature,
} = require('../src/webhooks/whatsapp.webhook');
const TenantWhatsAppConfig = require('../src/models/TenantWhatsAppConfig');
const { app } = require('../src/app');

const sign = (body, secret) => `sha256=${crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex')}`;

test('Meta signature verification is bound to the exact raw payload', () => {
    const secret = 'meta-webhook-test-secret';
    const raw = Buffer.from('{"object":"whatsapp_business_account","entry":[]}');
    const signature = sign(raw, secret);

    assert.equal(verifyMetaSignature(raw, signature, [secret]), true);
    assert.equal(verifyMetaSignature(Buffer.from('{"entry":[]}'), signature, [secret]), false);
    assert.equal(verifyMetaSignature(raw, 'sha256=short', [secret]), false);
    assert.equal(verifyMetaSignature(raw, signature, []), false);
});

test('phone number extraction is bounded and checks every entry', () => {
    const entry = Array.from({ length: 25 }, (_, index) => ({
        changes: [{ value: { metadata: { phone_number_id: `phone-${index}` } } }],
    }));
    const ids = extractPhoneNumberIds({ entry });

    assert.equal(ids.length, 20);
    assert.equal(ids[0], 'phone-0');
    assert.equal(ids[19], 'phone-19');
});

test('webhook secrets fall back to the tenant configuration', async (t) => {
    const originalFindOne = TenantWhatsAppConfig.findOne;
    const originalWabaSecret = process.env.WABA_APP_SECRET;
    const originalMetaSecret = process.env.META_APP_SECRET;
    const originalFacebookSecret = process.env.FACEBOOK_APP_SECRET;
    delete process.env.WABA_APP_SECRET;
    delete process.env.META_APP_SECRET;
    delete process.env.FACEBOOK_APP_SECRET;
    TenantWhatsAppConfig.findOne = async (filter) => {
        assert.equal(filter.$or[0].sharedPhoneNumberId, 'phone-1');
        return { getDecryptedAppSecret: () => 'tenant-meta-app-secret' };
    };
    t.after(() => {
        TenantWhatsAppConfig.findOne = originalFindOne;
        if (originalWabaSecret === undefined) delete process.env.WABA_APP_SECRET;
        else process.env.WABA_APP_SECRET = originalWabaSecret;
        if (originalMetaSecret === undefined) delete process.env.META_APP_SECRET;
        else process.env.META_APP_SECRET = originalMetaSecret;
        if (originalFacebookSecret === undefined) delete process.env.FACEBOOK_APP_SECRET;
        else process.env.FACEBOOK_APP_SECRET = originalFacebookSecret;
    });

    const secrets = await resolveWebhookSecrets({
        entry: [{ changes: [{ value: { metadata: { phone_number_id: 'phone-1' } } }] }],
    });
    assert.deepEqual(secrets, ['tenant-meta-app-secret']);
});

test('mounted WhatsApp route rejects unsigned and tampered Meta callbacks', async (t) => {
    const originalWabaSecret = process.env.WABA_APP_SECRET;
    const originalMetaSecret = process.env.META_APP_SECRET;
    const originalFacebookSecret = process.env.FACEBOOK_APP_SECRET;
    process.env.WABA_APP_SECRET = 'mounted-meta-webhook-route-secret';
    delete process.env.META_APP_SECRET;
    delete process.env.FACEBOOK_APP_SECRET;

    const server = await new Promise((resolve) => {
        const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
    });
    t.after(async () => {
        if (originalWabaSecret === undefined) delete process.env.WABA_APP_SECRET;
        else process.env.WABA_APP_SECRET = originalWabaSecret;
        if (originalMetaSecret === undefined) delete process.env.META_APP_SECRET;
        else process.env.META_APP_SECRET = originalMetaSecret;
        if (originalFacebookSecret === undefined) delete process.env.FACEBOOK_APP_SECRET;
        else process.env.FACEBOOK_APP_SECRET = originalFacebookSecret;
        await new Promise((resolve, reject) => server.close((error) => (
            error ? reject(error) : resolve()
        )));
    });

    const endpoint = `http://127.0.0.1:${server.address().port}/webhooks/whatsapp`;
    const body = JSON.stringify({ object: 'whatsapp_business_account', entry: [] });
    const signature = sign(body, process.env.WABA_APP_SECRET);
    const send = (payload, suppliedSignature) => fetch(endpoint, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            ...(suppliedSignature ? { 'x-hub-signature-256': suppliedSignature } : {}),
        },
        body: payload,
    });

    assert.equal((await send(body)).status, 401);
    assert.equal((await send(`${body} `, signature)).status, 401);
    assert.equal((await send(body, signature)).status, 200);
});
