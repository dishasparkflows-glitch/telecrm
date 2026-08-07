const AssignmentPolicy = require('../models/AssignmentPolicy');
const { ApiResponse, ApiError, asyncHandler } = require('@sparkcrm/shared-utils');

const cleanAgentIds = (agentIds = []) => [...new Set((agentIds || []).filter(Boolean).map(String))];

const getAssignmentPolicy = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const branchId = req.query.branchId || req.headers['x-branch-id'] || req.headers['x-user-branch-id'] || null;

    const filter = { tenantId };
    if (branchId && branchId !== 'all') filter.branchId = branchId;
    else filter.branchId = null;

    const policy = await AssignmentPolicy.findOne(filter);
    ApiResponse.success(res, policy, policy ? 'Assignment policy fetched' : 'No assignment policy configured');
});

const listAssignmentPolicies = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const policies = await AssignmentPolicy.find({ tenantId }).sort({ branchId: 1, updatedAt: -1 });
    ApiResponse.success(res, policies, 'Assignment policies fetched');
});

const upsertAssignmentPolicy = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const userId = req.headers['x-user-id'];
    const branchId = req.body.branchId || req.headers['x-branch-id'] || req.headers['x-user-branch-id'] || null;
    const { name, strategy, agentIds, isActive = true, conditions = {} } = req.body;

    if (!strategy) throw ApiError.badRequest('strategy is required');

    const normalizedBranchId = branchId && branchId !== 'all' ? branchId : null;
    const cleanedAgentIds = cleanAgentIds(agentIds);

    if (strategy !== 'manual' && cleanedAgentIds.length === 0) {
        throw ApiError.badRequest('agentIds are required for automatic assignment strategies');
    }

    const policy = await AssignmentPolicy.findOneAndUpdate(
        { tenantId, branchId: normalizedBranchId },
        {
            $set: {
                name: name || 'Default assignment policy',
                strategy,
                agentIds: cleanedAgentIds,
                isActive,
                conditions: {
                    sources: conditions.sources || [],
                    priorities: conditions.priorities || [],
                },
                updatedBy: userId || null,
            },
            $setOnInsert: {
                createdBy: userId || null,
                cursor: 0,
            },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    ApiResponse.success(res, policy, 'Assignment policy saved');
});

const deleteAssignmentPolicy = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const policy = await AssignmentPolicy.findOneAndDelete({ _id: req.params.id, tenantId });
    if (!policy) throw ApiError.notFound('Assignment policy not found');
    ApiResponse.success(res, null, 'Assignment policy deleted');
});

module.exports = {
    getAssignmentPolicy,
    listAssignmentPolicies,
    upsertAssignmentPolicy,
    deleteAssignmentPolicy,
};
