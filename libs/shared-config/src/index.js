const { env } = require('./env');

// Export env first to resolve circular dependencies
module.exports.env = env;

const { connectDB } = require('./database');
const { getRedisClient, getRedisSubscriber, isRedisReady, isSubscriberReady, publishRealtimeEvent } = require('./redis');

Object.assign(module.exports, {
    connectDB,
    getRedisClient,
    getRedisSubscriber,
    isRedisReady,
    isSubscriberReady,
    publishRealtimeEvent,
});
