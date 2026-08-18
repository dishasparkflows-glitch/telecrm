const mongoose = require('mongoose');
const { SmartForm, FormSubmission } = require('../models/SmartForm');
const { pickFormWriteInput, requireObjectId, pagination } = require('../utils/formDto');
const { ApiResponse, ApiError, asyncHandler, buildScopeFilter, cacheHelper } = require('@sparkcrm/shared-utils');
const { publishEvent, EVENTS } = require('@sparkcrm/shared-events');

const validateSubmission = (form, data) => {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw ApiError.badRequest('Submission data must be an object');
    }
    const fields = form.fields || [];
    // Only collect declared fields, ignore extraneous data
    const submission = {};
    for (const field of fields) {
        let value = data[field.name];
        
        // If field was conditional and hidden, it might not be sent. Skip validation if not required.
        // Wait, if it's required BUT hidden by showIf, it shouldn't be required. 
        // We evaluate showIf based on data.
        if (field.showIf && field.showIf.field) {
            const dependValue = data[field.showIf.field];
            let shouldShow = true;
            if (field.showIf.operator === 'equals') shouldShow = dependValue === field.showIf.value;
            else if (field.showIf.operator === 'not_equals') shouldShow = dependValue !== field.showIf.value;
            else if (field.showIf.operator === 'contains') shouldShow = String(dependValue || '').includes(field.showIf.value);
            
            if (!shouldShow) {
                continue;
            }
        }

        if (value === undefined || value === null || value === '') {
            if (field.required) throw ApiError.badRequest(`${field.label || field.name} is required`);
            continue;
        }

        // Handle stringified numbers or arrays from FormData
        if (field.type === 'number' || field.type === 'currency') {
            value = Number(value);
        }

        const valid = (() => {
            switch (field.type) {
                case 'email': return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
                case 'number': 
                case 'currency': return typeof value === 'number' && Number.isFinite(value);
                case 'dropdown': 
                case 'radio': return typeof value === 'string' && field.options.includes(value);
                case 'multiselect': 
                    if (typeof value === 'string') value = [value];
                    return Array.isArray(value) && value.every(v => field.options.includes(v));
                case 'checkbox': 
                    if (typeof value === 'string') value = value === 'true' || value === 'on';
                    return typeof value === 'boolean';
                case 'date': 
                case 'datetime': return (typeof value === 'string' || value instanceof Date) && !Number.isNaN(new Date(value).getTime());
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
    
    await cacheHelper.deleteByPattern(`forms:${scope.tenantId}:*`);
    
    ApiResponse.created(res, form, 'Form created');
});

const getForms = asyncHandler(async (req, res) => {
    const { page, limit, skip } = pagination(req.query);
    const filter = buildScopeFilter(req, { ownerField: null, module: 'forms' });
    
    const cacheKey = cacheHelper.generateKey(`forms:${filter.tenantId}:list`, { ...req.query, scope: JSON.stringify(filter) });

    const data = await cacheHelper.getOrSet(cacheKey, 3600, async () => {
        const [forms, total] = await Promise.all([
            SmartForm.find(filter).sort({ 'meta.createdAt': -1 }).skip(skip).limit(limit),
            SmartForm.countDocuments(filter),
        ]);
        return { forms, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
    });

    ApiResponse.paginated(res, data.forms, data.pagination);
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
    
    await cacheHelper.deleteByPattern(`forms:${scope.tenantId}:*`);
    
    ApiResponse.success(res, form, 'Form updated');
});

// PUBLIC endpoint — no auth required
const submitForm = asyncHandler(async (req, res) => {
    const formId = requireObjectId(req.params.id, 'form ID');
    const form = await SmartForm.findOne({ _id: formId, isActive: true });
    if (!form) throw ApiError.notFound('Form not found or inactive');

    const data = validateSubmission(form, req.body);
    
    // Extract UTM
    const utmSource = req.query.utm_source || req.body.utm_source || '';
    const utmMedium = req.query.utm_medium || req.body.utm_medium || '';
    const utmCampaign = req.query.utm_campaign || req.body.utm_campaign || '';
    const utmTerm = req.query.utm_term || req.body.utm_term || '';
    const utmContent = req.query.utm_content || req.body.utm_content || '';

    const submission = await FormSubmission.create({
        tenantId: form.tenantId,
        branchId: form.branchId,
        formId: form._id,
        data,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        utmSource,
        utmMedium,
        utmCampaign,
        utmTerm,
        utmContent,
    });

    form.submissionCount += 1;
    await form.save();

    // Publish event → lead-service creates a lead
    await publishEvent(EVENTS.FORM_SUBMITTED, {
        tenantId: form.tenantId,
        branchId: form.branchId,
        formId: form._id,
        formName: form.name,
        submissionId: submission._id,
        data,
        settings: form.settings,
        fields: form.fields, // Pass fields for CRM mapping
        utm: { utmSource, utmMedium, utmCampaign, utmTerm, utmContent }
    });

    ApiResponse.success(res, { 
        message: form.settings.successMessage,
        afterSubmitAction: form.settings.afterSubmitAction,
        redirectUrl: form.settings.redirectUrl,
        bookingLinkId: form.settings.bookingLinkId
    }, 'Form submitted');
});

// PUBLIC endpoint — renders HTML preview
const getFormPreview = asyncHandler(async (req, res) => {
    const formId = requireObjectId(req.params.id, 'form ID');
    const form = await SmartForm.findOne({ _id: formId, isActive: true });
    if (!form) {
        return res.status(404).send('<h1>Form not found or inactive</h1>');
    }

    // Generate HTML for the form
    const fieldsHtml = (form.fields || []).map(f => {
        let inputHtml = '';
        const requiredAttr = f.required ? 'required' : '';
        const commonClass = 'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500';
        
        switch (f.type) {
            case 'textarea':
                inputHtml = `<textarea name="${f.name}" placeholder="${f.placeholder || ''}" ${requiredAttr} class="${commonClass}" rows="4">${f.defaultValue || ''}</textarea>`;
                break;
            case 'dropdown': {
                const optionsHtml = (f.options || []).map(o => `<option value="${o}" ${f.defaultValue === o ? 'selected' : ''}>${o}</option>`).join('');
                inputHtml = `<select name="${f.name}" ${requiredAttr} class="${commonClass}"><option value="">Select an option</option>${optionsHtml}</select>`;
                break;
            }
            case 'radio':
                inputHtml = `<div class="space-y-2">` + (f.options || []).map(o => 
                    `<label class="flex items-center space-x-2"><input type="radio" name="${f.name}" value="${o}" ${f.defaultValue === o ? 'checked' : ''} ${requiredAttr} class="text-indigo-600 focus:ring-indigo-500 border-gray-300"> <span class="text-sm text-gray-700">${o}</span></label>`
                ).join('') + `</div>`;
                break;
            case 'multiselect': {
                const msOptionsHtml = (f.options || []).map(o => `<option value="${o}">${o}</option>`).join('');
                inputHtml = `<select name="${f.name}" multiple ${requiredAttr} class="${commonClass}">${msOptionsHtml}</select><p class="text-xs text-gray-500 mt-1">Hold Ctrl/Cmd to select multiple</p>`;
                break;
            }
            case 'checkbox':
                inputHtml = `<div class="flex items-center"><input type="checkbox" name="${f.name}" value="true" ${f.defaultValue === 'true' ? 'checked' : ''} ${requiredAttr} class="mr-2 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"> <span class="text-sm text-gray-700">${f.label}</span></div>`;
                break;
            default: {
                // text, email, phone, number, date, datetime, currency
                let inputType = f.type;
                if (f.type === 'phone') inputType = 'tel';
                if (f.type === 'datetime') inputType = 'datetime-local';
                if (f.type === 'currency') inputType = 'number';
                inputHtml = `<input type="${inputType}" name="${f.name}" placeholder="${f.placeholder || ''}" value="${f.defaultValue || ''}" ${requiredAttr} class="${commonClass}" ${f.type === 'currency' || f.type === 'number' ? 'step="any"' : ''}>`;
                break;
            }
        }

        const showIfData = f.showIf && f.showIf.field ? `data-show-if-field="${f.showIf.field}" data-show-if-operator="${f.showIf.operator}" data-show-if-value="${f.showIf.value}"` : '';

        // If it's a standalone checkbox, we don't need another label above it
        if (f.type === 'checkbox') {
            return `<div class="mb-4 form-field-container" data-field-name="${f.name}" ${showIfData}>${inputHtml} ${f.helpText ? `<p class="text-xs text-gray-500 mt-1">${f.helpText}</p>` : ''}</div>`;
        }

        return `
            <div class="mb-4 form-field-container" data-field-name="${f.name}" ${showIfData}>
                <label class="block text-sm font-medium text-gray-700 mb-1">${f.label} ${f.required ? '<span class="text-red-500">*</span>' : ''}</label>
                ${inputHtml}
                ${f.helpText ? `<p class="text-xs text-gray-500 mt-1">${f.helpText}</p>` : ''}
            </div>
        `;
    }).join('');

    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${form.name}</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
            body { background-color: #f9fafb; font-family: ${form.styling?.fontFamily || 'Inter, sans-serif'}; }
            .hidden { display: none !important; }
            input, select, textarea { width: 100%; padding: 8px; margin-bottom: 5px; border: 1px solid #ccc; border-radius: 4px; }
            input[type="radio"], input[type="checkbox"] { width: auto; margin-bottom: 0; }
            button { width: 100%; padding: 10px; color: white; border: none; border-radius: 4px; cursor: pointer; }
            .form-container { max-width: 500px; margin: 40px auto; padding: 20px; background: white; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        </style>
    </head>
    <body class="min-h-screen flex items-center justify-center p-4">
        <div class="form-container bg-white rounded-xl shadow-lg w-full max-w-md p-8 border border-gray-100">
            <h1 class="text-2xl font-bold text-gray-800 mb-2">${form.name}</h1>
            ${form.description ? `<p class="text-gray-500 text-sm mb-6">${form.description}</p>` : '<div class="mb-6"></div>'}
            
            <form id="smartForm" class="space-y-4" onsubmit="submitForm(event)">
                ${fieldsHtml}
                <button type="submit" class="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white transition-colors mt-6" style="background-color: ${form.styling?.primaryColor || '#4f46e5'}">
                    ${form.settings?.submitButtonText || 'Submit'}
                </button>
            </form>
            
            <div id="successMessage" class="hidden mt-4 p-4 bg-green-50 border border-green-200 text-green-700 rounded-md text-sm text-center">
            </div>
            <div id="errorMessage" class="hidden mt-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm text-center">
            </div>
        </div>

        <script>
            // Handle URL UTM parameters
            const urlParams = new URLSearchParams(window.location.search);
            const utmParams = {
                utm_source: urlParams.get('utm_source') || '',
                utm_medium: urlParams.get('utm_medium') || '',
                utm_campaign: urlParams.get('utm_campaign') || '',
                utm_term: urlParams.get('utm_term') || '',
                utm_content: urlParams.get('utm_content') || ''
            };

            // Conditional Logic
            function evaluateConditionals() {
                const form = document.getElementById('smartForm');
                const formData = new FormData(form);
                
                document.querySelectorAll('.form-field-container').forEach(container => {
                    const dependField = container.getAttribute('data-show-if-field');
                    if (dependField) {
                        const operator = container.getAttribute('data-show-if-operator');
                        const value = container.getAttribute('data-show-if-value');
                        const dependValue = formData.get(dependField);
                        
                        let shouldShow = true;
                        if (operator === 'equals') shouldShow = dependValue === value;
                        else if (operator === 'not_equals') shouldShow = dependValue !== value;
                        else if (operator === 'contains') shouldShow = dependValue && dependValue.includes(value);

                        container.style.display = shouldShow ? 'block' : 'none';
                        // Disable inputs inside hidden containers so they don't block HTML5 validation or get submitted
                        container.querySelectorAll('input, select, textarea').forEach(input => {
                            input.disabled = !shouldShow;
                        });
                    }
                });
            }

            document.getElementById('smartForm').addEventListener('change', evaluateConditionals);
            evaluateConditionals();

            async function submitForm(e) {
                e.preventDefault();
                const form = e.target;
                const button = form.querySelector('button[type="submit"]');
                const formData = new FormData(form);
                const data = Object.fromEntries(formData.entries());
                
                // Handle checkboxes and multiselect
                form.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                    data[cb.name] = cb.checked;
                });
                form.querySelectorAll('select[multiple]').forEach(select => {
                    const selected = Array.from(select.options).filter(opt => opt.selected).map(opt => opt.value);
                    data[select.name] = selected;
                });

                // Attach UTM
                Object.assign(data, utmParams);

                const originalText = button.innerText;
                button.innerText = 'Submitting...';
                button.disabled = true;
                button.style.opacity = '0.7';

                try {
                    const res = await fetch('/api/forms/${form._id}/submit', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(data)
                    });
                    
                    const result = await res.json();
                    
                    if (res.ok) {
                        const action = result.data?.afterSubmitAction || 'message';
                        
                        if (action === 'redirect' && result.data?.redirectUrl) {
                            window.location.href = result.data.redirectUrl;
                            return;
                        } else if (action === 'booking' && result.data?.bookingLinkId) {
                            // If your app has a public booking page
                            window.location.href = '/book/' + result.data.bookingLinkId;
                            return;
                        }

                        // Default message
                        form.style.display = 'none';
                        const successDiv = document.getElementById('successMessage');
                        successDiv.innerText = result.data?.message || 'Form submitted successfully!';
                        successDiv.style.display = 'block';
                        document.getElementById('errorMessage').style.display = 'none';
                    } else {
                        let errorMsg = result.message || 'Validation error';
                        if (result.errors && Array.isArray(result.errors)) {
                            errorMsg = result.errors.map(err => err.message).join(', ');
                        }
                        throw new Error(errorMsg);
                    }
                } catch (err) {
                    const errDiv = document.getElementById('errorMessage');
                    errDiv.innerText = err.message || 'Failed to submit form';
                    errDiv.style.display = 'block';
                    button.innerText = originalText;
                    button.disabled = false;
                    button.style.opacity = '1';
                }
            }
        </script>
    </body>
    </html>
    `;
    
    // Override Content-Security-Policy to allow inline scripts and Tailwind CDN
    res.setHeader('Content-Security-Policy', "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; script-src * 'unsafe-inline' 'unsafe-eval'; style-src * 'unsafe-inline';");
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
});

const getFormsBulk = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    if (!req.query.ids) return ApiResponse.success(res, []);
    
    const ids = req.query.ids.split(',').filter(id => mongoose.Types.ObjectId.isValid(id));
    if (ids.length === 0) return ApiResponse.success(res, []);

    const forms = await SmartForm.find({
        _id: { $in: ids },
        tenantId
    }).select('name description');

    ApiResponse.success(res, forms);
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
        FormSubmission.find(filter).sort({ 'meta.createdAt': -1 }).skip(skip).limit(limit),
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

    await cacheHelper.deleteByPattern(`forms:${scope.tenantId}:*`);

    ApiResponse.success(res, null, 'Form deleted');
});

module.exports = { createForm, getForms, getForm, updateForm, submitForm, getSubmissions, deleteForm, getFormsBulk, validateSubmission, getFormPreview };
