function parsePagination(query = {}, defaults = {}) {
    const defaultLimit = defaults.defaultLimit || 20;
    const maxLimit = defaults.maxLimit || 100;
    const parsedPage = Number.parseInt(query.page, 10);
    const parsedLimit = Number.parseInt(query.limit, 10);
    const page = Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
    const limit = Number.isSafeInteger(parsedLimit) && parsedLimit > 0
        ? Math.min(parsedLimit, maxLimit)
        : defaultLimit;
    return { page, limit, skip: (page - 1) * limit };
}

function escapeRegex(value = '') {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').slice(0, 200);
}

function pick(source, allowedFields) {
    const result = {};
    for (const field of allowedFields) {
        if (source[field] !== undefined) result[field] = source[field];
    }
    return result;
}

module.exports = { parsePagination, escapeRegex, pick };
