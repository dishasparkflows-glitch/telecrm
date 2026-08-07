const { requireServiceIdentity } = require('@sparkcrm/shared-middleware');

function requireVerifiedUser(audience) {
    return requireServiceIdentity(audience, {
        requireUser: true,
        allowedIssuers: ['api-gateway'],
    });
}

function requireInternalService(audience) {
    return requireServiceIdentity(audience);
}

function fixedWindowRateLimit({ windowMs = 60_000, max = 30 } = {}) {
    const buckets = new Map();
    return (req, res, next) => {
        const now = Date.now();
        const key = String(req.ip || req.socket?.remoteAddress || 'unknown');
        const bucket = buckets.get(key);
        if (!bucket || bucket.resetAt <= now) {
            buckets.set(key, { count: 1, resetAt: now + windowMs });
            return next();
        }
        bucket.count += 1;
        if (bucket.count > max) {
            res.setHeader('Retry-After', String(Math.ceil((bucket.resetAt - now) / 1000)));
            return res.status(429).json({ success: false, message: 'Too many requests' });
        }
        next();
    };
}

module.exports = { requireVerifiedUser, requireInternalService, fixedWindowRateLimit };
