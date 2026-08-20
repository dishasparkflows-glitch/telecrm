const { Worker, Queue } = require('bullmq');
const IORedis = require('ioredis');
const { env } = require('@sparkcrm/shared-config');
const { LeadSourceMapping, InboundLeadEvent } = require('../models/LeadSourceModels');
const { getConnection, apiClient } = require('../services/serviceClients/integration.client');
const { createOrUpdateLeadFromSource } = require('../services/leadIngestion.service');
const crypto = require('crypto');

const redisOptions = {
    maxRetriesPerRequest: null,
    retryStrategy: (times) => Math.min(times * 500, 10000),
};

const workerConnection = new IORedis(env.REDIS_URL, redisOptions);
const queueConnection = new IORedis(env.REDIS_URL, redisOptions);

const sheetImportQueue = new Queue('SheetImportQueue', { connection: queueConnection });

const generateRowHash = (rowValues) => {
    return crypto.createHash('sha256').update(JSON.stringify(rowValues)).digest('hex');
};

const mapRowToLead = (row, headers, standardMapping, customMapping, ignoredFields) => {
    const contact = {};
    const customFields = {};
    let validIdentity = false;

    // Loop through headers and row values
    headers.forEach((header, index) => {
        if (ignoredFields && ignoredFields.includes(header)) return;
        
        const value = row[index];
        if (value === undefined || value === null || value === '') return;

        // Check standard mappings
        const stdField = Object.keys(standardMapping || {}).find(k => standardMapping[k] === header);
        if (stdField) {
            contact[stdField] = value;
            if (stdField === 'email' || stdField === 'phone') validIdentity = true;
            return;
        }

        // Check custom mappings
        const customField = Object.keys(customMapping || {}).find(k => customMapping[k] === header);
        if (customField) {
            customFields[customField] = value;
            return;
        }
    });

    return { contact, customFields, validIdentity };
};

const sheetImportWorker = new Worker('SheetImportQueue', async (job) => {
    const { tenantId, branchId, mappingId, spreadsheetId, worksheetId, userId } = job.data;
    
    // Update mapping status to importing
    await LeadSourceMapping.updateOne(
        { _id: mappingId },
        { $set: { 'meta.importStatus': 'processing' } }
    );
    
    const mapping = await LeadSourceMapping.findById(mappingId);
    if (!mapping) throw new Error('Mapping not found');
    
    const connection = await getConnection(tenantId, userId, 'GOOGLE', 'GOOGLE_SHEETS');
    if (!connection) throw new Error('Google Sheets connection not found');

    const rowRes = await apiClient.get('/google/sheets/rows', {
        params: { tenantId, connectionId: connection.connectionId, spreadsheetId, worksheetName: worksheetId }
    });
    const rows = rowRes.data.data || [];
    if (!rows || rows.length <= 1) return { imported: 0, skipped: 0, errors: 0 };
    
    const headers = rows[0];
    const dataRows = rows.slice(1);
    
    let imported = 0;
    let skipped = 0;
    let errors = 0;
    
    for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        const rowHash = generateRowHash(row);
        
        const idempotencyKey = `${tenantId}:${spreadsheetId}:${worksheetId}:${rowHash}`;
        
        // Check if already processed
        const existingEvent = await InboundLeadEvent.findOne({ idempotencyKey });
        if (existingEvent) {
            skipped++;
            continue;
        }
        
        try {
            const { contact, customFields, validIdentity } = mapRowToLead(
                row, headers, 
                mapping.fieldMapping, mapping.customFieldMapping, mapping.ignoredFields
            );
            
            if (!validIdentity) {
                // We need at least an email or phone
                await InboundLeadEvent.create({
                    tenantId,
                    branchId,
                    provider: 'google_sheets',
                    idempotencyKey,
                    mappingId,
                    status: 'failed',
                    error: 'Missing identity fields (Email or Phone)',
                    rawPayload: row
                });
                errors++;
                continue;
            }
            
            // Log event
            const event = await InboundLeadEvent.create({
                tenantId,
                branchId,
                provider: 'google_sheets',
                idempotencyKey,
                mappingId,
                status: 'processing',
                rawPayload: row
            });
            
            // Create or update lead
            const { lead } = await createOrUpdateLeadFromSource({
                tenantId,
                branchId,
                source: 'google_sheets',
                sourceDetails: `Sheet: ${spreadsheetId}, Worksheet: ${worksheetId}`,
                leadData: {
                    contact,
                    customFields,
                    assignedTo: mapping.defaultAssignedTo
                },
                duplicateHandling: mapping.duplicateHandling
            });
            
            await InboundLeadEvent.updateOne(
                { _id: event._id },
                { $set: { status: 'processed', leadId: lead._id, processedAt: new Date() } }
            );
            
            imported++;
        } catch (err) {
            console.error(`Error importing row ${i}:`, err.message);
            await InboundLeadEvent.create({
                tenantId,
                branchId,
                provider: 'google_sheets',
                idempotencyKey,
                mappingId,
                status: 'failed',
                error: err.message,
                rawPayload: row
            });
            errors++;
        }
        
        // Report progress every 50 rows
        if (i % 50 === 0) {
            await job.updateProgress({ total: dataRows.length, processed: i, imported, skipped, errors });
        }
    }
    
    // Final update
    await LeadSourceMapping.updateOne(
        { _id: mappingId },
        { 
            $set: { 
                'meta.importStatus': 'completed',
                lastSyncedAt: new Date(),
                lastSyncError: null
            }
        }
    );
    
    return { total: dataRows.length, imported, skipped, errors };
}, { connection: workerConnection });

sheetImportWorker.on('failed', async (job, err) => {
    console.error(`Sheet import job ${job.id} failed:`, err);
    if (job.data && job.data.mappingId) {
        await LeadSourceMapping.updateOne(
            { _id: job.data.mappingId },
            { 
                $set: { 
                    'meta.importStatus': 'failed',
                    lastSyncError: err.message
                }
            }
        );
    }
});

module.exports = { sheetImportWorker, sheetImportQueue };
