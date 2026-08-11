const express = require('express');
const router = express.Router();
const CallLog = require('../models/CallLog');
const { publishEvent, EVENTS } = require('@sparkcrm/shared-events');
const { asyncHandler, EXOTEL_STATUS_MAP } = require('@sparkcrm/shared-utils');

const authenticateAndParse = (req, res, next) => {
    // Signature verification removed as Exotel does not natively support x-exotel-signature

    try {
        const bodyStr = req.body.toString('utf8');
        if (req.headers['content-type']?.includes('application/json')) {
            req.body = JSON.parse(bodyStr);
        } else {
            req.body = Object.fromEntries(new URLSearchParams(bodyStr));
        }
        next();
    } catch (err) {
        return res.status(400).json({ success: false, message: 'Invalid body format' });
    }
};

const rawExotelForm = express.raw({
    type: ['application/x-www-form-urlencoded', 'application/json'],
    limit: '64kb',
});

/**
 * POST /webhooks/exotel
 * Exotel sends status callbacks here after call events
 */
router.post(
    '/exotel',
    rawExotelForm,
    authenticateAndParse,
    asyncHandler(async (req, res) => {
        const {
            CallSid, Status, RecordingUrl, Duration, CustomField, EventType, StartTime, EndTime
        } = req.body;
        if (!CallSid || !Status) {
            return res.status(400).json({
                success: false,
                message: 'CallSid and Status are required',
            });
        }

        console.log('📞 Exotel webhook received:', {
            callSid: CallSid,
            customField: CustomField,
            status: Status,
            eventType: EventType
        });

        // Find call log by CustomField (our ID) or external ID
        let callLog = null;
        if (CustomField) {
            try {
                callLog = await CallLog.findById(CustomField);
            } catch (err) {
                console.error(`Error finding CallLog by CustomField: ${CustomField}`, err);
            }
        }
        if (!callLog) {
            callLog = await CallLog.findOne({ 'provider.externalCallId': CallSid, 'provider.name': 'exotel' });
        }

        if (callLog) {
            const STATUS_PRIORITY = {
                initiated: 1,
                ringing: 2,
                in_progress: 3,
                completed: 4,
                missed: 4,
                failed: 4
            };

            const isAlreadyTerminal = ['completed', 'missed', 'failed'].includes(callLog.call.status);
            const rawNewStatus = EXOTEL_STATUS_MAP[Status] || callLog.call.status;
            
            let newStatus = callLog.call.status;
            if (STATUS_PRIORITY[rawNewStatus] && STATUS_PRIORITY[rawNewStatus] >= (STATUS_PRIORITY[callLog.call.status] || 0)) {
                newStatus = rawNewStatus;
            }

            callLog.call.status = newStatus;
            const isNowTerminal = ['completed', 'missed', 'failed'].includes(newStatus);

            if (RecordingUrl) {
                callLog.recording.url = RecordingUrl;
                callLog.recording.status = 'available';
            }
            
            if (Duration !== undefined && Duration !== null) {
                const parsedDuration = Number.parseInt(Duration, 10);
                if (!Number.isNaN(parsedDuration)) {
                    callLog.call.duration = parsedDuration;
                }
            }
            
            if (StartTime && !callLog.timing.answeredAt && (newStatus === 'in_progress' || newStatus === 'completed')) {
                const parsedStartTime = new Date(StartTime);
                if (!Number.isNaN(parsedStartTime.getTime())) {
                    callLog.timing.answeredAt = parsedStartTime;
                }
            }

            if (EndTime && isNowTerminal && !callLog.timing.endedAt) {
                const parsedEndTime = new Date(EndTime);
                if (!Number.isNaN(parsedEndTime.getTime())) {
                    callLog.timing.endedAt = parsedEndTime;
                }
            }

            if (isNowTerminal && !callLog.timing.endedAt) {
                callLog.timing.endedAt = new Date();
            }

            if (callLog.timing.endedAt && callLog.call.duration > 0 && !callLog.timing.answeredAt) {
                callLog.timing.answeredAt = new Date(callLog.timing.endedAt.getTime() - (callLog.call.duration * 1000));
            }

            callLog.provider.data = { ...callLog.provider.data, lastStatus: Status, callSid: CallSid };
            callLog.markModified('provider');
            await callLog.save();

            // Publish events only if transitioned to terminal just now
            if (isNowTerminal && !isAlreadyTerminal) {
                if (newStatus === 'completed') {
                    await publishEvent(EVENTS.CALL_COMPLETED, {
                        tenantId: callLog.tenantId,
                        callId: callLog._id,
                        leadId: callLog.leadId,
                        userId: callLog.userId,
                        duration: callLog.call.duration,
                    });
                    
                    // Update lastContactedAt for completed calls
                    if (callLog.leadId) {
                        await publishEvent(EVENTS.LEAD_UPDATED, {
                            tenantId: callLog.tenantId,
                            leadId: callLog.leadId,
                            changes: { lastContactedAt: callLog.timing.answeredAt || callLog.timing.endedAt },
                        });
                    }
                } else if (newStatus === 'missed') {
                    await publishEvent(EVENTS.CALL_MISSED, {
                        tenantId: callLog.tenantId,
                        callId: callLog._id,
                        leadId: callLog.leadId,
                        userId: callLog.userId,
                    });
                }
            }
        }

        res.json({ status: 'ok' });
    })
);

module.exports = router;
module.exports.authenticateAndParse = authenticateAndParse;
