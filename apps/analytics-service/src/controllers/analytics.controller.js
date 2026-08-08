const mongoose = require('mongoose');
const { ApiResponse, asyncHandler, ROLES } = require('@sparkcrm/shared-utils');
const { Lead, CallLog, WhatsappMessage, User } = require('../models/ShadowModels');
const { resolveDateRange } = require('../utils/dateRange');

/**
 * Helper: build a scope-aware filter for analytics queries.
 * 
 * This mirrors the logic of buildScopeFilter from shared-utils:
 * - Superadmin: sees ALL data, optionally filtered by selected branch
 * - Admin/Manager (isGlobal=true): sees ALL data in their branch
 * - Agent (isOwn=true): sees ONLY their own records in their branch
 * 
 * @param {Object} req - Express request
 * @param {string} ownerField - Field to match for ownership (e.g. 'assignedTo', 'callerId')
 * @returns {Object} MongoDB filter
 */


function buildAnalyticsFilter(req, ownerField = null) {
    const tenantId = new mongoose.Types.ObjectId(req.headers['x-tenant-id']);
    const userRole = req.headers['x-user-role'];
    const userId = req.headers['x-user-id'];
    const userBranchId = req.headers['x-user-branch-id'];
    const selectedBranchId = req.headers['x-branch-id'];

    const filter = { tenantId };

    // ── Superadmin: sees all, optionally filtered by selected branch ──
    if (userRole === ROLES.SUPER_ADMIN) {
        const branchId = selectedBranchId || userBranchId;
        if (branchId && branchId !== 'all') {
            filter.branchId = new mongoose.Types.ObjectId(branchId);
        }
        return filter;
    }

    // ── Non-superadmin: determine isGlobal/isOwn from permissions ──
    let isGlobal = false;
    let isOwn = true; // default: agents see only their own

    try {
        const raw = req.headers['x-user-permissions'];
        if (raw) {
            const permissions = typeof raw === 'string' ? JSON.parse(raw) : raw;
            // Use 'leads' module permissions for dashboard (primary module)
            const modPerm = permissions.leads || permissions.calls;
            if (modPerm) {
                isGlobal = modPerm.isGlobal === true;
                isOwn = modPerm.isOwn !== false;
            }
        }
    } catch {
        // Fallback to legacy role-based logic
        if (userRole === 'admin' || userRole === 'manager') {
            isGlobal = true;
            isOwn = false;
        }
    }

    // ── Branch filter: non-superadmin always scoped to their branch ──
    const branchId = userBranchId || selectedBranchId;
    if (branchId && branchId !== 'all') {
        filter.branchId = new mongoose.Types.ObjectId(branchId);
    }

    // ── Ownership filter ──
    if (isGlobal) {
        // Manager/admin: sees all records in their branch (no owner filter)
    } else if (isOwn && ownerField && userId) {
        // Agent: sees only their own records
        filter[ownerField] = new mongoose.Types.ObjectId(userId);
    }

    return filter;
}

/**
 * GET /api/analytics/dashboard
 * Main dashboard KPIs — scoped by branch + ownership
 */
