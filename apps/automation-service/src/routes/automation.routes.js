const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/automation.controller');

router.get('/', ctrl.getRules);
router.post('/', ctrl.createRule);
router.put('/:id', ctrl.updateRule);
router.delete('/:id', ctrl.deleteRule);
router.put('/:id/toggle', ctrl.toggleRule);
router.get('/logs', ctrl.getLogs);

module.exports = router;
