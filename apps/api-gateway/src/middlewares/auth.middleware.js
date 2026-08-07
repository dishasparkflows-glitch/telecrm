const jwt = require('jsonwebtoken');
const { env } = require('@sparkcrm/shared-config');
const { ApiError } = require('@sparkcrm/shared-utils');

/**
 * Auth Middleware — Verifies JWT access token
 * Extracts userId, tenantId, role from the token and attaches to req + forwards as headers
 */
const verifyGatewayToken = (token) => {
    const decoded = jwt.verify(token, env.JWT_SECRET);

    if (decoded.isImpersonating) {
        if (decoded.iss !== 'sparkcrm-tenant-service'
            || decoded.aud !== 'sparkcrm-tenant-impersonation') {
            throw new Error('Invalid impersonation token purpose');
        }
        if (decoded.role !== 'superadmin' || decoded.originalRole !== 'owner') {
            throw new Error('Invalid impersonation identity');
        }
    }

    return decoded;
};

const authMiddleware = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw ApiError.unauthorized('Access token is required');
        }

        const token = authHeader.split(' ')[1];
        const decoded = verifyGatewayToken(token);

        // Attach to request
        req.userId = decoded.userId;
        req.tenantId = decoded.tenantId;
        req.userRole = decoded.role;
        req.userEmail = decoded.email;
        req.userBranchId = decoded.branchId;
        req.userRoleId = decoded.roleId;
        req.userWhatsapp = decoded.whatsappNumber;
        req.userMobile = decoded.mobileNumber;
        req.isImpersonating = decoded.isImpersonating || false;

        // Forward to downstream services via headers
        req.headers['x-user-id'] = decoded.userId;
        req.headers['x-tenant-id'] = decoded.tenantId;
        req.headers['x-user-role'] = decoded.role;
        req.headers['x-user-email'] = decoded.email;
        req.headers['x-user-whatsapp'] = decoded.whatsappNumber || '';
        req.headers['x-user-mobile'] = decoded.mobileNumber || '';    // For Exotel first-leg
        req.headers['x-user-branch-id'] = decoded.branchId || '';
        req.headers['x-user-role-id'] = decoded.roleId || '';
        req.headers['x-is-impersonating'] = decoded.isImpersonating ? 'true' : '';

        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Token expired. Please refresh your token.',
                code: 'TOKEN_EXPIRED',
            });
        }
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                message: 'Invalid token',
                code: 'INVALID_TOKEN',
            });
        }
        return res.status(401).json({
            success: false,
            message: error.message || 'Authentication failed',
        });
    }
};

module.exports = { authMiddleware, verifyGatewayToken };
