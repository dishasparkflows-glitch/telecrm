const express = require('express');
const router = express.Router();
const callCtrl = require('../controllers/call.controller');

router.post('/initiate', callCtrl.initiateCall);
router.post('/mobile/sync', callCtrl.syncMobileCalls);
router.post('/:id/recording', callCtrl.uploadCallRecording);
router.get('/:id/recording', callCtrl.getCallRecording);
router.get('/logs', callCtrl.getCallLogs);
router.get('/stats', callCtrl.getCallStats);
router.put('/:id/disposition', callCtrl.updateDisposition);

module.exports = router;