const getDashboard = asyncHandler(async (req, res) => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    // Build scoped filters for each data type
    const leadFilter = buildAnalyticsFilter(req, 'assignedTo');
    const callFilter = buildAnalyticsFilter(req, 'callerId');
    const msgFilter = buildAnalyticsFilter(req, null); // no ownership on messages
    const userFilter = buildAnalyticsFilter(req, null); // team count uses branch only

    // 1. Lead Stats (scoped by assignedTo for agents)
    const totalLeads = await Lead.countDocuments({ ...leadFilter, isArchived: false });
    const newLeadsToday = await Lead.countDocuments({ ...leadFilter, isArchived: false, createdAt: { $gte: startOfToday } });

    // 2. Call Stats (scoped by callerId for agents)
    const callsToday = await CallLog.countDocuments({ ...callFilter, startedAt: { $gte: startOfToday } });
    const totalDurationRes = await CallLog.aggregate([
        { $match: { ...callFilter, status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$duration' }, avg: { $avg: '$duration' } } }
    ]);

    // 3. WhatsApp Stats (branch-scoped, not ownership-scoped)
    const whatsappSent = await WhatsappMessage.countDocuments({ ...msgFilter, direction: 'outbound', createdAt: { $gte: startOfToday } });
    const whatsappReceived = await WhatsappMessage.countDocuments({ ...msgFilter, direction: 'inbound', createdAt: { $gte: startOfToday } });

    // 4. Team Stats (branch-scoped)
    const activeUsers = await User.countDocuments({ ...userFilter, isActive: true });

    const data = {
        leads: {
            total: totalLeads,
            newToday: newLeadsToday,
            conversionRate: 0,
            byStage: {},
        },
        calls: {
            totalToday: callsToday,
            totalDuration: totalDurationRes[0]?.total || 0,
            avgDuration: Math.round(totalDurationRes[0]?.avg || 0),
            missedRate: 0,
        },
        whatsapp: {
            sentToday: whatsappSent,
            receivedToday: whatsappReceived,
            responseRate: 0,
        },
        revenue: {
            thisMonth: 0,
            lastMonth: 0,
            growthPercent: 0,
        },
        team: {
            activeUsers: activeUsers,
            topPerformers: [],
        },
    };

    ApiResponse.success(res, data, 'Dashboard analytics');
});

/**
 * GET /api/analytics/leads
 * Lead-specific analytics — scoped by branch + ownership
 */
const getLeadAnalytics = asyncHandler(async (req, res) => {
    const filter = { ...buildAnalyticsFilter(req, 'assignedTo'), isArchived: false };
    const { from, to, range, groupBy = 'day' } = req.query;
    const dateRange = resolveDateRange({ range, from, to });
    if (dateRange) filter.createdAt = dateRange;

    const byStage = await Lead.aggregate([
        { $match: filter },
        { $group: { _id: '$stage', count: { $sum: 1 } } }
    ]);

    const bySource = await Lead.aggregate([
        { $match: filter },
        { $group: { _id: '$source', count: { $sum: 1 } } }
    ]);

    const [sourceConversion, campaignConversion] = await Promise.all([
        Lead.aggregate([
            { $match: filter },
            { $group: { _id: '$source', total: { $sum: 1 }, won: { $sum: { $cond: [{ $eq: ['$stage', 'won'] }, 1, 0] } } } },
            { $sort: { total: -1 } },
        ]),
        Lead.aggregate([
            { $match: { ...filter, 'firstTouch.campaignId': { $nin: [null, ''] } } },
            { $group: {
                _id: '$firstTouch.campaignId',
                campaignName: { $first: '$firstTouch.campaignName' },
                total: { $sum: 1 },
                won: { $sum: { $cond: [{ $eq: ['$stage', 'won'] }, 1, 0] } },
            } },
            { $sort: { total: -1 } },
            { $limit: 20 },
        ]),
    ]);

    const scoreBuckets = await Lead.aggregate([
        { $match: filter },
        {
            $bucket: {
                groupBy: '$score',
                boundaries: [0, 50, 80, 101],
                default: 'unscored',
                output: { count: { $sum: 1 } }
            }
        }
    ]);

    const data = {
        timeRange: { from, to },
        groupBy,
        conversionFunnel: byStage.reduce((acc, curr) => ({ ...acc, [curr._id]: curr.count }), {}),
        sourceDistribution: bySource.reduce((acc, curr) => ({ ...acc, [curr._id]: curr.count }), {}),
        sourceConversion: sourceConversion.map((item) => ({
            source: item._id || 'unknown',
            total: item.total,
            won: item.won,
            conversionRate: item.total ? Number(((item.won / item.total) * 100).toFixed(1)) : 0,
        })),
        campaignConversion: campaignConversion.map((item) => ({
            campaignId: item._id,
            campaignName: item.campaignName || item._id,
            total: item.total,
            won: item.won,
            conversionRate: item.total ? Number(((item.won / item.total) * 100).toFixed(1)) : 0,
        })),
        leadScoreDistribution: {
            cold: scoreBuckets.find(b => b._id === 0)?.count || 0,
            warm: scoreBuckets.find(b => b._id === 50)?.count || 0,
            hot: scoreBuckets.find(b => b._id === 80)?.count || 0,
        },
    };

    ApiResponse.success(res, data, 'Lead analytics');
});

/**
 * GET /api/analytics/calls
 * Call analytics — scoped by branch + ownership
 */
const getCallAnalytics = asyncHandler(async (req, res) => {
    const filter = buildAnalyticsFilter(req, 'callerId');
    const { from, to, range } = req.query;
    const dateRange = resolveDateRange({ range, from, to });
    if (dateRange) filter.startedAt = dateRange;

    const [callVolume, disposition, hourlyActivity] = await Promise.all([
        CallLog.aggregate([
            { $match: filter },
            { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$startedAt" } }, count: { $sum: 1 } } },
            { $sort: { _id: 1 } }
        ]),
        CallLog.aggregate([
            { $match: filter },
            { $group: { _id: { $ifNull: ['$disposition', '$status'] }, count: { $sum: 1 } } }
        ]),
        CallLog.aggregate([
            { $match: filter },
            { $group: {
                _id: { $hour: { date: '$startedAt', timezone: process.env.ANALYTICS_TIMEZONE || 'Asia/Kolkata' } },
                total: { $sum: 1 },
                completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
                duration: { $sum: { $ifNull: ['$duration', 0] } },
            } },
            { $sort: { _id: 1 } },
        ]),
    ]);

    const stats = await CallLog.aggregate([
        { $match: { ...filter, status: 'completed' } },
        { $group: { _id: null, avgDur: { $avg: '$duration' }, totalDur: { $sum: '$duration' } } }
    ]);

    const data = {
        callVolume: callVolume.map(v => ({ date: v._id, count: v.count })),
        dispositionBreakdown: disposition.reduce((acc, curr) => ({ ...acc, [curr._id]: curr.count }), {}),
        avgCallDuration: Math.round(stats[0]?.avgDur || 0),
        totalCallDuration: stats[0]?.totalDur || 0,
        totalCalls: callVolume.reduce((sum, v) => sum + v.count, 0),
        hourlyActivity: Array.from({ length: 24 }, (_, hour) => {
            const item = hourlyActivity.find((entry) => entry._id === hour);
            return { hour, label: `${String(hour).padStart(2, '0')}:00`, total: item?.total || 0, completed: item?.completed || 0, duration: item?.duration || 0 };
        }),
    };

    ApiResponse.success(res, data, 'Call analytics');
});

/**
 * GET /api/analytics/team
 * Team performance analytics — branch-scoped (no ownership filter)
 */
const getTeamAnalytics = asyncHandler(async (req, res) => {
    const filter = buildAnalyticsFilter(req, null);
    const dateRange = resolveDateRange(req.query);
    const leadFilter = { ...filter, assignedTo: { $ne: null }, ...(dateRange ? { createdAt: dateRange } : {}) };
    const callFilter = { ...filter, callerId: { $ne: null }, ...(dateRange ? { startedAt: dateRange } : {}) };

    const [leadsPerAgent, callsPerAgent, users] = await Promise.all([
        Lead.aggregate([
            { $match: leadFilter },
            { $group: {
                _id: '$assignedTo',
                count: { $sum: 1 },
                won: { $sum: { $cond: [{ $eq: ['$stage', 'won'] }, 1, 0] } },
                lost: { $sum: { $cond: [{ $eq: ['$stage', 'lost'] }, 1, 0] } },
                pipelineValue: { $sum: { $ifNull: ['$expectedValue', 0] } },
            } },
            { $sort: { won: -1, count: -1 } },
        ]),
        CallLog.aggregate([
            { $match: callFilter },
            { $group: {
                _id: '$callerId',
                count: { $sum: 1 },
                completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
                duration: { $sum: { $ifNull: ['$duration', 0] } },
            } },
            { $sort: { count: -1 } },
        ]),
        User.find(filter).select('name firstName lastName email isActive').lean(),
    ]);

    const userNames = new Map(users.map((user) => [String(user._id), user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Unknown Agent']));
    const leadRows = leadsPerAgent.map((item) => ({
        agentId: item._id,
        agentName: userNames.get(String(item._id)) || 'Unknown Agent',
        count: item.count,
        won: item.won,
        lost: item.lost,
        pipelineValue: item.pipelineValue,
        conversionRate: item.count ? Number(((item.won / item.count) * 100).toFixed(1)) : 0,
    }));
    const callRows = callsPerAgent.map((item) => ({
        agentId: item._id,
        agentName: userNames.get(String(item._id)) || 'Unknown Agent',
        count: item.count,
        completed: item.completed,
        duration: item.duration,
    }));

    const data = {
        leadsPerAgent: leadRows,
        callsPerAgent: callRows,
        leaderboard: leadRows.map((agent) => {
            const calls = callRows.find((item) => String(item.agentId) === String(agent.agentId));
            return { ...agent, calls: calls?.count || 0, completedCalls: calls?.completed || 0, callDuration: calls?.duration || 0 };
        }),
        activeAgents: users.filter((user) => user.isActive).length,
    };

    ApiResponse.success(res, data, 'Team analytics');
});

/**
 * GET /api/analytics/revenue
 * Revenue analytics
 */
const getRevenueAnalytics = asyncHandler(async (req, res) => {
    const filter = { ...buildAnalyticsFilter(req, 'assignedTo'), isArchived: false };
    const dateRange = resolveDateRange(req.query);
    if (dateRange) filter.createdAt = dateRange;

    const [summary, revenueByMonth] = await Promise.all([
        Lead.aggregate([
            { $match: filter },
            { $group: {
                _id: null,
                dealsClosed: { $sum: { $cond: [{ $eq: ['$stage', 'won'] }, 1, 0] } },
                wonRevenue: { $sum: { $cond: [{ $eq: ['$stage', 'won'] }, { $ifNull: ['$expectedValue', 0] }, 0] } },
                pipelineValue: { $sum: { $cond: [{ $nin: ['$stage', ['won', 'lost']] }, { $ifNull: ['$expectedValue', 0] }, 0] } },
            } },
        ]),
        Lead.aggregate([
            { $match: { ...filter, stage: 'won' } },
            { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, revenue: { $sum: { $ifNull: ['$expectedValue', 0] } }, deals: { $sum: 1 } } },
            { $sort: { _id: 1 } },
        ]),
    ]);

    const totals = summary[0] || {};
    const data = {
        mrr: 0,
        arr: 0,
        wonRevenue: totals.wonRevenue || 0,
        revenueByMonth: revenueByMonth.map((item) => ({ month: item._id, revenue: item.revenue, deals: item.deals })),
        dealsClosed: totals.dealsClosed || 0,
        avgDealSize: totals.dealsClosed ? Math.round((totals.wonRevenue || 0) / totals.dealsClosed) : 0,
        pipelineValue: totals.pipelineValue || 0,
    };

    ApiResponse.success(res, data, 'Revenue analytics');
});

module.exports = { getDashboard, getLeadAnalytics, getCallAnalytics, getTeamAnalytics, getRevenueAnalytics };
