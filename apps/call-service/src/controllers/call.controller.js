const CallLog = require('../models/CallLog');
const { ApiResponse, ApiError, asyncHandler, CALL_STATUS, buildScopeFilter } = require('@sparkcrm/shared-utils');
const { publishEvent, EVENTS } = require('@sparkcrm/shared-events');
const callingApi = require('../services/callingApi.service');
const { findLeadByPhone } = require('../services/leadLookup.service');
const { ALLOWED_AUDIO_TYPES, uploadPrivateRecording, createRecordingPlaybackUrl } = require('../services/recordingStorage.service');

/**
 * POST /api/calls/initiate
 * Initiate a click-to-call via Exotel / Twilio.
 *
 * Flow:
 *   1. Create a CallLog record (status: initiated)
 *   2. Call callingApi.initiateCall(agentMobile, leadPhone)
 *      → Exotel rings agent's phone first, then bridges to lead
 *      → Lead sees tenant's virtual number (fromNumber), not agent's mobile
 *   3. Save externalCallId returned by Exotel / Twilio
 *   4. Publish CALL_INITIATED event (triggers automation rules)
 *
 * Headers injected by API Gateway:
 *   x-tenant-calling-number  → tenant's Exotel virtual number (from Tenant.calling.exotelVirtualNumber)
 *   x-user-mobile            → agent's personal mobile number (from User.mobileNumber)
 */
const initiateCall = asyncHandler(async (req, res) => {
    const tenantId  = req.headers['x-tenant-id'];
    const userId    = req.headers['x-user-id'];
    const branchId  = req.headers['x-user-branch-id'] || req.headers['x-branch-id'];

    // Virtual number shown to the lead (Exotel caller-ID)
    const virtualNumber = req.headers['x-tenant-calling-number'];
    // Agent's personal mobile — Exotel rings this first
    const agentMobile   = req.headers['x-user-mobile'];

    const { toNumber, leadId } = req.body;

    if (!toNumber) throw ApiError.badRequest('Lead phone number is required');
    if (!virtualNumber) throw ApiError.badRequest('Calling is not configured for this account. Please contact your administrator.');
    if (!agentMobile)   throw ApiError.badRequest('Your mobile number is not set. Please update your profile before making calls.');

    // Step 1 — Create call log (status: initiated)
    const callLog = await CallLog.create({
        tenantId,
        branchId: branchId || null,
        leadId:   leadId   || null,
        callerId: userId,
        fromNumber: virtualNumber,  // What the lead sees
        toNumber,
        direction: 'outbound',
        status: CALL_STATUS.INITIATED,
        startedAt: new Date(),
    });

    // Step 2 — Actually place the call via Exotel / Twilio
    try {
        // agentMobile = the phone Exotel rings first
        // toNumber    = the lead's phone (Exotel bridges after agent picks up)
        const result = await callingApi.initiateCall(agentMobile, toNumber);

        callLog.externalCallId = result.externalCallId;
        callLog.provider       = result.provider;
        callLog.providerData   = result.providerData;
        await callLog.save();
    } catch (err) {
        // Mark failed so agent knows — don't leave it stuck as 'initiated'
        callLog.status = CALL_STATUS.FAILED;
        callLog.providerData = { error: err.message };
        await callLog.save();
        throw ApiError.internal(`Call could not be connected: ${err.message}`);
    }

    // Step 3 — Publish event → triggers automation rules (e.g. update lead stage)
    await publishEvent(EVENTS.CALL_INITIATED, {
        tenantId, callId: callLog._id, leadId, userId,
    });

    // Step 4 — Notify lead-service to update lastContactedAt
    if (leadId) {
        await publishEvent(EVENTS.LEAD_UPDATED, {
            tenantId,
            leadId,
            changes: { lastContactedAt: new Date(), lastActivityAt: new Date() },
        });
    }

    ApiResponse.created(res, callLog, 'Call initiated — your phone will ring shortly');
});

const MOBILE_CALL_TYPES = {
    incoming: { direction: 'inbound', status: CALL_STATUS.COMPLETED },
    outgoing: { direction: 'outbound', status: CALL_STATUS.COMPLETED },
    missed: { direction: 'inbound', status: CALL_STATUS.MISSED },
    rejected: { direction: 'inbound', status: CALL_STATUS.MISSED },
    blocked: { direction: 'inbound', status: CALL_STATUS.FAILED },
};

