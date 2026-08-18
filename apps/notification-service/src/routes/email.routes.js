const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/email.controller');

router.post('/send', ctrl.sendRawEmail);

module.exports = router;
