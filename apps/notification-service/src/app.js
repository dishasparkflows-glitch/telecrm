const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const jwt = require('jsonwebtoken');
const { createCorsOptions, errorHandler, requestLogger, contextMiddleware } = require('@sparkcrm/shared-middleware');
const { env } = require('@sparkcrm/shared-config');
const notificationRoutes = require('./routes/notification.routes');
const emailRoutes = require('./routes/email.routes');
const { requireVerifiedUser, requireInternalService } = require('./middleware/security');

const requireGatewayUser = requireVerifiedUser('notification-service');
const requireInternalCaller = requireInternalService('notification-service');

const app = express();
app.use(helmet());
app.use(cors(createCorsOptions()));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(contextMiddleware);
app.use(requestLogger('notification-service'));

app.get('/health', (req, res) => {
  res.json({ service: 'notification-service', status: 'healthy', timestamp: new Date().toISOString() });
});

app.use('/api/notifications', requireGatewayUser, notificationRoutes);
app.use('/api/emails', requireGatewayUser, emailRoutes);

// Internal routes
app.use('/internal/emails', requireInternalCaller, emailRoutes);

app.use(errorHandler);

const server = http.createServer(app);

module.exports = { app, server };
