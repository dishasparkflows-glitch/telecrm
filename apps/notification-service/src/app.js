const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { Server: SocketIO } = require('socket.io');
const jwt = require('jsonwebtoken');
const { createCorsOptions, errorHandler, requestLogger, contextMiddleware } = require('@sparkcrm/shared-middleware');
const { env } = require('@sparkcrm/shared-config');
const notificationRoutes = require('./routes/notification.routes');
const { requireVerifiedUser } = require('./middleware/security');
const realtimeService = require('./services/realtime.service');

const requireGatewayUser = requireVerifiedUser('notification-service');

const app = express();
app.use(helmet());
app.use(cors(createCorsOptions()));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(contextMiddleware);
app.use(requestLogger('notification-service'));

app.get('/health', (req, res) => {
  res.json({ service: 'notification-service', status: 'healthy', timestamp: new Date().toISOString() });
});

app.use('/api/notifications', requireGatewayUser, notificationRoutes);
app.use(errorHandler);

const server = http.createServer(app);

const io = new SocketIO(server, {
    cors: createCorsOptions(process.env, { methods: ['GET', 'POST'] }),
    path: '/socket.io-notifications',
    transports: ['websocket', 'polling'],
});

realtimeService.setIo(io);

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

io.on('connection', (socket) => {
    const { userId } = socket.data;
    const room = `user:${userId}`;
    socket.join(room);
    console.log(`🔌 [Socket.IO/Notifications] User ${userId} joined room ${room}`);

    socket.on('disconnect', () => {
        console.log(`🔌 [Socket.IO/Notifications] User ${userId} disconnected`);
    });
});

module.exports = { app, server, io };
