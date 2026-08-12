const CallLog = require('../models/CallLog');
const { ApiResponse, ApiError, asyncHandler, CALL_STATUS, buildScopeFilter, getPresignedDownloadUrl } = require('@sparkcrm/shared-utils');
const { publishEvent, EVENTS } = require('@sparkcrm/shared-events');
const callingApi = require('../services/callingApi.service');
const { findLeadByPhone } = require('../services/leadLookup.service');

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

    const virtualNumber = req.headers['x-tenant-calling-number'];
    const agentMobile   = req.headers['x-user-mobile'];
    const isImpersonating = req.headers['x-is-impersonating'] === 'true';

    const { leadId } = req.body;
    const toNumber = req.body.phone;

    if (!toNumber) throw ApiError.badRequest('Lead phone number is required');
    if (!virtualNumber) throw ApiError.badRequest('Calling is not configured for this account. Please contact your administrator.');
    if (!agentMobile) {
        if (isImpersonating) {
            throw ApiError.badRequest('Owners impersonating a tenant cannot initiate calls directly. Please log in as a tenant user with a configured mobile number to test calling.');
        }
        throw ApiError.badRequest('Your mobile number is not set. Please update your profile before making calls.');
    }

    const callLog = await CallLog.create({
        tenantId,
        branchId: branchId || null,
        userId: userId,
        leadId: leadId,
        call: {
            from: agentMobile,
            to: toNumber,
            direction: 'outbound',
            status: CALL_STATUS.INITIATED,
            duration: 0,
            initiatedAt: new Date(),
            answeredAt: null,
            endedAt: null
        },
        provider: {
            name: 'exotel', // Default, will be updated via callingApi
            externalCallId: null,
            data: {}
        }
    });

    try {
        const result = await callingApi.initiateCall({
            fromNumber: agentMobile,
            toNumber,
            callId: callLog._id
        });

        callLog.provider.externalCallId = result.externalCallId;
        callLog.provider.name           = result.provider;
        callLog.provider.data           = result.providerData;
        callLog.markModified('provider');
        await callLog.save();
    } catch (err) {
        callLog.call.status = CALL_STATUS.FAILED;
        
        if (err.providerData) {
            callLog.provider.data = err.providerData;
        } else {
            callLog.provider.data = { error: { message: err.message } };
        }
        callLog.markModified('provider');
        await callLog.save();

        if (err.code && err.status) {
            const apiError = new ApiError(err.status, err.message);
            apiError.code = err.code;
            throw apiError;
        }
        
        throw ApiError.internal(`Call could not be connected: ${err.message}`);
    }

    await publishEvent(EVENTS.CALL_INITIATED, {
        tenantId, callId: callLog._id, leadId, userId,
    });

    if (leadId) {
        await publishEvent(EVENTS.LEAD_UPDATED, {
            tenantId,
            leadId,
            changes: { lastActivityAt: new Date() },
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

            const existing = await CallLog.findOne({ tenantId, userId: callerId, 'provider.name': 'mobile', 'provider.externalCallId': externalCallId });
            if (existing) {
                results.duplicates += 1;
                continue;
            }

            const lead = entry.leadId ? { _id: entry.leadId } : await findLeadByPhone(tenantId, remoteNumber);
            const localNumber = String(entry.simPhoneNumber || req.headers['x-user-mobile'] || 'mobile');

            const callLog = await CallLog.create({
                tenantId,
                branchId: branchId && branchId !== 'all' ? branchId : null,
                userId: callerId,
                leadId: lead?._id || null,
                call: {
                    from: type.direction === 'outbound' ? localNumber : remoteNumber,
                    to: type.direction === 'outbound' ? remoteNumber : localNumber,
                    direction: type.direction,
                    status: type.status,
                    duration,
                    initiatedAt: startedAt,
                    answeredAt: type.status === CALL_STATUS.COMPLETED ? startedAt : null,
                    endedAt: new Date(startedAt.getTime() + duration * 1000)
                },
                provider: {
                    name: 'mobile',
                    externalCallId,
                    data: { nativeType: entry.type }
                },
                recording: {
                    status: entry.hasRecording ? 'pending' : 'none'
                },
                mobile: {
                    deviceId,
                    simSlot: Number.isInteger(entry.simSlot) ? entry.simSlot : null,
                    simLabel: String(entry.simLabel || ''),
                    phoneNumber: String(entry.simPhoneNumber || ''),
                    syncedAt: new Date()
                }
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
                const changes = { lastActivityAt: new Date() };
                if (type.status === CALL_STATUS.COMPLETED) {
                    changes.lastContactedAt = startedAt;
                }
                await publishEvent(EVENTS.LEAD_UPDATED, {
                    tenantId,
                    leadId: callLog.leadId,
                    changes,
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

const getCallRecording = asyncHandler(async (req, res) => {
    const filter = buildScopeFilter(req, { ownerField: 'userId', module: 'calls' });
    filter._id = req.params.id;
    const callLog = await CallLog.findOne(filter).select('+recording.objectKey');
    if (!callLog) throw ApiError.notFound('Call log not found');
    if (callLog.recording.objectKey) {
        const playbackUrl = await getPresignedDownloadUrl(callLog.recording.objectKey);
        return ApiResponse.success(res, { playbackUrl, recordingStatus: callLog.recording.status }, 'Recording playback URL generated');
    }
    if (callLog.recording.url) {
        return ApiResponse.success(res, { playbackUrl: callLog.recording.url, recordingStatus: 'available' }, 'Provider recording URL fetched');
    }
    throw ApiError.notFound('No recording is available for this call');
});

/**
 * GET /api/calls/logs
 * Get call logs with filters
 */
const getCallLogs = asyncHandler(async (req, res) => {
    const { page = 1, limit = 25, leadId, status, direction } = req.query;

    const filter = buildScopeFilter(req, { ownerField: 'userId', module: 'calls' });
    if (leadId) filter.leadId = leadId;
    if (status) filter['call.status'] = status;
    if (direction) filter['call.direction'] = direction;

    const safeLimit = Math.min(Math.max(parseInt(limit) || 25, 1), 100);
    const safePage = Math.max(parseInt(page) || 1, 1);
    const skip = (safePage - 1) * safeLimit;
    const [dbLogs, total] = await Promise.all([
        CallLog.find(filter)
            .sort({ 'audit.createdAt': -1 })
            .skip(skip)
            .limit(safeLimit),
        CallLog.countDocuments(filter),
    ]);

    // Generate signed playback URLs in parallel for logs that have an R2 objectKey
    const logs = await Promise.all(
        dbLogs.map(async log => {
            const obj = log.toObject();
            let playbackUrl = obj.recording?.url || null;
            if (obj.recording?.objectKey) {
                try {
                    playbackUrl = await getPresignedDownloadUrl(obj.recording.objectKey);
                } catch {
                    playbackUrl = obj.recording?.url || null;
                }
            }
            return {
                _id: obj._id,
                tenantId: obj.tenantId,
                branchId: obj.branchId,
                userId: obj.userId,
                leadId: obj.leadId,
                call: obj.call,
                recording: {
                    status: obj.recording?.status,
                    mimeType: obj.recording?.mimeType,
                    duration: obj.recording?.duration,
                    playbackUrl,
                },
                disposition: obj.disposition,
                audit: { createdAt: obj.audit?.createdAt },
            };
        })
    );

    ApiResponse.paginated(res, logs, {
        page: safePage, limit: safeLimit, total,
        totalPages: Math.ceil(total / safeLimit),
    });
});

/**
 * PUT /api/calls/:id/disposition
 * Update call disposition and notes after call ends
 */
const updateDisposition = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const userId = req.headers['x-user-id'];
    const { disposition, notes, callbackAt } = req.body;

    const callLog = await CallLog.findOne({ _id: req.params.id, tenantId });
    if (!callLog) throw ApiError.notFound('Call log not found');

    if (disposition) callLog.disposition.code = disposition;
    if (notes) callLog.disposition.notes = notes;
    callLog.disposition.updatedAt = new Date();
    callLog.disposition.updatedBy = userId;
    if (callbackAt) callLog.callbackAt = callbackAt;
    await callLog.save();

    ApiResponse.success(res, callLog, 'Disposition updated');
});

/**
 * GET /api/calls/stats
 * Call statistics
 */
const getCallStats = asyncHandler(async (req, res) => {
    const ObjectId = require('mongoose').Types.ObjectId;

    const scope = buildScopeFilter(req, { ownerField: 'userId', module: 'calls' });
    const matchStage = {};
    if (scope.tenantId) matchStage.tenantId = new ObjectId(scope.tenantId);
    if (scope.branchId) matchStage.branchId = new ObjectId(scope.branchId);
    if (scope.userId) matchStage.userId = new ObjectId(scope.userId);

    const stats = await CallLog.aggregate([
        { $match: matchStage },
        {
            $group: {
                _id: null,
                totalCalls: { $sum: 1 },
                completedCalls: { $sum: { $cond: [{ $eq: ['$call.status', 'completed'] }, 1, 0] } },
                missedCalls: { $sum: { $cond: [{ $eq: ['$call.status', 'missed'] }, 1, 0] } },
                avgDuration: { $avg: '$call.duration' },
                totalDuration: { $sum: '$call.duration' },
            },
        },
    ]);

    ApiResponse.success(res, stats[0] || { totalCalls: 0 });
});

module.exports = { initiateCall, syncMobileCalls, getCallRecording, getCallLogs, updateDisposition, getCallStats, normalizeMobileCallEntry };
