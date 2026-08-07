const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema(
    {
        tenantId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
        planId: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan', required: true },
        planSlug: { type: String, required: true },
        billingCycle: { type: String, enum: ['monthly', 'yearly'], default: 'monthly' },
        status: { type: String, enum: ['active', 'past_due', 'cancelled', 'expired', 'trialing', 'paused'], default: 'active' },
        razorpaySubscriptionId: { type: String, default: null },
        razorpayCustomerId: { type: String, default: null },
        currentPeriodStart: { type: Date, default: Date.now },
        currentPeriodEnd: { type: Date, required: true },
        cancelledAt: { type: Date, default: null },
        cancelAtPeriodEnd: { type: Boolean, default: false },
        provider: { type: String, enum: ['razorpay', 'stripe'], default: null },
        sourceInvoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', default: null },
        amount: { type: Number, required: true },
        amountMinor: { type: Number, default: null },
        currency: { type: String, default: 'INR' },
    },
    { timestamps: true }
);

subscriptionSchema.index({ tenantId: 1, status: 1 });
subscriptionSchema.index({ razorpaySubscriptionId: 1 });
subscriptionSchema.index(
    { sourceInvoiceId: 1 },
    { unique: true, partialFilterExpression: { sourceInvoiceId: { $type: 'objectId' } } }
);

const Subscription = mongoose.model('Subscription', subscriptionSchema);
module.exports = Subscription;
