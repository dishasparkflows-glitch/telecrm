require('dotenv').config({ path: require('@sparkcrm/shared-config').env.findEnvFile?.() });
const mongoose = require('mongoose');
const { connectDB, env } = require('@sparkcrm/shared-config');
const { IntegrationCredential, decrypt: oldDecrypt } = require('../../../tenant-service/src/models/IntegrationCredential');
const { encrypt } = require('../services/credential.service');
const IntegrationAccount = require('../models/IntegrationAccount');
const IntegrationConnection = require('../models/IntegrationConnection');

const migrateGoogleCalendar = async (cred) => {
    // google_calendar typically belongs to a user
    const ownerType = cred.userId ? 'USER' : 'TENANT';
    const ownerId = cred.userId || cred.tenantId;
    
    // In tenant-service, credentials map stores values
    // Assuming they are stored as access_token, refresh_token, expiry_date
    const tokens = {
        access_token: cred.credentials.get('access_token') ? oldDecrypt(cred.credentials.get('access_token')) : undefined,
        refresh_token: cred.credentials.get('refresh_token') ? oldDecrypt(cred.credentials.get('refresh_token')) : undefined,
        expiry_date: cred.credentials.get('expiry_date') ? oldDecrypt(cred.credentials.get('expiry_date')) : undefined,
    };

    if (!tokens.refresh_token) {
        console.log(`Skipping google_calendar for tenant ${cred.tenantId}: no refresh token`);
        return;
    }

    const providerEmail = cred.credentials.get('providerEmail') ? oldDecrypt(cred.credentials.get('providerEmail')) : 'unknown@gmail.com';
    const providerAccountId = cred.credentials.get('providerAccountId') ? oldDecrypt(cred.credentials.get('providerAccountId')) : providerEmail;

    // Create Account
    const account = await IntegrationAccount.findOneAndUpdate(
        { tenantId: cred.tenantId, ownerType, ownerId, provider: 'GOOGLE', providerAccountId },
        {
            $set: {
                providerEmail,
                'credentials.accessTokenEncrypted': tokens.access_token ? encrypt(tokens.access_token) : undefined,
                'credentials.refreshTokenEncrypted': encrypt(tokens.refresh_token),
                'credentials.expiresAt': tokens.expiry_date ? new Date(Number(tokens.expiry_date)) : undefined,
                status: 'CONNECTED',
            }
        },
        { new: true, upsert: true }
    );

    // Create Connection
    await IntegrationConnection.findOneAndUpdate(
        { tenantId: cred.tenantId, ownerType, ownerId, accountId: account._id, provider: 'GOOGLE', integrationType: 'GOOGLE_CALENDAR' },
        {
            $set: {
                status: 'CONNECTED',
                permissions: { read: true, write: true }
            }
        },
        { new: true, upsert: true }
    );
    
    console.log(`Migrated google_calendar for tenant ${cred.tenantId}`);
};

const runMigration = async () => {
    try {
        await connectDB(env.MONGO.TENANT, 'tenant-service-migration');
        // also connect integration db
        const integrationConn = mongoose.createConnection(env.MONGO.INTEGRATION);
        
        IntegrationAccount.init(integrationConn);
        IntegrationConnection.init(integrationConn);

        console.log('Starting credentials migration...');
        const credentials = await IntegrationCredential.find({ provider: 'google_calendar' });
        console.log(`Found ${credentials.length} google_calendar credentials`);

        for (const cred of credentials) {
            try {
                await migrateGoogleCalendar(cred);
            } catch (err) {
                console.error(`Failed to migrate cred ${cred._id}:`, err);
            }
        }

        console.log('Migration completed successfully.');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
};

runMigration();
