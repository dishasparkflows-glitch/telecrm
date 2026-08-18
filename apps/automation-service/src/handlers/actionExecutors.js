const axios = require('axios');
const { env } = require('@sparkcrm/shared-config');
const { createServiceHeaders } = require('@sparkcrm/shared-middleware');
const EmailTemplate = require('../models/EmailTemplate');
const { resolveTemplateContext } = require('../services/templateFieldResolver.service');
const { renderEmailTemplate } = require('../services/templateRenderer.service');
/**
 * Helper to build internal request configurations
 */
const buildInternalRequest = (method, path, targetServiceKey, tenantId) => {
    const targetUrl = env.SERVICES[targetServiceKey];
    if (!targetUrl) throw new Error(`Unknown target service: ${targetServiceKey}`);
    
    // Convert targetServiceKey (e.g., 'LEAD') to audience format 'lead-service'
    const audience = `${targetServiceKey.toLowerCase()}-service`;

    const headers = createServiceHeaders({
        issuer: 'automation-service',
        audience,
        method,
        path,
        identity: { tenantId: String(tenantId) },
    });

    return {
        url: `${targetUrl}${path}`,
        headers,
    };
};

const assignLead = async (tenantId, action, triggerData) => {
    const leadId = triggerData._id || triggerData.leadId;
    if (!leadId) throw new Error('Missing lead ID in trigger data');
    if (!action.config.userId) throw new Error('Missing assignedTo userId in action config');

    const reqConfig = buildInternalRequest('PUT', `/api/leads/${leadId}`, 'LEAD', tenantId);
    
    await axios.put(reqConfig.url, { assignedTo: action.config.userId }, {
        headers: reqConfig.headers,
    });
};

const changeStage = async (tenantId, action, triggerData) => {
    const leadId = triggerData._id || triggerData.leadId;
    if (!leadId) throw new Error('Missing lead ID in trigger data');
    if (!action.config.stage) throw new Error('Missing stage in action config');

    const reqConfig = buildInternalRequest('PUT', `/api/leads/${leadId}`, 'LEAD', tenantId);
    
    await axios.put(reqConfig.url, { pipeline: { stage: action.config.stage } }, {
        headers: reqConfig.headers,
    });
};

const addTag = async (tenantId, action, triggerData) => {
    const leadId = triggerData._id || triggerData.leadId;
    if (!leadId) throw new Error('Missing lead ID in trigger data');
    if (!action.config.tag) throw new Error('Missing tag in action config');

    // Assuming lead-service supports tags natively via PUT, or a specific endpoint
    // We will append tag using standard PUT for now
    // NOTE: This might require fetching the lead first or using a specialized endpoint in lead-service
    // For now, we will assume standard PUT merges if lead-service supports it, or we throw if not.
    // To be safe, let's fetch lead, append tag, and save.
    const getReq = buildInternalRequest('GET', `/api/leads/${leadId}`, 'LEAD', tenantId);
    const leadResponse = await axios.get(getReq.url, { headers: getReq.headers });
    const lead = leadResponse.data?.data;
    
    if (!lead) throw new Error('Lead not found for tagging');
    const tags = new Set(lead.tags || []);
    tags.add(action.config.tag);

    const putReq = buildInternalRequest('PUT', `/api/leads/${leadId}`, 'LEAD', tenantId);
    await axios.put(putReq.url, { tags: Array.from(tags) }, { headers: putReq.headers });
};

const sendEmail = async (tenantId, action, triggerData) => {
    if (!action.config.templateId) throw new Error('Missing email templateId in action config');
    
    // Load template
    const template = await EmailTemplate.findOne({ _id: action.config.templateId, tenantId });
    if (!template) throw new Error('Email template not found');
    if (template.status !== 'active') throw new Error(`Email template ${template.name} is not active`);

    const recordId = triggerData._id || triggerData.leadId;
    const module = template.module || 'Lead'; // Fallback to Lead if missing
    
    // Resolve context
    const context = await resolveTemplateContext({ tenantId, module, recordId });
    
    // Determine recipient email based on recipientType
    const recipientType = action.config.recipientType || 'lead';
    let to = '';
    
    if (recipientType === 'lead') {
        to = context.lead?.email;
    } else if (recipientType === 'assigned_user') {
        to = context.user?.email;
    } else if (recipientType === 'custom') {
        to = action.config.customEmail;
    }
    
    if (!to) {
        console.warn(`[Automation] No email found for recipient type ${recipientType}. Skipping sendEmail.`);
        return;
    }

    // Render email content
    const rendered = renderEmailTemplate({ template, context });

    const reqConfig = buildInternalRequest('POST', `/api/emails/send`, 'NOTIFICATION', tenantId);
    
    await axios.post(reqConfig.url, {
        to,
        subject: rendered.subject,
        html: rendered.bodyHtml,
        text: rendered.bodyText
    }, {
        headers: reqConfig.headers,
    });
};

const sendWhatsapp = async (tenantId, action, triggerData) => {
    if (!action.config.templateId) throw new Error('Missing whatsapp templateId in action config');
    
    const reqConfig = buildInternalRequest('POST', `/api/messages/send`, 'WHATSAPP', tenantId);
    
    await axios.post(reqConfig.url, {
        templateId: action.config.templateId,
        recipientId: triggerData._id || triggerData.leadId,
        recipientType: 'Lead',
        variables: triggerData
    }, {
        headers: reqConfig.headers,
    });
};

const webhook = async (tenantId, action, triggerData) => {
    if (!action.config.url) throw new Error('Missing webhook URL');
    
    await axios.post(action.config.url, {
        tenantId,
        event: 'automation_triggered',
        data: triggerData
    }, {
        headers: action.config.headers || {},
        timeout: 10000,
    });
};

const changeStatus = async (tenantId, action, triggerData) => {
    const leadId = triggerData._id || triggerData.leadId;
    if (!leadId) throw new Error('Missing lead ID in trigger data');
    if (!action.config.status) throw new Error('Missing status in action config');

    const reqConfig = buildInternalRequest('PUT', `/api/leads/${leadId}`, 'LEAD', tenantId);
    
    await axios.put(reqConfig.url, { status: action.config.status }, {
        headers: reqConfig.headers,
    });
};

const createFollowUp = async (tenantId, action, triggerData) => {
    const leadId = triggerData._id || triggerData.leadId;
    if (!leadId) throw new Error('Missing lead ID in trigger data');
    
    // Follow-ups would typically go to a follow-up or lead service endpoint
    // Assuming POST /api/leads/:id/follow-ups or POST /api/follow-ups
    const reqConfig = buildInternalRequest('POST', `/api/follow-ups`, 'LEAD', tenantId); // Guessed target
    
    await axios.post(reqConfig.url, {
        leadId,
        type: action.config.type || 'call',
        notes: action.config.notes || '',
        dueDate: action.config.dueDate, // Will need dynamic calculation or explicit
        assignedTo: action.config.assignedTo || triggerData.assignedTo,
    }, {
        headers: reqConfig.headers,
    });
};

module.exports = {
    assignLead,
    changeStage,
    changeStatus,
    addTag,
    createFollowUp,
    sendEmail,
    sendWhatsapp,
    webhook,
};
