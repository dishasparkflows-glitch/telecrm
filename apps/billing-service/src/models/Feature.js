const mongoose = require('mongoose');
const { FEATURE_CATEGORIES, BILLING_TYPE } = require('@sparkcrm/shared-utils');

const featureSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Feature name is required'],
            trim: true,
        },
        slug: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },
        description: {
            type: String,
            default: '',
        },
        category: {
            type: String,
            enum: Object.values(FEATURE_CATEGORIES),
            required: true,
        },
        price: {
            type: Number,
            required: true,
            min: 0,
        },
        billingType: {
            type: String,
            enum: Object.values(BILLING_TYPE),
            default: BILLING_TYPE.RECURRING,
        },
        minPlan: {
            type: String,
            enum: ['free', 'basic', 'professional', 'enterprise'],
            default: 'free',
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        icon: {
            type: String,
            default: '🧩',
        },
        sortOrder: {
            type: Number,
            default: 0,
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
        timestamps: { createdAt: 'meta.createdAt', updatedAt: 'meta.updatedAt' }, versionKey: false }
);

featureSchema.index({ category: 1, isActive: 1 });

const Feature = mongoose.model('Feature', featureSchema);
module.exports = Feature;
