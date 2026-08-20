/**
 * googleIntegration.service.js (lead-service)
 *
 * Previously contained direct googleapis calls with token management.
 * Now delegates all Google API calls to the centralized integration-service
 * via integration.client.js.
 *
 * @deprecated Direct googleapis methods are no longer used here.
 */

const { getConnection, googleSheetsApi, googleFormsApi } = require('./serviceClients/integration.client');

/**
 * Resolve Google account connection for a given user.
 * Tries user-level first, then falls back to tenant-level.
 */
const getGoogleConnection = async (tenantId, userId, integrationType = 'GOOGLE_SHEETS') => {
    const connection = await getConnection(tenantId, userId, 'GOOGLE', integrationType);
    return connection || null;
};

const getGoogleSheetsConnection = (tenantId, userId) => getGoogleConnection(tenantId, userId, 'GOOGLE_SHEETS');
const getGoogleFormsConnection = (tenantId, userId) => getGoogleConnection(tenantId, userId, 'GOOGLE_FORMS');

/**
 * --- Google Forms API (via integration-service) ---
 */

const listForms = async (tenantId, userId) => {
    const connection = await getGoogleFormsConnection(tenantId, userId);
    if (!connection) throw new Error('GOOGLE_FORMS_NOT_CONNECTED');
    return googleFormsApi.listForms(tenantId, connection.connectionId);
};

const getFormFields = async (tenantId, userId, formId) => {
    const connection = await getGoogleFormsConnection(tenantId, userId);
    if (!connection) throw new Error('GOOGLE_FORMS_NOT_CONNECTED');
    return googleFormsApi.getFields(tenantId, connection.connectionId, formId);
};

const createFormWatch = async (tenantId, userId, formId) => {
    const connection = await getGoogleFormsConnection(tenantId, userId);
    if (!connection) throw new Error('GOOGLE_FORMS_NOT_CONNECTED');
    return googleFormsApi.watchForm(tenantId, connection.connectionId, formId);
};

/**
 * --- Google Sheets API (via integration-service) ---
 */

const listSpreadsheets = async (tenantId, userId) => {
    const connection = await getGoogleSheetsConnection(tenantId, userId);
    if (!connection) throw new Error('GOOGLE_SHEETS_NOT_CONNECTED');
    return googleSheetsApi.listSpreadsheets(tenantId, connection.connectionId);
};

const listWorksheets = async (tenantId, userId, spreadsheetId) => {
    const connection = await getGoogleSheetsConnection(tenantId, userId);
    if (!connection) throw new Error('GOOGLE_SHEETS_NOT_CONNECTED');
    return googleSheetsApi.listWorksheets(tenantId, connection.connectionId, spreadsheetId);
};

const previewSheet = async (tenantId, userId, spreadsheetId, worksheetName) => {
    const connection = await getGoogleSheetsConnection(tenantId, userId);
    if (!connection) throw new Error('GOOGLE_SHEETS_NOT_CONNECTED');
    return googleSheetsApi.previewSheet(tenantId, connection.connectionId, spreadsheetId, worksheetName);
};

const getSheetRows = async (tenantId, userId, spreadsheetId, worksheetName) => {
    const connection = await getGoogleSheetsConnection(tenantId, userId);
    if (!connection) throw new Error('GOOGLE_SHEETS_NOT_CONNECTED');
    // getSheetRows is called with connection details now
    const { apiClient } = require('./serviceClients/integration.client');
    const res = await apiClient.get(`/google/sheets/rows`, { params: { tenantId, connectionId: connection.connectionId, spreadsheetId, worksheetName } });
    return res.data.data || [];
};

module.exports = {
    getGoogleSheetsConnection,
    getGoogleFormsConnection,
    listForms,
    getFormFields,
    createFormWatch,
    listSpreadsheets,
    listWorksheets,
    previewSheet,
    getSheetRows,
};
