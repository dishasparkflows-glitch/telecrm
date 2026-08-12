/**
 * Calling API Service — Exotel / Twilio Integration
 * Fetches global config from tenant-service and provides methods
 * to initiate calls through the configured provider.
 */
const axios = require('axios');
const { env } = require('@sparkcrm/shared-config');
const { decrypt } = require('@sparkcrm/shared-utils');
const { createServiceHeaders } = require('@sparkcrm/shared-middleware');
const { normalizeExotelNumber, normalizeTwilioNumber } = require('../utils/phoneNormalize');

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
 * Initiate a call via Exotel Connect API.
 */
const initiateExotelCall = async (config, { fromNumber, toNumber, callId }) => {
          const url = `https://${config.subdomain}/v1/Accounts/${config.sid}/Calls/connect.json`;

    const from = normalizeExotelNumber(fromNumber);
    const to = normalizeExotelNumber(toNumber);
    const callerId = normalizeExotelNumber(config.callerId);

    const params = new URLSearchParams();
    params.append('From', from);
    params.append('To', to);
    params.append('CallerId', callerId);
    params.append('CallType', 'trans');
    params.append('Record', 'true');

    if (callId) {
        params.append('CustomField', String(callId));
    }

    const callbackUrl = env.EXOTEL_CALLBACK_URL;
    if (callbackUrl) {
        params.append('StatusCallback', callbackUrl);
        params.append('StatusCallbackEvents[0]', 'terminal');
        params.append('StatusCallbackContentType', 'application/json');
    }

    let res;
    try {
        res = await axios.post(url, params.toString(), {
            auth: { username: config.apiKey, password: config.apiToken },
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
            timeout: 15000,
        });
    } catch (error) {
        const status = error.response?.status;
        const message = error.response?.data?.RestException?.Message || error.message;
        let code = 'EXOTEL_PROVIDER_ERROR';
        let httpStatus = 502;

        if (status === 403) {
            if (message.includes('KYC')) {
                code = 'EXOTEL_KYC_REQUIRED';
                httpStatus = 403;
            } else {
                code = 'EXOTEL_FORBIDDEN';
                httpStatus = 403;
            }
        } else if (status === 401) {
            code = 'EXOTEL_AUTHENTICATION_FAILED';
            httpStatus = 401;
        } else if (status === 400) {
            code = 'EXOTEL_INVALID_REQUEST';
            httpStatus = 400;
        } else if (status === 429) {
            code = 'EXOTEL_RATE_LIMITED';
            httpStatus = 429;
        } else if (!status || error.code === 'ECONNABORTED') {
            code = 'EXOTEL_TIMEOUT';
            httpStatus = 504;
        }

        console.error('❌ Exotel error:', {
            status,
            code,
            message: message.substring(0, 100),
        });

        const mappedError = new Error(message);
        mappedError.code = code;
        mappedError.status = httpStatus;
        mappedError.providerData = {
            error: {
                status: status || null,
                code,
                message,
            }
        };
        throw mappedError;
    }

    const externalCallId = res.data?.Call?.Sid;
    if (!externalCallId) {
        throw new Error('Exotel did not return a call SID');
    }

    return {
        externalCallId,
        provider: 'exotel',
        status: 'initiated',
        providerData: res.data,
    };
};

/**
 * Initiate a call via Twilio REST API.
 */
