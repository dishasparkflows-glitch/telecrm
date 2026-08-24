const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/notification.controller');
const reminderSettingsCtrl = require('../controllers/reminderSettings.controller');
router.get('/', ctrl.getNotifications);
router.get('/reminder-settings', reminderSettingsCtrl.getReminderSettings);
router.put('/reminder-settings', reminderSettingsCtrl.updateReminderSettings);
router.put('/read', ctrl.markAsRead);
router.put('/read-all', ctrl.markAllRead);
router.post('/devices', ctrl.registerDevice);
router.delete('/devices/:deviceId', ctrl.unregisterDevice);
router.post('/devices/test', ctrl.testPush);
router.delete('/:id', ctrl.deleteNotification);
router.post('/', ctrl.createNotification); // Internal

module.exports = router;
