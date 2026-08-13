const mongoose = require('mongoose');

/**
 * CommunicationConfig — Global communication provider configuration.
 * Managed exclusively by the Owner. Stores encrypted credentials for
 * WhatsApp (Meta Cloud API) and Calling (Exotel / Twilio).
 *
 * This is a singleton per `type` — only one active config per type.
 */
const communicationConfigSchema = new mongoose.Schema(
    {
        // 'whatsapp' or 'calling'
        type: {
            type: String,
            enum: ['whatsapp', 'calling'],
            required: true,
            unique: true,
        },

        // Provider name
        provider: {
            type: String,
            enum: ['meta', 'exotel', 'twilio'],
            required: true,
        },

        isActive: {
            type: Boolean,
            default: false,
        },

        displayName: {
            type: String,
            default: '',
        },

        // Encrypted credentials stored as a flexible Map
        // Keys vary by provider. All sensitive values are AES-256-GCM encrypted.
        credentials: {
            exotel: {
                apiKey: { type: String, default: null },
                apiToken: { type: String, default: null },
                sid: { type: String, default: null },
                subdomain: { type: String, default: 'api.exotel.com' },
                callerId: { type: String, default: null },
            },
            twilio: {
                accountSid: { type: String, default: null },
                authToken: { type: String, default: null },
                phoneNumber: { type: String, default: null },
            },
        },

        // Last successful connection test
        lastTestedAt: {
            type: Date,
            default: null,
        },

        testStatus: {
            type: String,
            enum: ['untested', 'success', 'failed'],
            default: 'untested',
        },

        testMessage: {
            type: String,
            default: '',
        },
        meta: {
            createdBy: { type: mongoose.Schema.Types.ObjectId },
            updatedBy: { type: mongoose.Schema.Types.ObjectId },
            deletedBy: { type: mongoose.Schema.Types.ObjectId },
            createdAt: { type: Date, default: Date.now },
            updatedAt: { type: Date, default: Date.now },
            deletedAt: { type: Date },
        },
    },
    { timestamps: { createdAt: 'meta.createdAt', updatedAt: 'meta.updatedAt' }, versionKey: false }
);

const CommunicationConfig = mongoose.model('CommunicationConfig', communicationConfigSchema);
module.exports = CommunicationConfig;
