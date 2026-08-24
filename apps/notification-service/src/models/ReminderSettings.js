const mongoose = require('mongoose');

const reminderSettingsSchema = new mongoose.Schema(
    {
        tenantId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
        userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
        defaultReminders: {
            meeting: {
                enabled: { type: Boolean, default: true },
                offsetMinutes: { type: Number, default: 60 }
            },
            followUp: {
                enabled: { type: Boolean, default: true },
                offsetMinutes: { type: Number, default: 15 }
            },
            task: {
                enabled: { type: Boolean, default: true },
                offsetMinutes: { type: Number, default: 30 }
            }
        },
        meta: {
            createdBy: { type: mongoose.Schema.Types.ObjectId },
            updatedBy: { type: mongoose.Schema.Types.ObjectId },
            createdAt: { type: Date, default: Date.now },
            updatedAt: { type: Date, default: Date.now },
        },
    },
    { timestamps: { createdAt: 'meta.createdAt', updatedAt: 'meta.updatedAt' }, versionKey: false, collection: 'reminder_settings' }
);

reminderSettingsSchema.index({ tenantId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('ReminderSettings', reminderSettingsSchema);
