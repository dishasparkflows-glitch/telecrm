const { Server: SocketIO } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const { createCorsOptions } = require('@sparkcrm/shared-middleware');
const { getRedisClient } = require('@sparkcrm/shared-config');
const { socketAuthMiddleware } = require('./socket.auth');
const { joinUserRooms } = require('./socket.rooms');
const { subscribeToRealtimeEvents } = require('./redis.events');

let io;

const initializeSocket = (server) => {
    io = new SocketIO(server, {
        cors: createCorsOptions(process.env, { methods: ['GET', 'POST'] }),
        path: '/socket.io',
        transports: ['websocket', 'polling'],
        // Tuned for CRM mobile/spotty networks:
        // Default ping interval=25s + timeout=20s means stale sockets linger 45s.
        // This tightens it to 25s total, freeing rooms faster on disconnect.
        pingTimeout: 10000,
        pingInterval: 15000,
    });

    // Redis adapter — required for multi-instance/cluster deployments.
    // Without this, Socket.IO uses an in-memory adapter and events published
    // to Redis are only emitted to users connected to THIS process.
    try {
        const pubClient = getRedisClient().duplicate({ enableOfflineQueue: true });
        const subClient = getRedisClient().duplicate({ enableOfflineQueue: true });
        subClient.on('error', (err) => {
            console.warn('⚠️ Socket.IO Redis subClient error:');
        });
        io.adapter(createAdapter(pubClient, subClient));
        console.log('✅ Socket.IO Redis adapter initialized');
    } catch (err) {
        console.warn('⚠️  Socket.IO Redis adapter failed, falling back to in-memory:', err.message);
    }

    // 1. Authentication
    io.use(socketAuthMiddleware);

    // 2. Connection Handling
    io.on('connection', (socket) => {
        // Join tenant-aware user and broadcast rooms
        joinUserRooms(socket);

        socket.on('disconnect', () => {
            console.log(`🔌 [Socket.IO] User ${socket.user?.userId} disconnected`);
        });
    });

    // 3. Redis Pub/Sub integration
    subscribeToRealtimeEvents(io);

    return io;
};

module.exports = { initializeSocket };
