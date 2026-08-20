const crypto = require('crypto');
const OAuthState = require('../models/OAuthState');

/**
 * Generates a secure OAuth state and saves it to the database
 */
const generateOAuthState = async (tenantId, userId, provider, integrationType, redirectUri, additionalData = {}) => {
    const state = crypto.randomBytes(32).toString('hex');
    
    // Expires in 15 minutes
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await OAuthState.create({
        state,
        tenantId,
        userId,
        provider,
        integrationType,
        redirectUri,
        expiresAt,
        ...additionalData
    });

    return state;
};

/**
 * Validates the state from OAuth callback
 */
const validateOAuthState = async (state) => {
    if (!state) {
        throw new Error('OAUTH_STATE_MISSING');
    }

    const oauthState = await OAuthState.findOneAndUpdate(
        { state, used: false, expiresAt: { $gt: new Date() } },
        { used: true },
        { new: true }
    );

    if (!oauthState) {
        throw new Error('OAUTH_STATE_INVALID_OR_EXPIRED');
    }

    return oauthState;
};

module.exports = {
    generateOAuthState,
    validateOAuthState,
};
