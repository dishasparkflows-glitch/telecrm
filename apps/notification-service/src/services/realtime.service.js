let io = null;

const setIo = (socketIoInstance) => {
    io = socketIoInstance;
};

const getIo = () => io;

const emitToUser = (userId, eventName, data) => {
    if (!io) {
        console.warn('Socket.IO is not initialized in notification-service');
        return;
    }
    io.to(`user:${userId}`).emit(eventName, data);
};

module.exports = {
    setIo,
    getIo,
    emitToUser,
};
