const express = require('express');
const router = express.Router();
const {
    listModules,
    createModule,
    updateModule,
    reorderModules,
    deleteModule,
} = require('../controllers/module.controller');

// GET  /api/modules              — List all active modules
router.get('/', listModules);

// POST /api/modules              — Create custom module
router.post('/', createModule);

// PUT  /api/modules/reorder      — Bulk reorder
router.put('/reorder', reorderModules);

// PUT  /api/modules/:id          — Update module
router.put('/:id', updateModule);

// DELETE /api/modules/:id        — Delete custom module
router.delete('/:id', deleteModule);

module.exports = router;
