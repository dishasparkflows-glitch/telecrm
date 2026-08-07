const express = require('express');
const router = express.Router();
const billingCtrl = require('../controllers/billing.controller');
const webhookCtrl = require('../controllers/webhook.controller');
const { requireTrustedGateway } = require('../middleware/serviceAuth.middleware');

// Provider signatures must be verified against the exact bytes received.
router.post('/webhooks/stripe', express.raw({ type: 'application/json' }), webhookCtrl.handleStripeWebhook);
router.post('/webhooks/razorpay', express.raw({ type: 'application/json' }), webhookCtrl.handleRazorpayWebhook);

router.use(requireTrustedGateway);

// Checkouts
router.get('/available-methods', billingCtrl.getAvailablePaymentMethods);
router.post('/subscribe', billingCtrl.createSubscription);
router.post('/verify-payment', billingCtrl.verifyPayment);
router.get('/payment-status/:invoiceId', billingCtrl.getPaymentStatus);
router.get('/invoices', billingCtrl.getInvoices);
router.get('/invoices/:id', billingCtrl.getInvoice);

module.exports = router;
