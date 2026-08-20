const { google } = require('googleapis');
const { getAuthenticatedClient } = require('./google.provider');

const getDriveApi = async (accountId, tenantId) => {
    const auth = await getAuthenticatedClient(accountId, tenantId);
    return google.drive({ version: 'v3', auth });
};

const getSheetsApi = async (accountId, tenantId) => {
    const auth = await getAuthenticatedClient(accountId, tenantId);
    return google.sheets({ version: 'v4', auth });
};

const listSpreadsheets = async (accountId, tenantId) => {
    const drive = await getDriveApi(accountId, tenantId);
    const response = await drive.files.list({
        q: "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false",
        fields: 'files(id, name, modifiedTime)',
        orderBy: 'modifiedTime desc',
        pageSize: 50
    });
    return response.data.files || [];
};

const listWorksheets = async (accountId, tenantId, spreadsheetId) => {
    const sheets = await getSheetsApi(accountId, tenantId);
    const response = await sheets.spreadsheets.get({ spreadsheetId });
    return response.data.sheets.map(sheet => ({
        id: sheet.properties.sheetId,
        name: sheet.properties.title
    }));
};

const previewSheet = async (accountId, tenantId, spreadsheetId, worksheetName) => {
    const sheets = await getSheetsApi(accountId, tenantId);
    const range = `${worksheetName}!1:10`;
    const response = await sheets.spreadsheets.values.get({ spreadsheetId, range });
    const rows = response.data.values || [];
    
    if (rows.length === 0) return { headers: [], sampleRows: [] };
    
    const headers = rows[0];
    const sampleRows = rows.slice(1);
    
    return { headers, sampleRows };
};

const getSheetRows = async (accountId, tenantId, spreadsheetId, worksheetName) => {
    const sheets = await getSheetsApi(accountId, tenantId);
    const range = `${worksheetName}`;
    const response = await sheets.spreadsheets.values.get({ spreadsheetId, range });
    return response.data.values || [];
};

const appendSheetRows = async (accountId, tenantId, spreadsheetId, worksheetName, values, connectionId) => {
    try {
        const sheets = await getSheetsApi(accountId, tenantId);
        const range = `${worksheetName}`;
        const start = Date.now();
        
        await sheets.spreadsheets.values.append({
            spreadsheetId,
            range,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values }
        });
    } catch (error) {
        throw error;
    }
};

module.exports = {
    listSpreadsheets,
    listWorksheets,
    previewSheet,
    getSheetRows,
    appendSheetRows,
};
