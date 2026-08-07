const express = require('express');
const router = express.Router();
const tenantCtrl = require('../controllers/tenant.controller');

router.get('/profile', tenantCtrl.getProfile);
router.put('/settings', tenantCtrl.updateSettings);
router.get('/trial-status', tenantCtrl.getTrialStatus);
router.get('/billing', tenantCtrl.getBillingDetails);
router.get('/payment-history', tenantCtrl.getPaymentHistory);
router.post('/upgrade-plan', tenantCtrl.upgradePlan);
router.put('/pipeline', tenantCtrl.updatePipeline);
router.post('/custom-fields', tenantCtrl.addCustomField);
router.put('/onboarding', tenantCtrl.updateOnboarding);

module.exports = router;
