const mongoose = require('mongoose');

const integrationAccountSchema = new mongoose.Schema(
    {
        tenantId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            index: true,
        },
        ownerType: {
            type: String,
            enum: ['TENANT', 'USER'],
            required: true,
        },
        ownerId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
        },
        provider: {
            type: String,
            enum: ['GOOGLE', 'MICROSOFT', 'SLACK', 'WHATSAPP', 'META', 'TWILIO', 'EXOTEL', 'SMTP', 'RAZORPAY', 'ZAPIER', 'CUSTOM_API'],
            required: true,
        },
        providerAccountId: {
            type: String,
            default: '',
        },
        providerEmail: {
            type: String,
            default: '',
        },
        credentials: {
            // These will store encrypted strings
            accessTokenEncrypted: { type: String },
            refreshTokenEncrypted: { type: String },
            expiresAt: { type: Date },
            // Extra credentials for other providers
            extraDataEncrypted: { type: String },
        },
        scopes: [{ type: String }],
        status: {
            type: String,
            enum: ['CONNECTED', 'EXPIRED', 'REVOKED', 'ERROR', 'DISCONNECTED'],
            default: 'CONNECTED',
        },
        metadata: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
        },
        meta: {
            createdBy: { type: mongoose.Schema.Types.ObjectId },
            updatedBy: { type: mongoose.Schema.Types.ObjectId },
            createdAt: { type: Date, default: Date.now },
            updatedAt: { type: Date, default: Date.now },
        },
    },
    { 
        timestamps: { createdAt: 'meta.createdAt', updatedAt: 'meta.updatedAt' },
        versionKey: false,
        collection: 'integration_accounts',
    }
);

integrationAccountSchema.index({ tenantId: 1, ownerType: 1, ownerId: 1, provider: 1, providerAccountId: 1 }, { unique: true });

module.exports = mongoose.model('IntegrationAccount', integrationAccountSchema);
