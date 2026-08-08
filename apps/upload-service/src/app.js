const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const {
  createCorsOptions,
  errorHandler,
  requestLogger,
  requireServiceIdentity,
} = require('@sparkcrm/shared-middleware');

const uploadRoutes = require('./routes/upload.routes');

const app = express();

app.use(helmet());
app.use(cors(createCorsOptions()));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger('upload-service'));

// Health check
app.get('/health', (req, res) => {
  res.json({ service: 'upload-service', status: 'healthy', timestamp: new Date().toISOString() });
});

// Routes
const requireGatewayUser = requireServiceIdentity('upload-service', {
  requireUser: true,
  allowedIssuers: ['api-gateway'],
});

app.use('/api/uploads', requireGatewayUser, uploadRoutes);

app.use(errorHandler);

module.exports = app;
