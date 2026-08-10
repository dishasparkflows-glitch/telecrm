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
        details = {},
        description,
        req,
        metadata = {},
    }) => {
        try {
            // Extract context from req if provided
            const finalTenantId = tenantId || req?.tenantId || req?.headers?.['x-tenant-id'];
            if (!finalTenantId) {
                return null;
            }

            const finalBranchId = branchId || req?.userBranchId || req?.headers?.['x-user-branch-id'] || req?.headers?.['x-branch-id'] || null;
            const finalUserId = user?.id || user?.userId || req?.userId || req?.headers?.['x-user-id'] || null;

            const rawIp = req?.ip || req?.headers?.['x-forwarded-for'] || req?.socket?.remoteAddress || '';
            const ipAddress = typeof rawIp === 'string' ? rawIp.split(',')[0].trim() : '';
            const userAgent = req?.headers?.['user-agent'] || '';

            const normalizedAction = (action || '').toUpperCase();

            // Rule: For UPDATE, do NOT create an audit record when details.updateddata is empty or not provided
            if (normalizedAction === 'UPDATE' && (!details || !details.updateddata)) {
                return null;
            }

            const defaultDesc = description || (
                normalizedAction === 'CREATE' ? `${recordType || module || 'Record'} created` :
                normalizedAction === 'UPDATE' ? `${recordType || module || 'Record'} updated` :
                normalizedAction === 'DELETE' ? `${recordType || module || 'Record'} deleted` :
                `${normalizedAction} performed`
            );

            const logData = {
                tenantId: finalTenantId,
                branchId: finalBranchId,
                userId: finalUserId,
                module: module ? String(module).toLowerCase() : 'system',
                action: normalizedAction,
                recordId: recordId ? String(recordId) : null,
                recordType: recordType || (module ? module.charAt(0).toUpperCase() + module.slice(1) : 'Record'),
                details: details,
                description: defaultDesc,
                systemInfo: { ipAddress, userAgent },
                meta: { ...metadata, createdAt: new Date() },
            };

            // Direct model invocation only if we are actually running inside the tenant-service
            if (process.env.SERVICE_NAME === 'tenant-service' || global.__AUDIT_LOG_MODEL__) {
                try {
                    const AuditLogModel = global.__AUDIT_LOG_MODEL__ || require('../../../apps/tenant-service/src/models/AuditLog');
                    if (AuditLogModel && AuditLogModel.create) {
                        return await AuditLogModel.create(logData);
                    }
                } catch (e) {
                    // Fall back to HTTP
                }
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
