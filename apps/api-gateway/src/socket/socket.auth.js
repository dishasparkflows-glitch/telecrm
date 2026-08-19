const jwt = require('jsonwebtoken');
const { env } = require('@sparkcrm/shared-config');

const socketAuthMiddleware = (socket, next) => {
    try {
        const token = socket.handshake.auth?.token;
        if (!token) return next(new Error('Authentication required'));

        const decoded = jwt.verify(token, env.JWT_SECRET);
        if (!decoded.tenantId || !decoded.userId) {
            return next(new Error('Tenant user identity required'));
        }

        // Establish the authoritative identity context from the validated token
        // Ignore any client-provided tenantId/userId from the handshake
        socket.user = {
            userId: decoded.userId.toString(),
            tenantId: decoded.tenantId.toString(),
            branchId: decoded.branchId ? decoded.branchId.toString() : null,
            role: decoded.role || null
        };
        
        next();
    } catch {
        next(new Error('Invalid or expired authentication token'));
    }
};

module.exports = { socketAuthMiddleware };
