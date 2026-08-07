const { getRedisSubscriber, isSubscriberReady } = require('@sparkcrm/shared-config');

const handlersByEvent = new Map();
const subscribedEvents = new Set();
let dispatcherRegistered = false;

const dispatchMessage = async (channel, message) => {
    const handlers = handlersByEvent.get(channel);
    if (!handlers || handlers.size === 0) return;

    let parsed;
    try {
        parsed = JSON.parse(message);
    } catch (err) {
        console.error(`❌ Failed to parse event ${channel}:`, err.message);
        return;
    }

    await Promise.allSettled(
        [...handlers].map(async (handler) => {
            try {
                await handler(channel, parsed.data, parsed.timestamp);
            } catch (err) {
                console.error(`❌ Failed to process event ${channel}:`, err.message);
            }
        })
    );
};

/**
 * Subscribe to one or more Redis Pub/Sub events.
 * The established handler contract is (eventName, data, timestamp).
 *
 * @param {string|string[]} events - Event name(s) to subscribe to
 * @param {Function} handler - Callback function (eventName, data, timestamp) => {}
 */
const subscribeToEvents = async (events, handler) => {
    try {
        const subscriber = getRedisSubscriber();

        if (!dispatcherRegistered) {
            subscriber.on('message', dispatchMessage);
            dispatcherRegistered = true;
        }

        // Wait briefly for the initial connection attempt without preventing
        // the rest of the service from starting when Redis is unavailable.
        if (!isSubscriberReady()) {
            await new Promise((resolve) => setTimeout(resolve, 8000));
        }

        if (!isSubscriberReady()) {
            console.warn('⚠️  Redis Pub/Sub unavailable — event subscriptions skipped');
            return;
        }

        const eventList = Array.isArray(events) ? events : [events];

        for (const event of eventList) {
            if (!handlersByEvent.has(event)) handlersByEvent.set(event, new Set());
            handlersByEvent.get(event).add(handler);

            if (subscribedEvents.has(event)) continue;

            try {
                await subscriber.subscribe(event);
                subscribedEvents.add(event);
                console.log(`📥 Subscribed to event: ${event}`);
            } catch (err) {
                handlersByEvent.get(event).delete(handler);
                console.warn(`⚠️  Failed to subscribe to ${event}: ${err.message}`);
            }
        }
    } catch (error) {
        console.warn('⚠️  Event subscription failed (non-blocking):', error.message);
    }
};

module.exports = { subscribeToEvents };
