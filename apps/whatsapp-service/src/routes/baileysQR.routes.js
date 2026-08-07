const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/baileysQR.controller');

// Any logged-in user can connect/disconnect their own number
// POST /api/whatsapp/qr/connect     → start session + stream QR via Socket.IO
// GET  /api/whatsapp/qr/status      → { status, phone, connectedAt }
// POST /api/whatsapp/qr/disconnect  → logout + delete session

router.post('/connect',    ctrl.connect);
router.get('/status',      ctrl.getStatus);
router.post('/disconnect', ctrl.disconnect);

module.exports = router;
