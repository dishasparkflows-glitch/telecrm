const { ApiError, ApiResponse, asyncHandler } = require('@sparkcrm/shared-utils');
const googleIntegrationService = require('../services/googleIntegration.service');
const { LeadSourceMapping, InboundLeadEvent } = require('../models/LeadSourceModels');
const { sheetImportQueue } = require('../workers/sheetImport.worker');
const { createOrUpdateLeadFromSource } = require('../services/leadIngestion.service');

const checkAuth = asyncHandler(async (req, res) => {
    const tokens = await googleIntegrationService.getGoogleTokens(req.user.tenantId, req.user.id);
    if (!tokens) {
        return res.json(new ApiResponse('Google Account not connected', { connected: false }));
    }
    return res.json(new ApiResponse('Google Account connected', { connected: true }));
});

const listForms = asyncHandler(async (req, res) => {
    const tokens = await googleIntegrationService.getGoogleTokens(req.user.tenantId, req.user.id);
    if (!tokens) throw new ApiError(401, 'Google Account not connected');
    
    const forms = await googleIntegrationService.listForms(tokens);
    return res.json(new ApiResponse('Google Forms fetched successfully', forms));
});

const getFormFields = asyncHandler(async (req, res) => {
    const tokens = await googleIntegrationService.getGoogleTokens(req.user.tenantId, req.user.id);
    if (!tokens) throw new ApiError(401, 'Google Account not connected');
    
    const { formId } = req.params;
    const fields = await googleIntegrationService.getFormFields(tokens, formId);
    return res.json(new ApiResponse('Google Form fields fetched successfully', fields));
});

const testForm = asyncHandler(async (req, res) => {
    // Tests mapping
    const tokens = await googleIntegrationService.getGoogleTokens(req.user.tenantId, req.user.id);
    if (!tokens) throw new ApiError(401, 'Google Account not connected');
    
    const { formId } = req.params;
    // Just verify access
    await googleIntegrationService.getFormFields(tokens, formId);
    return res.json(new ApiResponse('Connection successful', { success: true }));
});

const activateForm = asyncHandler(async (req, res) => {
    const tokens = await googleIntegrationService.getGoogleTokens(req.user.tenantId, req.user.id);
    if (!tokens) throw new ApiError(401, 'Google Account not connected');
    
    const { formId } = req.params;
    const watchId = `watch_${Date.now()}`;
    
    await googleIntegrationService.createFormWatch(tokens, formId, watchId);
    
    // Update mapping to active
    await LeadSourceMapping.findOneAndUpdate(
        { tenantId: req.user.tenantId, provider: 'google_forms', externalFormId: formId },
        { 
            $set: { 
                isActive: true, 
                'meta.watchId': watchId, 
                'meta.watchExpirationTime': new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) 
            } 
        }
    );
    
    return res.json(new ApiResponse('Google Form activated successfully', { watchId }));
});

const pauseForm = asyncHandler(async (req, res) => {
    const tokens = await googleIntegrationService.getGoogleTokens(req.user.tenantId, req.user.id);
    if (!tokens) throw new ApiError(401, 'Google Account not connected');
    
    const { formId } = req.params;
    const mapping = await LeadSourceMapping.findOne({ tenantId: req.user.tenantId, provider: 'google_forms', externalFormId: formId });
    if (mapping && mapping.meta?.watchId) {
        try {
            await googleIntegrationService.deleteFormWatch(tokens, formId, mapping.meta.watchId);
        } catch(err) {
            console.error('Failed to delete form watch', err);
        }
    }
    
    await LeadSourceMapping.updateOne(
        { _id: mapping._id },
        { $set: { isActive: false, 'meta.watchId': null } }
    );
    
    return res.json(new ApiResponse('Google Form paused successfully', null));
});

const syncForm = asyncHandler(async (req, res) => {
    const tokens = await googleIntegrationService.getGoogleTokens(req.user.tenantId, req.user.id);
    if (!tokens) throw new ApiError(401, 'Google Account not connected');
    
    const { formId } = req.params;
    const mapping = await LeadSourceMapping.findOne({ tenantId: req.user.tenantId, provider: 'google_forms', externalFormId: formId });
    if (!mapping) throw new ApiError(404, 'Mapping not found');
    
    const responses = await googleIntegrationService.getFormResponses(tokens, formId, mapping.lastSyncedAt);
    let created = 0;
    
    for (const response of responses) {
        // Process each response
        // Note: For a real prod, map answers to the mapping config.
        const idempotencyKey = `${req.user.tenantId}:${formId}:${response.responseId}`;
        const exists = await InboundLeadEvent.findOne({ idempotencyKey });
        if (exists) continue;
        
        await InboundLeadEvent.create({
            tenantId: req.user.tenantId,
            branchId: mapping.branchId,
            provider: 'google_forms',
            idempotencyKey,
            mappingId: mapping._id,
            status: 'processed',
            rawPayload: response
        });
        
        // Simple mapping placeholder
        const contact = { email: response.respondentEmail || `lead_${Date.now()}@test.com` };
        
        await createOrUpdateLeadFromSource({
            tenantId: req.user.tenantId,
            branchId: mapping.branchId,
            source: 'google_forms',
            sourceDetails: `Form: ${formId}, Response: ${response.responseId}`,
            leadData: {
                contact,
                assignedTo: mapping.defaultAssignedTo
            },
            duplicateHandling: mapping.duplicateHandling
        });
        created++;
    }
    
    await LeadSourceMapping.updateOne({ _id: mapping._id }, { $set: { lastSyncedAt: new Date() } });
    
    return res.json(new ApiResponse('Google Form synced successfully', { created, synced: responses.length }));
});

