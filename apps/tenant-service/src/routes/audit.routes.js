const express = require('express');
const router = express.Router();
const auditCtrl = require('../controllers/audit.controller');

router.get('/', auditCtrl.getAuditLogs);
router.post('/', auditCtrl.createAuditLog); // Internal

module.exports = router;
