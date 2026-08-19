const joinUserRooms = (socket) => {
    const { userId, tenantId, branchId } = socket.user;

    // 1. Strict per-user room (private notifications, direct events)
    const userRoom = `tenant:${tenantId}:user:${userId}`;
    socket.join(userRoom);

    // 2. Tenant-wide broadcast room (e.g. new lead came in, show badge for all users)
    const tenantRoom = `tenant:${tenantId}`;
    socket.join(tenantRoom);

    // 3. Branch-scoped room (e.g. broadcast to all users in a specific branch)
    if (branchId) {
        const branchRoom = `tenant:${tenantId}:branch:${branchId}`;
        socket.join(branchRoom);
    }

    console.log(
        `🔌 [Socket.IO] User ${userId} joined rooms: ${userRoom}` +
        (branchId ? `, tenant:${tenantId}:branch:${branchId}` : '') +
        `, tenant:${tenantId}`
    );
};

module.exports = { joinUserRooms };
