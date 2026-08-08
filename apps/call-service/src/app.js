const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { createCorsOptions, errorHandler, requestLogger, contextMiddleware } = require('@sparkcrm/shared-middleware');
const callRoutes = require('./routes/call.routes');
const exotelWebhook = require('./webhooks/exotel.webhook');
const { requireVerifiedUser, requireInternalService } = require('./middleware/security');

const requireGatewayUser = requireVerifiedUser('call-service');
const requireInternalCaller = requireInternalService('call-service');

const app = express();
app.use(helmet());
app.use(cors(createCorsOptions()));
app.use(requestLogger('call-service'));

// Provider signature verification requires the exact bytes received.
app.use('/webhooks', exotelWebhook);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(contextMiddleware);

app.get('/health', (req, res) => {
  res.json({ service: 'call-service', status: 'healthy', timestamp: new Date().toISOString() });
});

app.use('/api/calls', requireGatewayUser, callRoutes);

// Internal endpoints (service-to-service, no auth)
const CallLog = require('./models/CallLog');
const mongoose = require('mongoose');
app.get('/internal/calls/count', requireInternalCaller, async (req, res) => {
  try {
    const { tenantId } = req.query;
    const filter = tenantId ? { tenantId: new mongoose.Types.ObjectId(tenantId) } : {};
    const count = await CallLog.countDocuments(filter);
    res.json({ success: true, data: { count } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.use(errorHandler);

module.exports = app;
