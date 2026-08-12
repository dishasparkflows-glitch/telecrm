const { WhatsappMessage } = require('../models/WhatsappModels');
const { findLeadByPhone } = require('./leadLookup.service');
const { publishEvent, EVENTS } = require('@sparkcrm/shared-events');

async function publishInboundEvent(message, provider) {
    try {
        await publishEvent(EVENTS.WHATSAPP_MESSAGE_RECEIVED, {
            tenantId: message.tenantId,
            branchId: message.branchId,
            leadId: message.leadId,
            messageId: message._id,
            from: message.message.from,
            type: message.message.type,
            content: message.message.content,
            provider: provider || message.provider?.name,
            idempotencyKey: `whatsapp:${message._id}:received`,
        });
        await WhatsappMessage.updateOne({ _id: message._id }, { 'eventProcessing.eventPublishedAt': new Date(), 'eventProcessing.eventError': '' });
        return true;
    } catch (error) {
        await WhatsappMessage.updateOne({ _id: message._id }, { 'eventProcessing.eventError': String(error.message || error).slice(0, 1000) });
        return false;
    }
}

async function processInboundMessage({ tenantId, branchId = null, userId = null, from, to, type = 'text', content = '', mediaUrl = null, waMessageId, provider }) {
    if (!tenantId || !from || !to || !waMessageId) throw new Error('Inbound message identity is incomplete');
    const lead = await findLeadByPhone(tenantId, from);
    if (!lead) {
        console.log(`📩 [Inbound Service] Ignored message from ${from} (not a lead)`);
        return { created: false, lead: null, ignored: true };
    }
    let message;
    try {
        message = await WhatsappMessage.create({
            tenantId,
            branchId: branchId || lead?.branchId || null,
            leadId: lead?._id || null,
            userId,
            message: {
                direction: 'inbound',
                from,
                to,
                type,
                content: String(content || '').slice(0, 50_000),
            },
            media: {
                mediaUrl,
            },
            provider: {
                waMessageId,
                name: provider
            },
            delivery: {
                status: 'received'
            },
            readState: {
                isRead: false
            },
        });
    } catch (error) {
        if (error?.code !== 11000) throw error;
        return { message: await WhatsappMessage.findOne({ tenantId, 'provider.waMessageId': waMessageId }), created: false, lead };
    }

    const published = await publishInboundEvent(message, provider);
    return { message, created: true, lead, eventPending: !published };
}

async function retryPendingInboundEvents(limit = 100) {
    const boundedLimit = Math.max(1, Math.min(Number(limit) || 100, 100));
    const messages = await WhatsappMessage.find({ 'message.direction': 'inbound', 'eventProcessing.eventPublishedAt': null }).sort({ 'meta.createdAt': 1 }).limit(boundedLimit);
    for (const message of messages) await publishInboundEvent(message);
}

function registerInboundEventRetryJob() {
    const timer = setInterval(() => retryPendingInboundEvents().catch((error) => console.error('WhatsApp inbound event retry failed:', error.message)), 60_000);
    timer.unref?.();
    return timer;
}

module.exports = { processInboundMessage, publishInboundEvent, retryPendingInboundEvents, registerInboundEventRetryJob };
