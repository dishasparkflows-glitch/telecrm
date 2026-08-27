const { ApiError, ApiResponse, asyncHandler } = require('@sparkcrm/shared-utils');
const googleIntegrationService = require('../services/googleIntegration.service');
const { getConnection } = require('../services/serviceClients/integration.client');
const { LeadSourceMapping, InboundLeadEvent } = require('../models/LeadSourceModels');
const { sheetImportQueue } = require('../workers/sheetImport.worker');
const { createOrUpdateLeadFromSource } = require('../services/leadIngestion.service');
const { apiClient } = require('../services/serviceClients/integration.client');

const checkAuth = asyncHandler(async (req, res) => {
    const integrationType = req.query.type || 'GOOGLE_SHEETS';
    const connection = await getConnection(req.tenantId, req.userId, 'GOOGLE', integrationType);
    if (!connection) {
        return res.json(new ApiResponse('Google Account not connected', { connected: false }));
    }
    return res.json(new ApiResponse('Google Account connected', { 
        connected: true,
        connectionId: connection.connectionId,
        email: connection.configuration?.email || 'Connected'
    }));
});

const listForms = asyncHandler(async (req, res) => {
    try {
        const forms = await googleIntegrationService.listForms(req.tenantId, req.userId);
        return res.json(new ApiResponse('Google Forms fetched successfully', forms));
    } catch (err) {
        if (err.message === 'GOOGLE_FORMS_NOT_CONNECTED') throw new ApiError(401, 'Google Account not connected');
        throw err;
    }
});

const getFormFields = asyncHandler(async (req, res) => {
    const { formId } = req.params;
    try {
        const fields = await googleIntegrationService.getFormFields(req.tenantId, req.userId, formId);
        return res.json(new ApiResponse('Google Form fields fetched successfully', fields));
    } catch (err) {
        if (err.message === 'GOOGLE_FORMS_NOT_CONNECTED') throw new ApiError(401, 'Google Account not connected');
        throw err;
    }
});

const testForm = asyncHandler(async (req, res) => {
    const { formId } = req.params;
    try {
        // Just verify access by getting fields
        await googleIntegrationService.getFormFields(req.tenantId, req.userId, formId);
        return res.json(new ApiResponse('Connection successful', { success: true }));
    } catch (err) {
        if (err.message === 'GOOGLE_FORMS_NOT_CONNECTED') throw new ApiError(401, 'Google Account not connected');
        throw err;
    }
});

const activateForm = asyncHandler(async (req, res) => {
    const { formId } = req.params;

    try {
        const watch = await googleIntegrationService.createFormWatch(req.tenantId, req.userId, formId);
        const watchId = watch?.id || `watch_${Date.now()}`;

        await LeadSourceMapping.findOneAndUpdate(
            { tenantId: req.tenantId, provider: 'google_forms', externalFormId: formId },
            {
                $set: {
                    isActive: true,
                    'meta.watchId': watchId,
                    'meta.watchExpirationTime': new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                }
            }
        );

        return res.json(new ApiResponse('Google Form activated successfully', { watchId }));
    } catch (err) {
        if (err.message === 'GOOGLE_FORMS_NOT_CONNECTED') throw new ApiError(401, 'Google Account not connected');
        throw err;
    }
});

const pauseForm = asyncHandler(async (req, res) => {
    const { formId } = req.params;
    const mapping = await LeadSourceMapping.findOne({ tenantId: req.tenantId, provider: 'google_forms', externalFormId: formId });

    // Note: watch deletion could be done via integration-service in the future
    // For now just deactivate locally
    if (mapping) {
        await LeadSourceMapping.updateOne(
            { _id: mapping._id },
            { $set: { isActive: false, 'meta.watchId': null } }
        );
    }

    return res.json(new ApiResponse('Google Form paused successfully', null));
});

