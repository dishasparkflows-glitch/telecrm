/**
 * Data Scoping Utility — Shared helper for branch + user data isolation
 * 
 * Visibility is now driven by per-module permission flags:
 *   isGlobal = true → user sees ALL data in their branch (managers, sales leads)
 *   isOwn = true    → user sees ONLY their own records (agents)
 * 
 * Superadmins bypass branch and ownership scoping but remain tenant-scoped.
 * 
 * Usage in controllers:
 *   const scope = buildScopeFilter(req, { ownerField: 'assignedTo', module: 'leads' });
 */

const ROLES = require('./constants').ROLES;
const { ApiError } = require('./apiError');

/**
 * Parse permissions from the x-user-permissions header
 */
function _getPermissions(req) {
    try {
        const raw = req.headers['x-user-permissions'];
        if (!raw) return null;
        return typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch {
        return null;
    }
}

/**
 * Build a MongoDB filter object based on user permissions
 * 
 * @param {Object} req - Express request with forwarded headers
 * @param {Object} options
 * @param {string} options.ownerField - Field name for ownership (e.g. 'assignedTo', 'createdBy')
 *                                      Set to null to skip ownership filtering entirely.
 * @param {string} options.module - Module key (e.g. 'leads', 'calls') to look up isOwn/isGlobal
 * @param {boolean} options.useBranchId - If true, use branchId for branch filtering (default: true)
 * @returns {Object} filter - MongoDB query filter object
 * @throws {ApiError} when authenticated identity or visibility context is incomplete
 */
function buildScopeFilter(req, options = {}) {
    const headers = req?.headers || {};
    const tenantId = headers['x-tenant-id'];
    const userRole = headers['x-user-role'];
    const userId = headers['x-user-id'];
    const userBranchId = headers['x-user-branch-id'];
    const selectedBranchId = headers['x-branch-id'];
    const { ownerField = 'createdBy', module = null, useBranchId = true } = options;

    if (!tenantId) {
        throw ApiError.unauthorized('Authenticated tenant context is required for data scoping');
    }

    const filter = { tenantId };

    if (userRole === ROLES.SUPER_ADMIN) {
        if (selectedBranchId && selectedBranchId !== 'all' && useBranchId) {
            filter.branchId = selectedBranchId;
        }
        return filter;
    }

    if (!module) {
        throw ApiError.forbidden('A module is required to determine data visibility');
    }

    const permissions = _getPermissions(req);
    const modulePermission = permissions?.[module];
    if (!modulePermission || typeof modulePermission !== 'object') {
        throw ApiError.forbidden(`Verified permissions are required to determine '${module}' visibility`);
    }

    const isGlobal = modulePermission.isGlobal === true;
    const isBranch = modulePermission.isBranch === true;
    const isOwn = modulePermission.isOwn === true;
    if (!isGlobal && !isBranch && !isOwn) {
        throw ApiError.forbidden(`No data visibility granted for '${module}'`);
    }

    if (isBranch) {
        if (useBranchId && (!userBranchId || userBranchId === 'all')) {
            throw ApiError.forbidden('An assigned branch is required for data access');
        }
        if (useBranchId) {
            filter.branchId = userBranchId;
        }
    } else if (isGlobal) {
        if (selectedBranchId && selectedBranchId !== 'all' && useBranchId) {
            filter.branchId = selectedBranchId;
        }
    } else if (isOwn) {
        if (useBranchId && (!userBranchId || userBranchId === 'all')) {
            throw ApiError.forbidden('An assigned branch is required for data access');
        }
        if (useBranchId) {
            filter.branchId = userBranchId;
        }
        
        if (ownerField) {
            if (!userId) {
                throw ApiError.unauthorized('Authenticated user context is required for own-record visibility');
            }
            filter[ownerField] = userId;
        }
    }

    return filter;
}

/**
 * Check if user can access a specific record (for single-record operations like update/delete).
 * Returns false whenever required identity, branch, or permission context is incomplete.
 */
function canAccessRecord(req, record, options = {}) {
    if (!record) return false;

    const headers = req?.headers || {};
    const userRole = headers['x-user-role'];
    const userId = headers['x-user-id'];
    const userBranchId = headers['x-user-branch-id'];
    const tenantId = headers['x-tenant-id'];
    const { ownerField = 'createdBy', module = null, useBranchId = true } = options;

    if (!tenantId || !record.tenantId || String(record.tenantId) !== String(tenantId)) return false;
    if (userRole === ROLES.SUPER_ADMIN) return true;
    if (req?.serviceIdentity && req.serviceIdentity.issuer) return true;

    if (!module) return false;
    const modulePermission = _getPermissions(req)?.[module];
    if (!modulePermission || typeof modulePermission !== 'object') return false;

    const isGlobal = modulePermission.isGlobal === true;
    const isBranch = modulePermission.isBranch === true;
    const isOwn = modulePermission.isOwn === true;
    
    if (isBranch) {
        if (useBranchId) {
            if (!userBranchId || userBranchId === 'all' || !record.branchId) return false;
            if (String(record.branchId) !== String(userBranchId)) return false;
        }
        return true;
    }

    if (isGlobal) return true;

    if (isOwn) {
        if (useBranchId) {
            if (!userBranchId || userBranchId === 'all' || !record.branchId) return false;
            if (String(record.branchId) !== String(userBranchId)) return false;
        }
        if (!ownerField || !userId || !record[ownerField]) return false;
        return String(record[ownerField]) === String(userId);
    }
    
    return false;
}

module.exports = { buildScopeFilter, canAccessRecord };
