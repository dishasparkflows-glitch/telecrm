const Role = require('../models/Role');
const { ApiResponse, ApiError, asyncHandler } = require('@sparkcrm/shared-utils');
const { getPermissionModuleKeys, ALL_ACTIONS } = require('../helpers/seedDefaults');

/**
 * POST /api/roles
 * Create a new role for the tenant
 */
const createRole = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const userId = req.headers['x-user-id'];
    const { name, description, permissions, isDefault } = req.body;

    if (!name) throw ApiError.badRequest('Role name is required');

    // Auto-generate slug
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    // Check duplicate
    const existing = await Role.findOne({ tenantId, slug });
    if (existing) throw ApiError.conflict('A role with this name already exists');

    const role = await Role.create({
        tenantId,
        name,
        slug,
        description: description || '',
        isSystem: false,
        isDefault: isDefault || false,
        permissions: permissions || [],
        createdBy: userId,
    });

    ApiResponse.created(res, role, 'Role created successfully');
});

/**
 * GET /api/roles
 * List all roles for the tenant
 */
const listRoles = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];

    const roles = await Role.find({ tenantId, isActive: true }).sort({ isSystem: -1, name: 1 });

    // Count users per role (we can't query auth-service from here, so we return roles only)
    ApiResponse.success(res, roles, 'Roles fetched');
});

/**
 * GET /api/roles/compact
 * List lightweight roles for dropdowns
 */
const getCompactRoles = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];

    const roles = await Role.find({ tenantId, isActive: true })
        .select('_id tenantId name slug isDefault')
        .sort({ isSystem: -1, name: 1 })
        .lean();

    ApiResponse.success(res, roles, 'Compact roles fetched');
});

/**
 * GET /api/roles/:id
 * Get a single role with full permissions
 */
const getRole = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const { id } = req.params;

    const role = await Role.findOne({ _id: id, tenantId });
    if (!role) throw ApiError.notFound('Role not found');

    ApiResponse.success(res, role, 'Role fetched');
});

/**
 * PUT /api/roles/:id
 * Update role name, description, or default status
 */
const updateRole = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const { id } = req.params;
    const { name, description, isDefault } = req.body;

    const role = await Role.findOne({ _id: id, tenantId });
    if (!role) throw ApiError.notFound('Role not found');

    if (name !== undefined) {
        role.name = name;
        role.slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    }
    if (description !== undefined) role.description = description;
    if (isDefault !== undefined) role.isDefault = isDefault;

    await role.save();
    ApiResponse.success(res, role, 'Role updated');
});

/**
 * PUT /api/roles/:id/permissions
 * Update permissions for a role
 */
const updatePermissions = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const { id } = req.params;
    const { permissions } = req.body;

    if (!Array.isArray(permissions)) {
        throw ApiError.badRequest('Permissions must be an array of { moduleKey, actions }');
    }

    const role = await Role.findOne({ _id: id, tenantId });
    if (!role) throw ApiError.notFound('Role not found');

    // System super-admin role cannot have permissions reduced
    if (role.slug === 'super-admin' && role.isSystem) {
        throw ApiError.forbidden('Cannot modify Super Admin permissions');
    }

    role.permissions = permissions;
    await role.save();

    ApiResponse.success(res, role, 'Permissions updated');
});

/**
 * DELETE /api/roles/:id
 * Soft-delete a role (cannot delete system roles)
 */
const deleteRole = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const { id } = req.params;

    const role = await Role.findOne({ _id: id, tenantId });
    if (!role) throw ApiError.notFound('Role not found');
    if (role.isSystem) throw ApiError.forbidden('Cannot delete system roles');

    role.isActive = false;
    await role.save();

    ApiResponse.success(res, null, 'Role deleted');
});

/**
 * GET /api/roles/available-modules
 * Returns list of all module keys that can have permissions assigned
 */
const getAvailableModules = asyncHandler(async (req, res) => {
    const moduleKeys = getPermissionModuleKeys();
    ApiResponse.success(res, moduleKeys, 'Available modules for permissions');
});

module.exports = {
    createRole,
    listRoles,
    getCompactRoles,
    getRole,
    updateRole,
    updatePermissions,
    deleteRole,
    getAvailableModules,
};
