const mongoose = require('mongoose');
const AuditLog = require('../models/AuditLog');
const { ApiResponse, ApiError, asyncHandler } = require('@sparkcrm/shared-utils');

/**
 * Helper to build flexible ObjectId & String matcher for MongoDB queries
 */
function buildIdOrClause(field, val) {
    if (!val || val === 'all') return null;
    const strVal = String(val);
    if (mongoose.Types.ObjectId.isValid(strVal)) {
        return {
            $or: [
                { [field]: strVal },
                { [field]: new mongoose.Types.ObjectId(strVal) },
            ],
        };
    }
    return { [field]: strVal };
}

/**
 * GET /api/audit
 * Get audit logs with pagination, search, filters
 */
const getAuditLogs = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'] || req.tenantId;
    if (!tenantId) throw ApiError.badRequest('Tenant identity required');

    const userBranchId = req.headers['x-user-branch-id'] || req.headers['x-branch-id'];
    const { page = 1, limit = 20, search, module: mod, action, userId, user, branchId, branch, fromDate, toDate } = req.query;

    const andConditions = [];

    // Tenant ID match (both string and ObjectId)
    const tenantCond = buildIdOrClause('tenantId', tenantId);
    if (tenantCond) andConditions.push(tenantCond);

    // Branch filter
    const targetBranch = branchId || branch;
    if (targetBranch && targetBranch !== 'all') {
        const branchConds = [];
        if (mongoose.Types.ObjectId.isValid(targetBranch)) {
            branchConds.push({ branchId: targetBranch });
            branchConds.push({ branchId: new mongoose.Types.ObjectId(targetBranch) });
        } else {
            branchConds.push({ branchId: targetBranch });
            branchConds.push({ branchName: { $regex: targetBranch, $options: 'i' } });
        }
        andConditions.push({ $or: branchConds });
    } else if (userBranchId && req.userRole !== 'super admin' && req.userRole !== 'admin') {
        const userBranchCond = buildIdOrClause('branchId', userBranchId);
        if (userBranchCond) andConditions.push(userBranchCond);
    }

    if (mod && mod !== 'all') {
        andConditions.push({ module: String(mod).toLowerCase() });
    }
    if (action && action !== 'all') {
        andConditions.push({ action: String(action).toUpperCase() });
    }

    // User filter
    const targetUser = userId || user;
    if (targetUser && targetUser !== 'all') {
        const userConds = [];
        if (mongoose.Types.ObjectId.isValid(targetUser)) {
            userConds.push({ userId: targetUser });
            userConds.push({ userId: new mongoose.Types.ObjectId(targetUser) });
        }
        const escapedUser = String(targetUser).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        userConds.push({ userName: { $regex: escapedUser, $options: 'i' } });

        const nameParts = String(targetUser).split(/\s+/).filter(Boolean);
        nameParts.forEach((part) => {
            const esc = part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            userConds.push({ userName: { $regex: esc, $options: 'i' } });
        });

        andConditions.push({ $or: userConds });
    }

    if (fromDate || toDate) {
        const dateCond = {};
        if (fromDate) dateCond.$gte = new Date(fromDate);
        if (toDate) dateCond.$lte = new Date(toDate);
        andConditions.push({ createdAt: dateCond });
    }

    if (search) {
        const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        andConditions.push({
            $or: [
                { recordId: { $regex: escaped, $options: 'i' } },
                { recordName: { $regex: escaped, $options: 'i' } },
                { userName: { $regex: escaped, $options: 'i' } },
                { description: { $regex: escaped, $options: 'i' } },
                { 'changes.field': { $regex: escaped, $options: 'i' } },
            ],
        });
    }

    const filter = andConditions.length === 0 ? {} : andConditions.length === 1 ? andConditions[0] : { $and: andConditions };

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const [logs, total] = await Promise.all([
        AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
        AuditLog.countDocuments(filter),
    ]);

    ApiResponse.paginated(res, logs, {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
    });
});

/**
 * GET /api/audit/record/:recordId
 * Get full chronological audit history for a specific record
 */
