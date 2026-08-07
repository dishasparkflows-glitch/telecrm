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
            type: Map,
            of: String,
            default: {},
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
    },
    { timestamps: true, versionKey: false }
);

const CommunicationConfig = mongoose.model('CommunicationConfig', communicationConfigSchema);
module.exports = CommunicationConfig;
