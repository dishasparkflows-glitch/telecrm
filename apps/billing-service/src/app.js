const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { createCorsOptions, errorHandler, requestLogger } = require('@sparkcrm/shared-middleware');

const billingRoutes = require('./routes/billing.routes');
const featureRoutes = require('./routes/feature.routes');
const paymentConfigRoutes = require('./routes/paymentConfig.routes');
const razorpayWebhook = require('./webhooks/razorpay.webhook');
const { requireTrustedGateway } = require('./middleware/serviceAuth.middleware');

const app = express();

app.use(helmet());
app.use(cors(createCorsOptions()));

// Razorpay webhooks need raw body — mount before JSON parser
app.use('/webhooks', razorpayWebhook);

// Skip global JSON parser for Stripe webhook (it needs raw body)
app.use((req, res, next) => {
  if (
    req.originalUrl === '/api/billing/webhooks/stripe' ||
    req.originalUrl === '/api/billing/webhooks/razorpay'
  ) {
    return next();
  }
  express.json({ limit: '10mb' })(req, res, next);
});
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger('billing-service'));

// Health check
app.get('/health', (req, res) => {
  res.json({ service: 'billing-service', status: 'healthy', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/billing', billingRoutes);
app.use('/api/features', requireTrustedGateway, featureRoutes);
app.use('/api/payments', paymentConfigRoutes);

app.use(errorHandler);

module.exports = app;
