const Tenant = require('../models/Tenant');
const Plan = require('../models/Plan');
const Payment = require('../models/Payment');
const { ApiResponse, ApiError, asyncHandler, encrypt, decrypt, ROLES } = require('@sparkcrm/shared-utils');
const axios = require('axios');
const { env, getRedisClient } = require('@sparkcrm/shared-config');
const CommunicationConfig = require('../models/CommunicationConfig');
const { createServiceHeaders } = require('@sparkcrm/shared-middleware');

const internalServiceHeaders = (audience, method, path, identity = {}) => createServiceHeaders({
    issuer: 'tenant-service',
    audience,
    method,
    path,
    identity,
});

/**
 * Maps module keys to their required feature slugs.
 * Used for auto-syncing: when owner selects modules in a plan,
 * the corresponding features are automatically populated.
 */
const MODULE_FEATURE_MAP = {
    leads: 'lead_management',
    calls: 'calling_basic',
    whatsapp: 'whatsapp_session',
    forms: 'smart_forms',
    meetings: 'meeting_scheduler',
    automations: 'automation_basic',
    analytics: 'analytics_basic',
    tasks: 'task_management',
};

const PAYMENT_METHOD_PROVIDERS = {
    card: new Set(['razorpay', 'stripe']),
    international_card: new Set(['razorpay', 'stripe']),
    google_pay_qr: new Set(['razorpay']),
};

const invalidateTenantCaches = async (tenantIds) => {
    const ids = [...new Set((Array.isArray(tenantIds) ? tenantIds : [tenantIds])
        .filter(Boolean)
        .map(String))];
    if (ids.length === 0) return;

    try {
        const redis = getRedisClient();
        await redis.del(...ids.map((id) => `tenant:${id}`));
    } catch (error) {
        console.warn('⚠️ Could not clear tenant cache:', error.message);
    }
};

/** Convert module keys to their feature slugs */
function moduleKeysToFeatures(moduleKeys) {
    const features = new Set();
    for (const key of moduleKeys || []) {
        const feature = MODULE_FEATURE_MAP[key];
        if (feature) features.add(feature);
    }
    // Always include notifications
    features.add('notifications');
    return [...features];
}

const parsePagination = (query, defaultLimit) => {
    const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit, 10) || defaultLimit));
    return { page, limit };
};

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ══════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════

/**
 * GET /api/owner/dashboard
 * Aggregated KPIs and chart data for the owner
 */
