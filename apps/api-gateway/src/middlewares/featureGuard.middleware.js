/**
 * Feature Guard Middleware — Checks if the tenant has access to the required feature
 * Feature access comes from three sources (all checked in order):
 *   1. Plan features   — tenant.planId.features (populated by tenantResolver)
 *   2. Purchased add-ons — tenant.purchasedFeatures (stored as slug strings)
 *   3. Owner-granted extras — tenant.extraFeatures (string slugs)
 *
 * Usage: featureGuard('call_recording')
 *        featureGuard('whatsapp_chatbot')
 */
const featureGuard = (requiredFeature) => {
    return (req, res, next) => {
        try {
            // If no feature requirement, pass through
            if (!requiredFeature) return next();

            // Tenant View must mirror the tenant's subscribed plan. Owner Panel
            // routes remain separate and are not subject to tenant feature guards.
            const tenant = req.tenant;
            if (!tenant) {
                return res.status(500).json({
                    success: false,
                    message: 'Tenant data not available. Ensure tenantResolver runs first.',
                });
            }

            // 1. Check plan features (planId is populated by tenantResolver)
            const plan = tenant.subscription?.planId;
            const planFeatures = plan?.features || [];
            if (planFeatures.includes(requiredFeature)) return next();

            // 2. Check purchased add-on features (stored as string slugs since migration)
            const purchasedFeatures = tenant.purchasedFeatures || [];
            if (purchasedFeatures.includes(requiredFeature)) return next();

            // 3. Check owner-granted extra features
            const extraFeatures = tenant.extraFeatures || [];
            if (extraFeatures.includes(requiredFeature)) return next();

            // Feature not available — deny with upgrade hint
            console.log(`🚫 [featureGuard] DENIED: tenant=${tenant._id}, feature=${requiredFeature}, plan=${plan?.slug || 'unknown'}`);
            return res.status(403).json({
                success: false,
                message: `This feature requires '${requiredFeature}'. Please upgrade your plan or purchase it as an add-on.`,
                code: 'FEATURE_NOT_AVAILABLE',
                featureSlug: requiredFeature,
                upgradeUrl: '/billing',
            });
        } catch (error) {
            console.error('❌ Feature guard error:', error.message);
            next(error);
        }
    };
};

module.exports = { featureGuard };
