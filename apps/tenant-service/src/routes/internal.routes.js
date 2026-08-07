const express = require('express');
const router = express.Router();
const { asyncHandler } = require('@sparkcrm/shared-utils');
const trialService = require('../services/trial.service');
const Tenant = require('../models/Tenant');
const Role = require('../models/Role');
const Module = require('../models/Module');
const Branch = require('../models/Branch');
const { seedTenantDefaults } = require('../helpers/seedDefaults');
const { filterModulesForTenantPlan } = require('../utils/moduleAccess');


/**
 * POST /internal/tenants
 * Internal endpoint for auth-service to create a new tenant
 * This is NOT exposed through the API gateway — only for service-to-service calls
 */
router.post(
    '/tenants',
    asyncHandler(async (req, res) => {
        const { companyName, email, phone, referralCode, planSlug } = req.body;

        const tenant = await trialService.createTenantWithTrial({
            companyName,
            email,
            phone,
            referralCode,
            planSlug,
        });

        // Seed default roles, modules, and branches for the new tenant
        const { superAdminRoleId, defaultBranchId } = await seedTenantDefaults(tenant._id);

        // NOTE: Demo data seeding disabled — no default leads, calls, forms, etc.
        // Only system defaults (roles, modules, branches) are created via seedTenantDefaults above.

        res.status(201).json({
            success: true,
            data: {
                ...tenant.toObject(),
                superAdminRoleId,
                defaultBranchId,
            },
        });
    })
);

/**
 * GET /internal/tenants/:id
 * Internal endpoint for API Gateway's tenantResolver middleware
 * Returns full tenant data with populated plan
 */
router.get(
    '/tenants/:id',
    asyncHandler(async (req, res) => {
        const tenant = await Tenant.findById(req.params.id).populate('planId');
        if (!tenant) {
            return res.status(404).json({ success: false, message: 'Tenant not found' });
        }
        res.json({ success: true, data: tenant });
    })
);

/**
 * POST /internal/tenants/:tenantId/force-upgrade
 * Synchronous internal endpoint for billing-service to immediately apply a plan after payment
 */
router.post(
    '/tenants/:tenantId/force-upgrade',
    asyncHandler(async (req, res) => {
        const { planId } = req.body;
        const tenant = await Tenant.findById(req.params.tenantId);
        if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found' });

        tenant.planId = planId;
        tenant.status = 'active';
        if (tenant.trialStatus === 'active') {
            tenant.trialStatus = 'converted';
            tenant.trialConvertedAt = new Date();
        }
        await tenant.save();

        // Invalidate API Gateway's tenant cache so featureGuard picks up the new plan immediately
        try {
            const { getRedisClient, isRedisReady } = require('@sparkcrm/shared-config');
            if (isRedisReady()) {
                await getRedisClient().del(`tenant:${req.params.tenantId}`);
                console.log(`🗑️  [force-upgrade] Cleared gateway tenant cache: ${req.params.tenantId}`);
            }
        } catch (err) {
            console.warn('⚠️  [force-upgrade] Could not clear tenant cache (non-blocking):', err.message);
        }

        // Populate plan so billing-service can return updated data to frontend
        await tenant.populate('planId');

        res.json({ success: true, data: tenant });
    })
);

/**
 * GET /internal/roles/:roleId
 * Internal endpoint for API Gateway to fetch a user's role permissions
 * Used by the new permission-based RBAC middleware
 */
router.get(
    '/roles/:roleId',
    asyncHandler(async (req, res) => {
        const role = await Role.findById(req.params.roleId);
        if (!role) {
            return res.status(404).json({ success: false, message: 'Role not found' });
        }
        res.json({
            success: true,
            data: {
                _id: role._id,
                tenantId: role.tenantId,
                slug: role.slug,
                name: role.name,
                isSystem: role.isSystem,
                permissions: role.toPermissionMap(),
            },
        });
    })
);

/**
 * GET /internal/modules/:tenantId
 * Internal endpoint to fetch active modules for a tenant, filtered by plan.
 * Uses plan.moduleKeys + tenant.extraModuleKeys for filtering.
 * Falls back to plan.features + module.requiredFeature if moduleKeys not set.
 */
router.get(
    '/modules/:tenantId',
    asyncHandler(async (req, res) => {
        const tenantId = req.params.tenantId;

        let modules = await Module.find({
            tenantId,
            isActive: true,
        }).sort({ section: 1, order: 1 });

        // Plan-based filtering
        const tenant = await Tenant.findById(tenantId).populate('planId', 'features moduleKeys');
        modules = filterModulesForTenantPlan(modules, tenant);

        res.json({ success: true, data: modules });
    })
);

/**
 * GET /internal/branches/:tenantId
 * Internal endpoint to fetch all branches for a tenant
 * Used by auth-service to return branches on login
 */
router.get(
    '/branches/:tenantId',
    asyncHandler(async (req, res) => {
        const branches = await Branch.find({
            tenantId: req.params.tenantId,
            isActive: true,
        }).sort({ isDefault: -1, name: 1 });

        res.json({ success: true, data: branches });
    })
);

/**
 * GET /internal/features/:tenantId
 * Returns tenant's allowed features + moduleKeys (plan + extras),
 * plan info, and subscription status.
 * Used by auth-service to inject features into JWT and login response.
 */
