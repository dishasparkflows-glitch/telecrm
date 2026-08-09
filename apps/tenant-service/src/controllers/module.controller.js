const Module = require('../models/Module');
const Tenant = require('../models/Tenant');
const { ApiResponse, ApiError, asyncHandler } = require('@sparkcrm/shared-utils');
const { filterModulesForTenantPlan } = require('../utils/moduleAccess');

/**
 * GET /api/modules
 * Get active modules for the tenant, filtered by plan features.
 * Modules with requiredFeature=null are always visible.
 * Pass ?all=true to get ALL modules (admin management — no plan filter).
 */
const listModules = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];

    const { all } = req.query;

    const filter = { tenantId };
    if (all !== 'true') filter.isActive = true;

    let modules = await Module.find(filter).sort({ section: 1, order: 1 });

    // Tenant View mirrors the tenant's subscribed plan, including when the
    // Owner is impersonating the tenant. Only the explicit module-management
    // request (?all=true) may retrieve the complete tenant module catalog.
    if (all !== 'true') {
        const tenant = await Tenant.findById(tenantId).populate('subscription.planId', 'features moduleKeys');
        modules = filterModulesForTenantPlan(modules, tenant);
    }

    ApiResponse.success(res, modules, 'Modules fetched');
});

/**
 * POST /api/modules
 * Create a custom module (Super Admin only)
 */
const createModule = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const userId = req.headers['x-user-id'];
    const { key, label, icon, path, parentKey, section, order } = req.body;

    if (!key || !label || !path) {
        throw ApiError.badRequest('key, label, and path are required');
    }

    const existing = await Module.findOne({ tenantId, key: key.toLowerCase() });
    if (existing) throw ApiError.conflict('A module with this key already exists');

    const mod = await Module.create({
        tenantId,
        key: key.toLowerCase(),
        label,
        icon: icon || 'Box',
        path,
        parentKey: parentKey || null,
        section: section || 'MENU',
        order: order ?? 99,
        isSystem: false,
        createdBy: userId,
    });

    ApiResponse.created(res, mod, 'Module created');
});

/**
 * PUT /api/modules/:id
 * Update a module's label, icon, order, or active status
 */
const updateModule = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const { id } = req.params;
    const { label, icon, order, isActive, section } = req.body;

    const mod = await Module.findOne({ _id: id, tenantId });
    if (!mod) throw ApiError.notFound('Module not found');

    if (label !== undefined) mod.label = label;
    if (icon !== undefined) mod.icon = icon;
    if (order !== undefined) mod.order = order;
    if (isActive !== undefined) mod.isActive = isActive;
    if (section !== undefined) mod.section = section;

    await mod.save();
    ApiResponse.success(res, mod, 'Module updated');
});

/**
 * PUT /api/modules/reorder
 * Bulk reorder modules
 * Body: { orders: [{ id: '...', order: 0 }, { id: '...', order: 1 }] }
 */
const reorderModules = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const { orders } = req.body;

    if (!Array.isArray(orders)) {
        throw ApiError.badRequest('orders must be an array of { id, order }');
    }

    const bulkOps = orders.map(({ id, order }) => ({
        updateOne: {
            filter: { _id: id, tenantId },
            update: { order },
        },
    }));

    await Module.bulkWrite(bulkOps);
    ApiResponse.success(res, null, 'Modules reordered');
});

/**
 * DELETE /api/modules/:id
 * Delete a custom module (cannot delete system modules)
 */
const deleteModule = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const { id } = req.params;

    const mod = await Module.findOne({ _id: id, tenantId });
    if (!mod) throw ApiError.notFound('Module not found');
    if (mod.isSystem) throw ApiError.forbidden('Cannot delete system modules');

    await mod.deleteOne();
    ApiResponse.success(res, null, 'Module deleted');
});

module.exports = {
    listModules,
    createModule,
    updateModule,
    reorderModules,
    deleteModule,
};