const getRecordAuditHistory = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'] || req.tenantId;
    const { recordId } = req.params;
    const { page = 1, limit = 50, action, userId, user, fromDate, toDate } = req.query;

    if (!tenantId) throw ApiError.badRequest('Tenant identity required');
    if (!recordId) throw ApiError.badRequest('Record ID required');

    const isObjectId = mongoose.Types.ObjectId.isValid(recordId);
    const idOr = [
        { recordId: String(recordId) },
        { resourceId: String(recordId) },
    ];
    if (isObjectId) {
        idOr.push({ resourceId: new mongoose.Types.ObjectId(recordId) });
        idOr.push({ recordId: new mongoose.Types.ObjectId(recordId) });
    }

    const andConditions = [];
    const tenantCond = buildIdOrClause('tenantId', tenantId);
    if (tenantCond) andConditions.push(tenantCond);
    andConditions.push({ $or: idOr });

    if (action && action !== 'all') {
        andConditions.push({ action: String(action).toUpperCase() });
    }

    const targetUser = userId || user;
    if (targetUser && targetUser !== 'all') {
        const userConds = [];
        if (mongoose.Types.ObjectId.isValid(targetUser)) {
            userConds.push({ userId: targetUser });
            userConds.push({ userId: new mongoose.Types.ObjectId(targetUser) });
        }
        const escapedUser = String(targetUser).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        userConds.push({ userName: { $regex: escapedUser, $options: 'i' } });
        andConditions.push({ $or: userConds });
    }

    if (fromDate || toDate) {
        const dateCond = {};
        if (fromDate) dateCond.$gte = new Date(fromDate);
        if (toDate) dateCond.$lte = new Date(toDate);
        andConditions.push({ createdAt: dateCond });
    }

    const filter = { $and: andConditions };

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const [history, total] = await Promise.all([
        AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
        AuditLog.countDocuments(filter),
    ]);

    // Build record summary card info from available log items
    const allLogs = await AuditLog.find(filter).sort({ createdAt: 1 });
    const createLog = allLogs.find((l) => l.action === 'CREATE') || allLogs[0] || {};
    const latestLog = allLogs[allLogs.length - 1] || {};

    let totalChangedFields = 0;
    allLogs.forEach((l) => {
        totalChangedFields += (l.changes ? l.changes.length : 0);
    });

    const recordSummary = {
        recordId: recordId,
        recordName: latestLog.recordName || createLog.recordName || recordId,
        recordType: latestLog.recordType || createLog.recordType || 'Record',
        status: 'Active',
        branchName: latestLog.branchId ? 'Branch' : 'Head Office',
        ownerName: latestLog.userName || 'System User',
        phone: '—',
        email: '—',
        createdAt: createLog.createdAt || new Date(),
        createdBy: {
            userName: createLog.userName || 'System',
            userRole: createLog.userRole || 'Admin',
        },
        lastUpdated: latestLog.createdAt || new Date(),
        totalChanges: totalChangedFields || total || 0,
    };

    res.json({
        success: true,
        data: {
            record: recordSummary,
            totalChanges: total,
            history,
        },
        pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum),
        },
    });
});

/**
 * GET /api/audit/user/:userId
 * Get activity performed by selected user
 */
const getUserAuditLogs = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'] || req.tenantId;
    const { userId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const andConditions = [];
    const tenantCond = buildIdOrClause('tenantId', tenantId);
    if (tenantCond) andConditions.push(tenantCond);

    const userCond = buildIdOrClause('userId', userId);
    if (userCond) andConditions.push(userCond);

    const filter = andConditions.length === 1 ? andConditions[0] : { $and: andConditions };

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const [logs, total] = await Promise.all([
        AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
        AuditLog.countDocuments(filter),
    ]);

    ApiResponse.paginated(res, logs, { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) });
});

/**
 * GET /api/audit/export
 * Export audit logs as CSV file
 */