const extractContactFromGoogleForm = (response, mapping) => {
    const getAnswerValue = (questionId) => {
        if (!response.answers || !response.answers[questionId]) return null;
        const answerObj = response.answers[questionId];
        if (answerObj.textAnswers && answerObj.textAnswers.answers && answerObj.textAnswers.answers.length > 0) {
            return answerObj.textAnswers.answers[0].value;
        }
        return null;
    };

    const contact = {};
    const fm = mapping.fieldMapping || {};
    
    if (fm.firstName) contact.firstName = getAnswerValue(fm.firstName);
    if (fm.lastName) contact.lastName = getAnswerValue(fm.lastName);
    if (fm.fullName) contact.fullName = getAnswerValue(fm.fullName);
    if (fm.email) contact.email = getAnswerValue(fm.email);
    if (fm.phone) contact.phone = getAnswerValue(fm.phone);
    if (fm.company) contact.company = getAnswerValue(fm.company);
    
    if (!contact.email && response.respondentEmail) {
        contact.email = response.respondentEmail;
    }

    const customFields = {};
    const cm = mapping.customFieldMapping || {};
    for (const [sysField, formQuestionId] of Object.entries(cm)) {
        const val = getAnswerValue(formQuestionId);
        if (val) {
            customFields[sysField] = val;
        }
    }

    return { contact, customFields };
};

const syncForm = asyncHandler(async (req, res) => {
    const { formId } = req.params;
    const mapping = await LeadSourceMapping.findOne({ tenantId: req.tenantId, provider: 'google_forms', externalFormId: formId });
    if (!mapping) throw new ApiError(404, 'Mapping not found');

    // Fetch responses via integration-service
    const connection = await getConnection(req.tenantId, req.userId, 'GOOGLE', 'GOOGLE_FORMS');
    if (!connection) throw new ApiError(401, 'Google Account not connected');

    const resData = await apiClient.post('/google/forms/responses', {
        tenantId: req.tenantId,
        connectionId: connection.connectionId,
        formId,
        lastSyncAt: mapping.lastSyncedAt
    });
    const responses = resData.data.data || [];
    let created = 0;
    for (const response of responses) {
        const idempotencyKey = `${req.tenantId}:${formId}:${response.responseId}`;
        const exists = await InboundLeadEvent.findOne({ idempotencyKey });
        if (exists) continue;
        const event = await InboundLeadEvent.create({
            tenantId: req.tenantId,
            branchId: mapping.branchId,
            provider: 'google_forms',
            idempotencyKey,
            mappingId: mapping._id,
            status: 'received',
            rawPayload: response
        });

        const extracted = extractContactFromGoogleForm(response, mapping);
        try {
            await createOrUpdateLeadFromSource({
                tenantId: req.tenantId,
                branchId: mapping.branchId,
                source: 'google_forms',
                sourceDetails: `Form: ${formId}, Response: ${response.responseId}`,
                leadData: { 
                    contact: extracted.contact, 
                    customFields: extracted.customFields,
                    assignedTo: mapping.defaultAssignedTo 
                },
                duplicateHandling: mapping.duplicateHandling
            });
            await InboundLeadEvent.updateOne({ _id: event._id }, { $set: { status: 'processed', error: '' } });
            created++;
        } catch (err) {
            await InboundLeadEvent.updateOne(
                { _id: event._id }, 
                { $set: { status: 'failed', error: err.message || 'Failed to process lead' } }
            );
        }
    }
    
    await LeadSourceMapping.updateOne({ _id: mapping._id }, { $set: { lastSyncedAt: new Date() } });
    return res.json(new ApiResponse('Google Form synced successfully', { created, synced: responses.length }));
});

