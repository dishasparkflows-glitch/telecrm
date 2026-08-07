const express = require('express');
const router = express.Router();
const {
    createRole,
    listRoles,
    getRole,
    updateRole,
    updatePermissions,
    deleteRole,
    getAvailableModules,
} = require('../controllers/role.controller');

// GET  /api/roles                    — List all roles
router.get('/', listRoles);

// GET  /api/roles/available-modules  — Get module keys for permission matrix
router.get('/available-modules', getAvailableModules);

// POST /api/roles                    — Create a new role
router.post('/', createRole);

// GET  /api/roles/:id                — Get single role
router.get('/:id', getRole);

// PUT  /api/roles/:id                — Update role info
router.put('/:id', updateRole);

// PUT  /api/roles/:id/permissions    — Update permissions
router.put('/:id/permissions', updatePermissions);

// DELETE /api/roles/:id              — Delete role
router.delete('/:id', deleteRole);

module.exports = router;