const getDashboard = asyncHandler(async (req, res) => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    // Run aggregations in parallel
    const [
        totalTenants,
        statusAgg,
        planAgg,
        revenueMonthly,
        revenueYearly,
        revenueAllTime,
        newTenantsToday,
        newTenantsThisMonth,
        monthlyTenantTrend,
        monthlyRevenueTrend,
    ] = await Promise.all([
        // Total tenants
        Tenant.countDocuments(),

        // Tenants by status
        Tenant.aggregate([
            { $group: { _id: '$status', count: { $sum: 1 } } },
        ]),

        // Tenants by plan
        Tenant.aggregate([
            { $group: { _id: '$planId', count: { $sum: 1 } } },
            { $lookup: { from: 'plans', localField: '_id', foreignField: '_id', as: 'plan' } },
            { $unwind: { path: '$plan', preserveNullAndEmptyArrays: true } },
            { $project: { planName: '$plan.name', planSlug: '$plan.slug', count: 1 } },
        ]),

        // Revenue this month
        Payment.aggregate([
            { $match: { paidAt: { $gte: startOfMonth }, status: { $in: ['completed', 'trial'] } } },
            { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
        ]),

        // Revenue this year
        Payment.aggregate([
            { $match: { paidAt: { $gte: startOfYear }, status: { $in: ['completed', 'trial'] } } },
            { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
        ]),

        // Revenue all time
        Payment.aggregate([
            { $match: { status: { $in: ['completed'] } } },
            { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
        ]),

        // New tenants today
        Tenant.countDocuments({ createdAt: { $gte: new Date(now.setHours(0, 0, 0, 0)) } }),

        // New tenants this month
        Tenant.countDocuments({ createdAt: { $gte: startOfMonth } }),

        // Monthly tenant trend (last 12 months)
        Tenant.aggregate([
            { $match: { createdAt: { $gte: new Date(now.getFullYear() - 1, now.getMonth(), 1) } } },
            { $group: { _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } }, count: { $sum: 1 } } },
            { $sort: { '_id.year': 1, '_id.month': 1 } },
        ]),

        // Monthly revenue trend (last 12 months)
        Payment.aggregate([
            { $match: { paidAt: { $gte: new Date(now.getFullYear() - 1, now.getMonth(), 1) }, status: 'completed' } },
            { $group: { _id: { year: { $year: '$paidAt' }, month: { $month: '$paidAt' } }, total: { $sum: '$amount' }, count: { $sum: 1 } } },
            { $sort: { '_id.year': 1, '_id.month': 1 } },
        ]),
    ]);

    // Fetch cross-service counts (users, leads, calls) via internal APIs
    let totalUsers = 0, totalLeads = 0, totalCalls = 0;
    try {
        const usersPath = '/internal/users/count';
        const leadsPath = '/internal/leads/count';
        const callsPath = '/internal/calls/count';
        const [usersRes, leadsRes, callsRes] = await Promise.allSettled([
            axios.get(`${env.SERVICES.AUTH}${usersPath}`, {
                headers: internalServiceHeaders('auth-service', 'GET', usersPath),
            }),
            axios.get(`${env.SERVICES.LEAD}${leadsPath}`, {
                headers: internalServiceHeaders('lead-service', 'GET', leadsPath),
            }),
            axios.get(`${env.SERVICES.CALL}${callsPath}`, {
                headers: internalServiceHeaders('call-service', 'GET', callsPath),
            }),
        ]);
        if (usersRes.status === 'fulfilled') totalUsers = usersRes.value?.data?.data?.count || 0;
        if (leadsRes.status === 'fulfilled') totalLeads = leadsRes.value?.data?.data?.count || 0;
        if (callsRes.status === 'fulfilled') totalCalls = callsRes.value?.data?.data?.count || 0;
    } catch { /* silently ignore */ }

    // Build status map
    const statusMap = {};
    statusAgg.forEach(s => { statusMap[s._id] = s.count; });

    ApiResponse.success(res, {
        kpis: {
            totalTenants,
            activeTenants: statusMap.active || 0,
            trialTenants: statusMap.trial || 0,
            suspendedTenants: statusMap.suspended || 0,
            cancelledTenants: statusMap.cancelled || 0,
            freeTenants: statusMap.free || 0,
            totalUsers,
            totalLeads,
            totalCalls,
            newTenantsToday,
            newTenantsThisMonth,
            revenueThisMonth: revenueMonthly[0]?.total || 0,
            revenueThisYear: revenueYearly[0]?.total || 0,
            revenueAllTime: revenueAllTime[0]?.total || 0,
            paymentsThisMonth: revenueMonthly[0]?.count || 0,
        },
        charts: {
            planDistribution: planAgg,
            tenantsByStatus: statusAgg,
            monthlyTenantTrend,
            monthlyRevenueTrend,
        },
    }, 'Owner dashboard data fetched');
});

// ══════════════════════════════════════════
// TENANT MANAGEMENT
// ══════════════════════════════════════════

/**
 * GET /api/owner/tenants
 * List all tenants (paginated, searchable, filterable)
 */
