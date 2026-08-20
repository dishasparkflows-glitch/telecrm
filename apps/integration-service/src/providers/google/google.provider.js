const { google } = require('googleapis');
const { env } = require('@sparkcrm/shared-config');
const { getIntegrationAccount, upsertIntegrationAccount } = require('../../services/integration.service');
const { decrypt, encrypt } = require('../../services/credential.service');

const getOAuth2Client = () => {
    return new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
    );
};

const getAuthorizationUrl = (state, requestedScopes = []) => {
    const oauth2Client = getOAuth2Client();
    const DEFAULT_SCOPES = [
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile'
    ];
    const finalScopes = [...new Set([...DEFAULT_SCOPES, ...requestedScopes])];

    return oauth2Client.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent', // Force to get refresh token
        scope: finalScopes,
        state: state,
        include_granted_scopes: true
    });
};

const handleOAuthCallback = async (code, oauthState) => {
    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    
    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ auth: oauth2Client, version: 'v2' });
    const userInfo = await oauth2.userinfo.get();
    
    const accountData = {
        tenantId: oauthState.tenantId,
        ownerType: oauthState.additionalData?.ownerType || 'USER',
        ownerId: oauthState.userId,
        provider: 'GOOGLE',
        providerAccountId: userInfo.data.id,
        providerEmail: userInfo.data.email,
        tokens,
        scopes: tokens.scope ? tokens.scope.split(' ') : [],
        metadata: {
            name: userInfo.data.name,
            picture: userInfo.data.picture,
        }
    };

    const account = await upsertIntegrationAccount(accountData);
    return account;
};

const refreshAccessToken = async (account) => {
    const oauth2Client = getOAuth2Client();
    if (!account.credentials.refreshTokenEncrypted) {
        throw new Error('NO_REFRESH_TOKEN');
    }
    
    const refreshToken = decrypt(account.credentials.refreshTokenEncrypted);
    oauth2Client.setCredentials({ refresh_token: refreshToken });

    try {
        const { credentials } = await oauth2Client.refreshAccessToken();
        
        // Update account with new tokens
        account.credentials.accessTokenEncrypted = encrypt(credentials.access_token);
        if (credentials.expiry_date) {
            account.credentials.expiresAt = new Date(credentials.expiry_date);
        }
        if (credentials.refresh_token) {
            account.credentials.refreshTokenEncrypted = encrypt(credentials.refresh_token);
        }
        account.status = 'CONNECTED';
        await account.save();

        return credentials;
    } catch (error) {
        if (error.message.includes('invalid_grant') || error.message.includes('Token has been expired or revoked')) {
            account.status = 'REVOKED';
            await account.save();
            throw new Error('TOKEN_REVOKED');
        }
        throw error;
    }
};

const getAuthenticatedClient = async (accountId, tenantId) => {
    const account = await getIntegrationAccount(tenantId, accountId);
    if (!account) throw new Error('INTEGRATION_ACCOUNT_NOT_FOUND');
    
    if (account.status !== 'CONNECTED') {
        throw new Error(`INTEGRATION_ACCOUNT_STATUS_${account.status}`);
    }

    const oauth2Client = getOAuth2Client();
    
    let accessToken = decrypt(account.credentials.accessTokenEncrypted);
    let refreshToken = decrypt(account.credentials.refreshTokenEncrypted);
    
    oauth2Client.setCredentials({
        access_token: accessToken,
        refresh_token: refreshToken,
    });

    // Proactively refresh if expired or near expiration (within 5 minutes)
    if (account.credentials.expiresAt && account.credentials.expiresAt.getTime() < Date.now() + 5 * 60 * 1000) {
        const newTokens = await refreshAccessToken(account);
        oauth2Client.setCredentials(newTokens);
    }

    return oauth2Client;
};

module.exports = {
    getOAuth2Client,
    getAuthorizationUrl,
    handleOAuthCallback,
    refreshAccessToken,
    getAuthenticatedClient,
};
