const mongoose = require('mongoose');
const { INVOICE_STATUS } = require('@sparkcrm/shared-utils');

const invoiceSchema = new mongoose.Schema(
    {
        tenantId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            index: true,
        },
        invoiceNumber: {
            type: String,
            unique: true,
            required: true,
        },
        type: {
            type: String,
            enum: ['subscription', 'feature_purchase', 'addon', 'refund'],
            required: true,
        },
        description: {
            type: String,
            default: '',
        },
        planId: {
            type: String,
            default: null,
        },
        planSlug: {
            type: String,
            default: null,
        },
        featureId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Feature',
            default: null,
            required() {
                return this.type === 'feature_purchase';
            },
        },
        featureSlug: {
            type: String,
            default: null,
            required() {
                return this.type === 'feature_purchase';
            },
        },
        checkoutIdempotencyKey: {
            type: String,
            default: null,
            trim: true,
            maxlength: 128,
        },
        billingCycle: {
            type: String,
            enum: ['monthly', 'yearly'],
            default: null,
        },
        paymentProvider: {
            type: String,
            enum: ['razorpay', 'stripe'],
            default: null,
        },
        paymentMethod: {
            type: String,
            // Provider-valued entries are retained for compatibility with invoices
            // created before payment provider and method were stored separately.
            enum: ['card', 'international_card', 'google_pay_qr', 'razorpay', 'stripe', 'upi'],
            default: null,
        },
        gatewayPaymentMethod: {
            type: String,
            default: null,
        },
        items: [
            {
                name: { type: String, required: true },
                quantity: { type: Number, default: 1 },
                unitPrice: { type: Number, required: true },
                total: { type: Number, required: true },
                description: { type: String, default: '' },
            },
        ],
        subtotal: {
            type: Number,
            required: true,
        },
        tax: {
            type: Number,
            default: 0,
        },
        taxPercent: {
            type: Number,
            default: 18, // GST 18%
        },
        total: {
            type: Number,
            required: true,
        },
        subtotalMinor: {
            type: Number,
            default: null,
        },
        taxMinor: {
            type: Number,
            default: null,
        },
        totalMinor: {
            type: Number,
            default: null,
        },
        currency: {
            type: String,
            default: 'INR',
        },
        status: {
            type: String,
            enum: Object.values(INVOICE_STATUS),
            default: INVOICE_STATUS.PENDING,
        },
        checkoutStatus: {
            type: String,
            enum: ['creating', 'ready', 'completed', 'failed', 'expired'],
            default: 'creating',
        },
        checkoutOpen: {
            type: Boolean,
            default: false,
        },

        // ─── Payment Details ───
        razorpayOrderId: {
            type: String,
            default: null,
        },
        razorpayPaymentId: {
            type: String,
            default: null,
        },
        razorpaySubscriptionId: {
            type: String,
            default: null,
        },
        stripeSessionId: {
            type: String,
            default: null,
        },
        stripePaymentIntentId: {
            type: String,
            default: null,
        },
        razorpayQrCodeId: {
            type: String,
            default: null,
        },
        qrCodeImageUrl: {
            type: String,
            default: null,
        },
        qrCodeExpiresAt: {
            type: Date,
            default: null,
        },
        paidAt: {
            type: Date,
            default: null,
        },
        entitlementGrantedAt: {
            type: Date,
            default: null,
        },
        reconciliationAttempts: {
            type: Number,
            default: 0,
            select: false,
        },
        nextReconciliationAt: {
            type: Date,
            default: null,
            select: false,
        },
        lastReconciliationError: {
            type: String,
            default: null,
            select: false,
        },
        pdfUrl: {
            type: String,
            default: null,
        },
        pdfObjectKey: {
            type: String,
            default: null,
            select: false,
        },
        outboxEvents: {
            type: [
                {
                    eventId: { type: String, required: true },
                    eventType: { type: String, required: true },
                    payload: { type: mongoose.Schema.Types.Mixed, required: true },
                    status: {
                        type: String,
                        enum: ['pending', 'processing', 'published', 'failed'],
                        default: 'pending',
                    },
                    attempts: { type: Number, default: 0 },
                    nextAttemptAt: { type: Date, default: Date.now },
                    publishedAt: { type: Date, default: null },
                    lastError: { type: String, default: null },
                },
            ],
            default: [],
            select: false,
        },

        // ─── Billing Period ───
        periodStart: {
            type: Date,
            default: null,
        },
        periodEnd: {
            type: Date,
            default: null,
        },
    },
    { timestamps: true, versionKey: false }
);

invoiceSchema.index({ tenantId: 1, createdAt: -1 });
invoiceSchema.index(
    { tenantId: 1, type: 1, checkoutIdempotencyKey: 1 },
    {
        name: 'unique_tenant_checkout_idempotency',
        unique: true,
        partialFilterExpression: { checkoutIdempotencyKey: { $type: 'string' } },
    },
);
invoiceSchema.index(
    { tenantId: 1, featureSlug: 1, checkoutOpen: 1 },
    {
        name: 'unique_open_feature_checkout',
        unique: true,
        partialFilterExpression: { type: 'feature_purchase', checkoutOpen: true },
    },
);

invoiceSchema.index({ status: 1 });
invoiceSchema.index({ status: 1, checkoutStatus: 1, nextReconciliationAt: 1 });
invoiceSchema.index({ razorpayOrderId: 1 });
invoiceSchema.index(
    { stripeSessionId: 1 },
    { unique: true, partialFilterExpression: { stripeSessionId: { $type: 'string' } } }
);
invoiceSchema.index(
    { stripePaymentIntentId: 1 },
    { unique: true, partialFilterExpression: { stripePaymentIntentId: { $type: 'string' } } }
);
invoiceSchema.index(
    { razorpayQrCodeId: 1 },
    { unique: true, partialFilterExpression: { razorpayQrCodeId: { $type: 'string' } } }
);

const Invoice = mongoose.model('Invoice', invoiceSchema);
module.exports = Invoice;
