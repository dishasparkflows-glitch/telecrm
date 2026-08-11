const express = require('express');
const router = express.Router();
const callCtrl = require('../controllers/call.controller');
const rateLimit = require('express-rate-limit');

const initiateRateLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // limit each IP/tenant to 10 requests per windowMs
    message: 'Too many calls initiated from this account, please try again after a minute'
});

router.post('/initiate', initiateRateLimiter, callCtrl.initiateCall);
router.post('/mobile/sync', callCtrl.syncMobileCalls);
router.post('/:id/recording', callCtrl.uploadCallRecording);
router.get('/:id/recording', callCtrl.getCallRecording);
router.get('/logs', callCtrl.getCallLogs);
router.get('/stats', callCtrl.getCallStats);
router.put('/:id/disposition', callCtrl.updateDisposition);

module.exports = router;
