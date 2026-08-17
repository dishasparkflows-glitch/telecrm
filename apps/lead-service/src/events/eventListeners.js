const { subscribeToEvents, EVENTS } = require('@sparkcrm/shared-events');
const Lead = require('../models/Lead');
const { createOrUpdateLeadFromSource } = require('../services/leadIngestion.service');
const { ACTIVITY_TYPES, recordLeadActivity } = require('../services/leadActivity.service');

/**
 * Wire up event listeners for lead-service
 * Called once on startup from main.js
 */
const registerEventListeners = async () => {
    console.log('📡 lead-service: Registering event listeners...');

    // ─── form.submitted → Auto-create lead from form submission ───
    await subscribeToEvents(EVENTS.FORM_SUBMITTED, async (_channel, data) => {
        try {
            const { tenantId, branchId, data: formData, settings, fields, utm, formName } = data;
            
            if (settings && settings.createLead === false) {
                console.log(`📋 form.submitted: Lead creation disabled for form ${data.formId}`);
                return;
            }

            // Map form fields to lead fields using crmField configuration
            const contact = {};
            const customFields = {};
            const address = {};
            let firstName = 'Unknown';
            let lastName = '';
            let email = '';
            let phone = '';
            
            // Backwards compatibility for old forms
            if (!fields || !fields.some(f => f.crmField)) {
                firstName = formData.firstName || formData.name || 'Unknown';
                lastName = formData.lastName || '';
                email = formData.email || '';
                phone = formData.phone || formData.mobile || '';
                contact.company = formData.company || '';
            } else {
                for (const field of fields) {
                    if (!field.crmField) continue;
                    const value = formData[field.name];
                    if (value === undefined || value === null) continue;
                    
                    if (field.crmField === 'firstName') firstName = value;
                    else if (field.crmField === 'lastName') lastName = value;
                    else if (field.crmField === 'email') email = value;
                    else if (field.crmField === 'phone') phone = value;
                    else if (field.crmField.startsWith('contact.')) {
                        contact[field.crmField.replace('contact.', '')] = value;
                    } else if (field.crmField.startsWith('address.')) {
                        address[field.crmField.replace('address.', '')] = value;
                    } else if (field.crmField.startsWith('customFields.')) {
                        customFields[field.crmField.replace('customFields.', '')] = value;
                    } else if (field.crmField === 'company') {
                        contact.company = value;
                    } else if (field.crmField === 'designation') {
                        contact.designation = value;
                    }
                }
            }

            const tags = settings?.autoTag || [];
            
            // Map UTM parameters
            let touch = null;
            if (utm && (utm.utmSource || utm.utmCampaign || utm.utmMedium)) {
                touch = {
                    formId: String(data.formId || ''),
                    formName: formName || undefined,
                    campaignName: utm.utmCampaign,
                    capturedAt: new Date(),
                };
            } else {
                touch = { formId: String(data.formId || ''), formName: formName || undefined, capturedAt: new Date() };
            }

            const leadData = {
                contact: {
                    firstName,
                    lastName,
                    email,
                    phone,
                    ...contact
                },
                address,
                customFields,
                tags,
                pipeline: {
                    stage: settings?.leadStage || 'new'
                }
            };
            
            const result = await createOrUpdateLeadFromSource({
                tenantId,
                branchId: branchId || null,
                source: settings?.leadSource || 'smart_form',
                sourceDetails: formName ? `Form: ${formName}` : `Form: ${data.formId}`,
                leadData,
                assignedTo: null,
                actorType: 'integration',
                origin: { provider: 'smart_form', sourceName: formName ? `Form: ${formName}` : undefined, sourceId: String(data.formId || ''), rawSource: 'form.submitted' },
                firstTouch: touch,
                lastTouch: touch,
                rawPayload: formData,
            });

            if (result.duplicate) {
                console.log(`📋 form.submitted: Duplicate lead matched (${email || phone})`);
                return;
            }

            console.log(`📋 form.submitted → Lead created: ${result.lead._id}`);
        } catch (err) {
            console.error('❌ form.submitted handler error:', err.message);
        }
    });

    // ─── call.initiated → Track outbound call attempt ───
    await subscribeToEvents(EVENTS.CALL_INITIATED, async (_channel, data) => {
        try {
            const { tenantId, leadId } = data;
            if (!leadId) return;

            const lead = await Lead.findOne({ _id: leadId, tenantId }).select('_id branchId');
            if (!lead) return;

            await recordLeadActivity({
                tenantId,
                branchId: lead.branchId,
                leadId,
                actorId: data.userId,
                actorType: 'user',
                type: ACTIVITY_TYPES.CALL_INITIATED,
                title: 'Call initiated',
                description: 'Outbound call initiated',
                metadata: data,
            });
        } catch (err) {
            console.error('❌ call.initiated handler error:', err.message);
        }
    });

    // ─── call.completed → Update lead lastContactedAt ───
    await subscribeToEvents(EVENTS.CALL_COMPLETED, async (_channel, data) => {
        try {
            const { tenantId, leadId, duration } = data;
            if (!leadId) return;

            const lead = await Lead.findOneAndUpdate(
                { _id: leadId, tenantId },
                {
                    'lifecycle.lastContactedAt': new Date(),
                    'lifecycle.lastActivityAt': new Date(),
                },
                { new: true }
            );
            if (lead) {
                await recordLeadActivity({
                    tenantId,
                    branchId: lead.branchId,
                    leadId,
                    type: ACTIVITY_TYPES.CALL_COMPLETED,
                    title: 'Call completed',
                    description: duration ? `Duration: ${duration} seconds` : 'Call completed',
                    metadata: data,
                });
            }
            console.log(`📞 call.completed → Lead ${leadId} updated`);
        } catch (err) {
            console.error('❌ call.completed handler error:', err.message);
        }
    });

    // ─── call.missed → Track missed inbound/mobile call ───
    await subscribeToEvents(EVENTS.CALL_MISSED, async (_channel, data) => {
        try {
            const { tenantId, leadId } = data;
            if (!leadId) return;
            const lead = await Lead.findOneAndUpdate(
                { _id: leadId, tenantId },
                { 'lifecycle.lastActivityAt': new Date() },
                { new: true }
            );
            if (!lead) return;
            await recordLeadActivity({
                tenantId,
                branchId: lead.branchId,
                leadId,
                actorId: data.userId,
                actorType: 'user',
                type: ACTIVITY_TYPES.CALL_MISSED,
                title: 'Missed call',
                description: 'Inbound call was missed',
                metadata: data,
            });
        } catch (err) {
            console.error('❌ call.missed handler error:', err.message);
        }
    });

    // ─── whatsapp.message.sent → Track outbound WhatsApp message ───
    await subscribeToEvents(EVENTS.WHATSAPP_MESSAGE_SENT, async (_channel, data) => {
        try {
            const { tenantId, leadId } = data;
            if (!leadId) return;

            const lead = await Lead.findOne({ _id: leadId, tenantId }).select('_id branchId');
            if (!lead) return;

            await recordLeadActivity({
                tenantId,
                branchId: lead.branchId,
                leadId,
                type: ACTIVITY_TYPES.WHATSAPP_SENT,
                title: 'WhatsApp message sent',
                description: 'Outbound WhatsApp message sent',
                metadata: data,
            });
        } catch (err) {
            console.error('❌ whatsapp.message.sent handler error:', err.message);
        }
    });

    // ─── whatsapp.message.received → Update lead lastContactedAt ───
    await subscribeToEvents(EVENTS.WHATSAPP_MESSAGE_RECEIVED, async (_channel, data) => {
        try {
            const { tenantId, leadId } = data;
            if (!leadId) return;

            const lead = await Lead.findOneAndUpdate(
                { _id: leadId, tenantId },
                { 'lifecycle.lastActivityAt': new Date() },
                { new: true }
            );
            if (lead) {
                await recordLeadActivity({
                    tenantId,
                    branchId: lead.branchId,
                    leadId,
                    type: ACTIVITY_TYPES.WHATSAPP_RECEIVED,
                    title: 'WhatsApp message received',
                    description: 'Inbound WhatsApp message received',
                    metadata: data,
                });
            }
        } catch (err) {
            console.error('❌ whatsapp.message.received handler error:', err.message);
        }
    });

    // ─── lead.updated → Apply changes published by other services ───
    // call-service and whatsapp-service publish this event immediately after
    // initiating a call / sending a message, so the lead's timestamps stay current
    // without waiting for a CALL_COMPLETED event (which fires after the call ends).
    await subscribeToEvents(EVENTS.LEAD_UPDATED, async (_channel, data) => {
        try {
            const { tenantId, leadId, changes } = data;
            if (!leadId || !changes || typeof changes !== 'object') return;

            // Only allow safe fields to be updated via this event
            const updatePayload = {};
            const lifecycleMap = {
                lastContactedAt: 'lifecycle.lastContactedAt',
                lastActivityAt: 'lifecycle.lastActivityAt',
                followUpAt: 'lifecycle.followUpAt',
                'lifecycle.lastContactedAt': 'lifecycle.lastContactedAt',
                'lifecycle.lastActivityAt': 'lifecycle.lastActivityAt',
                'lifecycle.followUpAt': 'lifecycle.followUpAt',
            };
            const pipelineMap = {
                stage: 'pipeline.stage',
                'pipeline.stage': 'pipeline.stage',
            };
            for (const [key, value] of Object.entries(changes)) {
                if (lifecycleMap[key]) updatePayload[lifecycleMap[key]] = value;
                else if (pipelineMap[key]) updatePayload[pipelineMap[key]] = value;
                else if (key === 'assignedTo') updatePayload.assignedTo = value;
            }

            if (Object.keys(updatePayload).length === 0) return;

            const lead = await Lead.findOneAndUpdate({ _id: leadId, tenantId }, updatePayload, { new: true });
            if (lead) {
                await recordLeadActivity({
                    tenantId,
                    branchId: lead.branchId,
                    leadId,
                    type: ACTIVITY_TYPES.LEAD_UPDATED,
                    title: 'Lead updated',
                    description: `Updated fields: ${Object.keys(updatePayload).join(', ')}`,
                    metadata: { changes: updatePayload },
                });
            }
            console.log(`📋 lead.updated → Lead ${leadId} | fields: ${Object.keys(updatePayload).join(', ')}`);
        } catch (err) {
            console.error('❌ lead.updated handler error:', err.message);
        }
    });

    console.log('✅ lead-service: 6 event listeners registered');
};

module.exports = { registerEventListeners };
