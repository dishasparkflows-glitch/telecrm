const { getRedisClient, isRedisReady } = require('@sparkcrm/shared-config');

/**
 * Publish an event to Redis Pub/Sub
 * Non-blocking — if Redis is unavailable, event is logged and dropped
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
        if (!isRedisReady()) {
            console.warn(`⚠️  Event dropped (Redis not ready): ${event}`);
            return;
        }
        const payload = JSON.stringify({
            event,
            data,
            timestamp: new Date().toISOString(),
        });
        await redis.publish(event, payload);
    } catch (error) {
        console.warn(`⚠️  Event publish failed (${event}):`, error.message);
    }
};

module.exports = { publishEvent };
