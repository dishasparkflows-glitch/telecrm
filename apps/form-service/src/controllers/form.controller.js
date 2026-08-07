const { SmartForm, FormSubmission } = require('../models/SmartForm');
const { pickFormWriteInput, requireObjectId, pagination } = require('../utils/formDto');
const { ApiResponse, ApiError, asyncHandler, buildScopeFilter } = require('@sparkcrm/shared-utils');
const { publishEvent, EVENTS } = require('@sparkcrm/shared-events');

const validateSubmission = (form, data) => {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw ApiError.badRequest('Submission data must be an object');
    }
    const fields = form.fields || [];
    const declaredFields = new Map(fields.map((field) => [field.name, field]));

    for (const name of Object.keys(data)) {
        if (!declaredFields.has(name)) throw ApiError.badRequest(`Unknown field: ${name}`);
    }

    const submission = {};
    for (const field of fields) {
        const value = data[field.name];
        if (value === undefined || value === null || value === '') {
            if (field.required) throw ApiError.badRequest(`${field.label || field.name} is required`);
            continue;
        }

        const valid = (() => {
            switch (field.type) {
                case 'email': return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
                case 'number': return typeof value === 'number' && Number.isFinite(value);
                case 'dropdown': return Array.isArray(field.options) && field.options.includes(value);
                case 'checkbox': return typeof value === 'boolean';
                case 'date': return (typeof value === 'string' || value instanceof Date) && !Number.isNaN(new Date(value).getTime());
                default: return typeof value === 'string';
            }
        })();

        if (!valid) throw ApiError.badRequest(`Invalid value for ${field.label || field.name}`);
        submission[field.name] = value;
    }

    return submission;
};

const createForm = asyncHandler(async (req, res) => {
    const scope = buildScopeFilter(req, { ownerField: null, module: 'forms' });
    const formData = pickFormWriteInput(req.body);
    const form = await SmartForm.create({
        ...formData,
        tenantId: scope.tenantId,
        branchId: scope.branchId || null,
    });
    // Generate embed code
    form.embedCode = `<iframe src="${process.env.FRONTEND_URL || 'http://localhost:5173'}/forms/embed/${form._id}" width="100%" height="500" frameborder="0"></iframe>`;
    await form.save();
    ApiResponse.created(res, form, 'Form created');
});

const getForms = asyncHandler(async (req, res) => {
    const { page, limit, skip } = pagination(req.query);
    const filter = buildScopeFilter(req, { ownerField: null, module: 'forms' });
    const [forms, total] = await Promise.all([
        SmartForm.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
        SmartForm.countDocuments(filter),
    ]);
    ApiResponse.paginated(res, forms, { page, limit, total, totalPages: Math.ceil(total / limit) });
});

const getForm = asyncHandler(async (req, res) => {
    const formId = requireObjectId(req.params.id, 'form ID');
    const scope = buildScopeFilter(req, { ownerField: null, module: 'forms' });
    const form = await SmartForm.findOne({ _id: formId, ...scope });
    if (!form) throw ApiError.notFound('Form not found');
    ApiResponse.success(res, form);
});

const updateForm = asyncHandler(async (req, res) => {
    const formId = requireObjectId(req.params.id, 'form ID');
    const scope = buildScopeFilter(req, { ownerField: null, module: 'forms' });
    const changes = pickFormWriteInput(req.body);
    const form = await SmartForm.findOne({ _id: formId, ...scope });
    if (!form) throw ApiError.notFound('Form not found');

    Object.assign(form, changes);
    await form.save();
    ApiResponse.success(res, form, 'Form updated');
});

// PUBLIC endpoint — no auth required
const submitForm = asyncHandler(async (req, res) => {
    const formId = requireObjectId(req.params.id, 'form ID');
    const form = await SmartForm.findOne({ _id: formId, isActive: true });
    if (!form) throw ApiError.notFound('Form not found or inactive');

    const data = validateSubmission(form, req.body);
    const submission = await FormSubmission.create({
        tenantId: form.tenantId,
        branchId: form.branchId,
        formId: form._id,
        data,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
    });

    form.submissionCount += 1;
    await form.save();

    // Publish event → lead-service creates a lead
    await publishEvent(EVENTS.FORM_SUBMITTED, {
        tenantId: form.tenantId,
        branchId: form.branchId,
        formId: form._id,
        submissionId: submission._id,
        data,
        settings: form.settings,
    });

    ApiResponse.success(res, { message: form.settings.successMessage }, 'Form submitted');
});

const getSubmissions = asyncHandler(async (req, res) => {
    const formId = requireObjectId(req.params.id, 'form ID');
    const { page, limit, skip } = pagination(req.query);
    const scopeFilter = buildScopeFilter(req, { ownerField: null, module: 'forms' });

    const formFilter = { _id: formId, ...scopeFilter };
    const form = await SmartForm.findOne(formFilter);
    if (!form) throw ApiError.notFound('Form not found');

    const filter = { tenantId: scopeFilter.tenantId, formId: form._id };
    if (scopeFilter.branchId) filter.branchId = scopeFilter.branchId;

    const [submissions, total] = await Promise.all([
        FormSubmission.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
        FormSubmission.countDocuments(filter),
    ]);

    ApiResponse.paginated(res, submissions, { page, limit, total, totalPages: Math.ceil(total / limit) });
});

const deleteForm = asyncHandler(async (req, res) => {
    const formId = requireObjectId(req.params.id, 'form ID');
    const scope = buildScopeFilter(req, { ownerField: null, module: 'forms' });
    const form = await SmartForm.findOneAndDelete({ _id: formId, ...scope });
    if (!form) throw ApiError.notFound('Form not found');

    // Also delete submissions
    await FormSubmission.deleteMany({ formId: form._id, tenantId: scope.tenantId });

    ApiResponse.success(res, null, 'Form deleted');
});

module.exports = { createForm, getForms, getForm, updateForm, submitForm, getSubmissions, deleteForm, validateSubmission };
