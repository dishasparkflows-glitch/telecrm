const Tenant = require('../models/Tenant');
const Plan = require('../models/Plan');
const Payment = require('../models/Payment');
const { TENANT_STATUS, TRIAL_STATUS, TRIAL_DURATION_DAYS } = require('@sparkcrm/shared-utils');
const { publishEvent, EVENTS } = require('@sparkcrm/shared-events');
const crypto = require('crypto');

/**
 * Create a new tenant with 30-day free trial
 */
const createTenantWithTrial = async ({ companyName, email, phone, referralCode, planSlug }) => {
    // If a specific plan was selected, use it; otherwise fall back to trial/free plan
    let trialPlan;
    if (planSlug) {
        trialPlan = await Plan.findOne({ slug: planSlug, isActive: true });
    }
    if (!trialPlan) {
        trialPlan = await Plan.findOne({ isTrial: true, isActive: true });
    }
    if (!trialPlan) {
        trialPlan = await Plan.findOne({ slug: 'free' });
    }
    if (!trialPlan) {
        throw new Error('No trial or free plan found. Please seed plans first.');
    }

    // Generate unique slug
    const baseSlug = companyName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
    let slug = baseSlug;
    let counter = 1;
    while (await Tenant.findOne({ slug })) {
        slug = `${baseSlug}-${counter}`;
        counter++;
    }

    // Generate referral code
    const tenantReferralCode = `${baseSlug}-${crypto.randomBytes(3).toString('hex')}`.toUpperCase();

    const now = new Date();
    const trialExpiresAt = new Date(now.getTime() + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000);

    const tenant = await Tenant.create({
        companyName,
        slug,
        email,
        phone: phone || '',
        planId: trialPlan._id,
        status: TENANT_STATUS.TRIAL,
        trialStatus: TRIAL_STATUS.ACTIVE,
        trialStartedAt: now,
        trialExpiresAt,
        referralCode: tenantReferralCode,
        referredBy: null, // Will be set if referralCode is provided
    });

    // Handle referral
    if (referralCode) {
        const referrerTenant = await Tenant.findOne({ referralCode });
        if (referrerTenant) {
            tenant.referredBy = referrerTenant._id;
            await tenant.save();
        }
    }

    // Create trial invoice / payment record
    const invoiceNumber = `TRIAL-${tenant._id.toString().slice(-6).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
    try {
        await Payment.create({
            tenantId: tenant._id,
            planId: trialPlan._id,
            planName: trialPlan.name,
            invoiceNumber,
            amount: 0,
            currency: 'INR',
            billingCycle: 'trial',
            status: 'trial',
            method: 'free',
            paidAt: now,
            periodStart: now,
            periodEnd: trialExpiresAt,
            description: `${trialPlan.name} — 30-day free trial`,
        });
    } catch (err) {
        console.error('⚠️ Failed to create trial payment record:', err.message);
    }

    // Publish event with full details for welcome email + invoice
    await publishEvent(EVENTS.TENANT_REGISTERED, {
        tenantId: tenant._id,
        companyName: tenant.companyName,
        email: tenant.email,
        phone: tenant.phone,
        planName: trialPlan.name,
        trialExpiresAt: tenant.trialExpiresAt,
        invoiceNumber,
    });

    return tenant;
};

/**
 * Check and handle expired trials
 * Called by cron job
 */
const processExpiredTrials = async () => {
    const expiredTenants = await Tenant.find({
        status: TENANT_STATUS.TRIAL,
        trialStatus: TRIAL_STATUS.ACTIVE,
        trialExpiresAt: { $lte: new Date() },
    });

    const results = [];

    for (const tenant of expiredTenants) {
        // Downgrade to free plan
        const freePlan = await Plan.findOne({ slug: 'free', isActive: true });
        if (freePlan) {
            tenant.planId = freePlan._id;
        }

        tenant.status = TENANT_STATUS.FREE;
        tenant.trialStatus = TRIAL_STATUS.EXPIRED;
        await tenant.save();

        await publishEvent(EVENTS.TENANT_TRIAL_EXPIRED, {
            tenantId: tenant._id,
            companyName: tenant.companyName,
            email: tenant.email,
        });

        results.push({
            tenantId: tenant._id,
            companyName: tenant.companyName,
        });
    }

    return results;
};

/**
 * Get trial reminder tenants for a specific day
 * @param {number} day - Day of trial (3, 7, 14, 20, 27)
 */
const getTrialReminders = async (day) => {
    const now = new Date();
    const targetDate = new Date(now.getTime() - day * 24 * 60 * 60 * 1000);

    // Find tenants who started trial on that day (±12 hours window)
    const windowStart = new Date(targetDate.getTime() - 12 * 60 * 60 * 1000);
    const windowEnd = new Date(targetDate.getTime() + 12 * 60 * 60 * 1000);

    return Tenant.find({
        status: TENANT_STATUS.TRIAL,
        trialStatus: TRIAL_STATUS.ACTIVE,
        trialStartedAt: {
            $gte: windowStart,
            $lte: windowEnd,
        },
    });
};

/**
 * Convert trial to paid plan
 */
const convertTrial = async (tenantId, planId, billingCycle = 'monthly') => {
    const tenant = await Tenant.findById(tenantId);
    if (!tenant) throw new Error('Tenant not found');

    const plan = await Plan.findById(planId);
    if (!plan) throw new Error('Plan not found');

    const now = new Date();
    const expiresAt =
        billingCycle === 'yearly'
            ? new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000)
            : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    tenant.planId = planId;
    tenant.status = TENANT_STATUS.ACTIVE;
    tenant.trialStatus = TRIAL_STATUS.CONVERTED;
    tenant.trialConvertedAt = now;
    tenant.billingCycle = billingCycle;
    tenant.planExpiresAt = expiresAt;
    await tenant.save();

    await publishEvent(EVENTS.TENANT_UPGRADED, {
        tenantId: tenant._id,
        planId: plan._id,
        planName: plan.name,
        billingCycle,
    });

    return tenant;
};

module.exports = {
    createTenantWithTrial,
    processExpiredTrials,
    getTrialReminders,
    convertTrial,
};
