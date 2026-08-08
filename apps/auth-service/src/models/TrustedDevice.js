const mongoose = require('mongoose');

const trustedDeviceSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            required: [true, 'User ID is required'],
            ref: 'User',
            index: true,
        },
        tokenHash: {
            type: String,
            required: [true, 'Token hash is required'],
            index: true,
        },
        deviceName: {
            type: String,
            default: 'Unknown Device',
        },
        userAgent: {
            type: String,
            default: '',
        },
        ipAddress: {
            type: String,
            default: '',
        },
        lastUsedAt: {
            type: Date,
            default: Date.now,
        },
        expiresAt: {
            type: Date,
            required: true,
            index: { expires: '0s' }, // TTL index to automatically delete expired tokens
        },
        revokedAt: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

// Method to check if the device is active (not revoked and not expired)
trustedDeviceSchema.methods.isActive = function () {
    return this.revokedAt === null && this.expiresAt > new Date();
};

const TrustedDevice = mongoose.model('TrustedDevice', trustedDeviceSchema);

module.exports = TrustedDevice;
