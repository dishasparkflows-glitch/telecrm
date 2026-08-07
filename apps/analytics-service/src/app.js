const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { createCorsOptions, errorHandler, requestLogger } = require('@sparkcrm/shared-middleware');
const analyticsRoutes = require('./routes/analytics.routes');
const { requireVerifiedUser } = require('./middleware/security');

const requireGatewayUser = requireVerifiedUser('analytics-service');

const app = express();
app.use(helmet());
app.use(cors(createCorsOptions()));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger('analytics-service'));

app.get('/health', (req, res) => {
  res.json({ service: 'analytics-service', status: 'healthy', timestamp: new Date().toISOString() });
});

app.use('/api/analytics', requireGatewayUser, analyticsRoutes);
app.use(errorHandler);

module.exports = app;
