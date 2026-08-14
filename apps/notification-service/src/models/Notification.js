const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
    {
        tenantId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
        userId: { type: mongoose.Schema.Types.ObjectId, index: true },
        branchId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
        channel: { type: String, enum: ['in_app', 'email', 'sms', 'push', 'whatsapp'], default: 'in_app' },
        notification: {
            type: { type: String, enum: ['info', 'success', 'warning', 'error', 'action'], default: 'info' },
            title: { type: String, required: true },
            message: { type: String, required: true },
            data: { type: mongoose.Schema.Types.Mixed, default: {} },
        },
        action: {
            actionUrl: { type: String, default: '' },
            actionType: { type: String, default: '' },
        },
        readState: {
            isRead: { type: Boolean, default: false },
            readAt: { type: Date, default: null },
        },
        sentAt: { type: Date, default: Date.now },
    },
    { versionKey: false }
);

notificationSchema.index({ tenantId: 1, userId: 1, 'readState.isRead': 1, createdAt: -1 });

const Notification = mongoose.model('Notification', notificationSchema);
module.exports = Notification;
