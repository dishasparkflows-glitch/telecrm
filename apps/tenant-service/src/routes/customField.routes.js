const express = require('express');
const router = express.Router();
const customFieldController = require('../controllers/customField.controller');

// Definition management
router.get('/', customFieldController.getAllDefinitions);
router.get('/:entity', customFieldController.getDefinitions);
router.post('/', customFieldController.createDefinition);
router.put('/:id', customFieldController.updateDefinition);
router.delete('/:id', customFieldController.deleteDefinition);

module.exports = router;
