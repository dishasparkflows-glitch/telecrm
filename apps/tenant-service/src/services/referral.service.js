const Referral = require('../models/Referral');
const Tenant = require('../models/Tenant');
const AuditLog = require('../models/AuditLog');
const { publishEvent, EVENTS } = require('@sparkcrm/shared-events');

/**
 * Process referral rewards when a referred tenant upgrades to paid plan
 * Called by event listener on TENANT_UPGRADED
 */
const processReferralReward = async (tenantId) => {
    const tenant = await Tenant.findById(tenantId);
    if (!tenant || !tenant.referredBy) return null;

    // Atomically find the registered referral and mark it as converted and rewardApplied
    const referral = await Referral.findOneAndUpdate(
        {
            referredTenantId: tenantId,
            status: 'registered',
        },
        {
            $set: {
                status: 'converted',
                convertedAt: new Date(),
                rewardApplied: true,
                rewardType: 'free_month',
            }
        },
        { new: true }
    );

    // If no referral was updated, it means it was already converted, or doesn't exist
    if (!referral) return null;

    // Apply reward to referrer (extend plan by 30 days)
    const referrer = await Tenant.findById(tenant.referredBy);
    if (referrer && referrer.subscription?.expiresAt) {
        referrer.subscription.expiresAt = new Date(
            referrer.subscription.expiresAt.getTime() + 30 * 24 * 60 * 60 * 1000
        );
        await referrer.save();

        try {
            await AuditLog.create({
                tenantId: referrer._id,
                action: 'REFERRAL_REWARD_CREDITED',
                entityType: 'Referral',
                entityId: referral._id,
                details: {
                    message: '30-day plan extension applied',
                    referredTenantId: tenantId,
                    rewardType: 'free_month',
                },
                system: true,
            });
        } catch (err) {
            console.error('⚠️ Failed to create AuditLog for referral reward:', err.message);
        }

        await publishEvent(EVENTS.SEND_EMAIL, {
            to: referrer.company?.email,
            template: 'referral_reward',
            data: {
                companyName: referrer.company?.name,
                referredCompany: tenant.company?.name,
                reward: '1 Free Month',
                newExpiresAt: referrer.subscription?.expiresAt,
            },
        });
    }

    return referral;
};

/**
 * Track a new referral click (when someone uses a referral code)
 */
const trackReferralClick = async (referralCode) => {
    const referrerTenant = await Tenant.findOne({ referralCode });
    if (!referrerTenant) return null;

    // Create a registered referral record
    const referral = await Referral.create({
        referrerTenantId: referrerTenant._id,
        referralCode,
        status: 'registered',
    });

    return referral;
};

module.exports = { processReferralReward, trackReferralClick };
