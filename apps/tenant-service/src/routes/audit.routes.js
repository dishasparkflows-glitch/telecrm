const express = require('express');
const router = express.Router();
const auditCtrl = require('../controllers/audit.controller');

router.get('/', auditCtrl.getAuditLogs);
router.get('/export', auditCtrl.exportAuditLogs);
router.get('/record/:recordId', auditCtrl.getRecordAuditHistory);
router.get('/user/:userId', auditCtrl.getUserAuditLogs);
router.post('/', auditCtrl.createAuditLog);

module.exports = router;
