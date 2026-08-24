const FollowUp = require('../models/FollowUp');
const { ApiResponse, asyncHandler, buildScopeFilter } = require('@sparkcrm/shared-utils');
const followUpService = require('../services/followup.service');
const { getUsersBulk } = require('../services/serviceClients/user.client');

/**
 * GET /api/follow-ups
 */
const getFollowUps = asyncHandler(async (req, res) => {
    const { page = 1, limit = 50, status, assignedUserId, leadId, fromDate, toDate, type } = req.query;
    const tenantId = req.headers['x-tenant-id'];

    const filter = buildScopeFilter(req, { ownerField: 'assignedUserId', module: 'leads' });
    
    if (status) {
        if (status === 'upcoming') {
            filter.status = 'scheduled';
            filter.scheduledAt = { $gte: new Date() };
        } else if (status === 'missed') {
            filter.status = 'scheduled';
            filter.scheduledAt = { $lt: new Date(Date.now() - 30 * 60000) }; // 30 min grace period
        } else {
            filter.status = status;
        }
    }
    
    if (assignedUserId) filter.assignedUserId = assignedUserId;
    if (leadId) filter.leadId = leadId;
    if (type) filter.type = type;
    
    if (fromDate || toDate) {
        filter.scheduledAt = filter.scheduledAt || {};
        if (fromDate) filter.scheduledAt.$gte = new Date(fromDate);
        if (toDate) filter.scheduledAt.$lte = new Date(toDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [followUps, total] = await Promise.all([
        FollowUp.find(filter)
            .sort({ scheduledAt: 1 })
            .skip(skip)
            .limit(parseInt(limit))
            .lean(),
        FollowUp.countDocuments(filter)
    ]);

    // Populate user references
    const userIds = [...new Set(followUps.map(f => f.assignedUserId).filter(Boolean).map(String))];
    const users = userIds.length > 0 ? await getUsersBulk(tenantId, userIds) : [];
    const userMap = new Map(users.map(u => [String(u._id), u]));

    const populatedFollowUps = followUps.map(f => {
        const user = userMap.get(String(f.assignedUserId));
        return {
            ...f,
            assignedUser: user ? { _id: user._id, name: user.contact?.name || 'Unknown User' } : null
        };
    });

    ApiResponse.paginated(res, populatedFollowUps, {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
    });
});

/**
 * GET /api/follow-ups/calendar
 */
const getCalendarFollowUps = asyncHandler(async (req, res) => {
    const { fromDate, toDate, from, to } = req.query;
    const filter = buildScopeFilter(req, { ownerField: 'assignedUserId', module: 'leads' });

    // Handle both from/to and fromDate/toDate query params just in case
    const effectiveFrom = from || fromDate;
    const effectiveTo = to || toDate;

    if (effectiveFrom || effectiveTo) {
        filter.scheduledAt = {};
        if (effectiveFrom) filter.scheduledAt.$gte = new Date(effectiveFrom);
        if (effectiveTo) filter.scheduledAt.$lte = new Date(effectiveTo);
    }

    const followUps = await FollowUp.find(filter)
        .select('_id scheduledAt leadId assignedUserId type')
        .populate('leadId', 'name')
        .lean();

    ApiResponse.success(res, followUps);
});

/**
 * GET /api/follow-ups/stats
 */
const getFollowUpStats = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const filter = buildScopeFilter(req, { ownerField: 'assignedUserId', module: 'leads' });
    
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const [upcoming, today, missed, completedToday] = await Promise.all([
        FollowUp.countDocuments({ ...filter, status: 'scheduled', scheduledAt: { $gte: new Date() } }),
        FollowUp.countDocuments({ ...filter, status: 'scheduled', scheduledAt: { $gte: todayStart, $lte: todayEnd } }),
        FollowUp.countDocuments({ ...filter, status: 'scheduled', scheduledAt: { $lt: new Date(Date.now() - 30 * 60000) } }),
        FollowUp.countDocuments({ ...filter, status: 'completed', completedAt: { $gte: todayStart, $lte: todayEnd } }),
    ]);

    ApiResponse.success(res, { upcoming, today, missed, completedToday });
});

/**
 * POST /api/follow-ups
 */
const createFollowUp = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const userId = req.headers['x-user-id'];
    const { leadId, assignedUserId, type, scheduledAt, note, reminderMinutesBefore } = req.body;

    const followUp = await followUpService.createFollowUp(tenantId, leadId, userId, {
        assignedUserId,
        type,
        scheduledAt,
        note,
        reminderMinutesBefore
    });

    ApiResponse.created(res, followUp, 'Follow-up scheduled successfully');
});

/**
 * POST /api/follow-ups/:id/complete
 */
const completeFollowUp = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const userId = req.headers['x-user-id'];
    const { id } = req.params;
    
    const followUp = await followUpService.completeFollowUp(tenantId, id, userId, req.body);
    ApiResponse.success(res, followUp, 'Follow-up completed');
});

/**
 * POST /api/follow-ups/:id/reschedule
 */
const rescheduleFollowUp = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const userId = req.headers['x-user-id'];
    const { id } = req.params;
    
    const followUp = await followUpService.rescheduleFollowUp(tenantId, id, userId, req.body);
    ApiResponse.success(res, followUp, 'Follow-up rescheduled');
});

/**
 * POST /api/follow-ups/:id/cancel
 */
const cancelFollowUp = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const userId = req.headers['x-user-id'];
    const { id } = req.params;
    
    const followUp = await followUpService.cancelFollowUp(tenantId, id, userId, req.body);
    ApiResponse.success(res, followUp, 'Follow-up cancelled');
});

module.exports = {
    getFollowUps,
    getFollowUpStats,
    createFollowUp,
    completeFollowUp,
    rescheduleFollowUp,
    cancelFollowUp,
    getCalendarFollowUps
};
