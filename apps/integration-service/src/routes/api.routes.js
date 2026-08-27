const express = require('express');
const IntegrationConnection = require('../models/IntegrationConnection');
const IntegrationAccount = require('../models/IntegrationAccount');
const { disconnectIntegration } = require('../services/integration.service');
const { listForms, getFormFields } = require('../providers/google/google.forms');
const { listSpreadsheets, listWorksheets, previewSheet } = require('../providers/google/google.sheets');

const router = express.Router();

/**
 * GET /api/integrations/status
 * 
 * Returns all active integration connections for the current user/tenant.
 * 
 * Query: provider (optional), integrationType (optional)
 */
router.get('/status', async (req, res) => {
    try {
        const tenantId = req.headers['x-tenant-id'];
        const userId = req.headers['x-user-id'];

        if (!tenantId || !userId) {
            return res.status(401).json({ success: false, message: 'Authentication required' });
        }

        const { provider, integrationType } = req.query;

        const filter = {
            tenantId,
            status: 'CONNECTED',
            $or: [
                { ownerType: 'TENANT', ownerId: tenantId },
                { ownerType: 'USER', ownerId: userId },
            ],
        };
        if (provider) filter.provider = provider.toUpperCase();
        if (integrationType) filter.integrationType = integrationType.toUpperCase();

        const connections = await IntegrationConnection.find(filter)
            .populate({
                path: 'accountId',
                select: 'providerEmail providerAccountId metadata status',
                model: IntegrationAccount,
            })
            .lean();

        const response = connections.map(conn => ({
            connectionId: conn._id,
            provider: conn.provider,
            integrationType: conn.integrationType,
            ownerType: conn.ownerType,
            status: conn.status,
            email: conn.accountId?.providerEmail,
            configuration: conn.configuration,
            connectedAt: conn.meta?.createdAt,
        }));

        res.json({ success: true, data: response });
    } catch (err) {
        console.error('Integration status error:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * GET /api/integrations/status/:integrationType
 * 
 * Returns connection status for a specific integrationType.
 */
router.get('/status/:integrationType', async (req, res) => {
    try {
        const tenantId = req.headers['x-tenant-id'];
        const userId = req.headers['x-user-id'];

        if (!tenantId || !userId) {
            return res.status(401).json({ success: false, message: 'Authentication required' });
        }

        const integrationType = req.params.integrationType.toUpperCase();

        const connection = await IntegrationConnection.findOne({
            tenantId,
            integrationType,
            status: 'CONNECTED',
            $or: [
                { ownerType: 'TENANT', ownerId: tenantId },
                { ownerType: 'USER', ownerId: userId },
            ],
        })
            .populate({ path: 'accountId', select: 'providerEmail metadata', model: IntegrationAccount })
            .lean();

        if (!connection) {
            return res.json({ success: true, data: { connected: false } });
        }

        res.json({
            success: true,
            data: {
                connected: true,
                connectionId: connection._id,
                provider: connection.provider,
                integrationType: connection.integrationType,
                email: connection.accountId?.providerEmail,
                configuration: connection.configuration,
                connectedAt: connection.meta?.createdAt,
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * DELETE /api/integrations/:connectionId
 * 
 * Disconnect a specific integration connection.
 */
router.delete('/:connectionId', async (req, res) => {
    try {
        const tenantId = req.headers['x-tenant-id'];
        const userId = req.headers['x-user-id'];

        if (!tenantId || !userId) {
            return res.status(401).json({ success: false, message: 'Authentication required' });
        }

        const { connectionId } = req.params;

        // Security: ensure user owns this connection
        const connection = await IntegrationConnection.findOne({
            _id: connectionId,
            tenantId,
            $or: [
                { ownerType: 'TENANT', ownerId: tenantId },
                { ownerType: 'USER', ownerId: userId },
            ],
        });

        if (!connection) {
            return res.status(404).json({ success: false, message: 'Connection not found' });
        }

        await disconnectIntegration(tenantId, connectionId);

        res.json({ success: true, message: 'Integration disconnected' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * GET /api/integrations/google/forms
 */
router.get('/google/forms', async (req, res) => {
    try {
        const tenantId = req.headers['x-tenant-id'];
        const userId = req.headers['x-user-id'];
        
        const connection = await IntegrationConnection.findOne({
            tenantId,
            integrationType: 'GOOGLE_FORMS',
            status: 'CONNECTED',
            $or: [{ ownerType: 'TENANT', ownerId: tenantId }, { ownerType: 'USER', ownerId: userId }],
        }).populate('accountId');

        if (!connection) return res.status(401).json({ success: false, message: 'Google Forms not connected' });

        const forms = await listForms(connection.accountId, tenantId);
        res.json({ success: true, data: forms });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

/**
 * GET /api/integrations/google/forms/:formId/fields
 */
router.get('/google/forms/:formId/fields', async (req, res) => {
    try {
        const tenantId = req.headers['x-tenant-id'];
        const userId = req.headers['x-user-id'];
        
        const connection = await IntegrationConnection.findOne({
            tenantId,
            integrationType: 'GOOGLE_FORMS',
            status: 'CONNECTED',
            $or: [{ ownerType: 'TENANT', ownerId: tenantId }, { ownerType: 'USER', ownerId: userId }],
        }).populate('accountId');

        if (!connection) return res.status(401).json({ success: false, message: 'Google Forms not connected' });

        const fields = await getFormFields(connection.accountId, tenantId, req.params.formId);
        res.json({ success: true, data: fields });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

/**
 * GET /api/integrations/google/sheets
 */
router.get('/google/sheets', async (req, res) => {
    try {
        const tenantId = req.headers['x-tenant-id'];
        const userId = req.headers['x-user-id'];
        
        const connection = await IntegrationConnection.findOne({
            tenantId,
            integrationType: 'GOOGLE_SHEETS',
            status: 'CONNECTED',
            $or: [{ ownerType: 'TENANT', ownerId: tenantId }, { ownerType: 'USER', ownerId: userId }],
        }).populate('accountId');

        if (!connection) return res.status(401).json({ success: false, message: 'Google Sheets not connected' });

        const sheets = await listSpreadsheets(connection.accountId, tenantId);
        res.json({ success: true, data: sheets });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

/**
 * GET /api/integrations/google/sheets/:spreadsheetId/worksheets
 */
router.get('/google/sheets/:spreadsheetId/worksheets', async (req, res) => {
    try {
        const tenantId = req.headers['x-tenant-id'];
        const userId = req.headers['x-user-id'];
        
        const connection = await IntegrationConnection.findOne({
            tenantId,
            integrationType: 'GOOGLE_SHEETS',
            status: 'CONNECTED',
            $or: [{ ownerType: 'TENANT', ownerId: tenantId }, { ownerType: 'USER', ownerId: userId }],
        }).populate('accountId');

        if (!connection) return res.status(401).json({ success: false, message: 'Google Sheets not connected' });

        const worksheets = await listWorksheets(connection.accountId, tenantId, req.params.spreadsheetId);
        res.json({ success: true, data: worksheets });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

/**
 * GET /api/integrations/google/sheets/:spreadsheetId/:worksheetName/preview
 */
router.get('/google/sheets/:spreadsheetId/:worksheetName/preview', async (req, res) => {
    try {
        const tenantId = req.headers['x-tenant-id'];
        const userId = req.headers['x-user-id'];
        
        const connection = await IntegrationConnection.findOne({
            tenantId,
            integrationType: 'GOOGLE_SHEETS',
            status: 'CONNECTED',
            $or: [{ ownerType: 'TENANT', ownerId: tenantId }, { ownerType: 'USER', ownerId: userId }],
        }).populate('accountId');

        if (!connection) return res.status(401).json({ success: false, message: 'Google Sheets not connected' });

        const preview = await previewSheet(connection.accountId, tenantId, req.params.spreadsheetId, req.params.worksheetName);
        res.json({ success: true, data: preview });
    } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
