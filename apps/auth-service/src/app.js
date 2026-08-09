const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const {
    createCorsOptions,
    errorHandler,
    requestLogger,
    requireServiceIdentity,
    contextMiddleware,
} = require('@sparkcrm/shared-middleware');

const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');

const app = express();

app.use(helmet());
app.use(cookieParser());
app.use(cors(createCorsOptions()));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(contextMiddleware);
app.use(requestLogger('auth-service'));

// Health check
app.get('/health', (req, res) => {
  res.json({ service: 'auth-service', status: 'healthy', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', requireServiceIdentity('auth-service', {
  requireUser: true,
  allowedIssuers: ['api-gateway'],
}), userRoutes);

// Internal endpoints (service-to-service, no auth)
const User = require('./models/User');
const requireInternalCaller = requireServiceIdentity('auth-service');
app.get('/internal/users', requireInternalCaller, async (req, res) => {
  try {
    const { tenantId } = req.query;
    if (!tenantId) return res.status(400).json({ success: false, message: 'tenantId required' });
    const users = await User.find({ tenantId }).select('contact.name contact.email roleId isActive branchId meta.createdAt authentication.lastLoginAt').lean();
    res.json({ success: true, data: users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
app.get('/internal/users/count', requireInternalCaller, async (req, res) => {
  try {
    const { tenantId } = req.query;
    const count = tenantId ? await User.countDocuments({ tenantId }) : await User.countDocuments();
    res.json({ success: true, data: { count } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.use(errorHandler);

module.exports = app;
