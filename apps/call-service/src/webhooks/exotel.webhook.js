const express = require('express');
const router = express.Router();
const CallLog = require('../models/CallLog');
const { publishEvent, EVENTS } = require('@sparkcrm/shared-events');
const { asyncHandler, EXOTEL_STATUS_MAP, uploadBufferToR2 } = require('@sparkcrm/shared-utils');
const axios = require('axios');
const callingApiService = require('../services/callingApi.service');

router.use(express.urlencoded({ extended: true, limit: '64kb', type: (req) => !req.is('json') }));
router.use(express.json({ limit: '64kb' }));

const enrichExotelCallAsync = async (callLogId, callSid) => {
    try {
        console.log(`[Exotel] Recording enrichment for Call SID: ${callSid}`);
        const callLog = await CallLog.findById(callLogId);
        if (!callLog) return;
        
        const details = await callingApiService.getCallStatus(callLog.tenantId, callSid);
        
        let updated = false;

        if (details.duration !== undefined && details.duration > 0 && (!callLog.call.duration || callLog.call.duration < details.duration)) {
            callLog.call.duration = details.duration;
            callLog.recording.duration = details.duration;
            updated = true;
        }

        if (details.recordingUrl && !callLog.recording.url) {
            try {
                const config = await callingApiService.getConfig(callLog.tenantId);
                const authOptions = { username: config.apiKey, password: config.apiToken };
                
                const response = await axios.get(details.recordingUrl, {
                    responseType: 'arraybuffer',
                    auth: authOptions,
                });
                
                const buffer = Buffer.from(response.data);
                const objectKey = `tenants/${callLog.tenantId}/users/${callLog.userId}/leads/${callLog.leadId}/recordings/${callSid}.mp3`;
                
                await uploadBufferToR2(buffer, objectKey, 'audio/mpeg');
                
                callLog.recording.url = details.recordingUrl;
                callLog.recording.objectKey = objectKey;
                callLog.recording.mimeType = 'audio/mpeg';
                callLog.recording.status = 'available';
                callLog.recording.fetchedAt = new Date();
                updated = true;
            } catch (uploadError) {
                console.error(`❌ [Exotel] Failed to download/upload recording for Call SID: ${callSid}`, uploadError.message);
                callLog.recording.url = details.recordingUrl;
                callLog.recording.status = 'ready';
                callLog.recording.fetchedAt = new Date();
                updated = true;
            }
        } else if (details.status === 'completed' && !details.recordingUrl && callLog.recording.status === 'processing') {
            console.log('[Exotel] Recording unavailable during enrichment fallback');
            callLog.recording.status = 'unavailable';
            updated = true;
        }

        if (updated) {
            await callLog.save();
            if (callLog.call.status === 'completed' && !callLog.events.processed?.includes('CALL_COMPLETED')) {
                await publishEvent(EVENTS.CALL_COMPLETED, {
                    tenantId: callLog.tenantId,
                    callId: callLog._id,
                    leadId: callLog.leadId,
                    userId: callLog.userId,
                    duration: callLog.call.duration,
                });
                callLog.events.processed.push('CALL_COMPLETED');
                await callLog.save();
            }

            if (callLog.recording.status === 'ready' && !callLog.events.processed?.includes('CALL_RECORDING_READY')) {
                await publishEvent('CALL_RECORDING_READY', {
                    tenantId: callLog.tenantId,
                    callId: callLog._id,
                    callSid: callSid,
                    recordingUrl: details.recordingUrl,
                    userId: callLog.userId
                });
                callLog.events.processed.push('CALL_RECORDING_READY');
                await callLog.save();
            }
        }

    } catch (err) {
        console.error('❌ Error during Exotel call enrichment:', err.message);
    }
};

/**
 * POST /webhooks/exotel
 * Exotel sends status callbacks here after call events
 */
