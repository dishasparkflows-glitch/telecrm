const jwt = require('jsonwebtoken');
const { env } = require('@sparkcrm/shared-config');
const { requireServiceIdentity, verifyServiceContext } = require('@sparkcrm/shared-middleware');

const ADMIN_ROLES = ['admin', 'superadmin', 'owner'];

function applyServiceIdentity(req, context) {
    const identity = context.identity || {};
    const mappings = {
        userId: 'x-user-id', tenantId: 'x-tenant-id', role: 'x-user-role',
        email: 'x-user-email', branchId: 'x-user-branch-id', roleId: 'x-user-role-id',
        permissions: 'x-user-permissions', isImpersonating: 'x-is-impersonating',
    };
    for (const [key, header] of Object.entries(mappings)) {
        const value = identity[key];
        if (value === undefined || value === null || value === '') delete req.headers[header];
        else req.headers[header] = typeof value === 'string' ? value : JSON.stringify(value);
    }
    req.serviceIdentity = context;
    req.userId = identity.userId;
    req.tenantId = identity.tenantId;
    req.userRole = identity.role;
}

function unauthorized(res, message = 'Authentication required') {
    return res.status(401).json({ success: false, message });
}

function forbidden(res, message = 'Access denied') {
    return res.status(403).json({ success: false, message });
}

function authenticate(req, res, next) {
    try {
        if (req.headers['x-service-context'] && req.headers['x-service-signature']) {
            const context = verifyServiceContext(req, 'tenant-service');
            if (context.identity?.userId && context.identity?.role) {
                applyServiceIdentity(req, context);
                req.auth = { ...context.identity, role: context.identity.role };
                return next();
            }
            // Public gateway routes may carry a valid service context without user
            // identity. In that case, an explicit Bearer token is still required.
        }

        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) return unauthorized(res);
        const decoded = jwt.verify(authHeader.slice(7), env.JWT_SECRET);
        if (!decoded.userId || !decoded.role) return unauthorized(res, 'Invalid access token');

        req.auth = decoded;
        for (const header of [
            'x-user-id', 'x-user-role', 'x-user-email', 'x-tenant-id',
            'x-user-branch-id', 'x-user-role-id', 'x-is-impersonating',
        ]) delete req.headers[header];
        req.headers['x-user-id'] = String(decoded.userId);
        req.headers['x-user-role'] = String(decoded.role);
        if (decoded.email) req.headers['x-user-email'] = String(decoded.email);
        if (decoded.tenantId) req.headers['x-tenant-id'] = String(decoded.tenantId);
        if (decoded.branchId) req.headers['x-user-branch-id'] = String(decoded.branchId);
        if (decoded.roleId) req.headers['x-user-role-id'] = String(decoded.roleId);
        if (decoded.isImpersonating) req.headers['x-is-impersonating'] = 'true';
        return next();
    } catch {
        return unauthorized(res, 'Invalid or expired access token');
    }
}

function requireRoles(...roles) {
    return (req, res, next) => {
        const role = req.auth?.role || req.headers['x-user-role'];
        if (!roles.includes(role)) return forbidden(res);
        return next();
    };
}

function requireAdmin(req, res, next) {
    const role = req.auth?.role || req.headers['x-user-role'];
    if (!ADMIN_ROLES.includes(role)) return forbidden(res, 'Administrator access required');
    return next();
}

const requireSignedInternalService = requireServiceIdentity('tenant-service');

function internalServiceAuth(req, res, next) {
    return requireSignedInternalService(req, res, () => {
        req.serviceName = req.serviceIdentity.issuer;
        next();
    });
}

function validateSecurityConfiguration() {
    if (env.isProd && !env.JWT_SECRET) {
            throw new Error('JWT_SECRET is required in production');
        }
    if (env.isProd && env.INTERNAL_SERVICE_SECRET.length < 32) {
        throw new Error('INTERNAL_SERVICE_SECRET must contain at least 32 characters in production');
    }
    if (env.isProd && !/^[a-fA-F0-9]{64}$/.test(env.ENCRYPTION_KEY || '')) {
        throw new Error('ENCRYPTION_KEY must be configured as 64 hexadecimal characters in production');
    }
}

module.exports = {
    ADMIN_ROLES,
    authenticate,
    requireRoles,
    requireAdmin,
    internalServiceAuth,
    validateSecurityConfiguration,
};
