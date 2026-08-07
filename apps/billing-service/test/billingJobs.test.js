'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const Invoice = require('../src/models/Invoice');
const {
    formatBillingJobError,
    reconciliationDelayMs,
    schedulePaymentReconciliation,
} = require('../src/services/billingJobs.service');

test('billing job errors preserve Razorpay details when no Error message exists', () => {
    assert.equal(
        formatBillingJobError({
            statusCode: 400,
            error: { code: 'BAD_REQUEST_ERROR', description: 'The order does not exist' },
        }),
        'The order does not exist code=BAD_REQUEST_ERROR status=400'
    );
    assert.equal(formatBillingJobError(undefined), 'Unknown provider error');
    assert.equal(formatBillingJobError('network unavailable'), 'network unavailable');
});

test('payment reconciliation backoff grows exponentially and is capped', () => {
    assert.equal(reconciliationDelayMs(0), 60_000);
    assert.equal(reconciliationDelayMs(1), 120_000);
    assert.equal(reconciliationDelayMs(2), 240_000);
    assert.equal(reconciliationDelayMs(20), 6 * 60 * 60 * 1000);
});

test('scheduling reconciliation persists retry metadata without changing payment status', async (t) => {
    const originalUpdateOne = Invoice.updateOne;
    let captured;
    Invoice.updateOne = async (query, update) => {
        captured = { query, update };
    };
    t.after(() => { Invoice.updateOne = originalUpdateOne; });

    const before = Date.now();
    const invoiceId = new mongoose.Types.ObjectId();
    await schedulePaymentReconciliation(
        { _id: invoiceId, reconciliationAttempts: 2 },
        { error: { code: 'SERVER_ERROR', description: 'Provider temporarily unavailable' } }
    );

    assert.deepEqual(captured.query, {
        _id: invoiceId,
        status: 'pending',
        checkoutStatus: 'ready',
    });
    assert.deepEqual(captured.update.$inc, { reconciliationAttempts: 1 });
    assert.equal(captured.update.$set.lastReconciliationError, 'Provider temporarily unavailable code=SERVER_ERROR');
    assert.ok(captured.update.$set.nextReconciliationAt instanceof Date);
    assert.ok(captured.update.$set.nextReconciliationAt.getTime() >= before + 240_000);
    assert.ok(captured.update.$set.nextReconciliationAt.getTime() <= Date.now() + 240_000);
    assert.equal(captured.update.$set.status, undefined);
});

test('invoice reconciliation metadata is private and indexed for due polling', () => {
    assert.equal(Invoice.schema.path('reconciliationAttempts').options.select, false);
    assert.equal(Invoice.schema.path('nextReconciliationAt').options.select, false);
    assert.equal(Invoice.schema.path('lastReconciliationError').options.select, false);

    const index = Invoice.schema.indexes().find(([keys]) => (
        keys.status === 1 && keys.checkoutStatus === 1 && keys.nextReconciliationAt === 1
    ));
    assert.ok(index);
});
