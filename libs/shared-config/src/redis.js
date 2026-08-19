const Redis = require('ioredis');

let redisClient = null;
let redisSubscriber = null;
let clientReady = false;
let subscriberReady = false;

/**
 * Shared retry strategy: exponential backoff up to 10s, unlimited retries.
 * This ensures Redis is always reconnected after a blip, OOM-kill, or restart.
 */
const buildRetryStrategy = (label) => (times) => {
    const delay = Math.min(times * 500, 10000);
    if (times % 5 === 0) {
        console.warn(`⚠️  Redis ${label}: reconnect attempt #${times} (delay ${delay}ms)`);
    }
    return delay;
};

/**
 * reconnectOnError: reconnect on transient errors (ECONNRESET, ETIMEDOUT, READONLY).
 * Returning 2 means: reconnect AND resend the failed command.
 */
const reconnectOnError = (err) => {
    const transientErrors = ['READONLY', 'ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED'];
    return transientErrors.some((e) => err.message.includes(e)) ? 2 : false;
};

/**
 * Get or create Redis client (singleton)
 * Non-blocking — services start even if Redis is unavailable
 */
const getRedisClient = (url) => {
    if (!redisClient) {
        const redisUrl = url || process.env.REDIS_URL || 'redis://localhost:6379';

        redisClient = new Redis(redisUrl, {
            maxRetriesPerRequest: 3,
            retryStrategy: buildRetryStrategy('client'),
            lazyConnect: true,
            enableReadyCheck: true,
            reconnectOnError,
        });

        redisClient.on('ready', () => {
            clientReady = true;
            console.log('✅ Redis client ready');
        });
        redisClient.on('connect', () => { clientReady = true; });
        redisClient.on('error', (err) => {
            clientReady = false;
            if (process.env.NODE_ENV !== 'production') {
                console.warn('⚠️  Redis client error:', err.message);
            }
        });
        redisClient.on('close', () => { clientReady = false; });
        redisClient.on('end', () => { clientReady = false; });
        redisClient.on('reconnecting', () => { clientReady = false; });

        redisClient.connect().catch((err) => {
            console.warn('⚠️  Redis client initial connect failed (will retry):', err.message);
        });
    }
    return redisClient;
};

/**
 * Get or create Redis subscriber client (separate connection for pub/sub)
 * Non-blocking — services start even if Pub/Sub is unavailable
 */
const getRedisSubscriber = (url) => {
    if (!redisSubscriber) {
        const redisUrl = url || process.env.REDIS_URL || 'redis://localhost:6379';

        redisSubscriber = new Redis(redisUrl, {
            maxRetriesPerRequest: 3,
            retryStrategy: buildRetryStrategy('subscriber'),
            lazyConnect: true,
            enableReadyCheck: true,
            reconnectOnError,
        });

        redisSubscriber.on('ready', () => {
            subscriberReady = true;
            console.log('✅ Redis subscriber ready');
        });
        redisSubscriber.on('connect', () => { subscriberReady = true; });
        redisSubscriber.on('error', (err) => {
            subscriberReady = false;
            if (process.env.NODE_ENV !== 'production') {
                console.warn('⚠️  Redis subscriber error:', err.message);
            }
        });
        redisSubscriber.on('close', () => { subscriberReady = false; });
        redisSubscriber.on('end', () => { subscriberReady = false; });
        redisSubscriber.on('reconnecting', () => { subscriberReady = false; });

        redisSubscriber.connect().catch((err) => {
            console.warn('⚠️  Redis subscriber initial connect failed (will retry):', err.message);
        });
    }
    return redisSubscriber;
};

const isRedisReady = () => clientReady;
const isSubscriberReady = () => subscriberReady;

const publishRealtimeEvent = async ({ type, tenantId, userId, event, data }) => {
    if (!tenantId || !userId) {
        console.warn('⚠️ Missing tenantId or userId for realtime event, dropping:', type);
        return;
    }

    const publisher = getRedisClient();
    if (!publisher || !isRedisReady()) {
        console.warn('⚠️ Redis publisher not ready, skipping realtime event:', type);
        return;
    }

    const payload = {
        type,
        tenantId: tenantId.toString(),
        userId: userId.toString(),
        event,
        data,
        timestamp: Date.now()
    };

    try {
        await publisher.publish('realtime:events', JSON.stringify(payload));
    } catch (err) {
        console.error('❌ Failed to publish realtime event:', err.message);
    }
};

module.exports = { getRedisClient, getRedisSubscriber, isRedisReady, isSubscriberReady, publishRealtimeEvent };
