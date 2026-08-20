const mongoose = require('mongoose');

const oauthStateSchema = new mongoose.Schema(
    {
        state: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        tenantId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
        },
        provider: {
            type: String,
            required: true,
        },
        integrationType: {
            type: String,
            required: true,
        },
        redirectUri: {
            type: String,
            required: true,
        },
        expiresAt: {
            type: Date,
            required: true,
            index: { expires: 0 }, // TTL index
        },
        used: {
            type: Boolean,
            default: false,
        },
        meta: {
            createdAt: { type: Date, default: Date.now },
        },
    },
    { 
        timestamps: { createdAt: 'meta.createdAt', updatedAt: false },
        versionKey: false,
        collection: 'oauth_states',
    }
);

module.exports = mongoose.model('OAuthState', oauthStateSchema);
