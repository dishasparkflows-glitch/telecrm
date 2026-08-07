'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const FeatureTransaction = require('../src/models/FeatureTransaction');
const Invoice = require('../src/models/Invoice');
const {
    assertFeatureInvoiceInvariant,
    ensureLocalEntitlement,
    finalizeInvoicePayment,
} = require('../src/services/paymentLifecycle.service');
const {
    featureCheckoutResponse,
    readIdempotencyKey,
} = require('../src/controllers/feature.controller');

const ids = {
    tenant: new mongoose.Types.ObjectId(),
    feature: new mongoose.Types.ObjectId(),
    invoice: new mongoose.Types.ObjectId(),
    transaction: new mongoose.Types.ObjectId(),
};

const paidFeatureInvoice = (overrides = {}) => ({
    _id: ids.invoice,
    tenantId: ids.tenant,
    type: 'feature_purchase',
    featureId: ids.feature,
    featureSlug: 'whatsapp-chatbot',
    subtotal: 499,
    status: 'paid',
    paidAt: new Date('2026-01-01T00:00:00.000Z'),
    periodEnd: new Date('2026-02-01T00:00:00.000Z'),
    entitlementGrantedAt: null,
    ...overrides,
});

test('feature purchase documents require complete invoice identity', async () => {
    const invoice = new Invoice({
        tenantId: ids.tenant,
        invoiceNumber: 'FEAT-TEST-MISSING',
        type: 'feature_purchase',
        items: [{ name: 'Feature', quantity: 1, unitPrice: 10, total: 10 }],
        subtotal: 10,
        total: 10,
    });
    await assert.rejects(invoice.validate(), /feature/i);

    const transaction = new FeatureTransaction({
        tenantId: ids.tenant,
        featureId: ids.feature,
        featureSlug: 'whatsapp-chatbot',
        action: 'purchased',
        amount: 499,
        isActive: true,
    });
    await assert.rejects(transaction.validate(), /invoiceId/i);
});

test('feature lifecycle schemas enforce active and invoice uniqueness', () => {
    const transactionIndexes = FeatureTransaction.schema.indexes();
    const active = transactionIndexes.find(([, options]) => options.name === 'unique_active_tenant_feature');
    const invoice = transactionIndexes.find(([, options]) => options.name === 'unique_feature_entitlement_invoice');
    const checkout = Invoice.schema.indexes()
        .find(([, options]) => options.name === 'unique_tenant_checkout_idempotency');
    const openCheckout = Invoice.schema.indexes()
        .find(([, options]) => options.name === 'unique_open_feature_checkout');

    assert.equal(active[1].unique, true);
    assert.deepEqual(active[1].partialFilterExpression, { isActive: true });
    assert.equal(invoice[1].unique, true);
    assert.equal(checkout[1].unique, true);
    assert.equal(openCheckout[1].unique, true);
    assert.deepEqual(openCheckout[1].partialFilterExpression, {
        type: 'feature_purchase', checkoutOpen: true,
    });
});

test('feature entitlement rejects incomplete or unpaid invoices', async () => {
    assert.throws(() => assertFeatureInvoiceInvariant(paidFeatureInvoice({ featureId: null })), /identity/i);
    assert.throws(() => assertFeatureInvoiceInvariant(paidFeatureInvoice({
        status: 'pending', paidAt: null,
    })), /paid invoice/i);
    await assert.rejects(
        finalizeInvoicePayment(paidFeatureInvoice({ featureId: null }), {
            provider: 'razorpay', paymentId: 'payment-1', paymentMethod: 'card',
        }),
        (error) => error.code === 'INVALID_FEATURE_INVOICE',
    );
});

test('feature entitlement replay returns the invoice transaction and marks the invoice once', async (t) => {
    const originalFindOneAndUpdate = FeatureTransaction.findOneAndUpdate;
    const originalInvoiceUpdateOne = Invoice.updateOne;
    const entitlement = {
        _id: ids.transaction,
        tenantId: ids.tenant,
        featureId: ids.feature,
        featureSlug: 'whatsapp-chatbot',
        invoiceId: ids.invoice,
        isActive: true,
    };
    let entitlementQuery;
    let invoiceUpdate;
    FeatureTransaction.findOneAndUpdate = async (query) => {
        entitlementQuery = query;
        return entitlement;
    };
    Invoice.updateOne = async (query, update) => {
        invoiceUpdate = { query, update };
    };
    t.after(() => {
        FeatureTransaction.findOneAndUpdate = originalFindOneAndUpdate;
        Invoice.updateOne = originalInvoiceUpdateOne;
    });

    const result = await ensureLocalEntitlement(paidFeatureInvoice());
    assert.equal(result, entitlement);
    assert.deepEqual(entitlementQuery, { invoiceId: ids.invoice });
    assert.deepEqual(invoiceUpdate.query, { _id: ids.invoice, entitlementGrantedAt: null });
});

test('a competing paid invoice cannot replace an active entitlement', async (t) => {
    const originalFindOneAndUpdate = FeatureTransaction.findOneAndUpdate;
    const originalFindOne = FeatureTransaction.findOne;
    FeatureTransaction.findOneAndUpdate = async () => {
        const error = new Error('duplicate key');
        error.code = 11000;
        throw error;
    };
    FeatureTransaction.findOne = async (query) => (
        query.invoiceId
            ? null
            : { invoiceId: new mongoose.Types.ObjectId(), isActive: true }
    );
    t.after(() => {
        FeatureTransaction.findOneAndUpdate = originalFindOneAndUpdate;
        FeatureTransaction.findOne = originalFindOne;
    });

    await assert.rejects(
        ensureLocalEntitlement(paidFeatureInvoice()),
        (error) => error.code === 'ACTIVE_FEATURE_ENTITLEMENT_CONFLICT',
    );
});

test('feature checkout helpers preserve request and provider idempotency values', () => {
    assert.equal(readIdempotencyKey({
        headers: { 'idempotency-key': ' checkout-request-12345 ' },
        body: {},
    }), 'checkout-request-12345');
    assert.equal(readIdempotencyKey({
        headers: {},
        body: { idempotencyKey: 'body-checkout-key-12345' },
    }), 'body-checkout-key-12345');

    assert.deepEqual(featureCheckoutResponse({
        razorpayOrderId: 'order-1',
        totalMinor: 58882,
        currency: 'INR',
        _id: ids.invoice,
    }, { slug: 'whatsapp-chatbot' }, 'public-key'), {
        orderId: 'order-1',
        amount: 58882,
        currency: 'INR',
        invoiceId: ids.invoice,
        feature: { slug: 'whatsapp-chatbot' },
        razorpayKeyId: 'public-key',
    });
});
