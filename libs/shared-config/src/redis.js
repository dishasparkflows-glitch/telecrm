const Redis = require('ioredis');

let redisClient = null;
let redisSubscriber = null;
let clientReady = false;
let subscriberReady = false;

/**
 * Get or create Redis client (singleton)
 * Non-blocking — services start even if Redis is unavailable
 */
const getRedisClient = (url) => {
    if (!redisClient) {
        const redisUrl = url || process.env.REDIS_URL || 'redis://localhost:6379';

        redisClient = new Redis(redisUrl, {
            maxRetriesPerRequest: 3,
            retryStrategy(times) {
                if (times > 3) {
                    console.warn('⚠️  Redis client: max retries reached, giving up');
                    return null;
                }
                return Math.min(times * 1000, 3000);
            },
            lazyConnect: true,
            enableReadyCheck: false,
            reconnectOnError: () => false, // Don't auto-reconnect on errors
        });

        redisClient.on('connect', () => {
            clientReady = true;
            console.log('✅ Redis client connected');
        });
        redisClient.on('error', () => { clientReady = false; });
        redisClient.on('close', () => { clientReady = false; });
        redisClient.on('end', () => { clientReady = false; });

        redisClient.connect().catch((err) => {
            console.warn('⚠️  Redis client unavailable (non-blocking):', err.message);
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
            retryStrategy(times) {
                if (times > 3) {
                    console.warn('⚠️  Redis subscriber: max retries reached, giving up');
                    return null;
                }
                return Math.min(times * 1000, 3000);
            },
            lazyConnect: true,
            enableReadyCheck: false,
            reconnectOnError: () => false,
        });

        redisSubscriber.on('connect', () => {
            subscriberReady = true;
        });
        redisSubscriber.on('error', () => { subscriberReady = false; });
        redisSubscriber.on('close', () => { subscriberReady = false; });
        redisSubscriber.on('end', () => { subscriberReady = false; });

        redisSubscriber.connect().catch((err) => {
            console.warn('⚠️  Redis subscriber unavailable (non-blocking):', err.message);
        });
    }
    return redisSubscriber;
};

const isRedisReady = () => clientReady;
const isSubscriberReady = () => subscriberReady;

module.exports = { getRedisClient, getRedisSubscriber, isRedisReady, isSubscriberReady };
