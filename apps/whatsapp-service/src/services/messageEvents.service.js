const { WhatsappMessage } = require('../models/WhatsappModels');
const { publishEvent } = require('@sparkcrm/shared-events');

async function publishPendingMessageEvents(message) {
    const remaining = [];
    for (const pending of message.pendingEvents || []) {
        try { await publishEvent(pending.event, pending.data); }
        catch (error) { remaining.push({ event: pending.event, data: pending.data, attempts: (pending.attempts || 0) + 1, lastError: String(error.message || error).slice(0, 1000) }); }
    }
    message.pendingEvents = remaining;
    await message.save();
    return remaining.length === 0;
}

async function retryPendingMessageEvents(limit = 100) {
    const boundedLimit = Math.max(1, Math.min(Number(limit) || 100, 100));
    const messages = await WhatsappMessage.find({ 'pendingEvents.0': { $exists: true } }).sort({ updatedAt: 1 }).limit(boundedLimit);
    for (const message of messages) await publishPendingMessageEvents(message);
}

function registerMessageEventRetryJob() {
    const timer = setInterval(() => retryPendingMessageEvents().catch((error) => console.error('WhatsApp message event retry failed:', error.message)), 60_000);
    timer.unref?.();
    return timer;
}

module.exports = { publishPendingMessageEvents, retryPendingMessageEvents, registerMessageEventRetryJob };
