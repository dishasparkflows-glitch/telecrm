const mongoose = require('mongoose');

const jobLockSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    lockUntil: { type: Date, required: true },
    owner: { type: String, required: true },
}, { timestamps: true, versionKey: false });

module.exports = mongoose.model('JobLock', jobLockSchema);
