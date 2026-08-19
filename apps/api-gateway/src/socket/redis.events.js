const { getRedisSubscriber } = require('@sparkcrm/shared-config');

const subscribeToRealtimeEvents = (io) => {
    const redisSubscriber = getRedisSubscriber();
    if (!redisSubscriber) {
        console.warn('⚠️ Redis subscriber not available, realtime events will not be forwarded.');
        return;
    }

    redisSubscriber.subscribe('realtime:events', (err) => {
        if (err) console.error('❌ Failed to subscribe to realtime:events', err);
        else console.log('✅ Gateway Subscribed to realtime:events');
    });

    redisSubscriber.on('message', (channel, message) => {
        if (channel === 'realtime:events') {
            try {
                const payload = JSON.parse(message);
                const { tenantId, userId, event, data } = payload;
                
                if (tenantId && userId && event) {
                    const room = `tenant:${tenantId}:user:${userId}`;
                    io.to(room).emit(event, data);
                } else if (payload.room && payload.event) {
                    // Fallback for legacy events until all services are updated
                    io.to(payload.room).emit(payload.event, payload.data);
                }
            } catch (e) {
                console.error('Failed to parse realtime event payload', e);
            }
        }
    });
};

module.exports = { subscribeToRealtimeEvents };
