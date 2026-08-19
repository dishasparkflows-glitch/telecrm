const Tenant = require('../models/Tenant');
const Plan = require('../models/Plan');
const Payment = require('../models/Payment');
const { ApiResponse, ApiError, asyncHandler, getPresignedDownloadUrl, deleteMedia } = require('@sparkcrm/shared-utils');

const { publishEvent, EVENTS } = require('@sparkcrm/shared-events');

/**
 * GET /api/tenants/profile
 * Get current tenant profile
 */
const getProfile = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    if (!tenantId) throw ApiError.badRequest('Tenant ID is required');

    const tenant = await Tenant.findById(tenantId).populate('subscription.planId');
    if (!tenant) throw ApiError.notFound('Tenant not found');

    const tenantObj = tenant.toObject();
    if (tenantObj.company?.logo) {
        tenantObj.company.logo = await getPresignedDownloadUrl(tenantObj.company.logo);
    }
    ApiResponse.success(res, tenantObj, 'Tenant profile fetched');
});

/**
 * PUT /api/tenants/settings
 * Update tenant settings
 */
const updateSettings = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const { companyName, phone, logo, website, address, settings, company } = req.body;

    const tenant = await Tenant.findById(tenantId);
    if (!tenant) throw ApiError.notFound('Tenant not found');

    if (!tenant.company) tenant.company = {};

    const name = company?.name !== undefined ? company.name : companyName;
    if (name !== undefined) tenant.company.name = name;

    if (company?.email !== undefined) tenant.company.email = company.email;

    const compPhone = company?.phone !== undefined ? company.phone : phone;
    if (compPhone !== undefined) tenant.company.phone = compPhone;

    const compWebsite = company?.website !== undefined ? company.website : website;
    if (compWebsite !== undefined) tenant.company.website = compWebsite;

    const newLogo = company?.logo !== undefined ? company.logo : logo;
    if (newLogo !== undefined && newLogo !== tenant.company.logo) {
        if (tenant.company.logo) {
            await deleteMedia(tenant.company.logo);
        }
        tenant.company.logo = newLogo;
    }
    const newAddress = company?.address !== undefined ? company.address : address;
    if (newAddress !== undefined) tenant.company.address = newAddress;
    if (settings) {
        if (settings.timezone) tenant.settings.timezone = settings.timezone;
        if (settings.workingHours) tenant.settings.workingHours = settings.workingHours;
        if (settings.currency) tenant.settings.currency = settings.currency;
        if (settings.dateFormat) tenant.settings.dateFormat = settings.dateFormat;
        if (settings.language) tenant.settings.language = settings.language;
    }

    await tenant.save();
    ApiResponse.success(res, tenant, 'Settings updated');
});

/**
 * GET /api/tenants/trial-status
 * Get trial status of current tenant
 */
const getTrialStatus = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];

    const tenant = await Tenant.findById(tenantId).populate('subscription.planId');
    if (!tenant) throw ApiError.notFound('Tenant not found');

    const data = {
        status: tenant.status,
        trialStatus: tenant.trial?.status,
        isTrialActive: tenant.isTrialActive,
        trialDaysRemaining: tenant.trialDaysRemaining,
        trialStartedAt: tenant.trial?.startedAt,
        trialExpiresAt: tenant.trial?.expiresAt,
        trialConvertedAt: tenant.trial?.convertedAt,
        currentPlan: tenant.subscription?.planId,
    };

    ApiResponse.success(res, data, 'Trial status fetched');
});

/**
 * GET /api/tenants/billing
 * Get full billing details — current plan, tenant info, days remaining
 */
