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
        AutomationRule.find(filter).sort({ 'meta.createdAt': -1 }).skip(skip).limit(limit),
        AutomationRule.countDocuments(filter),
    ]);
    ApiResponse.paginated(res, rules, { page, limit, total, totalPages: Math.ceil(total / limit) });
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

    rule.isActive = !rule.isActive;
    await rule.save();
    ApiResponse.success(res, rule, `Rule ${rule.isActive ? 'activated' : 'deactivated'}`);
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
