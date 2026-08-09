const { TENANT_STATUS, TRIAL_STATUS } = require('@sparkcrm/shared-utils');

/**
 * Trial Guard Middleware — Validates tenant subscription status.
 * - Active paid plan: always allowed
 * - Free plan: allowed (limited features handled by featureGuard)
 * - Trial: check expiry → if still active, proceed; if expired, treat as free
 * 
 * Note: Trial does NOT unlock all features — tenants on trial are limited
 * to their selected plan's features (enforced by featureGuard).
 */
const trialGuard = (req, res, next) => {
    try {
        const tenant = req.tenant;
        if (!tenant) {
            return res.status(500).json({
                success: false,
                message: 'Tenant data not available. Ensure tenantResolver runs before trialGuard.',
            });
        }
        const status = tenant.status;
        const trialExpiresAt = tenant.trial?.expiresAt;

        // Active paid plan — always allowed
        if (status === TENANT_STATUS.ACTIVE) {
            req.isTrial = false;
            return next();
        }

        // Free plan — allowed (limited features handled by feature guard)
        if (status === TENANT_STATUS.FREE) {
            req.isTrial = false;
            return next();
        }

        // Trial — check if still active
        if (status === TENANT_STATUS.TRIAL) {
            const trialExpiry = new Date(trialExpiresAt);
            if (trialExpiry > new Date()) {
                req.isTrial = true;
                req.trialDaysRemaining = Math.ceil(
                    (trialExpiry - new Date()) / (1000 * 60 * 60 * 24)
                );
                return next();
            }

            // Trial has expired — treat as free plan (grace period)
            // Instead of blocking everything with 403, let the request through.
            // The featureGuard will restrict to free-tier features.
            // The cron job will formally downgrade status to FREE.
            req.isTrial = false;
            req.trialExpired = true;
            return next();
        }

        // Suspended or unknown status
        return res.status(403).json({
            success: false,
            message: 'Account status is invalid. Please contact support.',
        });
    } catch (error) {
        console.error('❌ Trial guard error:', error.message);
        next(error);
    }
};

module.exports = { trialGuard };

