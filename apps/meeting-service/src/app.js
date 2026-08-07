const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { createCorsOptions, errorHandler, requestLogger } = require('@sparkcrm/shared-middleware');
const meetingRoutes = require('./routes/meeting.routes');
const { requireInternalService } = require('./middleware/security');

const requireInternalCaller = requireInternalService('meeting-service');

const app = express();
app.use(helmet());
app.use(cors(createCorsOptions()));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger('meeting-service'));

app.get('/health', (req, res) => {
  res.json({ service: 'meeting-service', status: 'healthy', timestamp: new Date().toISOString() });
});

app.use('/api/meetings', meetingRoutes);

// Internal endpoints (service-to-service, no auth)
const Meeting = require('./models/Meeting');
const mongoose = require('mongoose');
app.get('/internal/meetings/count', requireInternalCaller, async (req, res) => {
  try {
    const { tenantId } = req.query;
    const filter = tenantId ? { tenantId: new mongoose.Types.ObjectId(tenantId) } : {};
    const count = await Meeting.countDocuments(filter);
    res.json({ success: true, data: { count } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.use(errorHandler);

module.exports = app;
