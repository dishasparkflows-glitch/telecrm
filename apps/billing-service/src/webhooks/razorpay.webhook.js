const express = require('express');
const { handleRazorpayWebhook } = require('../controllers/webhook.controller');

const router = express.Router();

// Backward-compatible provider URL. It shares the same Owner-configured,
// signed and idempotent handler as /api/billing/webhooks/razorpay.
router.post('/razorpay', express.raw({ type: 'application/json' }), handleRazorpayWebhook);

module.exports = router;
