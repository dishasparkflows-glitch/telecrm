const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/form.controller');
const { requireVerifiedUser } = require('../middleware/security');

const requireGatewayUser = requireVerifiedUser('form-service');

router.post('/:id/submit', ctrl.submitForm);  // Public
router.get('/:id/preview', ctrl.getFormPreview); // Public
router.use(requireGatewayUser);
router.get('/', ctrl.getForms);
router.post('/', ctrl.createForm);
router.get('/:id', ctrl.getForm);
router.put('/:id', ctrl.updateForm);
router.get('/:id/submissions', ctrl.getSubmissions);
router.delete('/:id', ctrl.deleteForm);

module.exports = router;
