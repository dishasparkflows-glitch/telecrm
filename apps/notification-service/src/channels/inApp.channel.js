const Notification = require('../models/Notification');
const realtimeService = require('../services/realtime.service');

/**
 * Create in-app notification and emit via Socket.IO (if connected)
 */
const sendInApp = async (tenantId, userId, { title, message, type, actionUrl, actionType, data, branchId }) => {
    const notification = await Notification.create({
        tenantId,
        userId,
        branchId: branchId || null,
        channel: 'in_app',
        notification: {
            type: type || 'info',
            title,
            message,
            data: data || {},
        },
        action: {
            actionUrl: actionUrl || '',
            actionType: actionType || '',
        }
    });

    // Emit via Socket.IO to connected client
    realtimeService.emitToUser(userId, 'notification', notification);

    return notification;
};

module.exports = { sendInApp };
