const { publishRealtimeEvent } = require('@sparkcrm/shared-config');

/**
 * Normalise any value to a plain JSON-serialisable object.
 * Handles Mongoose documents (toObject / toJSON), arrays, and primitives.
 */
const toPlain = (value) => {
    if (value == null) return value;
    if (typeof value.toObject === 'function') return value.toObject();
    if (typeof value.toJSON  === 'function') return value.toJSON();
    return value;
};

/**
 * Emit a real-time event to a specific user via Socket.IO (through Redis pub/sub).
 * Both tenantId and userId are required — without them the event goes to a room
 * that no client is subscribed to and is silently dropped.
 */
const emitToUser = (userId, eventName, data) => {
    const plain = toPlain(data);
    const tenantId = plain?.tenantId;

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
        data: plain,
    });
};

/**
 * Emit a real-time event to all users in a tenant (broadcast).
 * Uses the same Redis-readiness wait as publishRealtimeEvent to avoid dropping
 * events during startup.
 */
const emitToTenant = async (tenantId, eventName, data) => {
    if (!tenantId) {
        console.warn(`⚠️ [realtime] emitToTenant called without tenantId for event "${eventName}" → dropped`);
        return;
    }
    const { getRedisClient, isRedisReady } = require('@sparkcrm/shared-config');
    const publisher = getRedisClient();

    // Wait up to 3s for Redis — same pattern used in publishRealtimeEvent
    if (!isRedisReady()) {
        await Promise.race([
            new Promise((resolve) => publisher.once('ready', resolve)),
            new Promise((resolve) => setTimeout(resolve, 3000)),
        ]);
    }

    if (!isRedisReady()) {
        console.warn(`⚠️ [realtime] Redis still not ready, dropping tenant broadcast: ${eventName}`);
        return;
    }

    const payload = JSON.stringify({
        room: `tenant:${tenantId}`,
        event: eventName,
        data: toPlain(data),
        timestamp: Date.now(),
    });
    publisher.publish('realtime:events', payload).catch((err) => {
        console.error('❌ Failed to publish tenant broadcast event:', err.message);
    });
};

module.exports = { emitToUser, emitToTenant };