const listTenants = asyncHandler(async (req, res) => {
    const { page, limit } = parsePagination(req.query, 20);
    const search = req.query.search || '';
    const status = req.query.status || '';
    const planId = req.query.planId || '';
    const allowedSorts = new Set(['createdAt', '-createdAt', 'companyName', '-companyName', 'status', '-status']);
    const sort = allowedSorts.has(req.query.sort) ? req.query.sort : '-createdAt';

    const filter = {};
    if (search) {
        const literalSearch = escapeRegex(search);
        filter.$or = [
            { companyName: { $regex: literalSearch, $options: 'i' } },
            { email: { $regex: literalSearch, $options: 'i' } },
            { slug: { $regex: literalSearch, $options: 'i' } },
        ];
    }
    if (status) filter.status = status;
    if (planId) filter.planId = planId;

    const [tenants, total] = await Promise.all([
        Tenant.find(filter)
            .populate('planId', 'name slug price')
            .sort(sort)
            .skip((page - 1) * limit)
            .limit(limit)
            .lean(),
        Tenant.countDocuments(filter),
    ]);

    ApiResponse.success(res, {
        tenants,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    }, 'Tenants list fetched');
});

/**
 * GET /api/owner/tenants/:id
 * Full tenant detail with user/lead/call counts
 */
const getTenantDetail = asyncHandler(async (req, res) => {
    const tenant = await Tenant.findById(req.params.id)
        .populate('planId')
        .lean();
    if (!tenant) throw ApiError.notFound('Tenant not found');

    // Fetch user count and users for this tenant
    let users = [], userCount = 0;
    try {
        const tenantQuery = encodeURIComponent(String(tenant._id));
        const path = `/internal/users?tenantId=${tenantQuery}`;
        const usersRes = await axios.get(`${env.SERVICES.AUTH}${path}`, {
            headers: internalServiceHeaders('auth-service', 'GET', path, {
                tenantId: String(tenant._id),
            }),
        });
        if (usersRes.data.success) {
            users = usersRes.data.data || [];
            userCount = users.length;
        }
    } catch { /* silently ignore */ }

    // Fetch other counts (leads, calls, meetings) in parallel
    let leadCount = 0, callCount = 0, meetingCount = 0;
    try {
        const tenantQuery = encodeURIComponent(String(tenant._id));
        const leadsPath = `/internal/leads/count?tenantId=${tenantQuery}`;
        const callsPath = `/internal/calls/count?tenantId=${tenantQuery}`;
        const meetingsPath = `/internal/meetings/count?tenantId=${tenantQuery}`;
        const identity = { tenantId: String(tenant._id) };
        const [leadsRes, callsRes, meetingsRes] = await Promise.allSettled([
            axios.get(`${env.SERVICES.LEAD}${leadsPath}`, {
                headers: internalServiceHeaders('lead-service', 'GET', leadsPath, identity),
            }),
            axios.get(`${env.SERVICES.CALL}${callsPath}`, {
                headers: internalServiceHeaders('call-service', 'GET', callsPath, identity),
            }),
            axios.get(`${env.SERVICES.MEETING}${meetingsPath}`, {
                headers: internalServiceHeaders('meeting-service', 'GET', meetingsPath, identity),
            }),
        ]);
        if (leadsRes.status === 'fulfilled') leadCount = leadsRes.value?.data?.data?.count || 0;
        if (callsRes.status === 'fulfilled') callCount = callsRes.value?.data?.data?.count || 0;
        if (meetingsRes.status === 'fulfilled') meetingCount = meetingsRes.value?.data?.data?.count || 0;
    } catch { /* silently ignore */ }

    // Fetch payment history
    const payments = await Payment.find({ tenantId: tenant._id })
        .sort({ 'meta.createdAt': -1 })
        .limit(50)
        .lean();

    ApiResponse.success(res, {
        tenant,
        users,
        userCount,
        leadCount,
        callCount,
        meetingCount,
        payments,
    }, 'Tenant detail fetched');
});

/**
 * PUT /api/owner/tenants/:id/plan
 * Change a tenant's plan
 */
const updateTenantPlan = asyncHandler(async (req, res) => {
    const { planId, billingCycle } = req.body;
    const tenant = await Tenant.findById(req.params.id);
    if (!tenant) throw ApiError.notFound('Tenant not found');

    const plan = await Plan.findById(planId);
    if (!plan) throw ApiError.notFound('Plan not found');

    tenant.planId = plan._id;
    if (billingCycle) tenant.billingCycle = billingCycle;

    // If moving from trial to active
    if (tenant.status === 'trial') {
        tenant.status = 'active';
        tenant.trialStatus = 'converted';
    }

    await tenant.save();
    await invalidateTenantCaches(tenant._id);

    ApiResponse.success(res, tenant, `Tenant plan updated to ${plan.name}`);
});

