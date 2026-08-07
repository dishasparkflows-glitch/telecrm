/**
 * Calling API Service — Exotel / Twilio Integration
 * Fetches global config from tenant-service and provides methods
 * to initiate calls through the configured provider.
 */
const axios = require('axios');
const { env } = require('@sparkcrm/shared-config');
const { decrypt } = require('@sparkcrm/shared-utils');
const { createServiceHeaders } = require('@sparkcrm/shared-middleware');

let cachedConfig = null;
let cacheExpiry = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch calling config from tenant-service internal API.
 */
const getConfig = async () => {
    if (cachedConfig && Date.now() < cacheExpiry) return cachedConfig;

    try {
        const tenantServiceUrl = env.SERVICES.TENANT || 'http://localhost:8002';
        const path = '/internal/communication-config/calling';
        const headers = createServiceHeaders({
            issuer: 'call-service',
            audience: 'tenant-service',
            method: 'GET',
            path,
        });
        const res = await axios.get(`${tenantServiceUrl}${path}`, { timeout: 5000, headers });
        const config = res.data?.data;

        if (!config || !config.isActive) {
            throw new Error('Calling integration is not active');
        }

        const cred = config.credentials || {};
        const getVal = (key) => typeof cred.get === 'function' ? cred.get(key) : cred[key];

        if (config.provider === 'exotel') {
            cachedConfig = {
                provider: 'exotel',
                apiKey: decrypt(getVal('apiKey')),
                apiToken: decrypt(getVal('apiToken')),
                sid: getVal('sid'),
                subdomain: getVal('subdomain') || 'api.exotel.com',
                callerId: getVal('callerId'),
            };
        } else if (config.provider === 'twilio') {
            cachedConfig = {
                provider: 'twilio',
                accountSid: getVal('accountSid'),
                authToken: decrypt(getVal('authToken')),
                twilioPhoneNumber: getVal('twilioPhoneNumber'),
            };
        }

        cacheExpiry = Date.now() + CACHE_TTL;
        return cachedConfig;
    } catch (err) {
        console.error('❌ Failed to fetch calling config:', err.message);
        throw new Error('Calling is not configured. Please contact your administrator.');
    }
};

/**
 * Invalidate cached config
 */
const invalidateCache = () => {
    cachedConfig = null;
    cacheExpiry = 0;
};

/**
 * Initiate a call through the configured provider.
 * @param {string} fromNumber - Caller number (user's assigned number)
 * @param {string} toNumber   - Recipient number
 * @returns {{ externalCallId, provider, status }}
 */
const initiateCall = async (fromNumber, toNumber) => {
    const config = await getConfig();

    if (config.provider === 'exotel') {
        const url = `https://${config.subdomain}/v1/Accounts/${config.sid}/Calls/connect`;

        const params = new URLSearchParams();
        params.append('From', fromNumber);
        params.append('To', toNumber);
        params.append('CallerId', config.callerId);
        params.append('CallType', 'trans');

        const res = await axios.post(url, params.toString(), {
            auth: { username: config.apiKey, password: config.apiToken },
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            timeout: 15000,
        });

        return {
            externalCallId: res.data?.Call?.Sid || null,
            provider: 'exotel',
            status: 'initiated',
            providerData: res.data,
        };
    } else if (config.provider === 'twilio') {
        const url = `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Calls.json`;

        const params = new URLSearchParams();
        params.append('Url', 'http://demo.twilio.com/docs/voice.xml'); // TwiML URL
        params.append('To', toNumber);
        params.append('From', config.twilioPhoneNumber || fromNumber);

        const res = await axios.post(url, params.toString(), {
            auth: { username: config.accountSid, password: config.authToken },
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            timeout: 15000,
        });

        return {
            externalCallId: res.data?.sid || null,
            provider: 'twilio',
            status: 'initiated',
            providerData: res.data,
        };
    }

    throw new Error('Unknown calling provider');
};

/**
 * Get call status from the provider
 */
const getCallStatus = async (externalCallId) => {
    const config = await getConfig();

    if (config.provider === 'exotel') {
        const url = `https://${config.subdomain}/v1/Accounts/${config.sid}/Calls/${externalCallId}`;
        const res = await axios.get(url, {
            auth: { username: config.apiKey, password: config.apiToken },
            timeout: 10000,
        });
        return {
            status: res.data?.Call?.Status || 'unknown',
            duration: parseInt(res.data?.Call?.Duration) || 0,
            recordingUrl: res.data?.Call?.RecordingUrl || null,
        };
    } else if (config.provider === 'twilio') {
        const url = `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Calls/${externalCallId}.json`;
        const res = await axios.get(url, {
            auth: { username: config.accountSid, password: config.authToken },
            timeout: 10000,
        });
        return {
            status: res.data?.status || 'unknown',
            duration: parseInt(res.data?.duration) || 0,
            recordingUrl: null, // Twilio recordings need separate API call
        };
    }

    throw new Error('Unknown calling provider');
};

module.exports = {
    getConfig,
    invalidateCache,
    initiateCall,
    getCallStatus,
};
