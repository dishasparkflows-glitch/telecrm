const CustomFieldDefinition = require('../models/CustomFieldDefinition');
const { ApiResponse, ApiError, asyncHandler } = require('@sparkcrm/shared-utils');

/**
 * GET /api/custom-fields
 * Get ALL definitions for the tenant
 */
const getAllDefinitions = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const { entity } = req.query;

    const filter = { tenantId, isActive: true };
    if (entity) {
        filter.entity = entity;
    }

    const definitions = await CustomFieldDefinition.find(filter).sort({ order: 1 });
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
    const name = req.body.apiName ? req.body.apiName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') : 
                 (req.body.name ? req.body.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') : '');
    const { type, options, placeholder, defaultValue, helpText } = req.body;
    const isRequired = req.body.isRequired || req.body.required || false;

    if (!entity || !label) throw ApiError.badRequest('Target Module and Display Label are required');
    if (!name) throw ApiError.badRequest('API Name is required');

    // Duplicate check
    const existing = await CustomFieldDefinition.findOne({ tenantId, entity, name });
    if (existing) throw ApiError.badRequest(`A field with API name '${name}' already exists in the ${entity} module.`);

    // Options validation
    const selectableTypes = ['dropdown', 'multiselect', 'radio'];
    if (selectableTypes.includes(type)) {
        if (!options || !Array.isArray(options) || options.length === 0) {
            throw ApiError.badRequest(`Type ${type} requires at least one option.`);
        }
        const values = options.map(o => o.value);
        if (new Set(values).size !== values.length) {
            throw ApiError.badRequest('Options must have unique values.');
        }
        if (options.some(o => !o.id || !o.label || !o.value)) {
            throw ApiError.badRequest('All options must contain a label and value.');
        }
    }

    const definition = await CustomFieldDefinition.create({
        tenantId,
        entity,
        label,
        name,
        type,
        options: selectableTypes.includes(type) ? options : [],
        isRequired,
        placeholder,
        helpText,
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
    const { type, options } = req.body;
    
    // Options validation
    const selectableTypes = ['dropdown', 'multiselect', 'radio'];
    if (selectableTypes.includes(type)) {
        if (!options || !Array.isArray(options) || options.length === 0) {
            throw ApiError.badRequest(`Type ${type} requires at least one option.`);
        }
        const values = options.map(o => o.value);
        if (new Set(values).size !== values.length) {
            throw ApiError.badRequest('Options must have unique values.');
        }
        if (options.some(o => !o.id || !o.label || !o.value)) {
            throw ApiError.badRequest('All options must contain a label and value.');
        }
    } else if (type) {
        req.body.options = [];
    }

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
 * Hard delete a field definition
 */
const deleteDefinition = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const definition = await CustomFieldDefinition.findOneAndDelete({
        _id: req.params.id,
        tenantId
    });

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
