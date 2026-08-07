const crypto = require('crypto');
const mongoose = require('mongoose');

const jobLockSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    owner: { type: String, required: true },
    expiresAt: { type: Date, required: true },
}, { timestamps: true, versionKey: false });
jobLockSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
const JobLock = mongoose.model('JobLock', jobLockSchema);

async function withJobLock(name, ttlMs, handler) {
    const owner = `${process.pid}:${crypto.randomUUID()}`;
    const now = new Date();
    let lock;
    try {
        lock = await JobLock.findOneAndUpdate(
            { name, $or: [{ expiresAt: { $lte: now } }, { owner }] },
            { $set: { owner, expiresAt: new Date(Date.now() + ttlMs) }, $setOnInsert: { name } },
            { upsert: true, new: true }
        );
    } catch (error) {
        if (error?.code === 11000) return false;
        throw error;
    }
    if (!lock || lock.owner !== owner) return false;
    try { await handler(); return true; }
    finally { await JobLock.deleteOne({ name, owner }).catch(() => {}); }
}

module.exports = { JobLock, withJobLock };
