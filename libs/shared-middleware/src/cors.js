const DEFAULT_CORS_METHODS = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'];

function normalizeOrigin(origin) {
    if (typeof origin !== 'string') return '';
    return origin.trim().replace(/\/+$/, '');
}

function getConfiguredOrigins(env = process.env) {
    const origins = [
        ...(env.CORS_ALLOWED_ORIGINS || '').split(','),
        env.FRONTEND_URL,
        env.DASHBOARD_URL,
    ];

    return new Set(origins.map(normalizeOrigin).filter(Boolean));
}

function isLoopbackOrigin(origin) {
    try {
        const url = new URL(origin);
        return (url.protocol === 'http:' || url.protocol === 'https:')
            && (url.hostname === 'localhost' || url.hostname === '127.0.0.1');
    } catch {
        return false;
    }
}

function isOriginAllowed(origin, env = process.env) {
    // CORS is a browser control. Webhooks, service calls, and native clients
    // commonly omit Origin and must not be blocked.
    if (!origin) return true;

    const normalizedOrigin = normalizeOrigin(origin);
    const isProduction = env.NODE_ENV === 'production';

    if (isLoopbackOrigin(normalizedOrigin)) return !isProduction;

    return getConfiguredOrigins(env).has(normalizedOrigin);
}

function createCorsOptions(env = process.env, overrides = {}) {
    return {
        origin(origin, callback) {
            callback(null, isOriginAllowed(origin, env));
        },
        credentials: true,
        methods: DEFAULT_CORS_METHODS,
        // With allowedHeaders omitted, the cors package reflects requested headers.
        // This supports web, mobile, and extension-specific headers without a wildcard.
        ...overrides,
    };
}

module.exports = {
    DEFAULT_CORS_METHODS,
    createCorsOptions,
    getConfiguredOrigins,
    isOriginAllowed,
};
