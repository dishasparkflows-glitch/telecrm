const { publishRealtimeEvent } = require('@sparkcrm/shared-config');

function emitMessage(tenantId, userId, message) {
    if (!tenantId || !userId || !message) return false;
    const payload = typeof message.toJSON === 'function' ? message.toJSON() : message;

    publishRealtimeEvent({
        type: 'WHATSAPP_MESSAGE_RECEIVED',
        tenantId,
        userId,
        event: 'wa:message',
        data: { message: payload }
    });
    
    return true;
}

module.exports = { emitMessage };