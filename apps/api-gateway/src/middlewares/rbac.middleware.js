const { ROLE_HIERARCHY } = require('@sparkcrm/shared-utils');

/**
 * RBAC Middleware — Role-based access control
 * Checks if the user's role has sufficient privileges for the action
 * 
 * Usage: rbac(ROLES.ADMIN)  — allows Admin and above
 *        rbac(ROLES.AGENT)  — allows everyone (Agent is lowest)
 *        rbac(ROLES.SUPER_ADMIN) — only superadmin
 */
const rbac = (minimumRole) => {
    return (req, res, next) => {
        try {
            const userRole = req.userRole || req.headers['x-user-role'];

            if (!userRole) {
                return res.status(401).json({
                    success: false,
                    message: 'User role not found. Authentication may have failed.',
                });
            }

            const userLevel = ROLE_HIERARCHY[userRole];
            const requiredLevel = ROLE_HIERARCHY[minimumRole];

            if (userLevel === undefined || requiredLevel === undefined) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid role configuration',
                });
            }

            if (userLevel < requiredLevel) {
                return res.status(403).json({
                    success: false,
                    message: `Access denied. This action requires '${minimumRole}' role or higher.`,
                    code: 'INSUFFICIENT_ROLE',
                    requiredRole: minimumRole,
                    currentRole: userRole,
                });
            }

            next();
        } catch (error) {
            console.error('❌ RBAC error:', error.message);
            next(error);
        }
    };
};

module.exports = { rbac };
