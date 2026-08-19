const { getRedisSubscriber, isRedisReady } = require('@sparkcrm/shared-config');

const subscribeToRealtimeEvents = (io) => {
    const redisSubscriber = getRedisSubscriber();
    if (!redisSubscriber) {
        console.warn('⚠️ Redis subscriber not available, realtime events will not be forwarded.');
        return;
    }

    const doSubscribe = () => {
        redisSubscriber.subscribe('realtime:events', (err) => {
            if (err) console.error('❌ Failed to subscribe to realtime:events', err);
            else console.log('✅ Gateway Subscribed to realtime:events');
        });
    };

    // If Redis is already ready, subscribe immediately; otherwise wait for 'ready'
    if (isRedisReady()) {
        doSubscribe();
    } else {
        console.log('⏳ Gateway waiting for Redis before subscribing to realtime:events...');
        redisSubscriber.once('ready', () => {
            console.log('✅ Redis ready — subscribing to realtime:events');
            doSubscribe();
        });
    }

    redisSubscriber.on('message', (channel, message) => {
        if (channel === 'realtime:events') {
            try {
                const payload = JSON.parse(message);
                const { tenantId, userId, event, data } = payload;
                if (tenantId && userId && event) {
                    // User-specific event: emit to the user's private room
                    const room = `tenant:${tenantId}:user:${userId}`;
                    io.to(room).emit(event, data);
                } else if (payload.room && payload.event) {
                    // Tenant-wide broadcast (e.g. from emitToTenant)
                    io.to(payload.room).emit(payload.event, payload.data);
                } else {
                    console.warn('⚠️ [gateway] Received realtime event with insufficient routing info:', payload);
                }
            } catch (e) {
                console.error('❌ Failed to parse realtime event payload:', e.message);
            }
        }
    });
};

module.exports = { subscribeToRealtimeEvents };
