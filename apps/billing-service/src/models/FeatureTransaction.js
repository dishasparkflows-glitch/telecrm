const mongoose = require('mongoose');

const featureTransactionSchema = new mongoose.Schema(
    {
        tenantId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            index: true,
        },
        featureId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Feature',
            required: true,
        },
        featureSlug: {
            type: String,
            required: true,
        },
        action: {
            type: String,
            enum: ['purchased', 'cancelled', 'expired', 'renewed'],
            required: true,
        },
        amount: {
            type: Number,
            required: true,
            min: 0,
        },
        invoiceId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Invoice',
            default: null,
            required() {
                return ['purchased', 'renewed'].includes(this.action);
            },
        },
        relatedTransactionId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'FeatureTransaction',
            default: null,
        },
        activatedAt: {
            type: Date,
            default: Date.now,
        },
        expiresAt: {
            type: Date,
            default: null,
        },
        deactivatedAt: {
            type: Date,
            default: null,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
    },
    { timestamps: true, versionKey: false }
);

featureTransactionSchema.index({ tenantId: 1, featureSlug: 1 });
featureTransactionSchema.index({ tenantId: 1, isActive: 1 });
featureTransactionSchema.index(
    { tenantId: 1, featureSlug: 1, isActive: 1 },
    {
        name: 'unique_active_tenant_feature',
        unique: true,
        partialFilterExpression: { isActive: true },
    },
);
featureTransactionSchema.index(
    { invoiceId: 1 },
    {
        name: 'unique_feature_entitlement_invoice',
        unique: true,
        partialFilterExpression: { invoiceId: { $type: 'objectId' } },
    },
);

const FeatureTransaction = mongoose.model('FeatureTransaction', featureTransactionSchema);
module.exports = FeatureTransaction;