const formWebhook = asyncHandler(async (req, res) => {
    // This is a public webhook for Google PubSub notifications
    // Acknowledge immediately
    res.status(200).send('OK');
    
    const message = req.body.message;
    if (!message || !message.attributes || !message.attributes.formId) return;
    
    const formId = message.attributes.formId;
    
    // Find active mapping
    const mapping = await LeadSourceMapping.findOne({ provider: 'google_forms', externalFormId: formId, isActive: true });
    if (!mapping) return; // Ignore
    
    // Fetch latest response using stored credentials
    // Note: tenantId and userId needed. User is the one who created the mapping
    const userId = mapping.meta?.createdBy;
    if (!userId) return;
    
    const tokens = await googleIntegrationService.getGoogleTokens(mapping.tenantId, userId);
    if (!tokens) return;
    
    const responses = await googleIntegrationService.getFormResponses(tokens, formId, mapping.lastSyncedAt);
    for (const response of responses) {
        const idempotencyKey = `${mapping.tenantId}:${formId}:${response.responseId}`;
        const exists = await InboundLeadEvent.findOne({ idempotencyKey });
        if (exists) continue;
        
        await InboundLeadEvent.create({
            tenantId: mapping.tenantId,
            branchId: mapping.branchId,
            provider: 'google_forms',
            idempotencyKey,
            mappingId: mapping._id,
            status: 'processed',
            rawPayload: response
        });
        
        const contact = { email: response.respondentEmail || `lead_${Date.now()}@test.com` };
        await createOrUpdateLeadFromSource({
            tenantId: mapping.tenantId,
            branchId: mapping.branchId,
            source: 'google_forms',
            sourceDetails: `Form: ${formId}, Response: ${response.responseId}`,
            leadData: { contact, assignedTo: mapping.defaultAssignedTo },
            duplicateHandling: mapping.duplicateHandling
        });
    }
    
    await LeadSourceMapping.updateOne({ _id: mapping._id }, { $set: { lastSyncedAt: new Date() } });
});


const listSpreadsheets = asyncHandler(async (req, res) => {
    const tokens = await googleIntegrationService.getGoogleTokens(req.user.tenantId, req.user.id);
    if (!tokens) throw new ApiError(401, 'Google Account not connected');
    
    const sheets = await googleIntegrationService.listSpreadsheets(tokens);
    return res.json(new ApiResponse('Google Spreadsheets fetched successfully', sheets));
});

const listWorksheets = asyncHandler(async (req, res) => {
    const tokens = await googleIntegrationService.getGoogleTokens(req.user.tenantId, req.user.id);
    if (!tokens) throw new ApiError(401, 'Google Account not connected');
    
    const { spreadsheetId } = req.params;
    const worksheets = await googleIntegrationService.listWorksheets(tokens, spreadsheetId);
    return res.json(new ApiResponse('Worksheets fetched successfully', worksheets));
});

const previewSheet = asyncHandler(async (req, res) => {
    const tokens = await googleIntegrationService.getGoogleTokens(req.user.tenantId, req.user.id);
    if (!tokens) throw new ApiError(401, 'Google Account not connected');
    
    const { spreadsheetId, worksheetName } = req.params;
    const preview = await googleIntegrationService.previewSheet(tokens, spreadsheetId, worksheetName);
    return res.json(new ApiResponse('Sheet preview fetched successfully', preview));
});

const importSheet = asyncHandler(async (req, res) => {
    const { spreadsheetId, worksheetName, mappingId } = req.body;
    if (!spreadsheetId || !worksheetName || !mappingId) {
        throw new ApiError(400, 'spreadsheetId, worksheetName, and mappingId are required');
    }
    
    // Add to BullMQ queue
    await sheetImportQueue.add('ImportSheet', {
        tenantId: req.user.tenantId,
        branchId: req.user.branchId,
        mappingId,
        spreadsheetId,
        worksheetId: worksheetName,
        userId: req.user.id
    }, {
        jobId: `import-${mappingId}-${Date.now()}`
    });
    
    return res.json(new ApiResponse('Sheet import queued successfully', null));
});

module.exports = {
    checkAuth,
    listForms,
    getFormFields,
    testForm,
    activateForm,
    pauseForm,
    syncForm,
    formWebhook,
    listSpreadsheets,
    listWorksheets,
    previewSheet,
    importSheet
};
