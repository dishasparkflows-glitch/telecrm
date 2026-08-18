const EmailTemplate = require('../models/EmailTemplate');
const { ApiResponse, ApiError, asyncHandler } = require('@sparkcrm/shared-utils');
const { renderEmailTemplate } = require('../services/templateRenderer.service');

const createTemplate = asyncHandler(async (req, res) => {
    const userId = req.headers['x-user-id'];
    const tenantId = req.headers['x-tenant-id'];
    
    const template = await EmailTemplate.create({
        ...req.body,
        tenantId,
        meta: { createdBy: userId, updatedAt: new Date() }
    });
    ApiResponse.created(res, template, 'Email template created');
});

const getTemplates = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const { module, status } = req.query;
    
    const filter = { tenantId };
    if (module) filter.module = module;
    if (status) filter.status = status;

    const templates = await EmailTemplate.find(filter).sort({ 'meta.createdAt': -1 });
    ApiResponse.success(res, templates);
});

const getTemplateById = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const template = await EmailTemplate.findOne({ _id: req.params.id, tenantId });
    if (!template) throw ApiError.notFound('Email template not found');
    ApiResponse.success(res, template);
});

const updateTemplate = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const userId = req.headers['x-user-id'];
    
    const template = await EmailTemplate.findOne({ _id: req.params.id, tenantId });
    if (!template) throw ApiError.notFound('Email template not found');

    Object.assign(template, req.body);
    template.meta.updatedBy = userId;
    template.meta.updatedAt = new Date();
    await template.save();

    ApiResponse.success(res, template, 'Email template updated');
});

const deleteTemplate = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const template = await EmailTemplate.findOneAndDelete({ _id: req.params.id, tenantId });
    if (!template) throw ApiError.notFound('Email template not found');
    
    // Note: We might want to check if any automation rules are using this template before deleting
    // For now, hard delete is implemented. Real-world scenario might prefer soft-delete or checking dependencies.

    ApiResponse.success(res, null, 'Email template deleted');
});

const updateStatus = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const { status } = req.body;
    
    if (!['draft', 'active', 'inactive'].includes(status)) {
        throw ApiError.badRequest('Invalid status');
    }

    const template = await EmailTemplate.findOneAndUpdate(
        { _id: req.params.id, tenantId },
        { status, 'meta.updatedAt': new Date() },
        { new: true }
    );
    if (!template) throw ApiError.notFound('Email template not found');
    
    ApiResponse.success(res, template, 'Email template status updated');
});

const duplicateTemplate = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const userId = req.headers['x-user-id'];
    
    const original = await EmailTemplate.findOne({ _id: req.params.id, tenantId });
    if (!original) throw ApiError.notFound('Email template not found');

    const duplicate = new EmailTemplate({
        ...original.toObject(),
        _id: undefined,
        name: `${original.name} (Copy)`,
        status: 'draft',
        meta: { createdBy: userId, updatedAt: new Date() }
    });
    
    await duplicate.save();
    ApiResponse.created(res, duplicate, 'Email template duplicated');
});

const previewTemplate = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const template = await EmailTemplate.findOne({ _id: req.params.id, tenantId });
    if (!template) throw ApiError.notFound('Email template not found');

    // Mock Context
    const mockContext = {
        lead: {
            firstName: 'Rahul',
            lastName: 'Sharma',
            email: 'rahul@example.com',
            phone: '+919876543210',
            source: 'Website',
            customFields: {
                budget: '10000',
                preferredCity: 'Bangalore'
            }
        },
        user: {
            name: 'Priya Sales',
            email: 'priya@sparkcrm.com',
            phone: '+918888888888'
        },
        company: {
            name: 'SparkCRM Demo',
            email: 'info@sparkcrm.com'
        },
        branch: {
            name: 'Koramangala Branch'
        }
    };

    const rendered = renderEmailTemplate({ template, context: mockContext });
    ApiResponse.success(res, rendered);
});

module.exports = {
    createTemplate,
    getTemplates,
    getTemplateById,
    updateTemplate,
    deleteTemplate,
    updateStatus,
    duplicateTemplate,
    previewTemplate
};
