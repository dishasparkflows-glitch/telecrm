const { publishRealtimeEvent } = require('@sparkcrm/shared-config');

/**
 * Emit a real-time event to a specific user via Socket.IO (through Redis pub/sub).
 * Both tenantId and userId are required — without them the event goes to a room
 * that no client is subscribed to and is silently dropped.
 */
const emitToUser = (userId, eventName, data) => {
    const tenantId = data?.tenantId;

    if (!tenantId) {
        console.warn(`⚠️ [realtime] emitToUser called without tenantId for event "${eventName}" → dropped`);
        return;
    }
    if (!userId) {
        console.warn(`⚠️ [realtime] emitToUser called without userId for event "${eventName}" → dropped`);
        return;
    }

    publishRealtimeEvent({
        type: 'NOTIFICATION_CREATED',
        tenantId,
        userId,
        event: eventName,
        data,
    });
};

/**
 * Emit a real-time event to all users in a tenant (broadcast).
 */
const emitToTenant = (tenantId, eventName, data) => {
    if (!tenantId) {
        console.warn(`⚠️ [realtime] emitToTenant called without tenantId for event "${eventName}" → dropped`);
        return;
    }
    // Publish with a special room key — redis.events.js in the gateway picks this up
    const { getRedisClient, isRedisReady } = require('@sparkcrm/shared-config');
    const publisher = getRedisClient();
    if (!publisher || !isRedisReady()) return;

    const payload = JSON.stringify({
        room: `tenant:${tenantId}`,
        event: eventName,
        data,
        timestamp: Date.now(),
    });
    publisher.publish('realtime:events', payload).catch((err) => {
        console.error('❌ Failed to publish tenant broadcast event:', err.message);
    });
};

module.exports = { emitToUser, emitToTenant };
