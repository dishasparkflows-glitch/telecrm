const mongoose = require('mongoose');

const eventReceiptSchema = new mongoose.Schema({
    eventId: { type: String, required: true, unique: true, index: true },
    event: { type: String, required: true },
    processedAt: { type: Date, default: Date.now },
}, { timestamps: true, versionKey: false });

eventReceiptSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

const EventReceipt = mongoose.model('EventReceipt', eventReceiptSchema);

const idempotentEventHandler = (handler) => async (channel, data, timestamp, envelope = {}) => {
    const receiptId = data?.idempotencyKey || envelope.id;
    if (!receiptId) return handler(data, { channel, timestamp, envelope });
    const eventId = `${channel}:${receiptId}`;
    try {
        await EventReceipt.create({ eventId, event: channel });
    } catch (error) {
        if (error?.code === 11000) return;
        throw error;
    }
    try {
        return await handler(data, { channel, timestamp, envelope });
    } catch (error) {
        await EventReceipt.deleteOne({ eventId }).catch(() => {});
        throw error;
    }
};

module.exports = { EventReceipt, idempotentEventHandler };
