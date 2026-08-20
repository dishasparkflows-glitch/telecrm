const express = require('express');
const { getCalendars, getFreeBusy, createCalendarEvent, updateCalendarEvent, deleteCalendarEvent } = require('../providers/google/google.calendar');
const { listSpreadsheets, listWorksheets, previewSheet, getSheetRows, appendSheetRows } = require('../providers/google/google.sheets');
const { listForms, getFormFields, getFormResponses, createFormWatch, renewFormWatch, deleteFormWatch } = require('../providers/google/google.forms');
const { getIntegrationConnection } = require('../services/integration.service');
const IntegrationConnection = require('../models/IntegrationConnection');

const router = express.Router();

/**
 * Middleware to check internal connection validity
 */
const requireConnection = async (req, res, next) => {
    try {
        const tenantId = req.query.tenantId || req.body.tenantId;
        const connectionId = req.params.connectionId || req.body.connectionId;
        
        if (!tenantId || !connectionId) {
            return res.status(400).json({ success: false, message: 'tenantId and connectionId are required' });
        }

        const connection = await getIntegrationConnection(tenantId, connectionId);
        if (!connection || connection.status !== 'CONNECTED') {
            return res.status(404).json({ success: false, message: 'Active connection not found' });
        }

        req.connection = connection;
        req.accountId = connection.accountId;
        req.tenantId = tenantId;
        next();
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * Connection Resolver
 */
router.post('/connections/resolve', async (req, res) => {
    try {
        const { tenantId, ownerId, provider, integrationType } = req.body;
        if (!tenantId || !ownerId || !provider || !integrationType) {
            return res.status(400).json({ success: false, message: 'Missing required parameters' });
        }

        const connection = await IntegrationConnection.findOne({
            tenantId,
            $or: [{ ownerType: 'TENANT', ownerId: tenantId }, { ownerType: 'USER', ownerId }],
            provider,
            integrationType,
            status: 'CONNECTED'
        }).lean();

        if (!connection) {
            return res.status(404).json({ success: false, message: 'Connection not found' });
        }

        res.json({ success: true, data: { connectionId: connection._id, accountId: connection.accountId, configuration: connection.configuration } });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * Google Calendar Internal APIs
 */

router.get('/google/calendar/list/:connectionId', requireConnection, async (req, res) => {
    try {
        const calendars = await getCalendars(req.accountId, req.tenantId);
        res.json({ success: true, data: calendars });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

router.post('/google/calendar/freebusy', requireConnection, async (req, res) => {
    try {
        const { calendarId, timeMin, timeMax, timezone } = req.body;
        const busySlots = await getFreeBusy(req.accountId, req.tenantId, calendarId, timeMin, timeMax, timezone);
        res.json({ success: true, data: busySlots });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

router.post('/google/calendar/events', requireConnection, async (req, res) => {
    try {
        const { calendarId, ...eventDetails } = req.body;
        const event = await createCalendarEvent(req.accountId, req.tenantId, calendarId, eventDetails, req.connection._id);
        res.json({ success: true, data: event });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

router.patch('/google/calendar/events/:eventId', requireConnection, async (req, res) => {
    try {
        const { eventId } = req.params;
        const { calendarId, ...eventDetails } = req.body;
        const event = await updateCalendarEvent(req.accountId, req.tenantId, calendarId, eventId, eventDetails, req.connection._id);
        res.json({ success: true, data: event });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

router.delete('/google/calendar/events/:eventId', requireConnection, async (req, res) => {
    try {
        const { eventId } = req.params;
        const { calendarId } = req.body;
        await deleteCalendarEvent(req.accountId, req.tenantId, calendarId, eventId, req.connection._id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * Google Sheets Internal APIs
 */

router.get('/google/sheets/list/:connectionId', requireConnection, async (req, res) => {
    try {
        const spreadsheets = await listSpreadsheets(req.accountId, req.tenantId);
        res.json({ success: true, data: spreadsheets });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

router.get('/google/sheets/:connectionId/:spreadsheetId/worksheets', requireConnection, async (req, res) => {
    try {
        const worksheets = await listWorksheets(req.accountId, req.tenantId, req.params.spreadsheetId);
        res.json({ success: true, data: worksheets });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

router.post('/google/sheets/preview', requireConnection, async (req, res) => {
    try {
        const { spreadsheetId, worksheetName } = req.body;
        const preview = await previewSheet(req.accountId, req.tenantId, spreadsheetId, worksheetName);
        res.json({ success: true, data: preview });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

router.post('/google/sheets/append', requireConnection, async (req, res) => {
    try {
        const { spreadsheetId, worksheetName, values } = req.body;
        await appendSheetRows(req.accountId, req.tenantId, spreadsheetId, worksheetName, values, req.connection._id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

router.get('/google/sheets/rows', requireConnection, async (req, res) => {
    try {
        const { spreadsheetId, worksheetName } = req.query;
        const rows = await getSheetRows(req.accountId, req.tenantId, spreadsheetId, worksheetName);
        res.json({ success: true, data: rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * Google Forms Internal APIs
 */

router.get('/google/forms/list/:connectionId', requireConnection, async (req, res) => {
    try {
        const forms = await listForms(req.accountId, req.tenantId);
        res.json({ success: true, data: forms });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

router.get('/google/forms/:connectionId/:formId/fields', requireConnection, async (req, res) => {
    try {
        const fields = await getFormFields(req.accountId, req.tenantId, req.params.formId);
        res.json({ success: true, data: fields });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

router.post('/google/forms/responses', requireConnection, async (req, res) => {
    try {
        const { formId, lastSyncAt } = req.body;
        const responses = await getFormResponses(req.accountId, req.tenantId, formId, lastSyncAt);
        res.json({ success: true, data: responses });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

router.post('/google/forms/watch', requireConnection, async (req, res) => {
    try {
        const { formId } = req.body;
        const watch = await createFormWatch(req.accountId, req.tenantId, formId, req.connection._id);
        res.json({ success: true, data: watch });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
