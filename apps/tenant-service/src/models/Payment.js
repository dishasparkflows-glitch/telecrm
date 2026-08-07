const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
    {
        tenantId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Tenant',
            required: true,
            index: true,
        },
        planId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Plan',
            required: true,
        },
        planName: {
            type: String,
            required: true,
        },
        invoiceNumber: {
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
        billingCycle: {
            type: String,
            enum: ['monthly', 'yearly', 'trial', 'none'],
            default: 'monthly',
        },
        status: {
            type: String,
            enum: ['pending', 'completed', 'failed', 'refunded', 'trial'],
            default: 'pending',
        },
        method: {
            type: String,
            enum: ['razorpay', 'stripe', 'card', 'upi', 'netbanking', 'wallet', 'free', 'none'],
            default: 'none',
        },
        // Payment gateway references
        razorpayPaymentId: { type: String, default: null },
        razorpayOrderId: { type: String, default: null },
        stripePaymentIntentId: { type: String, default: null },
        stripeSessionId: { type: String, default: null },
        // Dates
        paidAt: { type: Date, default: null },
        periodStart: { type: Date, default: null },
        periodEnd: { type: Date, default: null },
        // Metadata
        description: { type: String, default: '' },
        receiptUrl: { type: String, default: '' },
    },
    {
        timestamps: true,
    }
);

paymentSchema.index({ tenantId: 1, createdAt: -1 });
paymentSchema.index({ invoiceNumber: 1 });

const Payment = mongoose.model('Payment', paymentSchema);
module.exports = Payment;
