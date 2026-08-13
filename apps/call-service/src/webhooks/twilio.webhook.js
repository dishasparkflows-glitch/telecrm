const express = require('express');
const router = express.Router();
const CallLog = require('../models/CallLog');
const { publishEvent, EVENTS } = require('@sparkcrm/shared-events');
const { asyncHandler, uploadBufferToR2 } = require('@sparkcrm/shared-utils');
const callingApi = require('../services/callingApi.service');
const twilio = require('twilio');
const axios = require('axios');

/**
 * Middleware to validate Twilio webhooks dynamically by Call ID
 */
const validateTwilioRequest = async (req, res, next) => {
    try {
        const callId = req.query.callId;
        if (!callId) {
            return res.status(401).send('Missing callId');
        }

        const callLog = await CallLog.findById(callId);
        if (!callLog || callLog.provider.name !== 'twilio') {
            return res.status(401).send('Invalid call reference');
        }

        const config = await callingApi.getConfig(callLog.tenantId);
        if (!config || config.provider !== 'twilio') {
            return res.status(401).send('Invalid configuration');
        }

        const twilioSignature = req.headers['x-twilio-signature'];
        if (!twilioSignature) {
            return res.status(401).send('Missing Twilio signature');
        }

        const protocol = req.headers['x-forwarded-proto'] || req.protocol;
        const host = req.headers['x-forwarded-host'] || req.get('host');
        const url = `${protocol}://${host}${req.originalUrl}`;

        const isValid = twilio.validateRequest(config.authToken, twilioSignature, url, req.body);
        if (!isValid) {
            return res.status(401).send('Invalid Twilio signature');
        }

        req.callLog = callLog;
        req.twilioConfig = config;
        next();
    } catch (err) {
        console.error('Twilio validation error:', err.message);
        res.status(500).send('Internal server error during validation');
    }
};

/**
 * POST /webhooks/twilio/voice
 * Twilio hits this URL when the agent answers the phone.
 * We return TwiML to dial the customer (toNumber).
 */
router.post('/voice', validateTwilioRequest, asyncHandler(async (req, res) => {
    const { callLog } = req;
    const toNumber = callLog.call.to;

    const response = new twilio.twiml.VoiceResponse();

    if (!toNumber) {
        response.say('Sorry, an error occurred while connecting your call.');
    } else {
        const protocol = req.headers['x-forwarded-proto'] || req.protocol;
        const host = req.headers['x-forwarded-host'] || req.get('host');
        const dialActionUrl = `${protocol}://${host}/webhooks/twilio/dial-status?callId=${callLog._id}`;
        
        const dial = response.dial({
            action: dialActionUrl,
            method: 'POST',
            callerId: req.twilioConfig.twilioPhoneNumber
        });
        dial.number(callingApi.normalizeTwilioNumber(toNumber));
    }

    res.type('text/xml');
    res.send(response.toString());
}));

/**
 * Helper to process status and idempotently update CallLog
 */
