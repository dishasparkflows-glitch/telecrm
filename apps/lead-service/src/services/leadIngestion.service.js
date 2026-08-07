const Lead = require('../models/Lead');
const { calculateLeadScore } = require('./scoring.service');
const { publishEvent, EVENTS } = require('@sparkcrm/shared-events');
const { ACTIVITY_TYPES, recordLeadActivity } = require('./leadActivity.service');
const { assignLeadFromPolicy } = require('./assignment.service');

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();
const normalizePhone = (phone) => String(phone || '').replace(/[^0-9]/g, '');

const buildDuplicateFilter = ({ tenantId, emailNormalized, phoneNormalized, email, phone }) => {
    const orConditions = [];
    if (emailNormalized) orConditions.push({ emailNormalized });
    if (phoneNormalized) orConditions.push({ phoneNormalized });
    if (email) orConditions.push({ email: normalizeEmail(email) });
    if (phone) orConditions.push({ phone });

    if (!orConditions.length) return null;
    return { tenantId, $or: orConditions };
};

/**
 * Canonical lead creation path for manual, CSV, Smart Form, API and future ad leads.
 * Existing workflow defaults are preserved by passing assignedTo/createdBy from callers.
 */
const createOrUpdateLeadFromSource = async ({
    tenantId,
    branchId = null,
    source = 'manual',
    sourceDetails = '',
    leadData = {},
    assignedTo = null,
    createdBy = null,
    actorId = null,
    actorType = 'system',
    origin = {},
    firstTouch = {},
    lastTouch = {},
    consent = {},
    externalIdentity = null,
    rawPayload = null,
    publishCreatedEvent = true,
}) => {
    const emailNormalized = normalizeEmail(leadData.email);
    const phoneNormalized = normalizePhone(leadData.phone);

    if (externalIdentity?.provider && externalIdentity?.externalId) {
        const existingByExternalIdentity = await Lead.findOne({
            tenantId,
            externalIdentities: {
                $elemMatch: {
                    provider: externalIdentity.provider,
                    externalId: String(externalIdentity.externalId),
                },
            },
        });

        if (existingByExternalIdentity) {
            await recordLeadActivity({
                tenantId,
                branchId: existingByExternalIdentity.branchId || branchId,
                leadId: existingByExternalIdentity._id,
                actorId,
                actorType,
                type: ACTIVITY_TYPES.INTEGRATION_RECEIVED,
                title: 'Duplicate source event received',
                description: `Duplicate ${source} external identity matched existing record`,
                metadata: {
                    source,
                    sourceDetails,
                    externalIdentity,
                    rawPayload,
                },
            });
            return { lead: existingByExternalIdentity, created: false, duplicate: true };
        }
    }

    const duplicateFilter = buildDuplicateFilter({
        tenantId,
        emailNormalized,
        phoneNormalized,
        email: leadData.email,
        phone: leadData.phone,
    });

    if (duplicateFilter) {
        const existing = await Lead.findOne(duplicateFilter);
        if (existing) {
            await recordLeadActivity({
                tenantId,
                branchId: existing.branchId || branchId,
                leadId: existing._id,
                actorId,
                actorType,
                type: ACTIVITY_TYPES.INTEGRATION_RECEIVED,
                title: 'Duplicate lead received',
                description: `Duplicate ${source} lead matched existing record`,
                metadata: { source, sourceDetails, rawPayload },
            });
            return { lead: existing, created: false, duplicate: true };
        }
    }

    const externalIdentities = [];
    if (externalIdentity?.provider && externalIdentity?.externalId) {
        externalIdentities.push(externalIdentity);
    }

    let resolvedAssignedTo = assignedTo || leadData.assignedTo || null;
    let assignmentPolicy = null;
    let assignmentStrategy = null;
    if (!resolvedAssignedTo) {
        const assignment = await assignLeadFromPolicy({
            tenantId,
            branchId: branchId || leadData.branchId || null,
            source,
            priority: leadData.priority,
        });
        resolvedAssignedTo = assignment.assignedTo || null;
        assignmentPolicy = assignment.policy;
        assignmentStrategy = assignment.strategy;
    }

    const lead = await Lead.create({
        ...leadData,
        tenantId,
        branchId: branchId || leadData.branchId || null,
        email: emailNormalized,
        emailNormalized,
        phoneNormalized,
        source,
        sourceDetails,
        assignedTo: resolvedAssignedTo,
        assignedAt: resolvedAssignedTo ? new Date() : null,
        createdBy: createdBy || leadData.createdBy || null,
        origin,
        firstTouch,
        lastTouch,
        consent,
        externalIdentities,
    });

    const { score, breakdown } = calculateLeadScore(lead);
    lead.score = score;
    lead.scoreBreakdown = breakdown;
    lead.lastScoredAt = new Date();
    await lead.save();

    await recordLeadActivity({
        tenantId,
        branchId: lead.branchId,
        leadId: lead._id,
        actorId: actorId || createdBy,
        actorType,
        type: ACTIVITY_TYPES.LEAD_CREATED,
        title: 'Lead created',
        description: `Lead created from ${source.replace('_', ' ')}`,
        metadata: { source, sourceDetails, rawPayload },
    });

    if (lead.assignedTo) {
        await recordLeadActivity({
            tenantId,
            branchId: lead.branchId,
            leadId: lead._id,
            actorId: actorId || createdBy,
            actorType,
            type: ACTIVITY_TYPES.LEAD_ASSIGNED,
            title: 'Lead assigned',
            description: 'Initial lead assignment applied',
            metadata: {
                assignedTo: lead.assignedTo,
                assignmentPolicyId: assignmentPolicy?._id,
                assignmentStrategy,
            },
        });
    }

    if (publishCreatedEvent) {
        await publishEvent(EVENTS.LEAD_CREATED, {
            tenantId,
            branchId: lead.branchId,
            leadId: lead._id,
            source: lead.source,
            assignedTo: lead.assignedTo,
        });
    }

    return { lead, created: true, duplicate: false };
};

module.exports = {
    createOrUpdateLeadFromSource,
    normalizeEmail,
    normalizePhone,
};