/**
 * PUT /api/owner/tenants/:id/status
 * Suspend or activate a tenant
 */
const updateTenantStatus = asyncHandler(async (req, res) => {
    const { status, reason } = req.body;
    if (!['active', 'suspended', 'cancelled', 'trial', 'free'].includes(status)) {
        throw ApiError.badRequest('Invalid status');
    }

    const tenant = await Tenant.findById(req.params.id);
    if (!tenant) throw ApiError.notFound('Tenant not found');

    tenant.status = status;
    if (status === 'suspended') {
        tenant.suspendedReason = reason || 'Suspended by owner';
    } else {
        tenant.suspendedReason = null;
    }
    await tenant.save();
    await invalidateTenantCaches(tenant._id);

    ApiResponse.success(res, tenant, `Tenant ${status === 'suspended' ? 'suspended' : 'activated'} successfully`);
});

/**
 * PUT /api/owner/tenants/:id/calling
 * Assign an Exotel virtual number to a tenant and enable/disable calling.
 * Body: { exotelVirtualNumber: "08068XXXXXX", callingEnabled: true }
 *
 * This is the ONLY place calling is configured for a tenant.
 * Tenants have no calling settings in their own panel.
 */
const updateTenantCalling = asyncHandler(async (req, res) => {
    const { exotelVirtualNumber, callingEnabled } = req.body;

    const tenant = await Tenant.findById(req.params.id);
    if (!tenant) throw ApiError.notFound('Tenant not found');

    if (exotelVirtualNumber !== undefined) {
        tenant.calling.exotelVirtualNumber = exotelVirtualNumber || null;
    }
    if (typeof callingEnabled === 'boolean') {
        tenant.calling.callingEnabled = callingEnabled;
    }

    await tenant.save();

    // Bust the API Gateway tenant cache so featureGuard / tenantResolver picks up the change immediately
    await invalidateTenantCaches(tenant._id);

    ApiResponse.success(res, {
        tenantId: tenant._id,
        exotelVirtualNumber: tenant.calling.exotelVirtualNumber,
        callingEnabled: tenant.calling.callingEnabled,
    }, 'Tenant calling configuration updated');
});

/**
 * PUT /api/owner/tenants/:id/payment-methods
 * Configure the payment methods available to a tenant.
 * Body: { methods: [{ type, provider, enabled }] }
 */
const updateTenantPaymentMethods = asyncHandler(async (req, res) => {
    const { methods } = req.body;
    if (!Array.isArray(methods)) {
        throw ApiError.badRequest('methods must be an array');
    }

    const paymentMethods = new Map();
    for (const method of methods) {
        if (!method || typeof method !== 'object' || Array.isArray(method)) {
            throw ApiError.badRequest('Each payment method must be an object');
        }

        const { type, provider, enabled = true } = method;
        if (!PAYMENT_METHOD_PROVIDERS[type]?.has(provider)) {
            throw ApiError.badRequest(`Invalid payment method combination: ${type}/${provider}`);
        }
        if (typeof enabled !== 'boolean') {
            throw ApiError.badRequest('Payment method enabled must be a boolean');
        }

        paymentMethods.set(`${type}:${provider}`, { type, provider, enabled });
    }

    const tenant = await Tenant.findById(req.params.id);
    if (!tenant) throw ApiError.notFound('Tenant not found');

    tenant.paymentMethodsConfigured = true;
    tenant.paymentMethods = [...paymentMethods.values()];
    await tenant.save();
    await invalidateTenantCaches(tenant._id);

    ApiResponse.success(res, {
        paymentMethodsConfigured: tenant.paymentMethodsConfigured,
        paymentMethods: tenant.paymentMethods,
    }, 'Tenant payment methods updated');
});