const initiateTwilioCall = async (config, { fromNumber, toNumber, callId }) => {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Calls.json`;

    const params = new URLSearchParams();
    const voiceWebhook = env.TWILIO_VOICE_WEBHOOK_URL;
    const voiceUrl = new URL(voiceWebhook);
    if (callId) voiceUrl.searchParams.append('callId', String(callId));

    params.append('Url', voiceUrl.toString()); // Our own TwiML webhook
    params.append('To', normalizeTwilioNumber(fromNumber)); // Twilio calls the agent first
    params.append('From', config.twilioPhoneNumber); // Twilio number to show as caller ID
    params.append('Record', 'true'); // Tell Twilio to record the call

    // Set up real-time status callbacks
    const statusUrl = new URL(voiceWebhook);
    statusUrl.pathname = statusUrl.pathname.replace('/voice', '/status');
    statusUrl.search = ''; // Clear existing search params from voiceWebhook
    if (callId) statusUrl.searchParams.append('callId', String(callId));
    
    params.append('StatusCallback', statusUrl.toString());
    params.append('StatusCallbackMethod', 'POST');
    params.append('StatusCallbackEvent', 'initiated');
    params.append('StatusCallbackEvent', 'ringing');
    params.append('StatusCallbackEvent', 'answered');
    params.append('StatusCallbackEvent', 'completed');

    let res;
    try {
        res = await axios.post(url, params.toString(), {
            auth: { username: config.accountSid, password: config.authToken },
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            timeout: 15000,
        });
    } catch (error) {
        const status = error.response?.status;
        const twilioError = error.response?.data?.message || error.message;
        const twilioCode = error.response?.data?.code;
        
        const mappedError = new Error(twilioError);
        mappedError.code = twilioCode ? `TWILIO_${twilioCode}` : 'TWILIO_PROVIDER_ERROR';
        mappedError.status = status === 400 ? 400 : (status === 401 ? 401 : 502);
        mappedError.providerData = error.response?.data || { message: twilioError };
        throw mappedError;
    }

    const externalCallId = res.data?.sid;
    if (!externalCallId) {
        throw new Error('Twilio did not return a call SID');
    }

    return {
        externalCallId,
        provider: 'twilio',
        status: 'initiated',
        providerData: res.data,
    };
};

/**
 * Initiate a call through the configured provider.
 * @param {Object} options - Call options
 * @returns {{ externalCallId, provider, status }}
 */
const initiateCall = async ({ fromNumber, toNumber, callId }) => {
    const config = await getConfig();
    if (config.provider === 'exotel') return initiateExotelCall(config, { fromNumber, toNumber, callId });
    if (config.provider === 'twilio') return initiateTwilioCall(config, { fromNumber, toNumber, callId });
    throw new Error('Unknown calling provider');
};

/**
 * Fetch call status from Exotel.
 */
const getExotelCallStatus = async (config, externalCallId) => {
    const url = `https://${config.subdomain}/v1/Accounts/${config.sid}/Calls/${externalCallId}.json`;
    const res = await axios.get(url, {
        auth: { username: config.apiKey, password: config.apiToken },
        timeout: 10000,
    });
    const callData = res.data?.Call || {};
    return {
        status: callData.Status || 'unknown',
        duration: parseInt(callData.Duration) || 0,
        recordingUrl: callData.RecordingUrl || null,
        startTime: callData.StartTime || null,
        endTime: callData.EndTime || null,
        from: callData.From || null,
        to: callData.To || null,
        sid: callData.Sid || null,
        preSignedRecordingUrl: callData.PreSignedRecordingUrl || null,
    };
};

/**
 * Fetch call status from Twilio (includes recording lookup).
 */
const getTwilioCallStatus = async (config, externalCallId) => {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Calls/${externalCallId}.json`;
    const res = await axios.get(url, {
        auth: { username: config.accountSid, password: config.authToken },
        timeout: 10000,
    });

    // Fetch recording URL from Twilio
    let recordingUrl = null;
    try {
        const recordingsUrl = `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Calls/${externalCallId}/Recordings.json`;
        const recordingsRes = await axios.get(recordingsUrl, {
            auth: { username: config.accountSid, password: config.authToken },
            timeout: 10000,
        });
        const recording = recordingsRes.data?.recordings?.[0];
        if (recording) {
            recordingUrl = `https://api.twilio.com${recording.uri.replace('.json', '.mp3')}`;
        }
    } catch (e) {
        console.error(`Failed to fetch Twilio recording for ${externalCallId}:`, e.message);
    }

    return {
        status: res.data?.status || 'unknown',
        duration: parseInt(res.data?.duration) || 0,
        recordingUrl: recordingUrl,
    };
};

/**
 * Get call status from the provider.
 */
const getCallStatus = async (tenantId, externalCallId) => {
    const config = await getConfig(tenantId);
    if (config.provider === 'exotel') return getExotelCallStatus(config, externalCallId);
    if (config.provider === 'twilio') return getTwilioCallStatus(config, externalCallId);
    throw new Error('Unknown calling provider');
};

module.exports = {
    getConfig,
    invalidateCache,
    initiateCall,
    getCallStatus,
    normalizeTwilioNumber,
};
