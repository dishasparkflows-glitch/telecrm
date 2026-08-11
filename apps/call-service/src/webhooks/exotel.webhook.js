const crypto = require('node:crypto');
const express = require('express');
const router = express.Router();
const CallLog = require('../models/CallLog');
const { publishEvent, EVENTS } = require('@sparkcrm/shared-events');
const { asyncHandler, EXOTEL_STATUS_MAP } = require('@sparkcrm/shared-utils');

const authenticateAndParse = (req, res, next) => {
    const secret = process.env.EXOTEL_WEBHOOK_SECRET;
    if (!secret) {
        return res.status(503).json({ success: false, message: 'Exotel webhook verification is not configured' });
    }
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
        return res.status(400).json({ success: false, message: 'A raw Exotel webhook body is required' });
    }

    const supplied = String(req.headers['x-exotel-signature'] || '')
        .replace(/^sha256=/i, '')
        .trim();
    if (!supplied || !/^[a-f\d]{64}$/i.test(supplied)) {
        return res.status(401).json({ success: false, message: 'Invalid or missing Exotel webhook signature' });
    }

    const expected = crypto.createHmac('sha256', secret).update(req.body).digest();
    const suppliedBuffer = Buffer.from(supplied, 'hex');
    if (suppliedBuffer.length !== expected.length || !crypto.timingSafeEqual(suppliedBuffer, expected)) {
        return res.status(401).json({ success: false, message: 'Invalid Exotel webhook signature' });
    }

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
            CallSid, Status, RecordingUrl, Duration, CustomField
        } = req.body;
        if (!CallSid || !Status) {
            return res.status(400).json({
                success: false,
                message: 'CallSid and Status are required',
            });
        }

        console.log(`📞 Exotel webhook: ${CallSid} → ${Status}`);

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
            const isAlreadyTerminal = ['completed', 'missed', 'failed'].includes(callLog.call.status);
            const newStatus = EXOTEL_STATUS_MAP[Status] || callLog.call.status;
            callLog.call.status = newStatus;
            
            const isNowTerminal = ['completed', 'missed', 'failed'].includes(newStatus);

            if (RecordingUrl) {
                callLog.recording.url = RecordingUrl;
                callLog.recording.status = 'available';
            }
            if (Duration) callLog.call.duration = parseInt(Duration, 10);
            
            if (isNowTerminal && !callLog.timing.endedAt) {
                callLog.timing.endedAt = new Date();
            }

            if (callLog.timing.endedAt && callLog.call.duration > 0 && !callLog.timing.answeredAt) {
                callLog.timing.answeredAt = new Date(callLog.timing.endedAt.getTime() - (callLog.call.duration * 1000));
            }

            callLog.provider.data = { ...callLog.provider.data, lastStatus: Status, callSid: CallSid };
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
