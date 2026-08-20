const { google } = require('googleapis');
const { getAuthenticatedClient } = require('./google.provider');


const getFormsApi = async (accountId, tenantId) => {
    const auth = await getAuthenticatedClient(accountId, tenantId);
    return google.forms({ version: 'v1', auth });
};

const getDriveApi = async (accountId, tenantId) => {
    const auth = await getAuthenticatedClient(accountId, tenantId);
    return google.drive({ version: 'v3', auth });
};

const listForms = async (accountId, tenantId) => {
    const drive = await getDriveApi(accountId, tenantId);
    const response = await drive.files.list({
        q: "mimeType='application/vnd.google-apps.form' and trashed=false",
        fields: 'files(id, name, modifiedTime)',
        orderBy: 'modifiedTime desc',
        pageSize: 50
    });
    return response.data.files || [];
};

const getFormFields = async (accountId, tenantId, formId) => {
    const forms = await getFormsApi(accountId, tenantId);
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
            id: item.questionItem.question.questionId,
            name: item.title,
            type,
            required: item.questionItem.question.required || false
        };
    });
    
    return fields;
};

const getFormResponses = async (accountId, tenantId, formId, lastSyncAt) => {
    const forms = await getFormsApi(accountId, tenantId);
    const params = { formId };
    if (lastSyncAt) {
        params.filter = `timestamp > ${new Date(lastSyncAt).toISOString()}`;
    }
    const response = await forms.forms.responses.list(params);
    return response.data.responses || [];
};

const createFormWatch = async (accountId, tenantId, formId, connectionId) => {
    try {
        const forms = await getFormsApi(accountId, tenantId);
        const start = Date.now();

        const response = await forms.forms.watches.create({
            formId,
            requestBody: {
                watch: {
                    target: {
                        topic: {
                            topicName: process.env.GOOGLE_PUBSUB_TOPIC
                        }
                    },
                    eventType: 'RESPONSES'
                }
            }
        });

        const watchData = response.data;

        return watchData;
    } catch (error) {
        throw error;
    }
};

const renewFormWatch = async (accountId, tenantId, formId, watchId) => {
    const forms = await getFormsApi(accountId, tenantId);
    const response = await forms.forms.watches.renew({
        formId,
        watchId
    });
    return response.data;
};

const deleteFormWatch = async (accountId, tenantId, formId, watchId) => {
    const forms = await getFormsApi(accountId, tenantId);
    await forms.forms.watches.delete({
        formId,
        watchId
    });
};

module.exports = {
    listForms,
    getFormFields,
    getFormResponses,
    createFormWatch,
    renewFormWatch,
    deleteFormWatch,
};
