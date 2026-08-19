const Notification = require('../models/Notification');
const realtimeService = require('../services/realtime.service');

/**
 * Create in-app notification and emit via Socket.IO (if connected)
 * 
 * @param {string} tenantId
 * @param {string|null} userId  - If null, notification is saved but NOT pushed via socket
 * @param {object} options
 */
const sendInApp = async (tenantId, userId, { title, message, type, actionUrl, actionType, data, branchId }) => {
    if (!tenantId) {
        console.warn('⚠️ [inApp] sendInApp called without tenantId — skipping');
        return null;
    }

    const notification = await Notification.create({
        tenantId,
        userId: userId || null,
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

    // Only emit socket event if there's a real user to push to.
    // userId=null means it's a tenant-wide/admin notification stored in DB only.
    if (userId) {
        // Convert Mongoose doc to plain object so tenantId is accessible as a
        // regular property when publishRealtimeEvent checks data?.tenantId.
        const plain = notification.toObject ? notification.toObject() : notification;
        realtimeService.emitToUser(userId, 'notification', plain);
    }

    return notification;
};

module.exports = { sendInApp };
