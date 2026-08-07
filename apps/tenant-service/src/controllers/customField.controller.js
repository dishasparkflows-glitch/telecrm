const CustomFieldDefinition = require('../models/CustomFieldDefinition');
const { ApiResponse, ApiError, asyncHandler } = require('@sparkcrm/shared-utils');

/**
 * GET /api/custom-fields
 * Get ALL definitions for the tenant
 */
const getAllDefinitions = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const definitions = await CustomFieldDefinition.find({
        tenantId,
        isActive: true
    }).sort({ order: 1 });
    ApiResponse.success(res, definitions);
});

/**
 * GET /api/custom-fields/:entity
 * Get definitions for a specific entity (Lead, User, etc.)
 */
const getDefinitions = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const { entity } = req.params;

    const definitions = await CustomFieldDefinition.find({
        tenantId,
        entity,
        isActive: true
    }).sort({ order: 1 });

    ApiResponse.success(res, definitions);
});

/**
 * POST /api/tenants/custom-fields
 * Create a new custom field definition
 */
const createDefinition = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    // Accept both frontend format (targetEntity, name as label) and proper format
    const entity = req.body.entity || req.body.targetEntity;
    const label = req.body.label || req.body.name;
    const name = req.body.name ? req.body.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') : '';
    const { type, options, placeholder, defaultValue } = req.body;
    const isRequired = req.body.isRequired || req.body.required || false;

    if (!entity || !label) throw ApiError.badRequest('Entity and label/name are required');

    const definition = await CustomFieldDefinition.create({
        tenantId,
        entity,
        label,
        name,
        type,
        options,
        isRequired,
        placeholder,
        defaultValue,
        order: (await CustomFieldDefinition.countDocuments({ tenantId, entity })) + 1
    });

    ApiResponse.created(res, definition, 'Custom field defined');
});

/**
 * PUT /api/tenants/custom-fields/:id
 * Update a field definition (Renae / Change options)
 */
const updateDefinition = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const definition = await CustomFieldDefinition.findOneAndUpdate(
        { _id: req.params.id, tenantId },
        req.body,
        { new: true, runValidators: true }
    );

    if (!definition) throw ApiError.notFound('Field definition not found');
    ApiResponse.success(res, definition, 'Field updated');
});

/**
 * DELETE /api/tenants/custom-fields/:id
 * Deactivate a field definition
 */
const deleteDefinition = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const definition = await CustomFieldDefinition.findOneAndUpdate(
        { _id: req.params.id, tenantId },
        { isActive: false },
        { new: true }
    );

    if (!definition) throw ApiError.notFound('Field definition not found');
    ApiResponse.success(res, null, 'Field deleted');
});

module.exports = {
    getAllDefinitions,
    getDefinitions,
    createDefinition,
    updateDefinition,
    deleteDefinition
};
