const mongoose = require('mongoose');

const deviceTokenSchema = new mongoose.Schema(
    {
        tenantId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
        userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
        deviceId: { type: String, required: true, trim: true },
        token: { type: String, required: true, select: false },
        platform: { type: String, enum: ['android', 'ios', 'web'], required: true },
        appVersion: { type: String, default: '' },
        isActive: { type: Boolean, default: true, index: true },
        lastSeenAt: { type: Date, default: Date.now },
        lastError: { type: String, default: '' },
    },
    { timestamps: true }
);

deviceTokenSchema.index({ tenantId: 1, userId: 1, deviceId: 1 }, { unique: true });
deviceTokenSchema.index({ token: 1 });

module.exports = mongoose.model('DeviceToken', deviceTokenSchema);
