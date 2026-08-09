function filterModulesForTenantPlan(modules, tenant) {
    const plan = tenant?.subscription?.planId;
    if (!plan) return modules;

    const planModuleKeys = plan.moduleKeys || [];
    const extraModuleKeys = tenant.extraModuleKeys || [];
    const allowedModuleKeys = new Set([...planModuleKeys, ...extraModuleKeys]);

    if (allowedModuleKeys.size > 0) {
        return modules.filter((module) => {
            if (!module.requiredFeature) return true;
            return allowedModuleKeys.has(module.key)
                || Boolean(module.parentKey && allowedModuleKeys.has(module.parentKey));
        });
    }

    const planFeatures = plan.features || [];
    const extraFeatures = tenant.extraFeatures || [];
    const allowedFeatures = new Set([...planFeatures, ...extraFeatures]);
    return modules.filter((module) => !module.requiredFeature || allowedFeatures.has(module.requiredFeature));
}

module.exports = { filterModulesForTenantPlan };
