const express = require('express');
const router = express.Router();
const {
    getProviders,
    getIntegrations,
    getIntegration,
    saveIntegration,
    deleteIntegration,
    testIntegration,
} = require('../controllers/integration.controller');

// GET /api/integrations/providers — field definitions for each provider
router.get('/providers', getProviders);

// GET /api/integrations — all configured integrations (masked)
router.get('/', getIntegrations);

// GET /api/integrations/:provider — single integration details
router.get('/:provider', getIntegration);

// POST /api/integrations — create or update integration credentials
router.post('/', saveIntegration);

// POST /api/integrations/:provider/test — test connectivity
router.post('/:provider/test', testIntegration);

// DELETE /api/integrations/:provider — remove integration
router.delete('/:provider', deleteIntegration);

module.exports = router;
