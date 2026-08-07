const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { createCorsOptions, errorHandler, requestLogger } = require('@sparkcrm/shared-middleware');
const notificationRoutes = require('./routes/notification.routes');
const { requireVerifiedUser } = require('./middleware/security');

const requireGatewayUser = requireVerifiedUser('notification-service');

const app = express();
app.use(helmet());
app.use(cors(createCorsOptions()));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger('notification-service'));

app.get('/health', (req, res) => {
  res.json({ service: 'notification-service', status: 'healthy', timestamp: new Date().toISOString() });
});

app.use('/api/notifications', requireGatewayUser, notificationRoutes);
app.use(errorHandler);

module.exports = app;
