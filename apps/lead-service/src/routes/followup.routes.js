const express = require('express');
const router = express.Router();
const followupCtrl = require('../controllers/followup.controller');

router.get('/stats', followupCtrl.getFollowUpStats);
router.get('/', followupCtrl.getFollowUps);
router.post('/', followupCtrl.createFollowUp);
router.post('/:id/complete', followupCtrl.completeFollowUp);
router.post('/:id/reschedule', followupCtrl.rescheduleFollowUp);
router.post('/:id/cancel', followupCtrl.cancelFollowUp);

module.exports = router;
