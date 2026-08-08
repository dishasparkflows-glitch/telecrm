const { ApiError } = require('@sparkcrm/shared-utils');

const LEAD_CREATE_FIELDS = Object.freeze([
    'contact',
    'stage',
    'source',
    'sourceDetails',
    'priority',
    'expectedValue',
    'currency',
    'tags',
    'lastContactedAt',
    'followUpAt',
    'customFields',
    'address',
]);

const LEAD_UPDATE_FIELDS = Object.freeze(
    LEAD_CREATE_FIELDS.filter((field) => !['source', 'sourceDetails'].includes(field))
);

const ADDRESS_FIELDS = Object.freeze(['city', 'state', 'country', 'pincode']);

const CONTACT_FIELDS = Object.freeze([
    'firstName',
    'lastName',
    'email',
    'emailNormalized',
    'phone',
    'phoneNormalized',
    'alternatePhone',
    'company',
    'designation'
]);

function isPlainObject(value) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}

function assertNoUnknownFields(input, allowedFields, label = 'lead') {
    if (!isPlainObject(input)) throw ApiError.badRequest(`${label} must be an object`);

    const allowed = new Set(allowedFields);
    const unknownFields = Object.keys(input).filter((field) => !allowed.has(field)).sort();
    if (unknownFields.length) {
        throw ApiError.badRequest(`Unsupported lead fields: ${unknownFields.join(', ')}`);
    }
}

function sanitizeNestedFields(value, allowedFields, fieldName) {
    if (!isPlainObject(value)) throw ApiError.badRequest(`${fieldName} must be an object`);
    const unknownFields = Object.keys(value).filter((field) => !allowedFields.includes(field)).sort();
    if (unknownFields.length) {
        throw ApiError.badRequest(`Unsupported ${fieldName} fields: ${unknownFields.join(', ')}`);
    }
    return Object.fromEntries(Object.entries(value));
}

function sanitizeLeadInput(input, allowedFields, label) {
    assertNoUnknownFields(input, allowedFields, label);
    const sanitized = Object.fromEntries(
        allowedFields
            .filter((field) => input[field] !== undefined)
            .map((field) => [field, input[field]])
    );

    if (sanitized.contact !== undefined) {
        sanitized.contact = sanitizeNestedFields(sanitized.contact, CONTACT_FIELDS, 'contact');
    }
    if (sanitized.address !== undefined) {
        sanitized.address = sanitizeNestedFields(sanitized.address, ADDRESS_FIELDS, 'address');
    }
    if (sanitized.customFields !== undefined && !isPlainObject(sanitized.customFields)) {
        throw ApiError.badRequest('customFields must be an object');
    }
    if (sanitized.tags !== undefined && !Array.isArray(sanitized.tags)) {
        throw ApiError.badRequest('tags must be an array');
    }

    return sanitized;
}

function pickLeadCreateInput(input) {
    return sanitizeLeadInput(input, LEAD_CREATE_FIELDS, 'lead');
}

function pickLeadUpdateInput(input) {
    return sanitizeLeadInput(input, LEAD_UPDATE_FIELDS, 'lead update');
}

function applyAssignedToFilter(scopeFilter, requestedAssignedTo) {
    if (!requestedAssignedTo) return scopeFilter;
    if (scopeFilter.assignedTo && String(scopeFilter.assignedTo) !== String(requestedAssignedTo)) {
        throw ApiError.forbidden('You cannot access leads assigned to another user');
    }
    scopeFilter.assignedTo = requestedAssignedTo;
    return scopeFilter;
}

module.exports = {
    LEAD_CREATE_FIELDS,
    LEAD_UPDATE_FIELDS,
    assertNoUnknownFields,
    pickLeadCreateInput,
    pickLeadUpdateInput,
    applyAssignedToFilter,
};
