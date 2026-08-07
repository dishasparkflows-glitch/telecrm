const LeadActivity = require('../models/LeadActivity');

const ACTIVITY_TYPES = {
    LEAD_CREATED: 'lead.created',
    LEAD_UPDATED: 'lead.updated',
    LEAD_STAGE_CHANGED: 'lead.stage_changed',
    LEAD_ASSIGNED: 'lead.assigned',
    NOTE_ADDED: 'note.added',
    CALL_INITIATED: 'call.initiated',
    CALL_COMPLETED: 'call.completed',
    CALL_MISSED: 'call.missed',
    WHATSAPP_SENT: 'whatsapp.sent',
    WHATSAPP_RECEIVED: 'whatsapp.received',
    FORM_SUBMITTED: 'form.submitted',
    INTEGRATION_RECEIVED: 'integration.received',
};

const recordLeadActivity = async ({
    tenantId,
    branchId = null,
    leadId,
    actorId = null,
    actorType = 'system',
    type,
    title,
    description = '',
    metadata = {},
}) => {
    if (!tenantId || !leadId || !type || !title) return null;

    return LeadActivity.create({
        tenantId,
        branchId: branchId || null,
        leadId,
        actorId: actorId || null,
        actorType,
        type,
        title,
        description,
        metadata,
    });
};

module.exports = { ACTIVITY_TYPES, recordLeadActivity };