const getBillingDetails = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];

    const tenant = await Tenant.findById(tenantId).populate('subscription.planId');
    if (!tenant) throw ApiError.notFound('Tenant not found');

    const now = new Date();
    const plan = tenant.subscription?.planId;

    // Calculate days remaining
    let daysRemaining = 0;
    let expiresAt = null;
    if (tenant.isTrialActive && tenant.trial?.expiresAt) {
        daysRemaining = Math.max(0, Math.ceil((new Date(tenant.trial.expiresAt) - now) / (1000 * 60 * 60 * 24)));
        expiresAt = tenant.trial.expiresAt;
    } else if (tenant.subscription?.expiresAt) {
        daysRemaining = Math.max(0, Math.ceil((new Date(tenant.subscription.expiresAt) - now) / (1000 * 60 * 60 * 24)));
        expiresAt = tenant.subscription.expiresAt;
    }

    const data = {
        tenant: {
            _id: tenant._id,
            companyName: tenant.company?.name,
            email: tenant.company?.email,
            phone: tenant.company?.phone,
            slug: tenant.company?.slug,
            company: tenant.company,
            status: tenant.status,
            createdAt: tenant.meta?.createdAt,
        },
        plan: plan ? {
            _id: plan._id,
            name: plan.name,
            slug: plan.slug,
            price: plan.price,
            yearlyPrice: plan.yearlyPrice,
            features: plan.features,
            limits: plan.limits,
        } : null,
        billing: {
            isOnTrial: tenant.isTrialActive,
            trialStatus: tenant.trial?.status,
            daysRemaining,
            expiresAt,
            billingCycle: tenant.subscription?.billingCycle || 'monthly',
        },
    };

    ApiResponse.success(res, data, 'Billing details fetched');
});

/**
 * GET /api/tenants/payment-history
 * Get payment/invoice history for current tenant
 */
const getPaymentHistory = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const payments = await Payment.find({ tenantId })
        .sort({ 'meta.createdAt': -1 })
        .skip((page - 1) * limit)
        .limit(limit);

    const total = await Payment.countDocuments({ tenantId });

    ApiResponse.success(res, {
        payments,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    }, 'Payment history fetched');
});

/**
 * POST /api/tenants/upgrade-plan
 * Upgrade tenant to a new plan
 */
