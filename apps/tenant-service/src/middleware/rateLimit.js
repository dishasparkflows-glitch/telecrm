const buckets = new Map();
const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
        if (bucket.resetAt <= now) buckets.delete(key);
    }
}, 60_000);
cleanupTimer.unref?.();

function localRateLimit({ windowMs = 60_000, max = 300 } = {}) {
    return (req, res, next) => {
        const now = Date.now();
        const key = req.ip || req.socket?.remoteAddress || 'unknown';
        const current = buckets.get(key);
        if (!current || current.resetAt <= now) {
            if (!current && buckets.size >= 10_000) buckets.delete(buckets.keys().next().value);
            buckets.set(key, { count: 1, resetAt: now + windowMs });
            return next();
        }
        current.count += 1;
        if (current.count > max) {
            res.set('Retry-After', String(Math.ceil((current.resetAt - now) / 1000)));
            return res.status(429).json({ success: false, message: 'Too many requests' });
        }
        return next();
    };
}

module.exports = { localRateLimit };
