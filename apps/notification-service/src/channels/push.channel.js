const crypto = require('crypto');
const DeviceToken = require('../models/DeviceToken');

let cachedAccessToken = null;
let cachedAccessTokenExpiresAt = 0;

const base64url = (value) => Buffer.from(value).toString('base64url');

const getFirebaseConfig = () => ({
    projectId: process.env.FIREBASE_PROJECT_ID || '',
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL || '',
    privateKey: String(process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
});

const getFirebaseAccessToken = async () => {
    if (cachedAccessToken && Date.now() < cachedAccessTokenExpiresAt - 60_000) return cachedAccessToken;
    const config = getFirebaseConfig();
    if (!config.projectId || !config.clientEmail || !config.privateKey) throw new Error('Firebase service-account configuration is incomplete');

    const now = Math.floor(Date.now() / 1000);
    const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const claims = base64url(JSON.stringify({
        iss: config.clientEmail,
        scope: 'https://www.googleapis.com/auth/firebase.messaging',
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600,
    }));
    const unsigned = `${header}.${claims}`;
    const signature = crypto.sign('RSA-SHA256', Buffer.from(unsigned), config.privateKey).toString('base64url');
    const assertion = `${unsigned}.${signature}`;

    const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
    });
    const payload = await response.json();
    if (!response.ok || !payload.access_token) throw new Error(payload.error_description || 'Firebase OAuth token request failed');
    cachedAccessToken = payload.access_token;
    cachedAccessTokenExpiresAt = Date.now() + Number(payload.expires_in || 3600) * 1000;
    return cachedAccessToken;
};

const buildFirebaseMessage = ({ device, title, body, data = {} }) => ({
    message: {
        token: device.token,
        notification: { title, body },
        data: Object.fromEntries(Object.entries(data || {}).map(([key, value]) => [key, String(value ?? '')])),
        android: { priority: 'high' },
        apns: { headers: { 'apns-priority': '10' } },
    },
});

const isInvalidFirebaseTokenError = (message) => String(message || '').includes('UNREGISTERED')
    || String(message || '').includes('registration-token-not-registered');

const sendToToken = async ({ device, title, body, data = {} }) => {
    const config = getFirebaseConfig();
    const accessToken = await getFirebaseAccessToken();
    const response = await fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(config.projectId)}/messages:send`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(buildFirebaseMessage({ device, title, body, data })),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        const message = payload.error?.message || 'Firebase push delivery failed';
        const invalid = isInvalidFirebaseTokenError(message);
        await DeviceToken.updateOne({ _id: device._id }, { $set: { isActive: !invalid, lastError: message } });
        throw new Error(message);
    }
    await DeviceToken.updateOne({ _id: device._id }, { $set: { lastError: '', lastSeenAt: new Date() } });
    return payload.name;
};

const sendPushToUser = async ({ tenantId, userId, title, body, data = {} }) => {
    if (!tenantId || !userId) return { sent: 0, failed: 0 };
    const devices = await DeviceToken.find({ tenantId, userId, isActive: true }).select('+token');
    const results = await Promise.allSettled(devices.map((device) => sendToToken({ device, title, body, data })));
    return {
        sent: results.filter((result) => result.status === 'fulfilled').length,
        failed: results.filter((result) => result.status === 'rejected').length,
    };
};

module.exports = { getFirebaseConfig, getFirebaseAccessToken, sendToToken, sendPushToUser, buildFirebaseMessage, isInvalidFirebaseTokenError };
