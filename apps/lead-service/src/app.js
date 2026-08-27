const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const FollowUp = require('./models/FollowUp');
const { createCorsOptions, errorHandler, requestLogger, contextMiddleware } = require('@sparkcrm/shared-middleware');

const leadRoutes = require('./routes/lead.routes');
const followupRoutes = require('./routes/followup.routes');
const leadController = require('./controllers/lead.controller');
const { requireVerifiedUser, requireInternalService } = require('./middleware/security');

const requireGatewayUser = requireVerifiedUser('lead-service');
const requireInternalCaller = requireInternalService('lead-service');
const PUBLIC_LEAD_ROUTES = [
  ['GET', /^\/api\/leads\/webhooks\/meta\/?$/],
  ['POST', /^\/api\/leads\/webhooks\/meta\/?$/],
  ['POST', /^\/api\/leads\/webhooks\/inbound\/[a-f0-9]{24}\/?$/],
  ['GET', /^\/api\/leads\/oauth\/meta\/callback\/?$/],
  ['POST', /^\/api\/leads\/google\/webhooks\/forms\/?$/],
];

const requireProtectedLeadRequest = (req, res, next) => {
  const requestPath = req.originalUrl.split('?')[0];
  const isPublic = PUBLIC_LEAD_ROUTES.some(([method, pattern]) => (
    req.method === method && pattern.test(requestPath)
  ));
  if (isPublic) return next();
  
  if (req.headers['x-service-context']) {
      return requireInternalCaller(req, res, next);
  }
  return requireGatewayUser(req, res, next);
};

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
app.use(requestLogger('lead-service'));

// Health check
app.get('/health', (req, res) => {
  res.json({ service: 'lead-service', status: 'healthy', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/leads/google', requireProtectedLeadRequest, require('./routes/googleIntegration.routes'));
app.use('/api/leads', requireProtectedLeadRequest, leadRoutes);
app.use('/api/follow-ups', requireProtectedLeadRequest, followupRoutes);

// Internal endpoints (service-to-service, no auth)
const Lead = require('./models/Lead');
const mongoose = require('mongoose');
app.get('/internal/leads/by-phone/:phone', requireInternalCaller, leadController.getLeadByPhone);
app.get('/internal/leads/bulk', requireInternalCaller, leadController.getLeadsBulk);
app.get('/internal/leads/:id', requireInternalCaller, leadController.getLeadInternal);
app.get('/internal/leads/count', requireInternalCaller, async (req, res) => {
  try {
    const { tenantId } = req.query;
    const filter = tenantId ? { tenantId: new mongoose.Types.ObjectId(tenantId) } : {};
    const count = await Lead.countDocuments(filter);
    res.json({ success: true, data: { count } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/internal/tasks-followups/check-overlap', requireInternalCaller, async (req, res) => {
  try {
    const { tenantId, userId, date } = req.query;
    if (!tenantId || !userId || !date) return res.json({ success: true, overlap: false });
    
    const targetDate = new Date(date);
    
    const followupOverlap = await FollowUp.exists({
      tenantId: new mongoose.Types.ObjectId(tenantId),
      assignedUserId: new mongoose.Types.ObjectId(userId),
      scheduledAt: targetDate,
      status: { $nin: ['completed', 'cancelled', 'missed'] }
    });
    
    res.json({ success: true, overlap: !!followupOverlap });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/internal/leads/ingest', requireInternalCaller, leadController.ingestLeadInternal);

app.use(errorHandler);

module.exports = app;
