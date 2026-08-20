const Tenant = require('../models/Tenant');
const Referral = require('../models/Referral');
const { ApiResponse, ApiError, asyncHandler } = require('@sparkcrm/shared-utils');

/**
 * GET /api/referral/code
 * Get current tenant's referral code
 */
const getReferralCode = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];

    const tenant = await Tenant.findById(tenantId).select('referralCode companyName');
    if (!tenant) throw ApiError.notFound('Tenant not found');

    const referralLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/register?ref=${tenant.referralCode}`;

    ApiResponse.success(res, {
        referralCode: tenant.referralCode,
        referralLink,
    });
});

/**
 * GET /api/referral/stats
 * Get referral statistics for current tenant
 */
const getReferralStats = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];

    const tenant = await Tenant.findById(tenantId);
    if (!tenant) throw ApiError.notFound('Tenant not found');

    const referrals = await Referral.find({ referrerTenantId: tenantId })
        .populate('referredTenantId', 'companyName status createdAt')
        .sort({ 'meta.createdAt': -1 });

    const stats = {
        totalReferrals: referrals.length,
        converted: referrals.filter((r) => r.status === 'converted').length,
        pending: referrals.filter((r) => r.status === 'registered').length,
        rewardsEarned: referrals.filter((r) => r.rewardApplied).length,
        referrals,
    };

    ApiResponse.success(res, stats, 'Referral stats fetched');
});

module.exports = {
    getReferralCode,
    getReferralStats,
};
