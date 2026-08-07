const CallLog = require('../models/CallLog');
const { publishEvent } = require('@sparkcrm/shared-events');

async function publishPendingEvents(callLog) {
    const remaining = [];
    for (const pending of callLog.pendingEvents || []) {
        try {
            await publishEvent(pending.event, pending.data);
        } catch (error) {
            remaining.push({ event: pending.event, data: pending.data, attempts: (pending.attempts || 0) + 1, lastError: String(error.message || error).slice(0, 1000) });
        }
    }
    callLog.pendingEvents = remaining;
    await callLog.save();
    return remaining.length === 0;
}

async function retryPendingCallEvents(limit = 100) {
    const logs = await CallLog.find({ 'pendingEvents.0': { $exists: true } }).sort({ updatedAt: 1 }).limit(limit);
    for (const log of logs) await publishPendingEvents(log);
}

function registerCallEventRetryJob() {
    const timer = setInterval(() => retryPendingCallEvents().catch((error) => console.error('Call event retry failed:', error.message)), 60_000);
    timer.unref?.();
    return timer;
}

module.exports = { publishPendingEvents, retryPendingCallEvents, registerCallEventRetryJob };
