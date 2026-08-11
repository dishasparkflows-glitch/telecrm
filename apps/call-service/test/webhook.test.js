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

test('mounted Exotel route parses raw body correctly', async (t) => {
    const originalFindOne = CallLog.findOne;
    CallLog.findOne = async () => null;

    const server = await new Promise((resolve) => {
        const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
    });
    t.after(async () => {
        CallLog.findOne = originalFindOne;
        await new Promise((resolve, reject) => server.close((error) => (
            error ? reject(error) : resolve()
        )));
    });

    const endpoint = `http://127.0.0.1:${server.address().port}/webhooks/exotel`;
    const body = 'CallSid=call-1&Status=completed';
    const send = (payload) => fetch(endpoint, {
        method: 'POST',
        headers: {
            'content-type': 'application/x-www-form-urlencoded',
        },
        body: payload,
    });

    assert.equal((await send(body)).status, 200);
});
