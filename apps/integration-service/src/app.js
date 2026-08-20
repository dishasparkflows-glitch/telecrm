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

const internalRoutes = require('./routes/internal.routes');
const oauthRoutes = require('./routes/oauth.routes');
const apiRoutes = require('./routes/api.routes');

const app = express();

app.use(helmet());
app.use(cors(createCorsOptions()));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(contextMiddleware);
app.use(requestLogger('integration-service'));

// Health check
app.get('/health', (req, res) => {
    res.json({ service: 'integration-service', status: 'healthy', timestamp: new Date().toISOString() });
});

// Routes
// OAuth flow — authorize is protected (auth required), callback is public (redirect from Google)
app.use('/api/integrations/oauth', oauthRoutes);

// Authenticated API routes (connection status, disconnect, logs)
app.use('/api/integrations', apiRoutes);

// Internal service-to-service routes (no auth — only trusted services call these)
app.use('/internal', internalRoutes);

app.use(errorHandler);

module.exports = app;
