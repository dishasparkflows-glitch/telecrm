const { getRedisClient, isRedisReady } = require('@sparkcrm/shared-config');

/**
 * Publish an event to Redis Pub/Sub
 * Non-blocking — if Redis is unavailable, event is silently dropped
 * @param {string} event - Event name from EVENTS constant
 * @param {Object} data - Event payload
 */
const publishEvent = async (event, data) => {
    try {
        // Creating the shared client starts its lazy connection. Previously the
        // readiness check happened first, so a service's first event could never
        // initialize Redis and was always discarded.
        const redis = getRedisClient();
        if (!isRedisReady()) {
            await Promise.race([
                new Promise((resolve) => redis.once('ready', resolve)),
                new Promise((resolve) => setTimeout(resolve, 3000)),
            ]);
        }
        if (!isRedisReady()) return;
        const payload = JSON.stringify({
            event,
            data,
            timestamp: new Date().toISOString(),
        });
        await redis.publish(event, payload);
    } catch (error) {
        // Don't spam logs — just silently fail for pub/sub
        if (process.env.NODE_ENV !== 'production') {
            console.warn(`⚠️  Event publish skipped (${event}):`, error.message);
        }
    }
};

module.exports = { publishEvent };
