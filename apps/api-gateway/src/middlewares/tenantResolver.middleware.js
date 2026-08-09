const axios = require('axios');
const { env, getRedisClient, isRedisReady } = require('@sparkcrm/shared-config');
const { createServiceHeaders } = require('@sparkcrm/shared-middleware');

const TENANT_CACHE_TTL = 60; // seconds
const CACHE_KEY_PREFIX = 'tenant:';

/**
 * Get tenant cache key
 */
function cacheKey(tenantId) {
    return `${CACHE_KEY_PREFIX}${tenantId}`;
}

/**
 * Clear cached tenant data (call when tenant plan/status changes)
 * Used by billing-service or admin updates via gateway invalidation
 */
async function clearTenantCache(tenantId) {
    if (!isRedisReady()) return;
    try {
        await getRedisClient().del(cacheKey(tenantId));
        console.log(`🗑️  [tenantResolver] Cache cleared: tenant=${tenantId}`);
    } catch (err) {
        console.warn('⚠️  [tenantResolver] Failed to clear cache:', err.message);
    }
}

/**
 * Tenant Resolver Middleware — Loads tenant data from tenant-service
 * Caches in Redis with a 60-second TTL to avoid hitting the DB on every request.
 * On cache miss: fetches from tenant-service and stores in Redis.
 * Falls back gracefully if Redis is unavailable.
 */
const tenantResolver = async (req, res, next) => {
    try {
        const tenantId = req.tenantId || req.headers['x-tenant-id'];
        if (!tenantId) {
            return res.status(400).json({
                success: false,
                message: 'Tenant ID is missing',
            });
        }

        let tenant = null;

        // ── Try Redis cache first ──────────────────────────────────────────────
        if (isRedisReady()) {
            try {
                const cached = await getRedisClient().get(cacheKey(tenantId));
                if (cached) {
                    tenant = JSON.parse(cached);
                }
            } catch (err) {
                console.warn('⚠️  [tenantResolver] Redis get failed (will fetch from service):', err.message);
            }
        }

        // ── Fetch from tenant-service on cache miss ────────────────────────────
        if (!tenant) {
            try {
                const path = `/internal/tenants/${encodeURIComponent(String(tenantId))}`;
                const headers = createServiceHeaders({
                    issuer: 'api-gateway',
                    audience: 'tenant-service',
                    method: 'GET',
                    path,
                    identity: { tenantId: String(tenantId) },
                });
                const response = await axios.get(
                    `${env.SERVICES.TENANT}${path}`,
                    { timeout: 5000, headers }
                );
                tenant = response.data.data;
            } catch (err) {
                if (err.response && err.response.status === 404) {
                    return res.status(404).json({
                        success: false,
                        message: 'Tenant not found',
                    });
                }
                console.error('❌ Tenant resolver error:', err.message);
                return res.status(502).json({
                    success: false,
                    message: 'Unable to resolve tenant. Tenant service may be unavailable.',
                });
            }

            // ── Store in Redis ─────────────────────────────────────────────────
            if (isRedisReady()) {
                try {
                    await getRedisClient().setex(cacheKey(tenantId), TENANT_CACHE_TTL, JSON.stringify(tenant));
                } catch (err) {
                    console.warn('⚠️  [tenantResolver] Redis set failed (non-blocking):', err.message);
                }
            }
        }

        // ── Check tenant status ────────────────────────────────────────────────
        const status = tenant.status;
        if (status === 'suspended') {
            return res.status(403).json({
                success: false,
                message: 'Your account has been suspended. Please contact support.',
                code: 'TENANT_SUSPENDED',
                reason: tenant.suspendedReason || undefined,
            });
        }

        if (status === 'cancelled') {
            return res.status(403).json({
                success: false,
                message: 'Your account has been cancelled.',
                code: 'TENANT_CANCELLED',
            });
        }

        // ── Attach tenant to request ───────────────────────────────────────────
        req.tenant = tenant;
        req.tenantPlan = tenant.subscription?.planId;

        // ── Inject calling headers for call-service ────────────────────────────
        // x-tenant-calling-number: Exotel virtual number assigned to this tenant
        //   → what the lead sees as caller-ID
        // x-user-mobile: agent's personal mobile from User.mobileNumber
        //   → Exotel rings this first before bridging to the lead
        if (tenant.calling?.exotelVirtualNumber) {
            req.headers['x-tenant-calling-number'] = tenant.calling.exotelVirtualNumber;
        }
        // x-user-mobile comes from the JWT (injected by authMiddleware from User.mobileNumber)
        // If authMiddleware didn't set it, it stays absent (call-service will return a clear error)

        next();
    } catch (error) {
        console.error('❌ Tenant resolver unexpected error:', error.message);
        next(error);
    }
};

module.exports = { tenantResolver, clearTenantCache };
