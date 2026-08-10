const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const {
  createCorsOptions,
  errorHandler,
  requestLogger,
  requireServiceIdentity,
  contextMiddleware,
} = require('@sparkcrm/shared-middleware');

const tenantRoutes = require('./routes/tenant.routes');
const planRoutes = require('./routes/plan.routes');
const referralRoutes = require('./routes/referral.routes');
const internalRoutes = require('./routes/internal.routes');
const auditRoutes = require('./routes/audit.routes');
const roleRoutes = require('./routes/role.routes');
const moduleRoutes = require('./routes/module.routes');
const branchRoutes = require('./routes/branch.routes');
const customFieldRoutes = require('./routes/customField.routes');
const integrationRoutes = require('./routes/integration.routes');
const ownerRoutes = require('./routes/owner.routes');

const app = express();

app.use(helmet());
app.use(cors(createCorsOptions()));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(contextMiddleware);
app.use(requestLogger('tenant-service'));

// Health check
app.get('/health', (req, res) => {
  res.json({ service: 'tenant-service', status: 'healthy', timestamp: new Date().toISOString() });
});

// Routes
const requireGatewayUser = requireServiceIdentity('tenant-service', {
  requireUser: true,
  allowedIssuers: ['api-gateway'],
});
const requireInternalCaller = requireServiceIdentity('tenant-service');

app.use('/api/tenants', requireGatewayUser, tenantRoutes);
app.use('/api/plans', planRoutes);
app.use('/api/referral', requireGatewayUser, referralRoutes);
app.use('/api/roles', requireGatewayUser, roleRoutes);
app.use('/api/modules', requireGatewayUser, moduleRoutes);
app.use('/api/branches', requireGatewayUser, branchRoutes);
app.use('/api/custom-fields', requireGatewayUser, customFieldRoutes);
app.use('/api/integrations', requireGatewayUser, integrationRoutes);
app.use('/internal', requireInternalCaller, internalRoutes);
app.use('/api/audit', requireServiceIdentity('tenant-service', { requireUser: false }), auditRoutes);
app.use('/api/owner', requireGatewayUser, ownerRoutes);

app.use(errorHandler);

module.exports = app;
