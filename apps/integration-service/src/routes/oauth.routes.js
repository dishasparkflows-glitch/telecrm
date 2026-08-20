const express = require('express');
const { getAuthorizationUrl } = require('../providers/google/google.provider');
const { generateOAuthState } = require('../services/oauth.service');
const { validateOAuthState } = require('../services/oauth.service');
const { handleOAuthCallback } = require('../providers/google/google.provider');
const { upsertIntegrationConnection } = require('../services/integration.service');

const router = express.Router();

const INTEGRATION_TYPE_SCOPES = {
    GOOGLE_CALENDAR: [
        'https://www.googleapis.com/auth/calendar.freebusy',
        'https://www.googleapis.com/auth/calendar.events',
        'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
    ],
    GOOGLE_SHEETS: [
        'https://www.googleapis.com/auth/drive.readonly',
        'https://www.googleapis.com/auth/spreadsheets',
    ],
    GOOGLE_FORMS: [
        'https://www.googleapis.com/auth/drive.readonly',
        'https://www.googleapis.com/auth/forms.responses.readonly',
        'https://www.googleapis.com/auth/forms.body.readonly',
    ],
};

/**
 * GET /api/integrations/oauth/authorize
 * 
 * Query params:
 *   provider        = GOOGLE | MICROSOFT etc.
 *   integrationType = GOOGLE_CALENDAR | GOOGLE_SHEETS | GOOGLE_FORMS
 *   redirectUrl     = (optional) frontend redirect after success
 * 
 * Headers (forwarded by gateway):
 *   x-tenant-id, x-user-id
 */
router.get('/authorize', async (req, res) => {
    try {
        const tenantId = req.headers['x-tenant-id'] || req.query.tenantId;
        const userId = req.headers['x-user-id'] || req.query.userId;
        const { provider, integrationType, redirectUrl } = req.query;

        if (!tenantId || !userId) {
            return res.status(401).json({ success: false, message: 'Authentication required' });
        }
        if (!provider || !integrationType) {
            return res.status(400).json({ success: false, message: 'provider and integrationType are required' });
        }

        const frontendUrl = redirectUrl || `${process.env.FRONTEND_URL || 'http://localhost:5173'}/settings/integrations`;

        if (provider.toUpperCase() === 'GOOGLE') {
            const scopes = INTEGRATION_TYPE_SCOPES[integrationType.toUpperCase()] || [];
            
            const state = await generateOAuthState(
                tenantId,
                userId,
                'GOOGLE',
                integrationType.toUpperCase(),
                frontendUrl
            );

            const authUrl = getAuthorizationUrl(state, scopes);
            return res.redirect(authUrl);
        }

        return res.status(400).json({ success: false, message: `Provider '${provider}' not yet supported` });
    } catch (err) {
        console.error('OAuth authorize error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * GET /api/integrations/oauth/callback/google
 * 
 * Google OAuth2 callback — state contains tenantId, userId, integrationType.
 */
router.get('/callback/google', async (req, res) => {
    const frontendBase = process.env.FRONTEND_URL || 'http://localhost:5173';
    const { code, state, error } = req.query;

    if (error) {
        console.error('Google OAuth error:', error);
        return res.redirect(`${frontendBase}/settings/integrations?error=${encodeURIComponent(error)}`);
    }

    if (!code || !state) {
        return res.redirect(`${frontendBase}/settings/integrations?error=missing_params`);
    }

    try {
        const oauthState = await validateOAuthState(state);
        const tenantId = oauthState.tenantId;
        const userId = oauthState.userId;
        const integrationType = oauthState.integrationType;
        const redirectUri = oauthState.redirectUri;

        // Exchange code for tokens and upsert IntegrationAccount
        const account = await handleOAuthCallback(code, oauthState);

        // Create a specific connection for the integrationType requested
        const connection = await upsertIntegrationConnection({
            tenantId,
            ownerType: 'USER',
            ownerId: userId,
            accountId: account._id,
            provider: 'GOOGLE',
            integrationType,
            configuration: {
                email: account.providerEmail,
                // calendarId will be set when the user selects it, default 'primary'
                calendarId: account.providerEmail || 'primary',
            },
            metadata: {
                connectedAt: new Date().toISOString(),
            }
        });

        const successUrl = redirectUri || `${frontendBase}/settings/integrations`;
        return res.redirect(`${successUrl}?success=true&provider=google&integrationType=${integrationType}`);
    } catch (err) {
        console.error('Google OAuth callback error:', err);
        const frontendRedirect = `${frontendBase}/settings/integrations?error=${encodeURIComponent(err.message)}`;
        return res.redirect(frontendRedirect);
    }
});

module.exports = router;