const exportAuditLogs = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'] || req.tenantId;
    const { module: mod, action, userId, user, branchId, branch, search, fromDate, toDate } = req.query;

    const andConditions = [];
    const tenantCond = buildIdOrClause('tenantId', tenantId);
    if (tenantCond) andConditions.push(tenantCond);

    const targetBranch = branchId || branch;
    if (targetBranch && targetBranch !== 'all') {
        const branchConds = [];
        if (mongoose.Types.ObjectId.isValid(targetBranch)) {
            branchConds.push({ branchId: targetBranch });
            branchConds.push({ branchId: new mongoose.Types.ObjectId(targetBranch) });
        } else {
            branchConds.push({ branchId: targetBranch });
            branchConds.push({ branchName: { $regex: targetBranch, $options: 'i' } });
        }
        andConditions.push({ $or: branchConds });
    }

    if (mod && mod !== 'all') andConditions.push({ module: String(mod).toLowerCase() });
    if (action && action !== 'all') andConditions.push({ action: String(action).toUpperCase() });

    const targetUser = userId || user;
    if (targetUser && targetUser !== 'all') {
        const userConds = [];
        if (mongoose.Types.ObjectId.isValid(targetUser)) {
            userConds.push({ userId: targetUser });
            userConds.push({ userId: new mongoose.Types.ObjectId(targetUser) });
        }
        const escapedUser = String(targetUser).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        userConds.push({ userName: { $regex: escapedUser, $options: 'i' } });
        andConditions.push({ $or: userConds });
    }

    if (fromDate || toDate) {
        const dateCond = {};
        if (fromDate) dateCond.$gte = new Date(fromDate);
        if (toDate) dateCond.$lte = new Date(toDate);
        andConditions.push({ createdAt: dateCond });
    }

    const filter = andConditions.length === 0 ? {} : andConditions.length === 1 ? andConditions[0] : { $and: andConditions };

    const logs = await AuditLog.find(filter).sort({ createdAt: -1 }).limit(1000);

    const csvRows = [
        ['Date & Time', 'User', 'Role', 'Module', 'Record ID', 'Record Name', 'Action', 'Changes Count', 'Description', 'IP Address'],
    ];

    logs.forEach((log) => {
        const dateStr = log.createdAt ? new Date(log.createdAt).toISOString() : '';
        csvRows.push([
            `"${dateStr}"`,
            `"${log.userName || ''}"`,
            `"${log.userRole || ''}"`,
            `"${log.module || ''}"`,
            `"${log.recordId || ''}"`,
            `"${log.recordName || ''}"`,
            `"${log.action || ''}"`,
            log.changes ? log.changes.length : 0,
            `"${(log.description || '').replace(/"/g, '""')}"`,
            `"${log.ipAddress || ''}"`,
        ]);
    });

    const csvContent = csvRows.map((row) => row.join(',')).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=audit-logs-${Date.now()}.csv`);
    res.status(200).send(csvContent);
});

/**
 * POST /api/audit
 * Create audit log manually or from microservices
 */
const createAuditLog = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'] || req.tenantId || req.body.tenantId;
    if (!tenantId) throw ApiError.badRequest('Tenant ID is required');

    const normalizedAction = (req.body.action || '').toUpperCase();
    if (normalizedAction === 'UPDATE' && (!req.body.changes || req.body.changes.length === 0)) {
        return ApiResponse.success(res, null, 'Skipped audit log for empty update', 200);
    }

    const logData = {
        tenantId,
        branchId: req.body.branchId || req.headers['x-user-branch-id'] || null,
        userId: req.body.userId || req.headers['x-user-id'] || null,
        userName: req.body.userName || req.headers['x-user-name'] || 'System',
        userRole: req.body.userRole || req.headers['x-user-role'] || 'user',
        module: String(req.body.module || 'system').toLowerCase(),
        action: normalizedAction,
        recordId: req.body.recordId || req.body.resourceId || null,
        recordType: req.body.recordType || 'Record',
        recordName: req.body.recordName || 'Record',
        changes: req.body.changes || [],
        description: req.body.description || '',
        ipAddress: req.ip || req.headers['x-forwarded-for'] || '',
        userAgent: req.headers['user-agent'] || '',
        severity: req.body.severity || 'info',
        metadata: req.body.metadata || {},
    };

    const newLog = await AuditLog.create(logData);
    ApiResponse.created(res, newLog, 'Audit log recorded successfully');
});

module.exports = {
    getAuditLogs,
    getRecordAuditHistory,
    getUserAuditLogs,
    exportAuditLogs,
    createAuditLog,
};
