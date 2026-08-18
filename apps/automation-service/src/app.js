const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { createCorsOptions, errorHandler, requestLogger, contextMiddleware } = require('@sparkcrm/shared-middleware');
const automationRoutes = require('./routes/automation.routes');
const emailTemplateRoutes = require('./routes/emailTemplate.routes');
const { requireVerifiedUser } = require('./middleware/security');

const requireGatewayUser = requireVerifiedUser('automation-service');

const app = express();
app.use(helmet());
app.use(cors(createCorsOptions()));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(contextMiddleware);
app.use(requestLogger('automation-service'));

app.get('/health', (req, res) => {
  res.json({ service: 'automation-service', status: 'healthy', timestamp: new Date().toISOString() });
});

app.use('/api/automations/email-templates', requireGatewayUser, emailTemplateRoutes);
app.use('/api/automations', requireGatewayUser, automationRoutes);
app.use(errorHandler);

module.exports = app;
