const mongoose = require('mongoose');

const paymentEventSchema = new mongoose.Schema({
    provider: { type: String, enum: ['stripe', 'razorpay'], required: true },
    eventId: { type: String, required: true },
    eventType: { type: String, required: true },
    status: { type: String, enum: ['processing', 'processed', 'failed', 'ignored'], default: 'processing' },
    invoiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice', default: null },
    attempts: { type: Number, default: 1 },
    lastError: { type: String, default: null },
    processedAt: { type: Date, default: null },
    meta: {
            createdBy: { type: mongoose.Schema.Types.ObjectId },
            updatedBy: { type: mongoose.Schema.Types.ObjectId },
            deletedBy: { type: mongoose.Schema.Types.ObjectId },
            createdAt: { type: Date, default: Date.now },
            updatedAt: { type: Date, default: Date.now },
            deletedAt: { type: Date },
        },
    },
    { timestamps: { createdAt: 'meta.createdAt', updatedAt: 'meta.updatedAt' }, versionKey: false });

paymentEventSchema.index({ provider: 1, eventId: 1 }, { unique: true });
paymentEventSchema.index({ status: 1, updatedAt: 1 });

module.exports = mongoose.model('PaymentEvent', paymentEventSchema);
