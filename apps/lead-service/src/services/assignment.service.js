const mongoose = require('mongoose');
const { ASSIGNMENT_STRATEGIES } = require('@sparkcrm/shared-utils');
const AssignmentPolicy = require('../models/AssignmentPolicy');
const Lead = require('../models/Lead');

const toObjectId = (value) => (mongoose.Types.ObjectId.isValid(String(value)) ? new mongoose.Types.ObjectId(value) : value);

const policyMatches = (policy, { source, priority }) => {
    const sources = policy.conditions?.sources || [];
    const priorities = policy.conditions?.priorities || [];

    if (sources.length && !sources.includes(source)) return false;
    if (priorities.length && !priorities.includes(priority)) return false;
    return true;
};

const findActivePolicy = async ({ tenantId, branchId = null, source, priority }) => {
    const tenantObjectId = toObjectId(tenantId);
    const branchObjectId = branchId && branchId !== 'all' ? toObjectId(branchId) : null;

    const policies = await AssignmentPolicy.find({
        tenantId: tenantObjectId,
        isActive: true,
        $or: [
            { branchId: branchObjectId },
            { branchId: null },
        ],
    }).sort({ branchId: -1, 'meta.updatedAt': -1 });

    return policies.find((policy) => policyMatches(policy, { source, priority })) || null;
};

const assignLeadFromPolicy = async ({ tenantId, branchId = null, source, priority }) => {
    const policy = await findActivePolicy({ tenantId, branchId, source, priority });
    if (!policy || policy.strategy === ASSIGNMENT_STRATEGIES.MANUAL || !policy.agentIds?.length) {
        return { assignedTo: null, policy: policy || null, strategy: ASSIGNMENT_STRATEGIES.MANUAL };
    }

    if (policy.strategy === ASSIGNMENT_STRATEGIES.ROUND_ROBIN) {
        const updated = await AssignmentPolicy.findOneAndUpdate(
            { _id: policy._id },
            { $inc: { cursor: 1 } },
            { new: true }
        );
        const cursorBeforeIncrement = Math.max(0, (updated.cursor || 1) - 1);
        const assignedTo = updated.agentIds[cursorBeforeIncrement % updated.agentIds.length];
        return { assignedTo, policy: updated, strategy: policy.strategy };
    }

    if (policy.strategy === ASSIGNMENT_STRATEGIES.LOAD_BASED) {
        const activeStages = ['new', 'contacted', 'qualified', 'negotiation'];
        const loads = await Lead.aggregate([
            {
                $match: {
                    tenantId: toObjectId(tenantId),
                    ...(branchId && branchId !== 'all' ? { branchId: toObjectId(branchId) } : {}),
                    isArchived: false,
                    stage: { $in: activeStages },
                    assignedTo: { $in: policy.agentIds },
                },
            },
            { $group: { _id: '$assignedTo', count: { $sum: 1 } } },
        ]);

        const assignedTo = selectLeastLoadedAgent(policy.agentIds, loads);

        return { assignedTo, policy, strategy: policy.strategy };
    }

    return { assignedTo: null, policy, strategy: policy.strategy };
};

/**
 * Compatibility helper for existing callers that pass an agent array directly.
 */
const assignLead = async (tenantId, strategy, agents) => {
    if (!agents || agents.length === 0) return null;

    switch (strategy) {
        case ASSIGNMENT_STRATEGIES.ROUND_ROBIN:
            return roundRobinAssign(tenantId, agents);
        case ASSIGNMENT_STRATEGIES.LOAD_BASED:
            return loadBasedAssign(tenantId, agents);
        case ASSIGNMENT_STRATEGIES.MANUAL:
        default:
            return null;
    }
};

const roundRobinAssign = (tenantId, agents) => {
    const index = Math.abs(String(tenantId).split('').reduce((sum, char) => sum + char.charCodeAt(0), 0)) % agents.length;
    return agents[index];
};

const loadBasedAssign = (tenantId, agents) => {
    if (agents.length === 0) return null;
    return agents.reduce((best, agent) => ((agent.leadCount || 0) < (best.leadCount || 0) ? agent : best), agents[0]);
};

const selectLeastLoadedAgent = (agentIds, loads = []) => {
    const loadMap = new Map(loads.map((item) => [String(item._id), item.count]));
    return agentIds.reduce((best, agentId) => {
        const bestCount = loadMap.get(String(best)) || 0;
        const currentCount = loadMap.get(String(agentId)) || 0;
        return currentCount < bestCount ? agentId : best;
    }, agentIds[0]);
};

module.exports = {
    assignLead,
    assignLeadFromPolicy,
    findActivePolicy,
    roundRobinAssign,
    loadBasedAssign,
    policyMatches,
    selectLeastLoadedAgent,
};
