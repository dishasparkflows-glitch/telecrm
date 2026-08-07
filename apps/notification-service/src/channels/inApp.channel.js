const Notification = require('../models/Notification');

/**
 * Create in-app notification and emit via Socket.IO (if connected)
 */
const sendInApp = async (tenantId, userId, { title, message, type, actionUrl, data }) => {
    const notification = await Notification.create({
        tenantId,
        userId,
        title,
        message,
        type: type || 'info',
        channel: 'in_app',
        actionUrl: actionUrl || '',
        data: data || {},
    });

    // TODO: Emit via Socket.IO to connected client
    // io.to(`user:${userId}`).emit('notification', notification);

    return notification;
};

module.exports = { sendInApp };