const formWebhook = asyncHandler(async (req, res) => {
    // Public webhook for Google PubSub notifications — acknowledge immediately
    res.status(200).send('OK');

    const message = req.body.message;
    if (!message || !message.attributes || !message.attributes.formId) return;

    const formId = message.attributes.formId;
    const mapping = await LeadSourceMapping.findOne({ provider: 'google_forms', externalFormId: formId, isActive: true });
    if (!mapping) return;

    const userId = mapping.meta?.createdBy;
    if (!userId) return;

    const { apiClient } = require('../services/serviceClients/integration.client');
    const connection = await getConnection(String(mapping.tenantId), String(userId), 'GOOGLE', 'GOOGLE_FORMS');
    if (!connection) return;

    const resData = await apiClient.post('/google/forms/responses', {
        tenantId: mapping.tenantId,
        connectionId: connection.connectionId,
        formId,
        lastSyncAt: mapping.lastSyncedAt
    });
    const responses = resData.data.data || [];

    for (const response of responses) {
        const idempotencyKey = `${mapping.tenantId}:${formId}:${response.responseId}`;
        const exists = await InboundLeadEvent.findOne({ idempotencyKey });
        if (exists) continue;

        const event = await InboundLeadEvent.create({
            tenantId: mapping.tenantId,
            branchId: mapping.branchId,
            provider: 'google_forms',
            idempotencyKey,
            mappingId: mapping._id,
            status: 'received',
            rawPayload: response
        });

        const extracted = extractContactFromGoogleForm(response, mapping);
        try {
            await createOrUpdateLeadFromSource({
                tenantId: mapping.tenantId,
                branchId: mapping.branchId,
                source: 'google_forms',
                sourceDetails: `Form: ${formId}, Response: ${response.responseId}`,
                leadData: { 
                    contact: extracted.contact,
                    customFields: extracted.customFields,
                    assignedTo: mapping.defaultAssignedTo 
                },
                duplicateHandling: mapping.duplicateHandling
            });
            await InboundLeadEvent.updateOne({ _id: event._id }, { $set: { status: 'processed', error: '' } });
        } catch (err) {
            await InboundLeadEvent.updateOne(
                { _id: event._id }, 
                { $set: { status: 'failed', error: err.message || 'Failed to process lead' } }
            );
        }
    }

    await LeadSourceMapping.updateOne({ _id: mapping._id }, { $set: { lastSyncedAt: new Date() } });
});

const listSpreadsheets = asyncHandler(async (req, res) => {
    try {
        const sheets = await googleIntegrationService.listSpreadsheets(req.tenantId, req.userId);
        return res.json(new ApiResponse('Google Spreadsheets fetched successfully', sheets));
    } catch (err) {
        if (err.message === 'GOOGLE_SHEETS_NOT_CONNECTED') throw new ApiError(401, 'Google Account not connected');
        throw err;
    }
});

const listWorksheets = asyncHandler(async (req, res) => {
    const { spreadsheetId } = req.params;
    try {
        const worksheets = await googleIntegrationService.listWorksheets(req.tenantId, req.userId, spreadsheetId);
        return res.json(new ApiResponse('Worksheets fetched successfully', worksheets));
    } catch (err) {
        if (err.message === 'GOOGLE_SHEETS_NOT_CONNECTED') throw new ApiError(401, 'Google Account not connected');
        throw err;
    }
});

const previewSheet = asyncHandler(async (req, res) => {
    const { spreadsheetId, worksheetName } = req.params;
    try {
        const preview = await googleIntegrationService.previewSheet(req.tenantId, req.userId, spreadsheetId, worksheetName);
        return res.json(new ApiResponse('Sheet preview fetched successfully', preview));
    } catch (err) {
        if (err.message === 'GOOGLE_SHEETS_NOT_CONNECTED') throw new ApiError(401, 'Google Account not connected');
        throw err;
    }
});

const importSheet = asyncHandler(async (req, res) => {
    const { spreadsheetId, worksheetName, mappingId } = req.body;
    if (!spreadsheetId || !worksheetName || !mappingId) {
        throw new ApiError(400, 'spreadsheetId, worksheetName, and mappingId are required');
    }

    await sheetImportQueue.add('ImportSheet', {
        tenantId: req.tenantId,
        branchId: req.userBranchId,
        mappingId,
        spreadsheetId,
        worksheetId: worksheetName,
        userId: req.userId
    }, {
        jobId: `import-${mappingId}-${Date.now()}`
    });

    return res.json(new ApiResponse('Sheet import queued successfully', null));
});

module.exports = {
    activateForm,
    pauseForm,
    syncForm,
    formWebhook,
    importSheet
};
