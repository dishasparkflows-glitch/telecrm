const express = require('express');
const googleIntegrationController = require('../controllers/googleIntegration.controller');

const router = express.Router();

// Public webhook
router.post('/webhooks/forms', googleIntegrationController.formWebhook);

router.get('/status', googleIntegrationController.checkAuth);

// Forms
router.get('/forms', googleIntegrationController.listForms);
router.get('/forms/:formId/fields', googleIntegrationController.getFormFields);
router.post('/forms/:formId/test', googleIntegrationController.testForm);
router.post('/forms/:formId/activate', googleIntegrationController.activateForm);
router.post('/forms/:formId/pause', googleIntegrationController.pauseForm);
router.post('/forms/:formId/sync', googleIntegrationController.syncForm);

// Sheets
router.get('/sheets', googleIntegrationController.listSpreadsheets);
router.get('/sheets/:spreadsheetId/worksheets', googleIntegrationController.listWorksheets);
router.get('/sheets/:spreadsheetId/:worksheetName/preview', googleIntegrationController.previewSheet);
router.post('/sheets/import', googleIntegrationController.importSheet);

module.exports = router;
