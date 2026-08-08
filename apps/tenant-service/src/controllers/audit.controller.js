const AuditLog = require('../models/AuditLog');
const { ApiResponse, asyncHandler } = require('@sparkcrm/shared-utils');

/**
 * GET /api/audit
 * Get audit logs with filters
 */
const getAuditLogs = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const branchId = req.headers['x-branch-id'] || req.headers['x-user-branch-id'];
    const { page = 1, limit = 50, action, userId, severity, from, to } = req.query;

    const filter = { tenantId };
    if (branchId) filter.branchId = branchId;
    if (action) filter.action = action;
    if (userId) filter.userId = userId;
    if (severity) filter.severity = severity;
    if (from || to) {
        filter.createdAt = {};
        if (from) filter.createdAt.$gte = new Date(from);
        if (to) filter.createdAt.$lte = new Date(to);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [logs, total] = await Promise.all([
        AuditLog.find(filter).sort({ 'meta.createdAt': -1 }).skip(skip).limit(parseInt(limit)),
        AuditLog.countDocuments(filter),
    ]);

    ApiResponse.paginated(res, logs, {
        page: parseInt(page), limit: parseInt(limit), total,
        totalPages: Math.ceil(total / parseInt(limit)),
    });
});

/**
 * POST /api/audit (Internal — used by other services)
 * Create an audit log entry
 */
const createAuditLog = asyncHandler(async (req, res) => {
    const log = await AuditLog.create(req.body);
    ApiResponse.created(res, log);
});

module.exports = { getAuditLogs, createAuditLog };
