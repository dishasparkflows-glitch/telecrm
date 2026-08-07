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
            const { tenantId, branchId, data: formData, settings } = data;

            // Map form fields to lead fields while preserving current Smart Form defaults.
            const leadData = {
                firstName: formData.firstName || formData.name || 'Unknown',
                lastName: formData.lastName || '',
                email: formData.email || '',
                phone: formData.phone || formData.mobile || '',
                company: formData.company || '',
                tags: settings?.autoTag || [],
                customFields: formData.customFields || {},
            };

            const result = await createOrUpdateLeadFromSource({
                tenantId,
                branchId: branchId || null,
                source: 'smart_form',
                sourceDetails: `Form: ${data.formId}`,
                leadData,
                assignedTo: settings?.assignTo || null,
                actorType: 'integration',
                origin: { provider: 'smart_form', sourceId: String(data.formId || ''), rawSource: 'form.submitted' },
                firstTouch: { formId: String(data.formId || ''), capturedAt: new Date() },
                lastTouch: { formId: String(data.formId || ''), capturedAt: new Date() },
                rawPayload: formData,
            });

            if (result.duplicate) {
                console.log(`📋 form.submitted: Duplicate lead matched (${leadData.email || leadData.phone})`);
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
                    lastContactedAt: new Date(),
                    lastActivityAt: new Date(),
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
                { lastActivityAt: new Date() },
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
                { lastActivityAt: new Date() },
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
            const safeFields = ['lastContactedAt', 'lastActivityAt', 'followUpAt', 'stage', 'assignedTo'];
            const updatePayload = {};
            for (const field of safeFields) {
                if (changes[field] !== undefined) {
                    updatePayload[field] = changes[field];
                }
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
