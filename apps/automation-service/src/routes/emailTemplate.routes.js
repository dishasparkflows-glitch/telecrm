const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/emailTemplate.controller');

router.get('/', ctrl.getTemplates);
router.post('/', ctrl.createTemplate);
router.get('/:id', ctrl.getTemplateById);
router.put('/:id', ctrl.updateTemplate);
router.delete('/:id', ctrl.deleteTemplate);

router.patch('/:id/status', ctrl.updateStatus);
router.post('/:id/duplicate', ctrl.duplicateTemplate);
router.post('/:id/preview', ctrl.previewTemplate);

module.exports = router;