router.post(
    '/exotel',
    asyncHandler(async (req, res) => {
        const { CallSid, Status, RecordingUrl, CustomField, EventType, StartTime, EndTime, EventTime, ConversationDuration, Legs } = req.body;
        if (!CallSid) {
            return res.status(400).json({ success: false, message: 'CallSid is required' });
        }
        
        if (!EventType && !Status) {
            return res.status(400).json({ success: false, message: 'EventType or Status is required' });
        }

        const eventType = EventType || null;

        let callLog = null;
        if (CustomField) {
            try {
                if (CustomField.length === 24) {
                    callLog = await CallLog.findById(CustomField);
                }
            } catch (err) {
                console.error(`Error finding CallLog by CustomField: ${CustomField}`, err);
            }
        }
        if (!callLog) {
            callLog = await CallLog.findOne({ 'provider.externalCallId': CallSid, 'provider.name': 'exotel' });
        }

        if (!callLog) {
            console.warn('⚠️ Exotel callback: CallLog not found', { CallSid, CustomField });
            return res.status(200).json({ status: 'ok' });
        }

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

        if (eventType === 'ringing') {
            if (STATUS_PRIORITY['ringing'] >= (STATUS_PRIORITY[callLog.call.status] || 0)) {
                newStatus = 'ringing';
            }
            if (!callLog.call.ringingAt) {
                callLog.call.ringingAt = EventTime ? new Date(EventTime) : new Date();
            }
        } else if (eventType === 'answered') {
            if (STATUS_PRIORITY['in_progress'] >= (STATUS_PRIORITY[callLog.call.status] || 0)) {
                newStatus = 'in_progress';
            }
            if (!callLog.call.answeredAt) {
                callLog.call.answeredAt = EventTime ? new Date(EventTime) : (StartTime ? new Date(StartTime) : new Date());
            }
        } else if (eventType === 'terminal' || (!eventType && Status)) {
            const rawNewStatus = EXOTEL_STATUS_MAP[Status] || callLog.call.status;
            if (STATUS_PRIORITY[rawNewStatus] && STATUS_PRIORITY[rawNewStatus] >= (STATUS_PRIORITY[callLog.call.status] || 0)) {
                newStatus = rawNewStatus;
            }
        }

        callLog.call.status = newStatus;
        const isNowTerminal = ['completed', 'missed', 'failed'].includes(newStatus);

        if (isNowTerminal) {
            let durationVal = null;
            if (ConversationDuration !== undefined && ConversationDuration !== null && ConversationDuration !== '') {
                durationVal = parseInt(ConversationDuration, 10);
            } else if (Legs && Array.isArray(Legs)) {
                for (const leg of Legs) {
                    if (leg.OnCallDuration) {
                        const parsed = parseInt(leg.OnCallDuration, 10);
                        if (!Number.isNaN(parsed) && (durationVal === null || parsed > durationVal)) {
                            durationVal = parsed;
                        }
                    }
                }
            }

            if (durationVal !== null && !Number.isNaN(durationVal)) {
                callLog.call.duration = durationVal;
                callLog.recording.duration = durationVal;
            }

            if (RecordingUrl) {
                try {
                    const config = await callingApiService.getConfig(callLog.tenantId);
                    const authOptions = { username: config.apiKey, password: config.apiToken };
                    
                    const response = await axios.get(RecordingUrl, {
                        responseType: 'arraybuffer',
                        auth: authOptions,
                    });
                    
                    const buffer = Buffer.from(response.data);
                    const objectKey = `tenants/${callLog.tenantId}/users/${callLog.userId}/leads/${callLog.leadId}/recordings/${CallSid}.mp3`;
                    
                    await uploadBufferToR2(buffer, objectKey, 'audio/mpeg');
                    
                    callLog.recording.url = RecordingUrl;
                    callLog.recording.objectKey = objectKey;
                    callLog.recording.mimeType = 'audio/mpeg';
                    callLog.recording.status = 'available';
                    callLog.recording.fetchedAt = new Date();
                } catch (uploadError) {
                    console.error(`❌ [Webhook] Failed to download/upload recording for Call SID: ${CallSid}`, uploadError.message);
                    callLog.recording.url = RecordingUrl;
                    callLog.recording.status = 'ready';
                    callLog.recording.fetchedAt = new Date();
                }
            } else {
                callLog.recording.status = 'processing';
            }

            if (!callLog.call.endedAt) {
                if (EventTime) {
                    callLog.call.endedAt = new Date(EventTime);
                } else if (EndTime) {
                    callLog.call.endedAt = new Date(EndTime);
                } else {
                    callLog.call.endedAt = new Date();
                }
            }
            
            if (callLog.call.endedAt && callLog.call.duration > 0 && !callLog.call.answeredAt && !EventTime) {
                callLog.call.answeredAt = new Date(callLog.call.endedAt.getTime() - (callLog.call.duration * 1000));
            }
        }

        callLog.provider.data = { 
            ...callLog.provider.data, 
            lastCallback: {
                eventType: eventType,
                status: Status,
                eventTime: EventTime,
                callSid: CallSid,
                conversationDuration: ConversationDuration,
                recordingUrl: RecordingUrl
            }
        };
        
        callLog.provider.externalCallId = CallSid;
        
        callLog.markModified('provider');
        await callLog.save();

        if (isNowTerminal && !isAlreadyTerminal) {
            if (newStatus === 'completed') {
                await publishEvent(EVENTS.CALL_COMPLETED, {
                    tenantId: callLog.tenantId,
                    callId: callLog._id,
                    leadId: callLog.leadId,
                    userId: callLog.userId,
                    duration: callLog.call.duration,
                });
                
                if (callLog.leadId) {
                    await publishEvent(EVENTS.LEAD_UPDATED, {
                        tenantId: callLog.tenantId,
                        userId: callLog.userId,
                        leadId: callLog.leadId,
                        changes: { lastContactedAt: callLog.call.answeredAt || callLog.call.endedAt },
                    });
                }
            } else if (newStatus === 'missed' || newStatus === 'failed') {
                await publishEvent(EVENTS.CALL_MISSED, {
                    tenantId: callLog.tenantId,
                    callId: callLog._id,
                    leadId: callLog.leadId,
                    userId: callLog.userId,
                });
            }
        }

        if (eventType === 'terminal' || (!eventType && Status && isNowTerminal)) {
            if (callLog.recording.status === 'processing') {
                // Recording URL was not in the webhook — poll Exotel API as fallback
                setTimeout(() => {
                    enrichExotelCallAsync(callLog._id, CallSid).catch(console.error);
                }, 5000);
            }
        }

        return res.status(200).json({ status: 'ok' });
    })
);

module.exports = router;
