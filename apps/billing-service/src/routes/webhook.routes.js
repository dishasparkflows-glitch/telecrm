const express = require('express');
const webhookController = require('../controllers/webhook.controller');

const router = express.Router();
const rawJson = express.raw({ type: 'application/json', limit: '1mb' });

router.post('/stripe', rawJson, webhookController.handleStripeWebhook);
router.post('/razorpay', rawJson, webhookController.handleRazorpayWebhook);

module.exports = router;
