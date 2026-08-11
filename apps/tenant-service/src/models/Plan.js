const mongoose = require('mongoose');

const planSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Plan name is required'],
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
        price: {
            type: Number,
            required: true,
            min: 0,
        },
        yearlyPrice: {
            type: Number,
            default: 0,
            min: 0,
        },
        perUserPrice: {
            type: Number,
            default: 0,
            min: 0,
        },
        currency: {
            type: String,
            default: 'INR',
            enum: ['INR', 'USD'],
        },
        features: [
            {
                type: String,
                trim: true,
            },
        ],
        limits: {
            maxUsers: { type: Number, default: 1 },
            maxLeadsPerMonth: { type: Number, default: 100 },
            maxCallsPerDay: { type: Number, default: 0 },
            maxWhatsappMessagesPerDay: { type: Number, default: 0 },
            storageGB: { type: Number, default: 1 },
        },
        moduleKeys: [
            {
                type: String,
                trim: true,
                lowercase: true,
            },
        ],
        isTrial: {
            type: Boolean,
            default: false,
        },
        trialDurationDays: {
            type: Number,
            default: 30,
        },
        isActive: {
            type: Boolean,
            default: true,
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
        timestamps: { createdAt: 'meta.createdAt', updatedAt: 'meta.updatedAt' }, versionKey: false
    }
);

planSchema.index({ isActive: 1, sortOrder: 1 });

const Plan = mongoose.model('Plan', planSchema);
module.exports = Plan;
