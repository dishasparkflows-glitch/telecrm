const Notification = require('../models/Notification');
const DeviceToken = require('../models/DeviceToken');
const { sendPushToUser } = require('../channels/push.channel');
const { ApiResponse, ApiError, asyncHandler } = require('@sparkcrm/shared-utils');

const getNotifications = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const userId = req.headers['x-user-id'];
    const branchId = req.headers['x-branch-id'] || req.headers['x-user-branch-id'];
    const { page = 1, limit = 25, isRead } = req.query;

    const filter = { tenantId, userId };
    if (branchId) filter.branchId = branchId;
    if (isRead !== undefined) filter.isRead = isRead === 'true';

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [notifications, total, unreadCount] = await Promise.all([
        Notification.find(filter).sort({ 'meta.createdAt': -1 }).skip(skip).limit(parseInt(limit)),
        Notification.countDocuments(filter),
        Notification.countDocuments({ ...filter, isRead: false }),
    ]);

    ApiResponse.paginated(res, notifications, {
        page: parseInt(page), limit: parseInt(limit), total,
        totalPages: Math.ceil(total / parseInt(limit)),
        unreadCount,
    });
});

const markAsRead = asyncHandler(async (req, res) => {
    const userId = req.headers['x-user-id'];
    const { ids } = req.body; // Array of notification IDs

    if (ids?.length) {
        await Notification.updateMany({ _id: { $in: ids }, userId }, { isRead: true, readAt: new Date() });
    }

    ApiResponse.success(res, null, 'Notifications marked as read');
});

const markAllRead = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const userId = req.headers['x-user-id'];
    const branchId = req.headers['x-branch-id'] || req.headers['x-user-branch-id'];

    const filter = { tenantId, userId, isRead: false };
    if (branchId) filter.branchId = branchId;

    await Notification.updateMany(filter, { isRead: true, readAt: new Date() });
    ApiResponse.success(res, null, 'All notifications marked as read');
});

const createNotification = asyncHandler(async (req, res) => {
    const notification = await Notification.create(req.body);
    ApiResponse.created(res, notification);
});

const registerDevice = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const userId = req.headers['x-user-id'];
    const { deviceId, token, platform, appVersion } = req.body;
    if (!deviceId || !token || !['android', 'ios', 'web'].includes(platform)) {
        throw ApiError.badRequest('deviceId, token, and a valid platform are required');
    }

    await DeviceToken.updateMany({ token, $or: [{ tenantId: { $ne: tenantId } }, { userId: { $ne: userId } }] }, { $set: { isActive: false } });
    const device = await DeviceToken.findOneAndUpdate(
        { tenantId, userId, deviceId },
        { $set: { token, platform, appVersion: appVersion || '', isActive: true, lastSeenAt: new Date(), lastError: '' } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    ApiResponse.success(res, { deviceId: device.deviceId, platform: device.platform, isActive: device.isActive }, 'Push notification device registered');
});

const unregisterDevice = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const userId = req.headers['x-user-id'];
    const result = await DeviceToken.updateOne(
        { tenantId, userId, deviceId: req.params.deviceId },
        { $set: { isActive: false } }
    );
    if (!result.matchedCount) throw ApiError.notFound('Registered device not found');
    ApiResponse.success(res, null, 'Push notification device unregistered');
});

const testPush = asyncHandler(async (req, res) => {
    const result = await sendPushToUser({
        tenantId: req.headers['x-tenant-id'],
        userId: req.headers['x-user-id'],
        title: 'SparkCRM notifications are ready',
        body: 'This device can receive lead, call, meeting, and follow-up alerts.',
        data: { type: 'configuration_test' },
    });
    if (!result.sent) throw ApiError.badRequest(result.failed ? 'Push delivery failed. Verify Firebase configuration and device token.' : 'No active device is registered.');
    ApiResponse.success(res, result, 'Test push notification sent');
});

const deleteNotification = asyncHandler(async (req, res) => {
    const userId = req.headers['x-user-id'];
    const notification = await Notification.findOneAndDelete({ _id: req.params.id, userId });
    if (!notification) throw ApiError.notFound('Notification not found');
    ApiResponse.success(res, null, 'Notification deleted');
});

module.exports = { getNotifications, markAsRead, markAllRead, createNotification, registerDevice, unregisterDevice, testPush, deleteNotification };
