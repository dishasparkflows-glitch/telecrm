const crypto = require('crypto');
const Redis = require('ioredis');

// Ensure you have REDIS_URL in your environment variables
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
let redisClient = null;

try {
    redisClient = new Redis(redisUrl, {
        maxRetriesPerRequest: null,
        lazyConnect: true,
    });
    redisClient.on('error', () => {});
} catch (error) {
    console.warn('⚠️ Could not initialize Redis client in cacheHelper:', error.message);
}

/**
 * Cache Helper Utility
 */
const cacheHelper = {
    /**
     * Connect to Redis (should be called during service startup)
     */
    connect: async () => {
        if (redisClient && redisClient.status === 'wait') {
            await redisClient.connect();
        }
        return redisClient;
    },

    /**
     * Generate a consistent cache key from a prefix and an object of parameters.
     * It sorts the object keys to ensure consistent hashing regardless of property order.
     * 
     * @param {string} prefix - The base namespace (e.g., 'leads:list:v1')
     * @param {Object} params - The query parameters or filters
     * @returns {string} The formatted cache key
     */
    generateKey: (prefix, params = {}) => {
        if (!params || Object.keys(params).length === 0) {
            return prefix;
        }

        // Sort keys to ensure consistency
        const sortedParams = {};
        Object.keys(params).sort().forEach(key => {
            // Ignore undefined values to prevent unnecessary cache misses
            if (params[key] !== undefined) {
                sortedParams[key] = params[key];
            }
        });

        // Hash the parameters to keep the key length short and safe
        const hash = crypto.createHash('md5').update(JSON.stringify(sortedParams)).digest('hex');
        return `${prefix}:${hash}`;
    },

    /**
     * Get data from cache, or execute the callback to fetch and cache it.
     * 
     * @param {string} key - The Redis cache key
     * @param {number} ttlSeconds - Time to live in seconds
     * @param {Function} fetchCallback - Async function that returns the data if cache misses
     * @returns {Promise<any>} The parsed data
     */
    getOrSet: async (key, ttlSeconds, fetchCallback) => {
        if (!redisClient) return await fetchCallback();

        try {
            const cachedData = await redisClient.get(key);
            if (cachedData) {
                return JSON.parse(cachedData);
            }
        } catch (error) {
            console.warn(`Redis GET error for key ${key}:`, error.message);
        }

        // Cache miss: fetch fresh data
        const freshData = await fetchCallback();

        try {
            if (freshData !== undefined && freshData !== null) {
                await redisClient.setex(key, ttlSeconds, JSON.stringify(freshData));
            }
        } catch (error) {
            console.warn(`Redis SETEX error for key ${key}:`, error.message);
        }

        return freshData;
    },

    /**
     * Delete all keys matching a specific pattern (e.g., 'leads:*')
     * Uses SCAN to safely delete keys without blocking Redis.
     * 
     * @param {string} pattern - The matching pattern
     */
    deleteByPattern: async (pattern) => {
        if (!redisClient) return;

        let cursor = '0';
        try {
            do {
                const [newCursor, keys] = await redisClient.scan(cursor, 'MATCH', pattern, 'COUNT', '100');
                cursor = newCursor;
                if (keys.length > 0) {
                    await redisClient.del(...keys);
                }
            } while (cursor !== '0');
        } catch (error) {
            console.error(`Redis DELETE PATTERN error for ${pattern}:`, error.message);
        }
    },
    
    /**
     * Provide direct access to the raw Redis client if needed
     */
    getClient: () => redisClient,
};

module.exports = cacheHelper;
