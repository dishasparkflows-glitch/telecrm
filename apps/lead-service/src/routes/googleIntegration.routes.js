const express = require('express');
const googleIntegrationController = require('../controllers/googleIntegration.controller');

const router = express.Router();

// Public webhook
router.post('/webhooks/forms', googleIntegrationController.formWebhook);

// Forms
router.post('/forms/:formId/activate', googleIntegrationController.activateForm);
router.post('/forms/:formId/pause', googleIntegrationController.pauseForm);
router.post('/forms/:formId/sync', googleIntegrationController.syncForm);

// Sheets
router.post('/sheets/import', googleIntegrationController.importSheet);

module.exports = router;
