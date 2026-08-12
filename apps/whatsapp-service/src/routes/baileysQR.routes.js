const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/baileysQR.controller');

router.post('/connect',    ctrl.connect);
router.get('/status',      ctrl.getStatus);
router.post('/disconnect', ctrl.disconnect);

module.exports = router;
