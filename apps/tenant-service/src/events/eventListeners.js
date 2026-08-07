const { EVENTS, subscribeToEvents } = require('@sparkcrm/shared-events');
const Tenant = require('../models/Tenant');
const { getRedisClient } = require('@sparkcrm/shared-config');

const invalidateTenantCache = async (tenantId) => {
    try {
        await getRedisClient().del(`tenant:${tenantId}`);
    } catch (error) {
        console.warn(`⚠️ Could not clear tenant cache for ${tenantId}:`, error.message);
    }
};

/**
 * Wire up event listeners for tenant-service
 */
const registerEventListeners = async () => {
    console.log('📡 tenant-service: Registering event listeners...');

    // ─── Feature purchased → Add to tenant purchasedFeatures ───
    await subscribeToEvents(EVENTS.FEATURE_PURCHASED, async (_channel, data) => {
        try {
            const { tenantId, featureSlug } = data;
            await Tenant.findByIdAndUpdate(tenantId, {
                $addToSet: { purchasedFeatures: featureSlug },
            });
            await invalidateTenantCache(tenantId);
            console.log(`🧩 Feature "${featureSlug}" added to tenant ${tenantId}`);
        } catch (err) {
            console.error('❌ feature.purchased handler error:', err.message);
        }
    });

    // ─── Feature cancelled → Remove from tenant purchasedFeatures ───
    await subscribeToEvents(EVENTS.FEATURE_CANCELLED, async (_channel, data) => {
        try {
            const { tenantId, featureSlug } = data;
            await Tenant.findByIdAndUpdate(tenantId, {
                $pull: { purchasedFeatures: featureSlug },
            });
            await invalidateTenantCache(tenantId);
            console.log(`🧩 Feature "${featureSlug}" removed from tenant ${tenantId}`);
        } catch (err) {
            console.error('❌ feature.cancelled handler error:', err.message);
        }
    });

    // ─── Plan upgraded → Update tenant plan ───
    await subscribeToEvents(EVENTS.PLAN_UPGRADED, async (_channel, data) => {
        try {
            const { tenantId, planId, planSlug } = data;
            await Tenant.findByIdAndUpdate(tenantId, {
                planId: planId,
                status: 'active',
                trialStatus: 'converted',
                trialConvertedAt: new Date(),
            });
            await invalidateTenantCache(tenantId);
            console.log(`📈 Tenant ${tenantId} upgraded to plan ${planSlug}`);
        } catch (err) {
            console.error('❌ plan.upgraded handler error:', err.message);
        }
    });

    console.log('✅ tenant-service: 3 event listeners registered');
};

module.exports = { registerEventListeners };
