async function invalidateTenantCache(tenantId) {
    if (!tenantId) return;
    try {
        const { getRedisClient, isRedisReady } = require('@sparkcrm/shared-config');
        if (isRedisReady()) await getRedisClient().del(`tenant:${tenantId}`);
    } catch (err) {
        console.warn(`Tenant cache invalidation failed for ${tenantId}: ${err.message}`);
    }
}

module.exports = { invalidateTenantCache };
