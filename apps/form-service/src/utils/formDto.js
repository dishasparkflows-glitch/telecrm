const mongoose = require('mongoose');
const { ApiError } = require('@sparkcrm/shared-utils');

const FORM_WRITE_FIELDS = Object.freeze([
    'name',
    'description',
    'fields',
    'settings',
    'styling',
    'isActive',
]);
const FORM_FIELD_FIELDS = Object.freeze([
    'label',
    'name',
    'type',
    'placeholder',
    'required',
    'options',
    'order',
    'helpText',
    'defaultValue',
    'showIf',
    'crmField'
]);
const FORM_SETTINGS_FIELDS = Object.freeze([
    'submitButtonText',
    'successMessage',
    'redirectUrl',
    'notifyEmails',
    'leadSource',
    'autoTag',
    'afterSubmitAction',
    'bookingLinkId',
    'createLead',
    'leadStage'
]);
const FORM_STYLING_FIELDS = Object.freeze([
    'theme',
    'primaryColor',
    'fontFamily',
]);

function isPlainObject(value) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}

function pickStrictObject(value, allowedFields, label) {
    if (!isPlainObject(value)) throw ApiError.badRequest(`${label} must be an object`);
    const unknownFields = Object.keys(value).filter((field) => !allowedFields.includes(field)).sort();
    if (unknownFields.length) {
        throw ApiError.badRequest(`Unsupported ${label} fields: ${unknownFields.join(', ')}`);
    }
    return Object.fromEntries(
        allowedFields
            .filter((field) => value[field] !== undefined)
            .map((field) => [field, value[field]])
    );
}

function sanitizeFields(fields) {
    if (!Array.isArray(fields)) throw ApiError.badRequest('fields must be an array');
    return fields.map((field, index) => {
        const sanitized = pickStrictObject(field, FORM_FIELD_FIELDS, `fields[${index}]`);
        if (sanitized.options !== undefined && !Array.isArray(sanitized.options)) {
            throw ApiError.badRequest(`fields[${index}].options must be an array`);
        }
        return sanitized;
    });
}

function sanitizeSettings(settings) {
    const sanitized = pickStrictObject(settings, FORM_SETTINGS_FIELDS, 'settings');
    for (const field of ['notifyEmails', 'autoTag']) {
        if (sanitized[field] !== undefined && !Array.isArray(sanitized[field])) {
            throw ApiError.badRequest(`settings.${field} must be an array`);
        }
    }
    return sanitized;
}

function pickFormWriteInput(input) {
    const sanitized = pickStrictObject(input, FORM_WRITE_FIELDS, 'form');
    if (sanitized.fields !== undefined) sanitized.fields = sanitizeFields(sanitized.fields);
    if (sanitized.settings !== undefined) sanitized.settings = sanitizeSettings(sanitized.settings);
    if (sanitized.styling !== undefined) {
        sanitized.styling = pickStrictObject(sanitized.styling, FORM_STYLING_FIELDS, 'styling');
    }
    return sanitized;
}

function requireObjectId(value, name) {
    if (!mongoose.Types.ObjectId.isValid(String(value || ''))) {
        throw ApiError.badRequest(`${name} must be a valid ObjectId`);
    }
    return String(value);
}

function pagination(query, defaultLimit = 25, maxLimit = 100) {
    const page = Number.parseInt(query.page ?? '1', 10);
    const limit = Number.parseInt(query.limit ?? String(defaultLimit), 10);
    if (!Number.isInteger(page) || page < 1) throw ApiError.badRequest('page must be a positive integer');
    if (!Number.isInteger(limit) || limit < 1 || limit > maxLimit) {
        throw ApiError.badRequest(`limit must be between 1 and ${maxLimit}`);
    }
    return { page, limit, skip: (page - 1) * limit };
}

module.exports = {
    FORM_WRITE_FIELDS,
    pickFormWriteInput,
    requireObjectId,
    pagination,
};