/**
 * PUT /api/owner/users/:id/status
 * Suspend or activate a user (cross-service via auth-service)
 */
const updateUserStatus = asyncHandler(async (req, res) => {
    const { isActive } = req.body;
    try {
        const path = `/internal/users/${encodeURIComponent(req.params.id)}/status`;
        const result = await axios.put(`${env.SERVICES.AUTH}${path}`, {
            isActive: Boolean(isActive),
        }, {
            headers: internalServiceHeaders('auth-service', 'PUT', path),
        });
        ApiResponse.success(res, result.data?.data, `User ${isActive ? 'activated' : 'suspended'} successfully`);
    } catch (err) {
        throw ApiError.internal(err?.response?.data?.message || 'Failed to update user status');
    }
});

// ══════════════════════════════════════════
// PLAN MANAGEMENT
// ══════════════════════════════════════════

/**
 * GET /api/owner/plans
 * All plans (including inactive)
 */
const listPlans = asyncHandler(async (req, res) => {
    const plans = await Plan.find().sort({ sortOrder: 1, 'meta.createdAt': 1 }).lean();
    ApiResponse.success(res, plans, 'Plans fetched');
});

/**
 * POST /api/owner/plans
 * Create a new plan
 */
const createPlan = asyncHandler(async (req, res) => {
    const { name, slug, description, price, yearlyPrice, perUserPrice, currency, features, moduleKeys, limits, isTrial, trialDurationDays, isActive, sortOrder } = req.body;
    if (!name || !slug) throw ApiError.badRequest('Plan name and slug are required');

    const existing = await Plan.findOne({ slug: slug.toLowerCase() });
    if (existing) throw ApiError.conflict('A plan with this slug already exists');

    // Auto-sync: if moduleKeys provided, auto-populate features from them
    const finalModuleKeys = moduleKeys || [];
    const autoFeatures = moduleKeysToFeatures(finalModuleKeys);
    // Merge: auto-generated features + any explicitly provided features
    const finalFeatures = [...new Set([...autoFeatures, ...(features || [])])];

    const plan = await Plan.create({
        name, slug: slug.toLowerCase(), description, price: price || 0,
        yearlyPrice: yearlyPrice || 0, perUserPrice: perUserPrice || 0,
        currency: currency || 'INR', features: finalFeatures,
        moduleKeys: finalModuleKeys,
        limits: limits || {}, isTrial: isTrial || false,
        trialDurationDays: trialDurationDays || 30,
        isActive: isActive !== false, sortOrder: sortOrder || 0,
    });

    ApiResponse.created(res, plan, 'Plan created');
});

/**
 * PUT /api/owner/plans/:id
 */
const updatePlan = asyncHandler(async (req, res) => {
    const plan = await Plan.findById(req.params.id);
    if (!plan) throw ApiError.notFound('Plan not found');

    const fields = ['name', 'slug', 'description', 'price', 'yearlyPrice', 'perUserPrice', 'currency', 'features', 'moduleKeys', 'limits', 'isTrial', 'trialDurationDays', 'isActive', 'sortOrder'];
    fields.forEach(f => { if (req.body[f] !== undefined) plan[f] = req.body[f]; });

    // Auto-sync features from moduleKeys when moduleKeys is updated
    if (req.body.moduleKeys !== undefined) {
        const autoFeatures = moduleKeysToFeatures(plan.moduleKeys);
        // Merge auto-features with any explicitly set features
        plan.features = [...new Set([...autoFeatures, ...(plan.features || [])])];
    }

    await plan.save();

    // Tenant cache entries contain populated plan entitlements.
    const affectedTenantIds = await Tenant.find({ planId: plan._id }).distinct('_id');
    await invalidateTenantCaches(affectedTenantIds);

    ApiResponse.success(res, plan, 'Plan updated');
});

/**
 * DELETE /api/owner/plans/:id
 */