const normalizeMobileCallEntry = (entry = {}) => {
    const externalCallId = String(entry.deviceCallId || '').trim();
    const remoteNumber = String(entry.phone || entry.remoteNumber || '').trim();
    const type = MOBILE_CALL_TYPES[String(entry.type || '').toLowerCase()];
    if (!externalCallId || !remoteNumber || !type) throw new Error('deviceCallId, phone, and a valid call type are required');

    const startedAt = new Date(entry.startedAt || entry.timestamp);
    if (Number.isNaN(startedAt.getTime())) throw new Error('A valid startedAt timestamp is required');

    return {
        externalCallId,
        remoteNumber,
        type,
        startedAt,
        duration: Math.max(0, Number(entry.duration) || 0),
    };
};

/**
 * POST /api/calls/mobile/sync
 * Idempotently import native mobile call logs for the authenticated agent.
 */
const syncMobileCalls = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const callerId = req.headers['x-user-id'];
    const branchId = req.headers['x-user-branch-id'] || req.headers['x-branch-id'];
    const deviceId = String(req.body.deviceId || '').trim();
    const calls = Array.isArray(req.body.calls) ? req.body.calls.slice(0, 100) : [];

    if (!deviceId) throw ApiError.badRequest('deviceId is required');
    if (!calls.length) throw ApiError.badRequest('calls must contain at least one call log');

    const results = { created: 0, duplicates: 0, errors: [] };
    for (const entry of calls) {
        try {
            const { externalCallId, remoteNumber, type, startedAt, duration } = normalizeMobileCallEntry(entry);

            const existing = await CallLog.findOne({ tenantId, callerId, provider: 'mobile', externalCallId });
            if (existing) {
                results.duplicates += 1;
                continue;
            }

            const lead = entry.leadId ? { _id: entry.leadId } : await findLeadByPhone(tenantId, remoteNumber);
            const localNumber = String(entry.simPhoneNumber || req.headers['x-user-mobile'] || 'mobile');

            const callLog = await CallLog.create({
                tenantId,
                branchId: branchId && branchId !== 'all' ? branchId : null,
                leadId: lead?._id || null,
                callerId,
                fromNumber: type.direction === 'outbound' ? localNumber : remoteNumber,
                toNumber: type.direction === 'outbound' ? remoteNumber : localNumber,
                direction: type.direction,
                status: type.status,
                duration,
                externalCallId,
                provider: 'mobile',
                providerData: { nativeType: entry.type },
                deviceId,
                simSlot: Number.isInteger(entry.simSlot) ? entry.simSlot : null,
                simLabel: String(entry.simLabel || ''),
                simPhoneNumber: String(entry.simPhoneNumber || ''),
                recordingStatus: entry.hasRecording ? 'pending' : 'none',
                startedAt,
                endedAt: new Date(startedAt.getTime() + duration * 1000),
                syncedAt: new Date(),
            });

            const event = type.status === CALL_STATUS.MISSED ? EVENTS.CALL_MISSED : EVENTS.CALL_COMPLETED;
            await publishEvent(event, {
                tenantId,
                branchId: callLog.branchId,
                callId: callLog._id,
                leadId: callLog.leadId,
                userId: callerId,
                duration,
                provider: 'mobile',
            });
            if (callLog.leadId) {
                await publishEvent(EVENTS.LEAD_UPDATED, {
                    tenantId,
                    leadId: callLog.leadId,
                    changes: { lastContactedAt: startedAt, lastActivityAt: new Date() },
                });
            }
            results.created += 1;
        } catch (error) {
            if (error.code === 11000) results.duplicates += 1;
            else results.errors.push({ deviceCallId: entry.deviceCallId || null, error: error.message });
        }
    }

    ApiResponse.success(res, results, `Mobile sync complete: ${results.created} created, ${results.duplicates} duplicates`);
});

const uploadCallRecording = asyncHandler(async (req, res) => {
    const filter = buildScopeFilter(req, { ownerField: 'callerId', module: 'calls' });
    filter._id = req.params.id;
    const callLog = await CallLog.findOne(filter).select('+recordingObjectKey');
    if (!callLog) throw ApiError.notFound('Call log not found');

    const contentType = String(req.body.contentType || '').toLowerCase();
    if (!ALLOWED_AUDIO_TYPES.has(contentType)) throw ApiError.badRequest('Unsupported recording audio type');
    const encoded = String(req.body.contentBase64 || '').replace(/^data:[^;]+;base64,/, '');
    if (!encoded) throw ApiError.badRequest('contentBase64 is required');

    let buffer;
    try {
        buffer = Buffer.from(encoded, 'base64');
    } catch {
        throw ApiError.badRequest('Invalid base64 recording');
    }
    if (!buffer.length) throw ApiError.badRequest('Recording is empty');
    if (buffer.length > 7 * 1024 * 1024) throw ApiError.badRequest('Recording exceeds the 7 MB mobile upload limit');

    callLog.recordingStatus = 'pending';
    await callLog.save();
    try {
        callLog.recordingObjectKey = await uploadPrivateRecording({
            buffer,
            tenantId: callLog.tenantId,
            callId: callLog._id,
            contentType,
        });
        callLog.recordingMimeType = contentType;
        callLog.recordingDuration = Math.max(0, Number(req.body.duration) || callLog.duration || 0);
        callLog.recordingStatus = 'available';
        callLog.recordingUrl = null;
        await callLog.save();
    } catch (error) {
        callLog.recordingStatus = 'failed';
        await callLog.save();
        throw ApiError.internal(error.message || 'Recording upload failed');
    }

    ApiResponse.success(res, { callId: callLog._id, recordingStatus: callLog.recordingStatus }, 'Call recording uploaded securely');
});

