let io = null;

function setIo(socketIo) {
    io = socketIo;
}

function emitMessage(tenantId, userId, message) {
    if (!io || !tenantId || !userId || !message) return false;
    const payload = typeof message.toJSON === 'function' ? message.toJSON() : message;
    io.to(`qr:${tenantId}:${userId}`).emit('wa:message', { message: payload });
    return true;
}

module.exports = { setIo, emitMessage };