const deletePlan = asyncHandler(async (req, res) => {
    const plan = await Plan.findById(req.params.id);
    if (!plan) throw ApiError.notFound('Plan not found');

    // Check if any tenants are using this plan
    const tenantCount = await Tenant.countDocuments({ planId: plan._id });
    if (tenantCount > 0) {
        throw ApiError.badRequest(`Cannot delete — ${tenantCount} tenant(s) are using this plan. Deactivate it instead.`);
    }

    await plan.deleteOne();
    ApiResponse.success(res, null, 'Plan deleted');
});

// ══════════════════════════════════════════
// REVENUE
// ══════════════════════════════════════════

/**
 * GET /api/owner/revenue
 * Revenue analytics with breakdown
 */
const getRevenue = asyncHandler(async (req, res) => {
    const { page, limit } = parsePagination(req.query, 30);
    const status = req.query.status || '';

    const filter = {};
    if (status) filter.status = status;

    // Revenue by plan
    const revenueByPlan = await Payment.aggregate([
        { $match: { status: 'completed' } },
        { $group: { _id: '$planName', total: { $sum: '$amount' }, count: { $sum: 1 } } },
        { $sort: { total: -1 } },
    ]);

    // All payments (paginated)
    const [payments, total] = await Promise.all([
        Payment.find(filter)
            .populate('tenantId', 'companyName email slug')
            .sort({ 'meta.createdAt': -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean(),
        Payment.countDocuments(filter),
    ]);

    ApiResponse.success(res, {
        revenueByPlan,
        payments,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    }, 'Revenue data fetched');
});

// ══════════════════════════════════════════
// COMMUNICATION CONFIG (GLOBAL)
// ══════════════════════════════════════════

// Credential keys that must be encrypted before storage
const SENSITIVE_KEYS = [
    'appSecret', 'accessToken', 'webhookVerifyToken',
    'apiKey', 'apiToken', 'authToken',
];

const validateExotelHost = (value) => {
    const host = String(value || 'api.exotel.com').trim().toLowerCase();
    if (!/^(?:[a-z0-9-]+\.)*exotel\.com$/.test(host)) {
        throw ApiError.badRequest('Invalid Exotel API host');
    }
    return host;
};

/**
 * GET /api/owner/communication-configs
 * List all global communication configs (whatsapp + calling)
 */
const getCommunicationConfigs = asyncHandler(async (req, res) => {
    const configs = await CommunicationConfig.find().lean();

    // Sanitize sensitive credential values — show masked versions
    const sanitized = configs.map(config => {
        const cred = config.credentials || {};
        const safe = {};
        for (const [key, val] of Object.entries(cred)) {
            if (SENSITIVE_KEYS.includes(key) && val) {
                safe[key] = '••••••••';
            } else {
                safe[key] = val;
            }
        }
        return { ...config, credentials: safe };
    });

    ApiResponse.success(res, sanitized, 'Communication configs fetched');
});

/**
 * PUT /api/owner/communication-configs/:type
 * Update or create a global communication config.
 * Type = 'whatsapp' | 'calling'
 */
const updateCommunicationConfig = asyncHandler(async (req, res) => {
    const { type } = req.params;
    if (!['whatsapp', 'calling'].includes(type)) {
        throw ApiError.badRequest('Invalid config type. Must be whatsapp or calling.');
    }

    const { provider, isActive, displayName, credentials } = req.body;
    if (!provider) throw ApiError.badRequest('Provider is required');

    // Validate provider for type
    if (type === 'whatsapp' && provider !== 'meta') {
        throw ApiError.badRequest('WhatsApp only supports meta provider');
    }
    if (type === 'calling' && !['exotel', 'twilio'].includes(provider)) {
        throw ApiError.badRequest('Calling supports exotel or twilio provider');
    }

    let config = await CommunicationConfig.findOne({ type });
    if (!config) {
        config = new CommunicationConfig({ type, provider });
    }

    config.provider = provider;
    if (typeof isActive === 'boolean') config.isActive = isActive;
    if (displayName !== undefined) config.displayName = displayName;

    // Encrypt sensitive credentials before storing
    if (credentials && typeof credentials === 'object') {
        for (const [key, value] of Object.entries(credentials)) {
            if (!value || value === '••••••••') continue; // Skip masked/empty values
            if (key === 'subdomain' && type === 'calling' && provider === 'exotel') {
                config.credentials.set(key, validateExotelHost(value));
            } else if (SENSITIVE_KEYS.includes(key)) {
                config.credentials.set(key, encrypt(value));
            } else {
                config.credentials.set(key, value);
            }
        }
    }

    config.testStatus = 'untested';
    config.testMessage = '';
    await config.save();

    // Return sanitized response
    const safe = {};
    for (const [key, val] of config.credentials.entries()) {
        safe[key] = SENSITIVE_KEYS.includes(key) ? '••••••••' : val;
    }

    ApiResponse.success(res, { ...config.toObject(), credentials: safe }, `${type} config updated`);
});

/**
 * POST /api/owner/communication-configs/:type/test
 * Test connection for a communication config
 */
const testCommunicationConfig = asyncHandler(async (req, res) => {
    const { type } = req.params;
    if (!['whatsapp', 'calling'].includes(type)) {
        throw ApiError.badRequest('Invalid config type');
    }

    const config = await CommunicationConfig.findOne({ type });
    if (!config) throw ApiError.notFound(`No ${type} config found. Save credentials first.`);

    try {
        if (type === 'whatsapp' && config.provider === 'meta') {
            // Test Meta WhatsApp Cloud API connection
            const accessToken = decrypt(config.credentials.get('accessToken'));
            const phoneNumberId = config.credentials.get('phoneNumberId');

            if (!accessToken || !phoneNumberId) {
                throw new Error('Access Token and Phone Number ID are required');
            }
            if (!/^\d+$/.test(String(phoneNumberId))) {
                throw new Error('Phone Number ID is invalid');
            }

            const metaRes = await axios.get(
                `https://graph.facebook.com/v21.0/${phoneNumberId}`,
                { headers: { Authorization: `Bearer ${accessToken}` }, timeout: 10000 }
            );

            config.testStatus = 'success';
            config.testMessage = `Connected! Phone: ${metaRes.data.display_phone_number || phoneNumberId}`;
        } else if (type === 'calling') {
            if (config.provider === 'exotel') {
                const apiKey = decrypt(config.credentials.get('apiKey'));
                const apiToken = decrypt(config.credentials.get('apiToken'));
                const sid = config.credentials.get('sid');
                const subdomain = validateExotelHost(config.credentials.get('subdomain'));

                if (!apiKey || !apiToken || !sid) {
                    throw new Error('API Key, API Token, and SID are required');
                }
                if (!/^[a-z0-9_-]+$/i.test(String(sid))) {
                    throw new Error('Exotel SID is invalid');
                }

                await axios.get(
                    `https://${subdomain}/v1/Accounts/${sid}`,
                    { auth: { username: apiKey, password: apiToken }, timeout: 10000 }
                );

                config.testStatus = 'success';
                config.testMessage = `Connected to Exotel account: ${sid}`;
            } else if (config.provider === 'twilio') {
                const accountSid = config.credentials.get('accountSid');
                const authToken = decrypt(config.credentials.get('authToken'));

                if (!accountSid || !authToken) {
                    throw new Error('Account SID and Auth Token are required');
                }

                const twilioRes = await axios.get(
                    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`,
                    { auth: { username: accountSid, password: authToken }, timeout: 10000 }
                );

                config.testStatus = 'success';
                config.testMessage = `Connected to Twilio: ${twilioRes.data.friendly_name || accountSid}`;
            }
        }
    } catch (err) {
        config.testStatus = 'failed';
        config.testMessage = err.response?.data?.error?.message || err.message || 'Connection test failed';
    }

    config.lastTestedAt = new Date();
    await config.save();

    ApiResponse.success(res, {
        testStatus: config.testStatus,
        testMessage: config.testMessage,
        lastTestedAt: config.lastTestedAt,
    }, `Test ${config.testStatus}`);
});

// ══════════════════════════════════════════
// TENANT IMPERSONATION
// ══════════════════════════════════════════

const Branch = require('../models/Branch');
const { signImpersonationToken } = require('../utils/impersonationToken');

/**
 * POST /api/owner/impersonate/:tenantId
 * Generate a temporary superadmin JWT scoped to the target tenant.
 * This lets the owner use all existing tenant APIs without modification.
 */
const impersonateTenant = asyncHandler(async (req, res) => {
    const { tenantId } = req.params;

    const tenant = await Tenant.findById(tenantId).populate('planId').lean();
    if (!tenant) throw ApiError.notFound('Tenant not found');

    // Find the default branch for this tenant
    let defaultBranch = await Branch.findOne({ tenantId, isDefault: true }).lean();
    if (!defaultBranch) {
        // Fallback: get any branch for this tenant
        defaultBranch = await Branch.findOne({ tenantId }).lean();
    }

    const ownerId = req.headers['x-user-id'];

    // Generate impersonation JWT — looks like a superadmin
    const payload = {
        userId: ownerId,
        role: ROLES.SUPER_ADMIN,
        email: req.headers['x-user-email'] || 'owner@sparkcrm.com',
        tenantId: tenant._id.toString(),
        branchId: defaultBranch?._id?.toString() || '',
        roleId: '',
        isImpersonating: true,
        originalRole: 'owner',
    };

    const token = signImpersonationToken(payload);

    ApiResponse.success(res, {
        token,
        tenant: {
            _id: tenant._id,
            companyName: tenant.companyName,
            slug: tenant.slug,
            email: tenant.email,
            status: tenant.status,
            plan: tenant.planId,
        },
        branchId: defaultBranch?._id || '',
    }, `Impersonating tenant: ${tenant.companyName}`);
});

/**
 * PUT /api/owner/tenants/:id/features
 * Owner grants or removes extra features/modules for a tenant.
 * Body: { extraFeatures: [...], extraModuleKeys: [...] }
 * If extraModuleKeys provided, auto-populates extraFeatures from them.
 */
const updateTenantFeatures = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { extraFeatures, extraModuleKeys } = req.body;

    const tenant = await Tenant.findById(id).populate('planId', 'features moduleKeys name');
    if (!tenant) throw ApiError.notFound('Tenant not found');

    // Update extraModuleKeys if provided
    if (Array.isArray(extraModuleKeys)) {
        tenant.extraModuleKeys = extraModuleKeys;
        // Auto-sync: generate feature slugs from module keys
        const autoFeatures = moduleKeysToFeatures(extraModuleKeys);
        tenant.extraFeatures = [...new Set([...autoFeatures, ...(extraFeatures || tenant.extraFeatures || [])])];
    } else if (Array.isArray(extraFeatures)) {
        tenant.extraFeatures = extraFeatures;
    } else {
        throw ApiError.badRequest('extraFeatures or extraModuleKeys must be an array');
    }

    await tenant.save();
    await invalidateTenantCaches(tenant._id);

    const planFeatures = tenant.planId?.features || [];
    const planModuleKeys = tenant.planId?.moduleKeys || [];
    const allFeatures = [...new Set([...planFeatures, ...tenant.extraFeatures])];
    const allModuleKeys = [...new Set([...planModuleKeys, ...tenant.extraModuleKeys])];

    ApiResponse.success(res, {
        extraFeatures: tenant.extraFeatures,
        extraModuleKeys: tenant.extraModuleKeys,
        planFeatures,
        planModuleKeys,
        totalAllowedFeatures: allFeatures,
        totalAllowedModuleKeys: allModuleKeys,
    }, 'Tenant features updated');
});

module.exports = {
    getDashboard,
    listTenants,
    getTenantDetail,
    updateTenantStatus,
    updateTenantCalling,
    updateTenantPaymentMethods,
    updateUserStatus,
    listPlans,
    createPlan,
    updatePlan,
    deletePlan,
    getRevenue,
    getCommunicationConfigs,
    updateCommunicationConfig,
    testCommunicationConfig,
    updateTenantPlan,
    impersonateTenant,
    updateTenantFeatures,
};
