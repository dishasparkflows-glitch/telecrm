const http    = require('http');
const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const { Server: SocketIO } = require('socket.io');
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

// ── HTTP server + Socket.IO ────────────────────────────────────────────────────
const server = http.createServer(app);

const io = new SocketIO(server, {
    cors: createCorsOptions(process.env, { methods: ['GET', 'POST'] }),
    // Allow long-polling fallback for networks that block WebSockets
    transports: ['websocket', 'polling'],
});

// Give the QR controller a reference to io so it can emit QR events
qrCtrl.setIo(io);
realtime.setIo(io);

io.use((socket, next) => {
    try {
        const token = socket.handshake.auth?.token;
        if (!token) return next(new Error('Authentication required'));

        const decoded = jwt.verify(token, env.JWT_SECRET);
        if (!decoded.tenantId || !decoded.userId) {
            return next(new Error('Tenant user identity required'));
        }

        socket.data.tenantId = decoded.tenantId.toString();
        socket.data.userId = decoded.userId.toString();
        next();
    } catch {
        next(new Error('Invalid or expired authentication token'));
    }
});

// Each authenticated agent browser tab joins its existing identity room.
io.on('connection', (socket) => {
    const { tenantId, userId } = socket.data;
    const room = `qr:${tenantId}:${userId}`;
    socket.join(room);
    console.log(`🔌 [Socket.IO] Agent ${userId} joined room ${room}`);

    socket.on('disconnect', () => {
        console.log(`🔌 [Socket.IO] Agent ${userId} disconnected`);
    });
});

module.exports = { app, server, io };
