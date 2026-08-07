const express = require('express');
const router = express.Router();
const planCtrl = require('../controllers/plan.controller');

// Public plan catalog is read-only. Owner plan management remains under
// /api/owner/plans and keeps its existing workflow and payloads.
router.get('/', planCtrl.getAllPlans);
router.get('/:slug', planCtrl.getPlanBySlug);

module.exports = router;
