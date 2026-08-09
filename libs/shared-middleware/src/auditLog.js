const axios = require('axios');
const { createServiceHeaders } = require('./serviceIdentity');

/**
 * Common Audit Logger Utility & Express Middleware
 */
const auditLogger = {
    /**
     * Log an audit event
     */
    log: async ({
        tenantId,
        branchId,
        user,
        module,
        action,
        recordId,
        recordType,
        recordName,
        changes = [],
        description,
        req,
        metadata = {},
        severity = 'info',
    }) => {
        try {
            // Extract context from req if provided
            const finalTenantId = tenantId || req?.tenantId || req?.headers?.['x-tenant-id'];
            if (!finalTenantId) {
                return null;
            }

            const finalBranchId = branchId || req?.userBranchId || req?.headers?.['x-user-branch-id'] || req?.headers?.['x-branch-id'] || null;
            let rawName = user?.name || user?.userName || req?.userName || req?.headers?.['x-user-name'] || user?.email || req?.userEmail || req?.headers?.['x-user-email'] || 'System';
            if (typeof rawName === 'string' && rawName.includes('@')) {
                const prefix = rawName.split('@')[0];
                rawName = prefix.split(/[._-]/).map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
            }
            const finalUserName = rawName;
            const finalUserRole = user?.role || user?.userRole || req?.userRole || req?.headers?.['x-user-role'] || 'user';

            const rawIp = req?.ip || req?.headers?.['x-forwarded-for'] || req?.socket?.remoteAddress || '';
            const ipAddress = typeof rawIp === 'string' ? rawIp.split(',')[0].trim() : '';
            const userAgent = req?.headers?.['user-agent'] || '';

            const normalizedAction = (action || '').toUpperCase();

            // Rule: For UPDATE, do NOT create an audit record when changes array is empty
            if (normalizedAction === 'UPDATE' && (!changes || changes.length === 0)) {
                return null;
            }

            const formattedChanges = Array.isArray(changes) ? changes.map((c) => ({
                field: String(c.field || c.name || 'field'),
                oldValue: c.oldValue !== undefined ? c.oldValue : null,
                newValue: c.newValue !== undefined ? c.newValue : null,
            })) : [];

            const defaultDesc = description || (
                normalizedAction === 'CREATE' ? `${recordType || module || 'Record'} created` :
                normalizedAction === 'UPDATE' ? `${formattedChanges.length} field${formattedChanges.length === 1 ? '' : 's'} updated` :
                normalizedAction === 'DELETE' ? `${recordType || module || 'Record'} deleted` :
                `${normalizedAction} performed`
            );

            const logData = {
                tenantId: finalTenantId,
                branchId: finalBranchId,
                userId: finalUserId,
                userName: finalUserName,
                userRole: finalUserRole,
                module: module ? String(module).toLowerCase() : 'system',
                action: normalizedAction,
                recordId: recordId ? String(recordId) : null,
                recordType: recordType || (module ? module.charAt(0).toUpperCase() + module.slice(1) : 'Record'),
                recordName: recordName || (recordId ? `${recordType || 'Record'} ${recordId}` : 'Record'),
                changes: formattedChanges,
                description: defaultDesc,
                ipAddress,
                userAgent,
                severity,
                metadata: metadata || {},
                createdAt: new Date(),
            };

            // Direct model invocation if registered globally or loadable in tenant-service
            if (global.__AUDIT_LOG_MODEL__) {
                return await global.__AUDIT_LOG_MODEL__.create(logData);
            }
            try {
                const AuditLogModel = require('../../../apps/tenant-service/src/models/AuditLog');
                if (AuditLogModel && AuditLogModel.create) {
                    return await AuditLogModel.create(logData);
                }
            } catch (e) {
                // Service isolated, proceed to HTTP dispatch
            }

            // Async HTTP POST to tenant-service
            const tenantServiceUrl = process.env.TENANT_SERVICE_URL || 'http://localhost:8002';
            const headers = createServiceHeaders({
                issuer: process.env.SERVICE_NAME || 'crm-service',
                audience: 'tenant-service',
                method: 'POST',
                path: '/api/audit',
                identity: { tenantId: finalTenantId, userId: finalUserId },
            });

            axios.post(`${tenantServiceUrl}/api/audit`, logData, { headers, timeout: 5000 }).catch((err) => {
                console.warn('⚠️ Audit logger dispatch failed:', err.message);
            });

            return logData;
        } catch (err) {
            console.warn('⚠️ Error in auditLogger.log:', err.message);
            return null;
        }
    },
};

/**
 * Express middleware helper for auto-auditing route responses
 */
const auditLog = (action, resource) => {
    return (req, res, next) => {
        const originalJson = res.json.bind(res);
        res.json = (body) => {
            if (res.statusCode < 400) {
                auditLogger.log({
                    action,
                    recordType: resource,
                    recordId: req.params?.id || body?.data?._id,
                    req,
                });
            }
            return originalJson(body);
        };
        next();
    };
};

module.exports = { auditLogger, auditLog };
