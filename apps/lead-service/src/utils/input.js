const mongoose = require('mongoose');
const { ApiError } = require('@sparkcrm/shared-utils');

function pagination(query, defaultLimit = 25, maxLimit = 100) {
    const page = Number.parseInt(query.page ?? '1', 10);
    const limit = Number.parseInt(query.limit ?? String(defaultLimit), 10);
    if (!Number.isInteger(page) || page < 1) throw ApiError.badRequest('page must be a positive integer');
    if (!Number.isInteger(limit) || limit < 1 || limit > maxLimit) throw ApiError.badRequest(`limit must be between 1 and ${maxLimit}`);
    return { page, limit, skip: (page - 1) * limit };
}

function requireObjectId(value, name) {
    if (!mongoose.Types.ObjectId.isValid(String(value || ''))) throw ApiError.badRequest(`${name} must be a valid ObjectId`);
    return String(value);
}

function pick(source, fields) {
    return Object.fromEntries(fields.filter((field) => source[field] !== undefined).map((field) => [field, source[field]]));
}

function normalizeEmail(value) {
    const email = String(value || '').trim().toLowerCase();
    if (email && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320)) {
        throw ApiError.badRequest('email must be valid');
    }
    return email;
}

function normalizePhone(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const digits = raw.replace(/\D/g, '');
    if (digits.length < 8 || digits.length > 15) throw ApiError.badRequest('phone must be a valid international number');
    return digits.length === 10 ? `91${digits}` : digits;
}

function escapeRegex(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function modulePermission(req, moduleName) {
    try {
        const raw = req.headers['x-user-permissions'];
        const permissions = typeof raw === 'string' ? JSON.parse(raw) : raw;
        return permissions?.[moduleName] || {};
    } catch { return {}; }
}

module.exports = { pagination, requireObjectId, pick, normalizeEmail, normalizePhone, escapeRegex, modulePermission };
