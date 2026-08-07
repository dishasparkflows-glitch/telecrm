const express = require('express');
const router = express.Router();
const referralCtrl = require('../controllers/referral.controller');

router.get('/code', referralCtrl.getReferralCode);
router.get('/stats', referralCtrl.getReferralStats);

module.exports = router;
