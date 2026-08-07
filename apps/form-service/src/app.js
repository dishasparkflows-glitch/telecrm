const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { createCorsOptions, errorHandler, requestLogger } = require('@sparkcrm/shared-middleware');
const formRoutes = require('./routes/form.routes');

const app = express();
app.use(helmet());
app.use(cors(createCorsOptions()));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger('form-service'));

app.get('/health', (req, res) => {
  res.json({ service: 'form-service', status: 'healthy', timestamp: new Date().toISOString() });
});

app.use('/api/forms', formRoutes);
app.use(errorHandler);

module.exports = app;