const updateCallStatus = async (callLog, proposedStatus, duration, recordingUrl, providerDataUpdates, twilioConfig) => {
    const STATUS_PRIORITY = {
        initiated: 1,
        ringing: 2,
        in_progress: 3,
        completed: 4,
        missed: 4,
        failed: 4
    };

    const isAlreadyTerminal = ['completed', 'missed', 'failed'].includes(callLog.call.status);
    
    let newStatus = callLog.call.status;
    if (STATUS_PRIORITY[proposedStatus] && STATUS_PRIORITY[proposedStatus] >= (STATUS_PRIORITY[callLog.call.status] || 0)) {
        newStatus = proposedStatus;
    }

    callLog.call.status = newStatus;
    
    if (recordingUrl && callLog.recording.status !== 'available') {
        try {
            let downloadUrl = recordingUrl;
            if (!downloadUrl.endsWith('.mp3') && !downloadUrl.endsWith('.wav')) {
                downloadUrl += '.mp3';
            }
            
            const authOptions = twilioConfig ? { username: twilioConfig.accountSid, password: twilioConfig.authToken } : null;

            const response = await axios.get(downloadUrl, {
                responseType: 'arraybuffer',
                auth: authOptions
            });

            const buffer = Buffer.from(response.data);
            const callSid = providerDataUpdates.callSid || providerDataUpdates.parentCallSid || callLog.provider.externalCallId;
            const objectKey = `tenants/${callLog.tenantId}/users/${callLog.userId}/leads/${callLog.leadId}/recordings/${callSid}.mp3`;

            await uploadBufferToR2(buffer, objectKey, 'audio/mpeg');

            callLog.recording.url = recordingUrl;
            callLog.recording.objectKey = objectKey;
            callLog.recording.mimeType = 'audio/mpeg';
            callLog.recording.status = 'available';
            callLog.recording.fetchedAt = new Date();
        } catch (uploadError) {
            console.error(`❌ [Twilio] Failed to download/upload recording for Call SID: ${providerDataUpdates.callSid || providerDataUpdates.parentCallSid}`, uploadError.message);
            callLog.recording.url = recordingUrl;
            callLog.recording.status = 'ready'; // Fallback
            callLog.recording.fetchedAt = new Date();
        }
    } else if (recordingUrl) {
        callLog.recording.url = recordingUrl;
    }
    
    if (duration && !callLog.call.duration) callLog.call.duration = parseInt(duration, 10);
    
    const isNowTerminal = ['completed', 'missed', 'failed'].includes(newStatus);
    
    if (isNowTerminal && !callLog.call.endedAt) {
        callLog.call.endedAt = new Date();
    }

    if (callLog.call.endedAt && callLog.call.duration > 0 && !callLog.call.answeredAt) {
        callLog.call.answeredAt = new Date(callLog.call.endedAt.getTime() - (callLog.call.duration * 1000));
    }

    callLog.provider.data = { ...callLog.provider.data, ...providerDataUpdates };
    await callLog.save();

    if (isNowTerminal && !isAlreadyTerminal) {
        if (newStatus === 'completed') {
            await publishEvent(EVENTS.CALL_COMPLETED, {
                tenantId: callLog.tenantId,
                callId: callLog._id,
                leadId: callLog.leadId,
                duration: callLog.call.duration,
            });
            if (callLog.leadId) {
                await publishEvent(EVENTS.LEAD_UPDATED, {
                    tenantId: callLog.tenantId,
                    leadId: callLog.leadId,
                    changes: { lastContactedAt: callLog.call.answeredAt || callLog.call.endedAt },
                });
            }
        } else if (newStatus === 'missed') {
            await publishEvent(EVENTS.CALL_MISSED, {
                tenantId: callLog.tenantId,
                callId: callLog._id,
                leadId: callLog.leadId,
            });
        }
    }
};

/**
 * POST /webhooks/twilio/dial-status
 * Webhook called after the <Dial> verb (customer leg) finishes.
 */
router.post('/dial-status', validateTwilioRequest, asyncHandler(async (req, res) => {
    const { callLog, twilioConfig } = req;
    const { DialCallStatus, DialCallDuration, DialCallSid, CallSid } = req.body;

    console.log(`📞 Twilio Dial webhook: ${CallSid} (parent) -> ${DialCallSid} (child) -> ${DialCallStatus}`);

    const statusMap = {
        completed: 'completed',
        answered: 'completed',
        busy: 'missed',
        'no-answer': 'missed',
        failed: 'failed',
        canceled: 'missed', // Agent hung up before customer answered
    };

    const newStatus = statusMap[DialCallStatus] || callLog.call.status;
    
    await updateCallStatus(callLog, newStatus, DialCallDuration, null, {
        parentCallSid: CallSid,
        customerCallSid: DialCallSid,
        dialCallStatus: DialCallStatus
    }, twilioConfig);

    res.status(200).send('OK');
}));

/**
 * POST /webhooks/twilio/status
 * Twilio sends status callbacks here for the overall call (parent leg).
 */
router.post('/status', validateTwilioRequest, asyncHandler(async (req, res) => {
    const { callLog, twilioConfig } = req;
    const { CallSid, CallStatus, RecordingUrl, CallDuration } = req.body;
    
    console.log(`📞 Twilio Parent webhook: ${CallSid} -> ${CallStatus}`);

    const isAlreadyTerminal = ['completed', 'missed', 'failed'].includes(callLog.call.status);
    
    if (!isAlreadyTerminal) {
        const statusMap = {
            queued: 'initiated',
            initiated: 'initiated',
            ringing: 'ringing',
            'in-progress': 'in_progress',
            completed: 'completed', 
            busy: 'missed',
            'no-answer': 'missed',
            canceled: 'missed',
            failed: 'failed',
        };

        const newStatus = statusMap[CallStatus] || callLog.call.status;
        
        await updateCallStatus(callLog, newStatus, CallDuration, RecordingUrl, {
            lastParentStatus: CallStatus,
            callSid: CallSid
        }, twilioConfig);
    } else {
        if (RecordingUrl || CallDuration) {
            await updateCallStatus(callLog, callLog.call.status, CallDuration, RecordingUrl, {
                lastParentStatus: CallStatus,
                callSid: CallSid
            }, twilioConfig);
        }
    }

    res.status(200).send('OK');
}));

module.exports = router;
