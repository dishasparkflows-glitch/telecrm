const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/analytics.controller');

router.get('/dashboard', ctrl.getDashboard);
router.get('/leads', ctrl.getLeadAnalytics);
router.get('/calls', ctrl.getCallAnalytics);
router.get('/team', ctrl.getTeamAnalytics);
router.get('/revenue', ctrl.getRevenueAnalytics);

module.exports = router;