router.get(
    '/features/:tenantId',
    asyncHandler(async (req, res) => {
        const tenant = await Tenant.findById(req.params.tenantId).populate('planId', 'name slug features moduleKeys');
        if (!tenant) {
            return res.status(404).json({ success: false, message: 'Tenant not found' });
        }

        const planFeatures = tenant.planId?.features || [];
        const purchasedFeatures = tenant.purchasedFeatures || []; // now stored as string slugs
        const extraFeatures = tenant.extraFeatures || [];
        const allowedFeatures = [...new Set([...planFeatures, ...purchasedFeatures, ...extraFeatures])];

        const planModuleKeys = tenant.planId?.moduleKeys || [];
        const extraModuleKeys = tenant.extraModuleKeys || [];
        const allowedModuleKeys = [...new Set([...planModuleKeys, ...extraModuleKeys])];

        res.json({
            success: true,
            data: {
                features: allowedFeatures,
                moduleKeys: allowedModuleKeys,
                plan: tenant.planId ? {
                    name: tenant.planId.name,
                    slug: tenant.planId.slug,
                } : null,
                subscription: {
                    status: tenant.status,
                    trialStatus: tenant.trialStatus,
                    trialExpiresAt: tenant.trialExpiresAt,
                    planExpiresAt: tenant.planExpiresAt,
                },
            },
        });
    })
);

/**
 * GET /internal/plans/:slug
 * Internal endpoint for billing-service to fetch plan details by slug
 * Returns plan name, slug, price, yearlyPrice, currency, features, limits
 */
router.get(
    '/plans/:slug',
    asyncHandler(async (req, res) => {
        const Plan = require('../models/Plan');
        const plan = await Plan.findOne({ slug: req.params.slug });
        if (!plan) {
            return res.status(404).json({ success: false, message: 'Plan not found' });
        }
        res.json({ success: true, data: plan });
    })
);

/**
 * GET /internal/communication-config/:type
 * Internal endpoint for whatsapp-service / call-service to fetch active provider config.
 * Type = 'whatsapp' | 'calling'
 */
const CommunicationConfig = require('../models/CommunicationConfig');
const { IntegrationCredential } = require('../models/IntegrationCredential');

router.get(
    '/communication-config/:type',
    asyncHandler(async (req, res) => {
        const { type } = req.params;
        if (!['whatsapp', 'calling'].includes(type)) {
            return res.status(400).json({ success: false, message: 'Invalid config type' });
        }

        const config = await CommunicationConfig.findOne({ type, isActive: true });
        if (!config) {
            return res.status(404).json({ success: false, message: `No active ${type} config found` });
        }

        res.json({ success: true, data: config });
    })
);

/**
 * GET /internal/communication-config/lookup/whatsapp/:phoneNumberId
 * Maps a Meta Cloud API phoneNumberId to the tenantId that owns it.
 *
 * Called by whatsapp-service webhook for EVERY inbound message to route it
 * to the correct tenant. Result is cached in-memory inside whatsapp-service.
 *
 * Flow:
 *   1. Tenant configures WhatsApp via their Integrations panel
 *      → phone_number_id stored in IntegrationCredential
 *   2. Meta sends webhook to single endpoint with phoneNumberId in metadata
 *   3. Webhook calls this endpoint → gets tenantId → stores message in correct DB
 */
router.get(
    '/communication-config/lookup/whatsapp/:phoneNumberId',
    asyncHandler(async (req, res) => {
        const { phoneNumberId } = req.params;

        if (!phoneNumberId) {
            return res.status(400).json({ success: false, message: 'phoneNumberId is required' });
        }

        // IntegrationCredential stores phone_number_id in credentials Map
        // Look for whatsapp provider records across all tenants
        const allWhatsappCreds = await IntegrationCredential.find({
            provider: 'whatsapp',
            isActive: true,
        }).lean();

        let matchedTenantId  = null;
        let matchedBranchId  = null;

        for (const cred of allWhatsappCreds) {
            const credMap = cred.credentials instanceof Map
                ? Object.fromEntries(cred.credentials)
                : cred.credentials;

            // phone_number_id is stored unencrypted (it's not sensitive)
            if (credMap.phone_number_id === phoneNumberId) {
                matchedTenantId = cred.tenantId;
                matchedBranchId = cred.branchId || null;
                break;
            }
        }

        if (!matchedTenantId) {
            return res.status(404).json({
                success: false,
                message: `No tenant configured for phoneNumberId: ${phoneNumberId}`,
            });
        }

        res.json({
            success: true,
            data: {
                tenantId: matchedTenantId,
                branchId: matchedBranchId,
                phoneNumberId,
            },
        });
    })
);

/**
 * GET /internal/integration-config/:tenantId/:provider
 * Returns a tenant's integration credentials for a specific provider.
 * Called by whatsapp-service to fetch per-tenant WhatsApp credentials.
 * Only callable from service-to-service (not through API Gateway).
 *
 * Returns decrypted credentials so the calling service can use them directly.
 */
const { decrypt: decryptCred } = require('../models/IntegrationCredential');

router.get(
    '/integration-config/:tenantId/:provider',
    asyncHandler(async (req, res) => {
        const { tenantId, provider } = req.params;

        const cred = await IntegrationCredential.findOne({
            tenantId,
            provider,
            isActive: true,
        }).lean();

        if (!cred) {
            return res.status(404).json({
                success: false,
                message: `No active ${provider} integration found for tenant`,
            });
        }

        // Decrypt all credential values for the calling service
        const credMap = cred.credentials instanceof Map
            ? Object.fromEntries(cred.credentials)
            : (cred.credentials || {});

        const decrypted = {};
        for (const [key, val] of Object.entries(credMap)) {
            try {
                decrypted[key] = decryptCred(val) || val;
            } catch {
                decrypted[key] = val; // If not encrypted, return as-is
            }
        }

        res.json({
            success: true,
            data: {
                _id: cred._id,
                tenantId: cred.tenantId,
                provider: cred.provider,
                label: cred.label,
                isActive: cred.isActive,
                credentials: decrypted,
                lastTestedAt: cred.lastTestedAt,
                lastTestStatus: cred.lastTestStatus,
            },
        });
    })
);

module.exports = router;
