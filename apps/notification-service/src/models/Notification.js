const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
    {
        tenantId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
        userId: { type: mongoose.Schema.Types.ObjectId, index: true },
        branchId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
        type: { type: String, enum: ['info', 'success', 'warning', 'error', 'action'], default: 'info' },
        channel: { type: String, enum: ['in_app', 'email', 'sms', 'push', 'whatsapp'], default: 'in_app' },
        title: { type: String, required: true },
        message: { type: String, required: true },
        data: { type: mongoose.Schema.Types.Mixed, default: {} },
        actionUrl: { type: String, default: '' },
        isRead: { type: Boolean, default: false },
        readAt: { type: Date, default: null },
        sentAt: { type: Date, default: Date.now },
        expiresAt: { type: Date, default: null },
    },
    { timestamps: true, versionKey: false }
);

notificationSchema.index({ tenantId: 1, userId: 1, isRead: 1, createdAt: -1 });

const Notification = mongoose.model('Notification', notificationSchema);
module.exports = Notification;
