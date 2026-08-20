const mongoose = require('mongoose');

const referralSchema = new mongoose.Schema(
    {
        referrerTenantId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Tenant',
            required: true,
        },
        referredTenantId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Tenant',
            default: null,
        },
        referralCode: {
            type: String,
            required: true,
        },
        status: {
            type: String,
            enum: ['registered', 'converted', 'expired'],
            default: 'registered',
        },
        rewardType: {
            type: String,
            enum: ['free_month', 'discount', 'credits'],
            default: 'free_month',
        },
        rewardApplied: {
            type: Boolean,
            default: false,
        },
        convertedAt: {
            type: Date,
            default: null,
        },
        meta: {
            createdBy: { type: mongoose.Schema.Types.ObjectId },
            updatedBy: { type: mongoose.Schema.Types.ObjectId },
            deletedBy: { type: mongoose.Schema.Types.ObjectId },
            createdAt: { type: Date, default: Date.now },
            updatedAt: { type: Date, default: Date.now },
            deletedAt: { type: Date },
        },
    },
    {
        timestamps: { createdAt: 'meta.createdAt', updatedAt: 'meta.updatedAt' }, versionKey: false
    }
);

referralSchema.index({ referrerTenantId: 1 });
referralSchema.index({ referralCode: 1 });
referralSchema.index({ status: 1 });
referralSchema.index(
    { referredTenantId: 1 },
    { unique: true, partialFilterExpression: { referredTenantId: { $type: 'objectId' } } }
);

const Referral = mongoose.model('Referral', referralSchema);
module.exports = Referral;
