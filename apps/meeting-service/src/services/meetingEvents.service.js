const { Meeting } = require('../models/Meeting');
const { publishEvent } = require('@sparkcrm/shared-events');

async function publishPendingMeetingEvents(meeting) {
    const remaining = [];
    for (const pending of meeting.pendingEvents || []) {
        try { await publishEvent(pending.event, pending.data); }
        catch (error) { remaining.push({ event: pending.event, data: pending.data, attempts: (pending.attempts || 0) + 1, lastError: String(error.message || error).slice(0, 1000) }); }
    }
    meeting.pendingEvents = remaining;
    await meeting.save();
    return remaining.length === 0;
}

function registerMeetingEventRetryJob() {
    const timer = setInterval(async () => {
        try {
            const meetings = await Meeting.find({ 'pendingEvents.0': { $exists: true } }).sort({ 'meta.updatedAt': 1 }).limit(100);
            for (const meeting of meetings) await publishPendingMeetingEvents(meeting);
        } catch (error) { console.error('Meeting event retry failed:', error.message); }
    }, 60_000);
    timer.unref?.();
    return timer;
}

module.exports = { publishPendingMeetingEvents, registerMeetingEventRetryJob };
