const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { createCorsOptions, errorHandler, requestLogger, contextMiddleware } = require('@sparkcrm/shared-middleware');

const taskRoutes = require('./routes/task.routes');
const { requireVerifiedUser } = require('./middleware/security');

const requireGatewayUser = requireVerifiedUser('task-service');

const app = express();

app.use(helmet());
app.use(cors(createCorsOptions()));
app.use(express.json({
  limit: '10mb',
  verify: (req, _res, buf) => {
    req.rawBody = Buffer.from(buf);
  },
}));
app.use(express.urlencoded({ extended: true }));
app.use(contextMiddleware);
app.use(requestLogger('task-service'));

// Health check
app.get('/health', (req, res) => {
  res.json({ service: 'task-service', status: 'healthy', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/tasks', requireGatewayUser, taskRoutes);

app.use(errorHandler);

module.exports = app;
