const mongoose = require('mongoose');
const { ApiResponse, ApiError, asyncHandler } = require('@sparkcrm/shared-utils');
const baileysService = require('../services/baileysSession.service');

const requireValidIdentity = (tenantId, userId) => {
    if (!mongoose.isValidObjectId(tenantId) || !mongoose.isValidObjectId(userId)) {
        throw ApiError.badRequest('Valid tenantId and userId are required');
    }
};

// The Socket.IO instance is set by app.js after it is created
let _io = null;
const setIo = (io) => { _io = io; };

// ── GET /api/whatsapp/qr/status ─────────────────────────────────────────────
// Returns the current connection status for the requesting agent
const getStatus = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const userId   = req.headers['x-user-id'];

    if (!tenantId || !userId) throw ApiError.badRequest('tenantId and userId required');
    requireValidIdentity(tenantId, userId);

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    const status = baileysService.getSessionStatus(tenantId, userId);
    ApiResponse.success(res, status, 'QR status fetched');
});

// ── POST /api/whatsapp/qr/connect ───────────────────────────────────────────
// Starts or restarts a Baileys session for the agent.
// The QR image is pushed to the browser via Socket.IO event 'wa:qr'.
const connect = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const userId   = req.headers['x-user-id'];

    if (!tenantId || !userId) throw ApiError.badRequest('tenantId and userId required');
    requireValidIdentity(tenantId, userId);
    if (!_io) throw ApiError.internal('Socket.IO not initialised');

    // An explicit Connect/Refresh action requests a new pairing session. Clear
    // stale credentials so protocol failures cannot reconnect forever without
    // producing a QR. The generated QR is available through both Socket.IO and
    // the status endpoint, so a browser cannot miss it due to a connection race.
    await baileysService.createSession(tenantId, userId, _io, { fresh: true });

    ApiResponse.success(res, { message: 'Session starting — QR will appear momentarily' }, 'QR session initiated');
});

// ── POST /api/whatsapp/qr/disconnect ────────────────────────────────────────
// Logs the agent out of WhatsApp Web and deletes their session files
const disconnect = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const userId   = req.headers['x-user-id'];

    if (!tenantId || !userId) throw ApiError.badRequest('tenantId and userId required');
    requireValidIdentity(tenantId, userId);

    await baileysService.disconnectSession(tenantId, userId);
    ApiResponse.success(res, null, 'WhatsApp disconnected');
});

module.exports = { getStatus, connect, disconnect, setIo };
