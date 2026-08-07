const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const { env } = require('@sparkcrm/shared-config');

/**
 * Rate Limiter Middleware — Prevents abuse
 * Keyed by userId (extracted from JWT) for authenticated requests,
 * falls back to IP for unauthenticated requests.
 */

/**
 * Extract a rate-limit identity only from a valid signed access token.
 * Public and invalid-token requests continue to use the caller IP.
 */
const extractUserKeyFromToken = (req) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
        const token = authHeader.split(' ')[1];
        const payload = jwt.verify(token, env.JWT_SECRET);
        const userId = payload.userId || payload.id;
        if (!userId) return null;
        return payload.tenantId
            ? `${payload.tenantId}:${userId}`
            : `${payload.role || 'user'}:${userId}`;
    } catch {
        return null;
    }
};

const createRateLimiter = (options = {}) => {
    return rateLimit({
        windowMs: options.windowMs || 15 * 60 * 1000, // 15 minutes
        max: options.max || 200, // Default 200 requests per window
        message: {
            success: false,
            message: 'Too many requests. Please try again later.',
            code: 'RATE_LIMIT_EXCEEDED',
        },
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: (req) => {
            // Try to extract user identity from JWT for per-user rate limiting
            const userKey = extractUserKeyFromToken(req);
            if (userKey) return userKey;
            // Fall back to IP for unauthenticated requests (login, register, etc.)
            return req.ip;
        },
    });
};

// Pre-configured limiters
const globalLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 1000 });
const authLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 30 });
const apiLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 300 });

module.exports = {
    extractUserKeyFromToken,
    createRateLimiter,
    globalLimiter,
    authLimiter,
    apiLimiter,
};
