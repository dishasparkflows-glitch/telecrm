const { WhatsappMessage } = require('../models/WhatsappModels');
const whatsappApi = require('./whatsappApi.service');
const { publishPendingMessageEvents } = require('./messageEvents.service');
const { EVENTS } = require('@sparkcrm/shared-events');

const MAX_ATTEMPTS = 5;

async function deliver(message) {
    const payload = message.deliveryPayload || {};
    if (message.type === 'template') {
        return whatsappApi.sendTemplateMessage(message.to, message.templateName, payload.languageCode || 'en', payload.templateComponents || [], message.tenantId, message.userId);
    }
    if (['image', 'video', 'document', 'audio'].includes(message.type)) {
        return whatsappApi.sendMediaMessage(message.to, message.type, message.mediaUrl, message.content || '', message.tenantId, message.userId);
    }
    return whatsappApi.sendTextMessage(message.to, message.content, message.tenantId, message.userId);
}

async function deliverQueuedMessage(messageId) {
    const staleBefore = new Date(Date.now() - 2 * 60_000);
    const message = await WhatsappMessage.findOneAndUpdate(
        {
            _id: messageId,
            status: 'queued',
            $or: [{ processingAt: null }, { processingAt: { $lte: staleBefore } }],
        },
        { $set: { processingAt: new Date() } },
        { new: true }
    );
    if (!message) return null;

    try {
        const result = await deliver(message);
        message.status = result.status === 'sent' ? 'sent' : 'queued';
        message.waMessageId = result.waMessageId || message.waMessageId;
        message.lastError = result.offline ? 'Waiting for WhatsApp integration configuration' : '';
        message.processingAt = null;
        message.nextAttemptAt = message.status === 'queued' ? new Date(Date.now() + 5 * 60_000) : null;
        if (message.status === 'sent') {
            message.pendingEvents.push({ event: EVENTS.WHATSAPP_MESSAGE_SENT, data: {
                tenantId: message.tenantId, branchId: message.branchId, messageId: message._id,
                leadId: message.leadId, status: 'sent', idempotencyKey: `whatsapp:${message._id}:sent`,
            } });
            if (message.leadId) message.pendingEvents.push({ event: EVENTS.LEAD_UPDATED, data: {
                tenantId: message.tenantId, branchId: message.branchId, leadId: message.leadId,
                changes: { lastContactedAt: new Date(), lastActivityAt: new Date() },
                idempotencyKey: `whatsapp:${message._id}:lead-activity`,
            } });
        }
        await message.save();
        if (message.pendingEvents.length) await publishPendingMessageEvents(message);
        return message;
    } catch (error) {
        message.sendAttempts += 1;
        message.lastError = String(error.message || error).slice(0, 1000);
        message.processingAt = null;
        if (message.sendAttempts >= MAX_ATTEMPTS) {
            message.status = 'failed';
            message.nextAttemptAt = null;
        } else {
            message.status = 'queued';
            message.nextAttemptAt = new Date(Date.now() + Math.min(60_000, 1000 * (2 ** message.sendAttempts)));
        }
        await message.save();
        return message;
    }
}

async function retryQueuedMessages(limit = 50) {
    const boundedLimit = Math.max(1, Math.min(Number(limit) || 50, 100));
    const messages = await WhatsappMessage.find({
        status: 'queued',
        $or: [{ nextAttemptAt: null }, { nextAttemptAt: { $lte: new Date() } }],
    }).select('_id').sort({ createdAt: 1 }).limit(boundedLimit).lean();
    for (const message of messages) await deliverQueuedMessage(message._id);
}

function registerOutboundQueueJob() {
    const timer = setInterval(() => retryQueuedMessages().catch((error) => {
        console.error('WhatsApp outbound queue retry failed:', error.message);
    }), 15_000);
    timer.unref?.();
    return timer;
}

module.exports = { deliverQueuedMessage, retryQueuedMessages, registerOutboundQueueJob, MAX_ATTEMPTS };
