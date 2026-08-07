const crypto = require('node:crypto');
const express = require('express');
const router = express.Router();
const CallLog = require('../models/CallLog');
const { publishEvent, EVENTS } = require('@sparkcrm/shared-events');
const { asyncHandler } = require('@sparkcrm/shared-utils');

const authenticateAndParse = (req, res, next) => {
    const secret = process.env.EXOTEL_WEBHOOK_SECRET;
    if (!secret) {
        return res.status(503).json({
            success: false,
            message: 'Exotel webhook verification is not configured',
        });
    }
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
        return res.status(400).json({ success: false, message: 'A raw Exotel webhook body is required' });
    }

    const supplied = String(req.headers['x-exotel-signature'] || '')
        .replace(/^sha256=/i, '')
        .trim();
    if (!/^[a-f\d]{64}$/i.test(supplied)) {
        return res.status(401).json({ success: false, message: 'Invalid Exotel webhook signature' });
    }

    const expected = crypto.createHmac('sha256', secret).update(req.body).digest();
    const suppliedBuffer = Buffer.from(supplied, 'hex');
    if (suppliedBuffer.length !== expected.length || !crypto.timingSafeEqual(suppliedBuffer, expected)) {
        return res.status(401).json({ success: false, message: 'Invalid Exotel webhook signature' });
    }

    req.body = Object.fromEntries(new URLSearchParams(req.body.toString('utf8')));
    next();
};

const rawExotelForm = express.raw({
    type: 'application/x-www-form-urlencoded',
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
            CallSid, Status, RecordingUrl, Duration,
        } = req.body;
        if (!CallSid || !Status) {
            return res.status(400).json({
                success: false,
                message: 'CallSid and Status are required',
            });
        }

        console.log(`📞 Exotel webhook: ${CallSid} → ${Status}`);

        // Find call log by external ID
        const callLog = await CallLog.findOne({ externalCallId: CallSid });

        if (callLog) {
            // Map Exotel statuses to our statuses
            const statusMap = {
                ringing: 'ringing',
                'in-progress': 'in_progress',
                completed: 'completed',
                busy: 'missed',
                'no-answer': 'missed',
                failed: 'failed',
                canceled: 'failed',
            };

            callLog.status = statusMap[Status] || callLog.status;

            if (RecordingUrl) callLog.recordingUrl = RecordingUrl;
            if (Duration) callLog.duration = parseInt(Duration, 10);
            if (Status === 'completed' || Status === 'busy' || Status === 'no-answer' || Status === 'failed') {
                callLog.endedAt = new Date();
            }

            callLog.providerData = { ...callLog.providerData, lastStatus: Status, callSid: CallSid };
            await callLog.save();

            // Publish events
            if (callLog.status === 'completed') {
                await publishEvent(EVENTS.CALL_COMPLETED, {
                    tenantId: callLog.tenantId,
                    callId: callLog._id,
                    leadId: callLog.leadId,
                    duration: callLog.duration,
                });
            } else if (callLog.status === 'missed') {
                await publishEvent(EVENTS.CALL_MISSED, {
                    tenantId: callLog.tenantId,
                    callId: callLog._id,
                    leadId: callLog.leadId,
                });
            }
        }

        res.json({ status: 'ok' });
    })
);

module.exports = router;
module.exports.authenticateAndParse = authenticateAndParse;