const getCallRecording = asyncHandler(async (req, res) => {
    const filter = buildScopeFilter(req, { ownerField: 'callerId', module: 'calls' });
    filter._id = req.params.id;
    const callLog = await CallLog.findOne(filter).select('+recordingObjectKey');
    if (!callLog) throw ApiError.notFound('Call log not found');
    if (callLog.recordingObjectKey) {
        const playbackUrl = await createRecordingPlaybackUrl(callLog.recordingObjectKey, callLog.recordingMimeType, 300);
        return ApiResponse.success(res, { playbackUrl, expiresIn: 300, recordingStatus: callLog.recordingStatus }, 'Recording playback URL generated');
    }
    if (callLog.recordingUrl) {
        return ApiResponse.success(res, { playbackUrl: callLog.recordingUrl, expiresIn: null, recordingStatus: 'available' }, 'Provider recording URL fetched');
    }
    throw ApiError.notFound('No recording is available for this call');
});

/**
 * GET /api/calls/logs
 * Get call logs with filters
 */
const getCallLogs = asyncHandler(async (req, res) => {
    const { page = 1, limit = 25, leadId, status, direction } = req.query;

    // Build scope filter — agents see only their calls, managers see branch data
    const filter = buildScopeFilter(req, { ownerField: 'callerId', module: 'calls' });
    if (leadId) filter.leadId = leadId;
    if (status) filter.status = status;
    if (direction) filter.direction = direction;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [logs, total] = await Promise.all([
        CallLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
        CallLog.countDocuments(filter),
    ]);

    ApiResponse.paginated(res, logs, {
        page: parseInt(page), limit: parseInt(limit), total,
        totalPages: Math.ceil(total / parseInt(limit)),
    });
});

/**
 * PUT /api/calls/:id/disposition
 * Update call disposition and notes after call ends
 */
const updateDisposition = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const { disposition, notes, callbackAt } = req.body;

    const callLog = await CallLog.findOne({ _id: req.params.id, tenantId });
    if (!callLog) throw ApiError.notFound('Call log not found');

    if (disposition) callLog.disposition = disposition;
    if (notes) callLog.notes = notes;
    if (callbackAt) callLog.callbackAt = callbackAt;
    callLog.status = CALL_STATUS.COMPLETED;
    callLog.endedAt = new Date();
    if (callLog.startedAt) {
        callLog.duration = Math.floor((callLog.endedAt - callLog.startedAt) / 1000);
    }
    await callLog.save();

    await publishEvent(EVENTS.CALL_COMPLETED, {
        tenantId, callId: callLog._id, leadId: callLog.leadId,
        disposition, duration: callLog.duration,
    });

    ApiResponse.success(res, callLog, 'Disposition updated');
});

/**
 * GET /api/calls/stats
 * Call statistics
 */
const getCallStats = asyncHandler(async (req, res) => {
    const ObjectId = require('mongoose').Types.ObjectId;

    // Build scope filter for stats
    const scope = buildScopeFilter(req, { ownerField: 'callerId', module: 'calls' });
    const matchStage = {};
    if (scope.tenantId) matchStage.tenantId = new ObjectId(scope.tenantId);
    if (scope.branchId) matchStage.branchId = new ObjectId(scope.branchId);
    if (scope.callerId) matchStage.callerId = new ObjectId(scope.callerId);

    const stats = await CallLog.aggregate([
        { $match: matchStage },
        {
            $group: {
                _id: null,
                totalCalls: { $sum: 1 },
                completedCalls: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
                missedCalls: { $sum: { $cond: [{ $eq: ['$status', 'missed'] }, 1, 0] } },
                avgDuration: { $avg: '$duration' },
                totalDuration: { $sum: '$duration' },
            },
        },
    ]);

    ApiResponse.success(res, stats[0] || { totalCalls: 0 });
});

module.exports = { initiateCall, syncMobileCalls, uploadCallRecording, getCallRecording, getCallLogs, updateDisposition, getCallStats, normalizeMobileCallEntry };
