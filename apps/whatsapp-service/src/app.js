const http    = require('http');
const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const jwt = require('jsonwebtoken');
const { createCorsOptions, errorHandler, requestLogger } = require('@sparkcrm/shared-middleware');
const { env } = require('@sparkcrm/shared-config');
const whatsappRoutes      = require('./routes/whatsapp.routes');
const whatsappConfigRoutes = require('./routes/whatsappConfig.routes');
const baileysQRRoutes     = require('./routes/baileysQR.routes');
const whatsappWebhook     = require('./webhooks/whatsapp.webhook');
const whatsappApi         = require('./services/whatsappApi.service');
const qrCtrl              = require('./controllers/baileysQR.controller');
const realtime            = require('./services/realtime.service');
const { requireVerifiedUser, requireInternalService } = require('./middleware/security');

const requireGatewayUser = requireVerifiedUser('whatsapp-service');
const requireInternalCaller = requireInternalService('whatsapp-service');

// ── Express app ────────────────────────────────────────────────────────────────
const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors(createCorsOptions()));
app.use(requestLogger('whatsapp-service'));

// Meta signature verification requires the exact bytes received.
app.use('/webhooks', whatsappWebhook);

// Base64 expands a 15MB media file to roughly 20MB.
app.use(express.json({ limit: '21mb' }));
app.use(express.urlencoded({ extended: true, limit: '21mb' }));

// ── Health check ───────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
    res.json({ service: 'whatsapp-service', status: 'healthy', timestamp: new Date().toISOString() });
});

// ── Internal cache-clear endpoint ──────────────────────────────────────────────
app.delete('/internal/cache/whatsapp/:tenantId', requireInternalCaller, (req, res) => {
    const { tenantId } = req.params;
    whatsappApi.invalidateCache(tenantId);
    console.log(`🗑️ [whatsapp-service] Cache cleared for tenant: ${tenantId}`);
    res.json({ success: true, message: `Cache cleared for tenant ${tenantId}` });
});

// ── API routes ─────────────────────────────────────────────────────────────────
app.use('/api/whatsapp/config',  requireGatewayUser, whatsappConfigRoutes);
app.use('/api/whatsapp/qr',      requireGatewayUser, baileysQRRoutes);
app.use('/api/whatsapp',         requireGatewayUser, whatsappRoutes);
app.use(errorHandler);

// ── HTTP server ────────────────────────────────────────────────────
const server = http.createServer(app);

module.exports = { app, server };
