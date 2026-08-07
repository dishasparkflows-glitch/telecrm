const Referral = require('../models/Referral');
const Tenant = require('../models/Tenant');
const { publishEvent, EVENTS } = require('@sparkcrm/shared-events');

/**
 * Process referral rewards when a referred tenant upgrades to paid plan
 * Called by event listener on TENANT_UPGRADED
 */
const processReferralReward = async (tenantId) => {
    const tenant = await Tenant.findById(tenantId);
    if (!tenant || !tenant.referredBy) return null;

    // Find or create referral record
    let referral = await Referral.findOne({
        referredTenantId: tenantId,
        status: 'pending',
    });

    if (!referral) {
        referral = await Referral.create({
            referrerTenantId: tenant.referredBy,
            referredTenantId: tenantId,
            referralCode: tenant.referralCode,
            status: 'pending',
        });
    }

    // Mark as converted
    referral.status = 'converted';
    referral.convertedAt = new Date();
    await referral.save();

    // Apply reward to referrer (extend plan by 30 days)
    const referrer = await Tenant.findById(tenant.referredBy);
    if (referrer && referrer.planExpiresAt) {
        referrer.planExpiresAt = new Date(
            referrer.planExpiresAt.getTime() + 30 * 24 * 60 * 60 * 1000
        );
        await referrer.save();

        referral.rewardApplied = true;
        referral.rewardType = 'free_month';
        await referral.save();

        await publishEvent(EVENTS.SEND_EMAIL, {
            to: referrer.email,
            template: 'referral_reward',
            data: {
                companyName: referrer.companyName,
                referredCompany: tenant.companyName,
                reward: '1 Free Month',
                newExpiresAt: referrer.planExpiresAt,
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

    // Create a pending referral record
    const referral = await Referral.create({
        referrerTenantId: referrerTenant._id,
        referralCode,
        status: 'pending',
    });

    return referral;
};

module.exports = { processReferralReward, trackReferralClick };
