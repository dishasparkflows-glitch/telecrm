const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const {
    verifyPaymentSignature,
    verifyWebhookSignature,
} = require('../src/services/razorpay.service');
const {
    toMinorUnits,
    fromMinorUnits,
    calculateTotals,
} = require('../src/services/money.service');

const secret = 'test_webhook_secret';

test('Razorpay payment signatures accept valid HMAC and reject malformed values', () => {
    const orderId = 'order_123';
    const paymentId = 'pay_456';
    const signature = crypto.createHmac('sha256', secret)
        .update(`${orderId}|${paymentId}`)
        .digest('hex');

    assert.equal(verifyPaymentSignature({ orderId, paymentId, signature, secret }), true);
    assert.equal(verifyPaymentSignature({ orderId, paymentId, signature: `${signature}00`, secret }), false);
    assert.equal(verifyPaymentSignature({ orderId, paymentId, signature: 'not-hex', secret }), false);
    assert.equal(verifyPaymentSignature({ orderId, paymentId, signature: '', secret }), false);
});

test('Razorpay webhooks verify the exact raw bytes', () => {
    const raw = Buffer.from('{"event":"payment.captured","value":1}');
    const signature = crypto.createHmac('sha256', secret).update(raw).digest('hex');
    assert.equal(verifyWebhookSignature(raw, signature, secret), true);
    assert.equal(verifyWebhookSignature(Buffer.from('{ "event":"payment.captured","value":1}'), signature, secret), false);
});

test('money conversion respects currency exponents and rounds once', () => {
    assert.equal(toMinorUnits(10.25, 'INR'), 1025);
    assert.equal(toMinorUnits(10.25, 'JPY'), 10);
    assert.equal(toMinorUnits(1.2344, 'KWD'), 1234);
    assert.equal(fromMinorUnits(1025, 'INR'), 10.25);

    assert.deepEqual(calculateTotals({ subtotal: 499, taxPercent: 18, currency: 'INR' }), {
        subtotalMinor: 49900,
        taxMinor: 8982,
        totalMinor: 58882,
        subtotal: 499,
        tax: 89.82,
        total: 588.82,
    });
});
