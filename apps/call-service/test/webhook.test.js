const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { authenticateAndParse } = require('../src/webhooks/exotel.webhook');
const CallLog = require('../src/models/CallLog');
const app = require('../src/app');

const invoke = (signature) => {
    const raw = Buffer.from('CallSid=call-1&Status=completed');
    const req = { body: raw, headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-exotel-signature': signature } };
    let statusCode;
    const res = {
        status(code) { statusCode = code; return this; },
        json(payload) { return payload; },
    };
    let nextCalled = false;
    authenticateAndParse(req, res, () => { nextCalled = true; });
    return { req, statusCode, nextCalled };
};

test('accepts only a valid Exotel HMAC over the raw body', () => {
    process.env.EXOTEL_WEBHOOK_SECRET = 'test-only-webhook-secret';
    delete process.env.EXOTEL_WEBHOOK_USERNAME;
    delete process.env.EXOTEL_WEBHOOK_PASSWORD;
    const raw = Buffer.from('CallSid=call-1&Status=completed');
    const valid = crypto.createHmac('sha256', process.env.EXOTEL_WEBHOOK_SECRET).update(raw).digest('hex');

    const accepted = invoke(valid);
    assert.equal(accepted.nextCalled, true);
    assert.equal(accepted.req.body.CallSid, 'call-1');
    assert.equal(invoke('invalid').statusCode, 401);
    delete process.env.EXOTEL_WEBHOOK_SECRET;
});

test('fails closed when Exotel verification is not configured', () => {
    delete process.env.EXOTEL_WEBHOOK_SECRET;
    delete process.env.EXOTEL_WEBHOOK_USERNAME;
    delete process.env.EXOTEL_WEBHOOK_PASSWORD;
    assert.equal(invoke('').statusCode, 503);
});

test('mounted Exotel route verifies the exact raw body before processing', async (t) => {
    const originalSecret = process.env.EXOTEL_WEBHOOK_SECRET;
    const originalFindOne = CallLog.findOne;
    process.env.EXOTEL_WEBHOOK_SECRET = 'mounted-route-test-webhook-secret';
    CallLog.findOne = async () => null;

    const server = await new Promise((resolve) => {
        const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
    });
    t.after(async () => {
        CallLog.findOne = originalFindOne;
        if (originalSecret === undefined) delete process.env.EXOTEL_WEBHOOK_SECRET;
        else process.env.EXOTEL_WEBHOOK_SECRET = originalSecret;
        await new Promise((resolve, reject) => server.close((error) => (
            error ? reject(error) : resolve()
        )));
    });

    const endpoint = `http://127.0.0.1:${server.address().port}/webhooks/exotel`;
    const body = 'CallSid=call-1&Status=completed';
    const signature = crypto
        .createHmac('sha256', process.env.EXOTEL_WEBHOOK_SECRET)
        .update(body)
        .digest('hex');
    const send = (payload, suppliedSignature) => fetch(endpoint, {
        method: 'POST',
        headers: {
            'content-type': 'application/x-www-form-urlencoded',
            ...(suppliedSignature ? { 'x-exotel-signature': suppliedSignature } : {}),
        },
        body: payload,
    });

    assert.equal((await send(body)).status, 401);
    assert.equal((await send(`${body}&Duration=10`, signature)).status, 401);
    assert.equal((await send(body, signature)).status, 200);
});
