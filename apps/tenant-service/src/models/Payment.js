const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
    {
        tenantId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Tenant',
            required: true,
            index: true,
        },
        plan: {
            planId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Plan',
                required: true,
            },
            name: {
                type: String,
                required: true,
            },
            billingCycle: {
                type: String,
                enum: ['monthly', 'yearly', 'trial', 'none'],
                default: 'monthly',
            },
        },
        invoice: {
            number: {
                type: String,
                required: true,
                unique: true,
            },
            amount: {
                type: Number,
                required: true,
                min: 0,
            },
            currency: {
                type: String,
                default: 'INR',
                enum: ['INR', 'USD'],
            },
            description: { type: String, default: '' },
            receiptUrl: { type: String, default: '' },
        },
        subscription: {
            status: {
                type: String,
                enum: ['pending', 'completed', 'failed', 'refunded', 'trial'],
                default: 'pending',
            },
            periodStart: { type: Date, default: null },
            periodEnd: { type: Date, default: null },
        },
        payment: {
            method: {
                type: String,
                enum: ['razorpay', 'stripe', 'card', 'upi', 'netbanking', 'wallet', 'free', 'none'],
                default: 'none',
            },
            status: {
                type: String,
                enum: ['pending', 'paid', 'completed', 'failed', 'refunded', 'trial'],
                default: 'pending',
            },
            razorpay: {
                paymentId: { type: String, default: null },
                orderId: { type: String, default: null },
            },
            stripe: {
                paymentIntentId: { type: String, default: null },
                sessionId: { type: String, default: null },
            },
            paidAt: { type: Date, default: null },
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

paymentSchema.index({ tenantId: 1, createdAt: -1 });

const Payment = mongoose.model('Payment', paymentSchema);
module.exports = Payment;
