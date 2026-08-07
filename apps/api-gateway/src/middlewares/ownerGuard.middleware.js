const { ROLES } = require('@sparkcrm/shared-utils');

/**
 * Owner Guard Middleware
 * Ensures that only the system owner (role === 'owner') can access owner routes.
 * Runs INSTEAD of permissionGuard for /api/owner/* routes.
 */
function ownerGuard(req, res, next) {
    const userRole = req.headers['x-user-role'];

    if (userRole !== 'owner') {
        return res.status(403).json({
            success: false,
            message: 'Access denied. Owner-only endpoint.',
        });
    }

    next();
}

module.exports = { ownerGuard };
