const mongoose = require('mongoose');

const reminderSchema = new mongoose.Schema(
    {
        tenantId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
        branchId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
        userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
        leadId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
        type: { type: String, enum: ['lead_follow_up'], default: 'lead_follow_up' },
        title: { type: String, required: true },
        message: { type: String, required: true },
        actionUrl: { type: String, default: '' },
        dueAt: { type: Date, required: true, index: true },
        status: { type: String, enum: ['pending', 'processing', 'sent', 'cancelled', 'failed'], default: 'pending', index: true },
        processingAt: { type: Date, default: null },
        sentAt: { type: Date, default: null },
        attempts: { type: Number, default: 0 },
        lastError: { type: String, default: '' },
    },
    { timestamps: true, versionKey: false }
);

reminderSchema.index({ tenantId: 1, leadId: 1, type: 1 }, { unique: true });
reminderSchema.index({ status: 1, dueAt: 1, processingAt: 1 });

module.exports = mongoose.model('Reminder', reminderSchema);
