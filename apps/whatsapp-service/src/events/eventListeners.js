const mongoose = require('mongoose');
const { subscribeToEvents, EVENTS } = require('@sparkcrm/shared-events');
const { WhatsappMessage, Template } = require('../models/WhatsappModels');
const { deliverQueuedMessage } = require('../services/outboundQueue.service');

const buildTemplateComponents = (template, templateData = {}) => {
    const parameters = (template.variables || [])
        .slice()
        .sort((a, b) => Number(a.index || 0) - Number(b.index || 0))
        .map((variable) => {
            const fieldName = variable.field || variable.name || '';
            const value = templateData[fieldName] ?? variable.example ?? '';
            return { type: 'text', text: String(value) };
        });

    return parameters.length ? [{ type: 'body', parameters }] : [];
};

const validateWelcomeRequest = (data = {}) => {
    const { tenantId, leadId, phone, templateName, consent, consentRequired = true, idempotencyKey } = data;
    if (!tenantId || !leadId || !phone || !templateName || !idempotencyKey) return { ok: false, reason: 'incomplete' };
    if (consentRequired && !consent?.whatsappOptIn) return { ok: false, reason: 'consent' };
    return { ok: true, reason: null };
};

const registerEventListeners = async () => {
    console.log('📡 whatsapp-service: Registering event listeners...');

    await subscribeToEvents(EVENTS.WHATSAPP_WELCOME_REQUESTED, async (_channel, data) => {
        const {
            tenantId,
            branchId,
            leadId,
            assignedTo,
            phone,
            templateName,
            templateData,
            idempotencyKey,
        } = data || {};

        const validation = validateWelcomeRequest(data);
        if (validation.reason === 'incomplete') {
            console.warn('WhatsApp welcome request ignored: incomplete payload');
            return;
        }
        if (validation.reason === 'consent') {
            console.warn(`WhatsApp welcome request ignored for lead ${leadId}: consent not recorded`);
            return;
        }

        const template = await Template.findOne({
            tenantId,
            name: templateName,
            status: 'approved',
            isActive: true,
            $or: [{ branchId: branchId || null }, { branchId: null }],
        }).sort({ branchId: -1 });

        if (!template) {
            await WhatsappMessage.findOneAndUpdate(
                { idempotencyKey },
                {
                    $setOnInsert: {
                        tenantId,
                        branchId: branchId || null,
                        leadId,
                        userId: mongoose.Types.ObjectId.isValid(assignedTo) ? assignedTo : null,
                        message: {
                            direction: 'outbound',
                            from: 'business',
                            to: phone,
                            type: 'template',
                            content: '',
                        },
                        templateName,
                        status: 'failed',
                        automation: { automationType: 'meta_lead_welcome' },
                        lastError: 'Configured WhatsApp welcome template is missing, inactive, or not approved',
                    },
                },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );
            return;
        }

        const message = await WhatsappMessage.findOneAndUpdate(
            { idempotencyKey },
            {
                $setOnInsert: {
                    tenantId,
                    branchId: branchId || null,
                    leadId,
                    userId: mongoose.Types.ObjectId.isValid(assignedTo) ? assignedTo : null,
                    message: {
                        direction: 'outbound',
                        from: 'business',
                        to: phone,
                        type: 'template',
                        content: template.body,
                    },
                    templateName: template.name,
                    status: 'queued',
                    deliveryPayload: {
                        languageCode: template.language || 'en',
                        templateComponents: buildTemplateComponents(template, templateData),
                    },
                    automation: { automationType: 'meta_lead_welcome' },
                },
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        if (message.status === 'queued') await deliverQueuedMessage(message._id);
    });
};

module.exports = { registerEventListeners, buildTemplateComponents, validateWelcomeRequest };
