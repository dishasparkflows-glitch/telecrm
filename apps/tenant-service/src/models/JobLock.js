const mongoose = require('mongoose');

const jobLockSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    lockUntil: { type: Date, required: true },
    owner: { type: String, required: true },

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
        timestamps: { createdAt: 'meta.createdAt', updatedAt: 'meta.updatedAt' }, versionKey: false });

module.exports = mongoose.model('JobLock', jobLockSchema);
