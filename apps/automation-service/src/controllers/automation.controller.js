const { AutomationRule, AutomationLog } = require('../models/AutomationRule');
const { pickRuleWriteInput, requireObjectId, pagination } = require('../utils/automationDto');
const { ApiResponse, ApiError, asyncHandler, buildScopeFilter, canAccessRecord } = require('@sparkcrm/shared-utils');

const createRule = asyncHandler(async (req, res) => {
    const userId = req.headers['x-user-id'];
    const scope = buildScopeFilter(req, { ownerField: 'createdBy', module: 'automations' });
    const ruleData = pickRuleWriteInput(req.body);
    const rule = await AutomationRule.create({
        ...ruleData,
        tenantId: scope.tenantId,
        branchId: scope.branchId || null,
        createdBy: userId,
    });
    ApiResponse.created(res, rule, 'Automation rule created');
});

const getRules = asyncHandler(async (req, res) => {
    const { page, limit, skip } = pagination(req.query);
    const filter = buildScopeFilter(req, { ownerField: 'createdBy', module: 'automations' });
    const [rules, total] = await Promise.all([
        AutomationRule.find(filter).sort({ 'meta.createdAt': -1 }).skip(skip).limit(limit).lean(),
        AutomationRule.countDocuments(filter),
    ]);

    // Aggregate stats
    const ruleIds = rules.map(r => r._id);
    const stats = await AutomationLog.aggregate([
        { $match: { ruleId: { $in: ruleIds } } },
        { 
            $group: { 
                _id: "$ruleId", 
                totalRuns: { $sum: 1 },
                successfulRuns: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
                failedRuns: { $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] } },
                exitedRuns: { $sum: { $cond: [{ $eq: ["$status", "exited"] }, 1, 0] } }
            } 
        }
    ]);

    const statsMap = stats.reduce((acc, curr) => {
        acc[curr._id] = curr;
        return acc;
    }, {});

    const rulesWithStats = rules.map(rule => {
        const s = statsMap[rule._id] || { totalRuns: 0, successfulRuns: 0, failedRuns: 0, exitedRuns: 0 };
        return {
            ...rule,
            stats: {
                totalRuns: s.totalRuns,
                successfulRuns: s.successfulRuns,
                failedRuns: s.failedRuns,
                exitedRuns: s.exitedRuns,
                successRate: s.totalRuns > 0 ? ((s.successfulRuns / s.totalRuns) * 100).toFixed(1) : 0
            }
        };
    });

    ApiResponse.paginated(res, rulesWithStats, { page, limit, total, totalPages: Math.ceil(total / limit) });
});

const updateRule = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const ruleId = requireObjectId(req.params.id, 'rule ID');
    const changes = pickRuleWriteInput(req.body);
    const rule = await AutomationRule.findOne({ _id: ruleId, tenantId });
    if (!rule) throw ApiError.notFound('Rule not found');

    if (!canAccessRecord(req, rule, { ownerField: 'createdBy', module: 'automations' })) {
        throw ApiError.forbidden('You do not have access to this rule');
    }

    Object.assign(rule, changes);
    await rule.save();
    ApiResponse.success(res, rule, 'Rule updated');
});

const deleteRule = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const ruleId = requireObjectId(req.params.id, 'rule ID');
    const rule = await AutomationRule.findOne({ _id: ruleId, tenantId });
    if (!rule) throw ApiError.notFound('Rule not found');

    if (!canAccessRecord(req, rule, { ownerField: 'createdBy', module: 'automations' })) {
        throw ApiError.forbidden('You do not have access to this rule');
    }

    await rule.deleteOne();
    ApiResponse.success(res, null, 'Rule deleted');
});

const toggleRule = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const ruleId = requireObjectId(req.params.id, 'rule ID');
    const rule = await AutomationRule.findOne({ _id: ruleId, tenantId });
    if (!rule) throw ApiError.notFound('Rule not found');

    if (!canAccessRecord(req, rule, { ownerField: 'createdBy', module: 'automations' })) {
        throw ApiError.forbidden('You do not have access to this rule');
    }

    if (rule.status === 'draft' || rule.status === 'inactive') {
        // Validate before activation
        if (rule.type === 'workflow') {
            if (!rule.trigger || !rule.trigger.event) {
                throw ApiError.badRequest('Trigger event is missing');
            }
            if (!rule.nodes || rule.nodes.length === 0) {
                throw ApiError.badRequest('Automation has no nodes');
            }
            const hasTriggerNode = rule.nodes.some(n => n.type === 'trigger');
            if (!hasTriggerNode) {
                throw ApiError.badRequest('Automation must have a trigger node');
            }
        }
        rule.status = 'active';
    } else {
        rule.status = 'inactive';
    }

    await rule.save();
    ApiResponse.success(res, rule, `Rule marked as ${rule.status}`);
});

const getLogs = asyncHandler(async (req, res) => {
    const { ruleId: requestedRuleId } = req.query;
    const { page, limit, skip } = pagination(req.query);
    const ruleScope = buildScopeFilter(req, { ownerField: 'createdBy', module: 'automations' });
    const { createdBy, ...filter } = ruleScope;

    if (requestedRuleId) {
        const ruleId = requireObjectId(requestedRuleId, 'ruleId');
        const rule = await AutomationRule.findOne({ _id: ruleId, ...ruleScope }).select('_id');
        if (!rule) throw ApiError.notFound('Rule not found');
        filter.ruleId = rule._id;
    } else if (createdBy) {
        filter.ruleId = { $in: await AutomationRule.distinct('_id', ruleScope) };
    }
    const [logs, total] = await Promise.all([
        AutomationLog.find(filter).sort({ 'meta.createdAt': -1 }).skip(skip).limit(limit),
        AutomationLog.countDocuments(filter),
    ]);

    ApiResponse.paginated(res, logs, { page, limit, total, totalPages: Math.ceil(total / limit) });
});

module.exports = { createRule, getRules, updateRule, deleteRule, toggleRule, getLogs };
