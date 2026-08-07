const axios = require('axios');

/**
 * Audit Logger Middleware — Logs user actions to the audit trail
 * Mount on routes that need audit tracking
 * 
 * Usage: auditLog('lead.created', 'Lead')
 */
const auditLog = (action, resource) => {
    return (req, res, next) => {
        // Capture original json method to intercept response
        const originalJson = res.json.bind(res);

        res.json = (body) => {
            // Fire and forget — don't block the response
            const logEntry = {
                tenantId: req.tenantId || req.headers['x-tenant-id'],
                userId: req.userId || req.headers['x-user-id'],
                userName: req.userEmail || req.headers['x-user-email'] || '',
                userRole: req.userRole || req.headers['x-user-role'] || '',
                action,
                resource,
                resourceId: req.params?.id || body?.data?._id || null,
                details: {
                    method: req.method,
                    path: req.originalUrl,
                    statusCode: res.statusCode,
                },
                ipAddress: req.ip || req.headers['x-forwarded-for'] || '',
                userAgent: req.headers['user-agent'] || '',
                severity: res.statusCode >= 400 ? 'warning' : 'info',
            };

            // Post to tenant-service audit endpoint (async, no await)
            const tenantServiceUrl = process.env.TENANT_SERVICE_URL || 'http://localhost:8002';
            axios.post(`${tenantServiceUrl}/api/audit`, logEntry).catch((err) => {
                console.warn('⚠️ Audit log failed:', err.message);
            });

            return originalJson(body);
        };

        next();
    };
};

module.exports = { auditLog };
