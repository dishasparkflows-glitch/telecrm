const IntegrationAccount = require('../models/IntegrationAccount');
const IntegrationConnection = require('../models/IntegrationConnection');
const { encrypt } = require('./credential.service');

const upsertIntegrationAccount = async (accountData) => {
    const { tenantId, ownerType, ownerId, provider, providerAccountId, providerEmail, tokens, scopes, metadata } = accountData;

    const credentials = {};
    if (tokens.access_token) credentials.accessTokenEncrypted = encrypt(tokens.access_token);
    if (tokens.refresh_token) credentials.refreshTokenEncrypted = encrypt(tokens.refresh_token);
    if (tokens.expiry_date) credentials.expiresAt = new Date(tokens.expiry_date);
    
    // Some providers return id_token or extra data
    if (tokens.id_token) credentials.extraDataEncrypted = encrypt(JSON.stringify({ id_token: tokens.id_token }));

    const updatePayload = {
        providerEmail,
        scopes,
        status: 'CONNECTED',
        metadata,
    };

    // Only update refresh token if provided, to avoid overwriting existing
    if (credentials.refreshTokenEncrypted) {
        updatePayload['credentials.refreshTokenEncrypted'] = credentials.refreshTokenEncrypted;
    }
    if (credentials.accessTokenEncrypted) {
        updatePayload['credentials.accessTokenEncrypted'] = credentials.accessTokenEncrypted;
    }
    if (credentials.expiresAt) {
        updatePayload['credentials.expiresAt'] = credentials.expiresAt;
    }
    if (credentials.extraDataEncrypted) {
        updatePayload['credentials.extraDataEncrypted'] = credentials.extraDataEncrypted;
    }

    const account = await IntegrationAccount.findOneAndUpdate(
        { tenantId, ownerType, ownerId, provider, providerAccountId },
        { $set: updatePayload },
        { new: true, upsert: true }
    );

    return account;
};

const upsertIntegrationConnection = async (connectionData) => {
    const { tenantId, ownerType, ownerId, accountId, provider, integrationType, configuration, permissions, metadata } = connectionData;

    const connection = await IntegrationConnection.findOneAndUpdate(
        { tenantId, ownerType, ownerId, accountId, provider, integrationType },
        { 
            $set: { 
                status: 'CONNECTED',
                configuration: configuration || {},
                permissions: permissions || { read: true, write: true },
                metadata: metadata || {}
            } 
        },
        { new: true, upsert: true }
    );

    return connection;
};

const getIntegrationAccount = async (tenantId, accountId) => {
    return IntegrationAccount.findOne({ _id: accountId, tenantId });
};

const getIntegrationConnection = async (tenantId, connectionId) => {
    return IntegrationConnection.findOne({ _id: connectionId, tenantId });
};

const disconnectIntegration = async (tenantId, connectionId) => {
    const connection = await IntegrationConnection.findOneAndUpdate(
        { _id: connectionId, tenantId },
        { status: 'DISCONNECTED' },
        { new: true }
    );

    return connection;
};

module.exports = {
    upsertIntegrationAccount,
    upsertIntegrationConnection,
    getIntegrationAccount,
    getIntegrationConnection,
    disconnectIntegration,
};
