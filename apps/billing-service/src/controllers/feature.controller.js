const crypto = require('node:crypto');
const Feature = require('../models/Feature');
const FeatureTransaction = require('../models/FeatureTransaction');
const Invoice = require('../models/Invoice');
const razorpayService = require('../services/razorpay.service');
const { ApiResponse, ApiError, asyncHandler, INVOICE_STATUS } = require('@sparkcrm/shared-utils');
const { publishEvent, EVENTS } = require('@sparkcrm/shared-events');
const { calculateTotals } = require('../services/money.service');
const { getActivePaymentConfig, getProviderCredentials } = require('../services/paymentConfig.service');
const { ensureLocalEntitlement } = require('../services/paymentLifecycle.service');

const readIdempotencyKey = (req) => String(
    req.headers['idempotency-key'] || req.body?.idempotencyKey || ''
).trim();

const featureCheckoutResponse = (invoice, feature, keyId) => ({
    orderId: invoice.razorpayOrderId,
    amount: invoice.totalMinor,
    currency: invoice.currency,
    invoiceId: invoice._id,
    feature,
    razorpayKeyId: keyId,
});

/**
 * GET /api/features/store
 * Get all available features for the marketplace
 */
const getFeatureStore = asyncHandler(async (req, res) => {
    const features = await Feature.find({ isActive: true }).sort({ category: 1, sortOrder: 1 });

    // Group by category
    const grouped = {};
    features.forEach((f) => {
        if (!grouped[f.category]) grouped[f.category] = [];
        grouped[f.category].push(f);
    });

    ApiResponse.success(res, { features, grouped }, 'Feature store loaded');
});

/**
 * POST /api/features/purchase
 * Purchase a feature add-on
 */
