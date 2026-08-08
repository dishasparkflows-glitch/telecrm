const mongoose = require('mongoose');
const { ApiError, ROLES } = require('@sparkcrm/shared-utils');

const objectId = (value, name) => {
    if (!mongoose.Types.ObjectId.isValid(String(value || ''))) throw ApiError.badRequest(`${name} must be a valid ObjectId`);
    return new mongoose.Types.ObjectId(value);
};

const hasGlobalAnalytics = (req) => {
    const role = req.headers['x-user-role'];
    if ([ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.MANAGER, ROLES.BRANCH_MANAGER].includes(role)) return true;
    try {
        const raw = req.headers['x-user-permissions'];
        const permissions = typeof raw === 'string' ? JSON.parse(raw) : raw;
        return permissions?.analytics?.isGlobal === true;
    } catch { return false; }
};

function buildAnalyticsFilter(req, ownerField = null, moduleName = 'analytics') {
    const tenantId = objectId(req.headers['x-tenant-id'], 'tenantId');
    const userRole = req.headers['x-user-role'];
    const userId = req.headers['x-user-id'];
    const userBranchId = req.headers['x-user-branch-id'];
    const selectedBranchId = req.headers['x-branch-id'];
    if (!userRole || !userId) throw ApiError.forbidden('Verified user scope is required');

    const filter = { tenantId };
    if (userRole === ROLES.SUPER_ADMIN) {
        const branchId = selectedBranchId || userBranchId;
        if (branchId && branchId !== 'all') filter.branchId = objectId(branchId, 'branchId');
        return filter;
    }

    let isGlobal = false;
    let isOwn = true;
    try {
        const raw = req.headers['x-user-permissions'];
        if (raw) {
            const permissions = typeof raw === 'string' ? JSON.parse(raw) : raw;
            const modulePermission = permissions[moduleName] || permissions.analytics;
            if (modulePermission) {
                isGlobal = modulePermission.isGlobal === true;
                isOwn = modulePermission.isOwn !== false;
            }
        }
    } catch {}
    if (!req.headers['x-user-permissions'] && (userRole === 'admin' || userRole === 'manager')) {
        isGlobal = true;
        isOwn = false;
    }

    if (!userBranchId || userBranchId === 'all') throw ApiError.forbidden('A verified branch assignment is required');
    filter.branchId = objectId(userBranchId, 'branchId');
    if (!isGlobal && isOwn && ownerField) filter[ownerField] = objectId(userId, 'userId');
    if (!isGlobal && (!isOwn || !ownerField)) throw ApiError.forbidden('No analytics visibility scope is granted');
    return filter;
}

module.exports = { objectId, hasGlobalAnalytics, buildAnalyticsFilter };
