const Lead = require('../models/Lead');
const { publishEvent } = require('@sparkcrm/shared-events');

async function publishPendingLeadEvents(lead) {
    const remaining = [];
    for (const pending of lead.pendingEvents || []) {
        try { await publishEvent(pending.event, pending.data); }
        catch (error) { remaining.push({ event: pending.event, data: pending.data, attempts: (pending.attempts || 0) + 1, lastError: String(error.message || error).slice(0, 1000) }); }
    }
    lead.pendingEvents = remaining;
    await lead.save();
    return remaining.length === 0;
}

async function retryPendingLeadEvents(limit = 100) {
    const leads = await Lead.find({ 'pendingEvents.0': { $exists: true } }).sort({ 'meta.updatedAt': 1 }).limit(limit);
    for (const lead of leads) await publishPendingLeadEvents(lead);
}

function registerLeadEventRetryJob() {
    const timer = setInterval(() => retryPendingLeadEvents().catch((error) => console.error('Lead event retry failed:', error.message)), 60_000);
    timer.unref?.();
    return timer;
}

module.exports = { publishPendingLeadEvents, retryPendingLeadEvents, registerLeadEventRetryJob };