const purchaseFeature = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const { featureSlug } = req.body;
    const idempotencyKey = readIdempotencyKey(req);

    if (!featureSlug) throw ApiError.badRequest('Feature slug is required');
    if (idempotencyKey.length < 16 || idempotencyKey.length > 128) {
        throw ApiError.badRequest('A 16-128 character Idempotency-Key is required');
    }

    const feature = await Feature.findOne({ slug: featureSlug, isActive: true });
    if (!feature) throw ApiError.notFound('Feature not found');

    const activeEntitlement = await FeatureTransaction.findOne({
        tenantId,
        featureSlug: feature.slug,
        isActive: true,
    });
    if (activeEntitlement) throw ApiError.conflict('Feature already purchased and active');
    if (!Number.isFinite(feature.price) || feature.price <= 0) {
        throw ApiError.badRequest('Feature price must be greater than zero for checkout');
    }

    const paymentConfig = await getActivePaymentConfig('razorpay');
    const { keyId, keySecret } = getProviderCredentials(paymentConfig);

    const existingInvoice = await Invoice.findOne({
        tenantId,
        type: 'feature_purchase',
        checkoutIdempotencyKey: idempotencyKey,
    });
    if (existingInvoice) {
        if (String(existingInvoice.featureId) !== String(feature._id)) {
            throw ApiError.conflict('Idempotency-Key was already used for another feature');
        }
        if (existingInvoice.checkoutStatus === 'ready' && existingInvoice.razorpayOrderId) {
            return ApiResponse.success(
                res,
                featureCheckoutResponse(existingInvoice, feature, keyId),
                'Feature purchase order already created'
            );
        }
        throw ApiError.conflict(`Feature checkout is ${existingInvoice.checkoutStatus}; use a new Idempotency-Key if retry is required`);
    }

    const invoiceNumber = `FEAT-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const currency = 'INR';
    const totals = calculateTotals({ subtotal: feature.price, taxPercent: 18, currency });
    let invoice;
    try {
        invoice = await Invoice.create({
            tenantId,
            invoiceNumber,
            type: 'feature_purchase',
            featureId: feature._id,
            featureSlug: feature.slug,
            checkoutIdempotencyKey: idempotencyKey,
            checkoutStatus: 'creating',
            checkoutOpen: true,
            paymentProvider: 'razorpay',
            paymentMethod: 'card',
            description: `Add-on: ${feature.name}`,
            items: [{ name: feature.name, quantity: 1, unitPrice: totals.subtotal, total: totals.subtotal }],
            subtotal: totals.subtotal,
            tax: totals.tax,
            taxPercent: 18,
            total: totals.total,
            subtotalMinor: totals.subtotalMinor,
            taxMinor: totals.taxMinor,
            totalMinor: totals.totalMinor,
            currency,
            status: INVOICE_STATUS.PENDING,
        });
    } catch (error) {
        if (error?.code !== 11000) throw error;
        const racedInvoice = await Invoice.findOne({
            tenantId,
            type: 'feature_purchase',
            checkoutIdempotencyKey: idempotencyKey,
        });
        if (racedInvoice?.checkoutStatus === 'ready' && racedInvoice.razorpayOrderId) {
            return ApiResponse.success(
                res,
                featureCheckoutResponse(racedInvoice, feature, keyId),
                'Feature purchase order already created'
            );
        }
        throw ApiError.conflict('Another feature checkout is already open for this tenant');
    }

    try {
        const order = await razorpayService.createAdhocOrder(keyId, keySecret, {
            amount: totals.total,
            currency,
            receipt: invoiceNumber,
            notes: {
                tenantId: String(tenantId),
                featureSlug: feature.slug,
                featureId: String(feature._id),
                invoiceId: String(invoice._id),
            },
        });
        invoice = await Invoice.findOneAndUpdate(
            { _id: invoice._id, checkoutStatus: 'creating', checkoutOpen: true },
            { $set: { razorpayOrderId: order.id, checkoutStatus: 'ready' } },
            { new: true }
        );
        if (!invoice) throw new Error('Feature invoice checkout state changed unexpectedly');
    } catch (error) {
        await Invoice.updateOne(
            { _id: invoice._id, checkoutStatus: 'creating' },
            { $set: { checkoutStatus: 'failed', checkoutOpen: false } }
        );
        throw ApiError.internal(`Feature payment order creation failed: ${error.message}`);
    }

    ApiResponse.success(
        res,
        featureCheckoutResponse(invoice, feature, keyId),
        'Feature purchase order created'
    );
});

/**
 * POST /api/features/activate
 * Activate a feature after payment verification (called after verify-payment)
 */
const activateFeature = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const { featureSlug, invoiceId } = req.body;

    if (!invoiceId || !featureSlug) {
        throw ApiError.badRequest('Paid invoice and feature slug are required');
    }

    const invoice = await Invoice.findOne({
        _id: invoiceId,
        tenantId,
        type: 'feature_purchase',
        featureSlug,
        status: INVOICE_STATUS.PAID,
    });
    if (!invoice?.featureId) throw ApiError.badRequest('Invoice is not eligible for feature activation');

    const feature = await Feature.findOne({
        _id: invoice.featureId,
        slug: invoice.featureSlug,
        isActive: true,
    });
    if (!feature) throw ApiError.notFound('Feature linked to the paid invoice was not found');

    const transaction = await ensureLocalEntitlement(invoice);
    ApiResponse.success(res, transaction, 'Feature entitlement verified');
});

/**
 * GET /api/features/purchased
 * Get purchased features for the current tenant
 */
const getPurchasedFeatures = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];

    const purchased = await FeatureTransaction.find({
        tenantId,
        isActive: true,
    }).populate('featureId');

    ApiResponse.success(res, purchased, 'Purchased features fetched');
});

/**
 * POST /api/features/cancel
 * Cancel a purchased feature
 */
const cancelFeature = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const { featureSlug } = req.body;

    if (!featureSlug) throw ApiError.badRequest('Feature slug is required');

    const transaction = await FeatureTransaction.findOneAndUpdate(
        { tenantId, featureSlug, isActive: true },
        { $set: { isActive: false, deactivatedAt: new Date() } },
        { new: true }
    );
    if (!transaction) throw ApiError.notFound('Active feature not found');

    await FeatureTransaction.create({
        tenantId,
        featureId: transaction.featureId,
        featureSlug,
        action: 'cancelled',
        amount: 0,
        relatedTransactionId: transaction._id,
        activatedAt: new Date(),
        deactivatedAt: new Date(),
        isActive: false,
    });

    await publishEvent(EVENTS.FEATURE_CANCELLED, {
        tenantId,
        featureSlug,
        transactionId: transaction._id,
    });

    ApiResponse.success(res, null, 'Feature cancelled');
});

module.exports = {
    getFeatureStore,
    purchaseFeature,
    activateFeature,
    getPurchasedFeatures,
    cancelFeature,
    featureCheckoutResponse,
    readIdempotencyKey,
};
