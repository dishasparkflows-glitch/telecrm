const crypto = require('crypto');
const mongoose = require('mongoose');

const bookingLockSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true },
    owner: { type: String, required: true },
    expiresAt: { type: Date, required: true },
}, { timestamps: true });
bookingLockSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
const BookingLock = mongoose.model('BookingLock', bookingLockSchema);

async function withBookingLock(key, handler) {
    const owner = crypto.randomUUID();
    try {
        const lock = await BookingLock.findOneAndUpdate(
            { key, expiresAt: { $lte: new Date() } },
            { $set: { owner, expiresAt: new Date(Date.now() + 30_000) }, $setOnInsert: { key } },
            { upsert: true, new: true }
        );
        if (!lock || lock.owner !== owner) return { acquired: false };
    } catch (error) {
        if (error?.code === 11000) return { acquired: false };
        throw error;
    }
    try { return { acquired: true, result: await handler() }; }
    finally { await BookingLock.deleteOne({ key, owner }).catch(() => {}); }
}

module.exports = { BookingLock, withBookingLock };