const upgradePlan = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const { planId, billingCycle } = req.body;

    if (!planId) throw ApiError.badRequest('Plan ID is required');

    const tenant = await Tenant.findById(tenantId).populate('subscription.planId', 'price yearlyPrice');
    if (!tenant) throw ApiError.notFound('Tenant not found');

    const newPlan = await Plan.findById(planId);
    if (!newPlan) throw ApiError.notFound('Plan not found');
    if (!newPlan.isActive) throw ApiError.badRequest('This plan is not available');

    const cycle = billingCycle || 'monthly';
    const amount = cycle === 'yearly' ? (newPlan.yearlyPrice || newPlan.price * 12) : newPlan.price;
    const currentPlanPrice = cycle === 'yearly'
        ? (tenant.subscription?.planId?.yearlyPrice || (tenant.subscription?.planId?.price || 0) * 12)
        : (tenant.subscription?.planId?.price || 0);

    // The existing dashboard uses this route only for free plans and
    // downgrades. Paid upgrades must complete through billing verification.
    if (amount > 0 && amount >= currentPlanPrice) {
        throw ApiError.badRequest('Paid upgrades must be completed through checkout');
    }

    // Update tenant plan
    const now = new Date();
    const periodEnd = cycle === 'yearly'
        ? new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000)
        : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    if (!tenant.subscription) tenant.subscription = {};
    if (!tenant.trial) tenant.trial = {};
    tenant.subscription.planId = newPlan._id;
    tenant.subscription.billingCycle = cycle;
    tenant.subscription.expiresAt = periodEnd;
    tenant.status = 'active';
    if (tenant.trial.status === 'active') {
        tenant.trial.status = 'converted';
        tenant.trial.convertedAt = now;
    }
    await tenant.save();

    // Create payment record
    const invoiceNumber = `INV-${tenant._id.toString().slice(-6).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
    const payment = await Payment.create({
        tenantId: tenant._id,
        plan: {
            planId: newPlan._id,
            name: newPlan.name,
            billingCycle: cycle,
        },
        invoice: {
            number: invoiceNumber,
            amount,
            currency: 'INR',
            description: `${newPlan.name} — ${cycle} plan`,
        },
        subscription: {
            status: 'completed',
            periodStart: now,
            periodEnd,
        },
        payment: {
            method: 'none',
            status: 'completed',
            paidAt: now,
        }
    });

    // Publish event
    await publishEvent(EVENTS.PLAN_UPGRADED, {
        tenantId: tenant._id,
        planName: newPlan.name,
        amount,
        billingCycle: cycle,
    });

    ApiResponse.success(res, { tenant, plan: newPlan, payment }, `Successfully upgraded to ${newPlan.name} plan`);
});

/**
 * PUT /api/tenants/pipeline
 */
const updatePipeline = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const { stages } = req.body;

    if (!stages || !Array.isArray(stages)) {
        throw ApiError.badRequest('Pipeline stages must be an array');
    }

    const tenant = await Tenant.findById(tenantId);
    if (!tenant) throw ApiError.notFound('Tenant not found');

    tenant.pipelineStages = stages.map((stage, index) => ({
        name: stage.name,
        slug: stage.slug || stage.name.toLowerCase().replace(/\s+/g, '_'),
        color: stage.color || '#6366f1',
        order: stage.order ?? index,
    }));

    await tenant.save();
    ApiResponse.success(res, tenant.pipelineStages, 'Pipeline updated');
});

/**
 * PUT /api/tenants/call-dispositions
 */
const updateCallDispositions = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const { dispositions } = req.body;

    if (!dispositions || !Array.isArray(dispositions)) {
        throw ApiError.badRequest('Call dispositions must be an array');
    }

    const tenant = await Tenant.findById(tenantId);
    if (!tenant) throw ApiError.notFound('Tenant not found');

    tenant.callDispositions = dispositions.map((disp, index) => ({
        name: disp.name,
        slug: disp.slug || disp.name.toLowerCase().replace(/\s+/g, '_'),
        color: disp.color || '#6366f1',
        isActive: disp.isActive !== undefined ? disp.isActive : true,
        order: disp.order ?? index,
    }));

    await tenant.save();
    ApiResponse.success(res, tenant.callDispositions, 'Call dispositions updated');
});

/**
 * POST /api/tenants/custom-fields
 */
const addCustomField = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const { name, type, options, required } = req.body;

    if (!name || !type) throw ApiError.badRequest('Field name and type are required');

    const tenant = await Tenant.findById(tenantId);
    if (!tenant) throw ApiError.notFound('Tenant not found');

    const exists = tenant.customFields.some(
        (f) => f.name.toLowerCase() === name.toLowerCase()
    );
    if (exists) throw ApiError.conflict('Custom field with this name already exists');

    tenant.customFields.push({
        name, type,
        options: options || [],
        required: required || false,
        order: tenant.customFields.length,
    });

    await tenant.save();
    ApiResponse.created(res, tenant.customFields, 'Custom field added');
});

/**
 * PUT /api/tenants/onboarding
 */
const updateOnboarding = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const { step } = req.body;

    const tenant = await Tenant.findById(tenantId);
    if (!tenant) throw ApiError.notFound('Tenant not found');

    if (step && !tenant.onboarding.completedSteps.includes(step)) {
        tenant.onboarding.completedSteps.push(step);
    }

    const requiredSteps = ['profile', 'pipeline', 'invite_team', 'first_lead'];
    const allComplete = requiredSteps.every((s) =>
        tenant.onboarding.completedSteps.includes(s)
    );
    tenant.onboarding.isComplete = allComplete;

    await tenant.save();
    ApiResponse.success(res, tenant.onboarding, 'Onboarding updated');
});

module.exports = {
    getProfile,
    updateSettings,
    getTrialStatus,
    getBillingDetails,
    getPaymentHistory,
    upgradePlan,
    updatePipeline,
    updateCallDispositions,
    addCustomField,
    updateOnboarding,
};
