const { google } = require('googleapis');
const { getUserIntegrationConfig } = require('./serviceClients/tenant.client');

/**
 * Fetch Google Tokens from IntegrationCredential
 */
const getGoogleTokens = async (tenantId, userId) => {
    const cred = await getUserIntegrationConfig(tenantId, userId, 'google_calendar');
    if (!cred || !cred.credentials) return null;
    return cred.credentials;
};

/**
 * Create a configured OAuth2 client for a user
 */
const createClientWithTokens = (tokens) => {
    const client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
    );
    client.setCredentials(tokens);
    return client;
};

/**
 * --- Google Forms API ---
 */

const listForms = async (tokens) => {
    const client = createClientWithTokens(tokens);
    const drive = google.drive({ version: 'v3', auth: client });
    
    // We search drive for files with mimeType form
    const response = await drive.files.list({
        q: "mimeType='application/vnd.google-apps.form' and trashed=false",
        fields: 'files(id, name, modifiedTime)',
        orderBy: 'modifiedTime desc',
        pageSize: 50
    });
    
    return response.data.files || [];
};

const getFormFields = async (tokens, formId) => {
    const client = createClientWithTokens(tokens);
    const forms = google.forms({ version: 'v1', auth: client });
    
    const response = await forms.forms.get({ formId });
    const items = response.data.items || [];
    
    const fields = items.filter(item => item.questionItem).map(item => {
        let type = 'Text';
        const question = item.questionItem.question;
        if (question.choiceQuestion) {
            type = 'Choice';
        } else if (question.dateQuestion) {
            type = 'Date';
        } else if (question.timeQuestion) {
            type = 'Time';
        } else if (question.fileUploadQuestion) {
            type = 'File';
        }
        return {
            id: item.itemId,
            name: item.title,
            type,
            required: item.questionItem.question.required || false
        };
    });
    
    return fields;
};

const getFormResponses = async (tokens, formId, lastSyncAt) => {
    const client = createClientWithTokens(tokens);
    const forms = google.forms({ version: 'v1', auth: client });
    
    const params = { formId };
    if (lastSyncAt) {
        params.filter = `timestamp > ${new Date(lastSyncAt).toISOString()}`;
    }
    
    const response = await forms.forms.responses.list(params);
    return response.data.responses || [];
};

const createFormWatch = async (tokens, formId, watchId) => {
    const client = createClientWithTokens(tokens);
    const forms = google.forms({ version: 'v1', auth: client });
    
    const response = await forms.forms.watches.create({
        formId,
        requestBody: {
            watch: {
                target: {
                    topic: {
                        topicName: process.env.GOOGLE_PUBSUB_TOPIC // We would need a pub/sub topic for this in real prod
                    }
                },
                eventType: 'RESPONSES'
            }
        }
    });
    
    return response.data;
};

const renewFormWatch = async (tokens, formId, watchId) => {
    const client = createClientWithTokens(tokens);
    const forms = google.forms({ version: 'v1', auth: client });
    
    const response = await forms.forms.watches.renew({
        formId,
        watchId
    });
    
    return response.data;
};

const deleteFormWatch = async (tokens, formId, watchId) => {
    const client = createClientWithTokens(tokens);
    const forms = google.forms({ version: 'v1', auth: client });
    
    await forms.forms.watches.delete({
        formId,
        watchId
    });
};

/**
 * --- Google Sheets API ---
 */

const listSpreadsheets = async (tokens) => {
    const client = createClientWithTokens(tokens);
    const drive = google.drive({ version: 'v3', auth: client });
    
    const response = await drive.files.list({
        q: "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false",
        fields: 'files(id, name, modifiedTime)',
        orderBy: 'modifiedTime desc',
        pageSize: 50
    });
    
    return response.data.files || [];
};

const listWorksheets = async (tokens, spreadsheetId) => {
    const client = createClientWithTokens(tokens);
    const sheets = google.sheets({ version: 'v4', auth: client });
    
    const response = await sheets.spreadsheets.get({ spreadsheetId });
    return response.data.sheets.map(sheet => ({
        id: sheet.properties.sheetId,
        name: sheet.properties.title
    }));
};

const previewSheet = async (tokens, spreadsheetId, worksheetName) => {
    const client = createClientWithTokens(tokens);
    const sheets = google.sheets({ version: 'v4', auth: client });
    
    // Read first 10 rows
    const range = `${worksheetName}!1:10`;
    const response = await sheets.spreadsheets.values.get({ spreadsheetId, range });
    const rows = response.data.values || [];
    
    if (rows.length === 0) return { headers: [], sampleRows: [] };
    
    const headers = rows[0];
    const sampleRows = rows.slice(1);
    
    return { headers, sampleRows };
};

const getSheetRows = async (tokens, spreadsheetId, worksheetName) => {
    const client = createClientWithTokens(tokens);
    const sheets = google.sheets({ version: 'v4', auth: client });
    
    // Read all values
    const range = `${worksheetName}`;
    const response = await sheets.spreadsheets.values.get({ spreadsheetId, range });
    return response.data.values || [];
};

const appendSheetRows = async (tokens, spreadsheetId, worksheetName, values) => {
    const client = createClientWithTokens(tokens);
    const sheets = google.sheets({ version: 'v4', auth: client });
    
    const range = `${worksheetName}`;
    await sheets.spreadsheets.values.append({
        spreadsheetId,
        range,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values }
    });
};

module.exports = {
    getGoogleTokens,
    createClientWithTokens,
    listForms,
    getFormFields,
    getFormResponses,
    createFormWatch,
    renewFormWatch,
    deleteFormWatch,
    listSpreadsheets,
    listWorksheets,
    previewSheet,
    getSheetRows,
    appendSheetRows
};
