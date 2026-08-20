const Tenant = require('../models/Tenant');
const Plan = require('../models/Plan');
const Payment = require('../models/Payment');
const Referral = require('../models/Referral');
const { TENANT_STATUS, TRIAL_STATUS, TRIAL_DURATION_DAYS } = require('@sparkcrm/shared-utils');
const { publishEvent, EVENTS } = require('@sparkcrm/shared-events');
const crypto = require('crypto');

/**
 * Create a new tenant with 30-day free trial
 */
const createTenantWithTrial = async ({ company, referralCode, planSlug }) => {
    const compName = company?.name;
    const compEmail = company?.email;
    const compPhone = company?.phone || '';

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
    const baseSlug = (compName || 'company')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
    let slug = baseSlug;
    let counter = 1;
    while (await Tenant.findOne({ 'company.slug': slug })) {
        slug = `${baseSlug}-${counter}`;
        counter++;
    }

    // Generate referral code
    const tenantReferralCode = `${baseSlug}-${crypto.randomBytes(3).toString('hex')}`.toUpperCase();

    const now = new Date();
    const trialExpiresAt = new Date(now.getTime() + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000);

    const companyObj = {
        name: compName,
        slug,
        email: compEmail,
        phone: compPhone || '',
        logo: company?.logo || '',
        website: company?.website || '',
    };

    const subscription = {
        planId: trialPlan._id,
        billingCycle: 'none',
        startedAt: now,
        expiresAt: trialExpiresAt,
        convertedAt: null,
    };

    const trial = {
        status: TRIAL_STATUS.ACTIVE,
        startedAt: now,
        expiresAt: trialExpiresAt,
        convertedAt: null,
    };

    const tenant = await Tenant.create({
        company: companyObj,
        status: TENANT_STATUS.TRIAL,
        subscription,
        trial,
        referralCode: tenantReferralCode,
        referredBy: null,
    });

    // Handle referral
    if (referralCode) {
        const referrerTenant = await Tenant.findOne({ referralCode });
        if (
            referrerTenant &&
            referrerTenant.company?.email !== compEmail &&
            referrerTenant.company?.phone !== compPhone
        ) {
            tenant.referredBy = referrerTenant._id;
            await tenant.save();
            
            try {
                await Referral.create({
                    referrerTenantId: referrerTenant._id,
                    referredTenantId: tenant._id,
                    referralCode: referrerTenant.referralCode,
                    status: 'registered',
                });
            } catch (err) {
                console.error('⚠️ Failed to create Referral record:', err.message);
            }
        }
    }

    // Create trial invoice / payment record
    const invoiceNumber = `TRIAL-${tenant._id.toString().slice(-6).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
    try {
        await Payment.create({
            tenantId: tenant._id,
            plan: {
                planId: trialPlan._id,
                name: trialPlan.name,
                billingCycle: 'trial',
            },
            invoice: {
                number: invoiceNumber,
                amount: 0,
                currency: 'INR',
                description: `${trialPlan.name} — 30-day free trial`,
            },
            subscription: {
                status: 'trial',
                periodStart: now,
                periodEnd: trialExpiresAt,
            },
            payment: {
                method: 'free',
                status: 'trial',
                paidAt: now,
            }
        });
    } catch (err) {
        console.error('⚠️ Failed to create trial payment record:', err.message);
    }

    // Publish event with full details for welcome email + invoice
    await publishEvent(EVENTS.TENANT_REGISTERED, {
        tenantId: tenant._id,
        companyName: tenant.company?.name,
        email: tenant.company?.email,
        phone: tenant.company?.phone,
        planName: trialPlan.name,
        trialExpiresAt: tenant.trial?.expiresAt,
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
        'subscription.status': TENANT_STATUS.TRIAL,
        'trial.status': TRIAL_STATUS.ACTIVE,
        'trial.expiresAt': { $lte: new Date() },
    });

    const results = [];

    for (const tenant of expiredTenants) {
        // Downgrade to free plan
        const freePlan = await Plan.findOne({ slug: 'free', isActive: true });
        if (freePlan) {
            if (!tenant.subscription) tenant.subscription = {};
            tenant.subscription.planId = freePlan._id;
        }

        if (!tenant.subscription) tenant.subscription = {};
        if (!tenant.trial) tenant.trial = {};
        tenant.status = TENANT_STATUS.FREE;
        tenant.trial.status = TRIAL_STATUS.EXPIRED;
        await tenant.save();

        await publishEvent(EVENTS.TENANT_TRIAL_EXPIRED, {
            tenantId: tenant._id,
            companyName: tenant.company?.name,
            email: tenant.company?.email,
        });

        results.push({
            tenantId: tenant._id,
            companyName: tenant.company?.name,
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
        'trial.status': TRIAL_STATUS.ACTIVE,
        'trial.startedAt': { $gte: windowStart, $lte: windowEnd },
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

    if (!tenant.subscription) tenant.subscription = {};
    if (!tenant.trial) tenant.trial = {};
    tenant.subscription.planId = planId;
    tenant.subscription.billingCycle = billingCycle;
    tenant.subscription.expiresAt = expiresAt;
    tenant.subscription.convertedAt = now;
    tenant.trial.status = TRIAL_STATUS.CONVERTED;
    tenant.trial.convertedAt = now;
    tenant.status = TENANT_STATUS.ACTIVE;
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
