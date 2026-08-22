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
    if (branchId) {
        filter.$or = [{ branchId }, { branchId: null }];
    }
    if (isRead !== undefined) filter['readState.isRead'] = isRead === 'true';

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [notifications, total, unreadCount] = await Promise.all([
        Notification.find(filter).sort({ sentAt: -1 }).skip(skip).limit(parseInt(limit)),
        Notification.countDocuments(filter),
        Notification.countDocuments({ ...filter, 'readState.isRead': false }),
    ]);

    ApiResponse.paginated(res, notifications, {
        page: parseInt(page), limit: parseInt(limit), total,
        totalPages: Math.ceil(total / parseInt(limit)),
        unreadCount,
    });
});

const markAsRead = asyncHandler(async (req, res) => {
    const userId = req.body.userId || req.headers['x-user-id'];
    const { ids } = req.body; // Array of notification IDs

    if (ids?.length) {
        await Notification.updateMany({ _id: { $in: ids }, userId }, { $set: { 'readState.isRead': true, 'readState.readAt': new Date() } });
    }

    ApiResponse.success(res, null, 'Notifications marked as read');
});

const markAllRead = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const userId = req.body.userId || req.headers['x-user-id'];
    const branchId = req.headers['x-branch-id'] || req.headers['x-user-branch-id'];

    const filter = { tenantId, userId, 'readState.isRead': false };
    if (branchId) {
        filter.$or = [{ branchId }, { branchId: null }];
    }

    await Notification.updateMany(filter, { $set: { 'readState.isRead': true, 'readState.readAt': new Date() } });
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

    let device = await DeviceToken.findOne({ token });
    if (device) {
        // Resolve unique index conflicts ({ tenantId, userId, deviceId })
        if (device.deviceId !== deviceId || String(device.userId) !== String(userId) || String(device.tenantId) !== String(tenantId)) {
            const conflict = await DeviceToken.findOne({ tenantId, userId, deviceId });
            if (conflict && String(conflict._id) !== String(device._id)) {
                await DeviceToken.deleteOne({ _id: conflict._id });
            }
        }
        
        device.tenantId = tenantId;
        device.userId = userId;
        device.deviceId = deviceId;
        device.platform = platform;
        device.appVersion = appVersion || '';
        device.isActive = true;
        device.lastSeenAt = new Date();
        device.lastError = '';
        await device.save();
    } else {
        let existingDevice = await DeviceToken.findOne({ tenantId, userId, deviceId });
        if (existingDevice) {
            existingDevice.token = token;
            existingDevice.platform = platform;
            existingDevice.appVersion = appVersion || '';
            existingDevice.isActive = true;
            existingDevice.lastSeenAt = new Date();
            existingDevice.lastError = '';
            device = await existingDevice.save();
        } else {
            device = await DeviceToken.create({
                tenantId, userId, deviceId, token, platform, appVersion: appVersion || '', isActive: true
            });
        }
    }

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
