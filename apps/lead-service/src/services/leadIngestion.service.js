const Lead = require('../models/Lead');
const { calculateLeadScore } = require('./scoring.service');
const { publishEvent, EVENTS } = require('@sparkcrm/shared-events');
const { ACTIVITY_TYPES, recordLeadActivity } = require('./leadActivity.service');
const { assignLeadFromPolicy } = require('./assignment.service');
const { cacheHelper } = require('@sparkcrm/shared-utils');

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();
const normalizePhone = (phone) => String(phone || '').replace(/[^0-9]/g, '');

const buildDuplicateFilter = ({ tenantId, emailNormalized, phoneNormalized, email, phone }) => {
    const orConditions = [];
    if (emailNormalized) orConditions.push({ 'contact.emailNormalized': emailNormalized });
    if (phoneNormalized) orConditions.push({ 'contact.phoneNormalized': phoneNormalized });
    if (email) orConditions.push({ 'contact.email': normalizeEmail(email) });
    if (phone) orConditions.push({ 'contact.phone': phone });

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
    const emailNormalized = normalizeEmail(leadData.contact?.email || leadData.email);
    const phoneNormalized = normalizePhone(leadData.contact?.phone || leadData.phone);

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
        email: leadData.contact?.email || leadData.email,
        phone: leadData.contact?.phone || leadData.phone,
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
    const resolvedPriority = leadData.lifecycle?.priority || 'medium';
    const resolvedExpectedValue = Number(leadData.lifecycle?.expectedValue) || 0;
    const resolvedFollowUpAt = leadData.lifecycle?.followUpAt || null;
    if (!resolvedAssignedTo) {
        const assignment = await assignLeadFromPolicy({
            tenantId,
            branchId: branchId || leadData.branchId || null,
            source,
            priority: resolvedPriority,
        });
        resolvedAssignedTo = assignment.assignedTo || null;
        assignmentPolicy = assignment.policy;
        assignmentStrategy = assignment.strategy;

        // Fallback to creator if no assignment policy took effect and it was manually created or imported
        if (!resolvedAssignedTo && ['manual', 'csv'].includes(source) && createdBy) {
            resolvedAssignedTo = createdBy;
        }
    }

    const pipeline = {
        stage: leadData.pipeline?.stage || 'new',
        previousStage: leadData.pipeline?.previousStage || null,
        stageChangedAt: leadData.pipeline?.stageChangedAt || new Date(),
    };

    const lifecycle = {
        priority: resolvedPriority,
        expectedValue: resolvedExpectedValue,
        currency: leadData.lifecycle?.currency || 'INR',
        lastActivityAt: leadData.lifecycle?.lastActivityAt || new Date(),
        lastContactedAt: leadData.lifecycle?.lastContactedAt || null,
        followUpAt: resolvedFollowUpAt,
        convertedAt: leadData.lifecycle?.convertedAt || null,
    };

    const lead = await Lead.create({
        ...leadData,
        pipeline,
        lifecycle,
        tenantId,
        branchId: branchId || leadData.branchId || null,
        contact: {
            ...(leadData.contact || {}),
            emailNormalized,
            phoneNormalized,
        },
        source,
        sourceDetails,
        assignedTo: resolvedAssignedTo,
        assignedAt: resolvedAssignedTo ? new Date() : null,
        origin,
        firstTouch,
        lastTouch,
        consent,
        externalIdentities,
    });

    const { score, breakdown } = calculateLeadScore(lead);
    lead.scoring = {
        score,
        scoreBreakdown: breakdown,
        lastScoredAt: new Date(),
    };
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

    // Invalidate lead cache across the tenant since a new lead was ingested
    await cacheHelper.deleteByPattern(`leads:${tenantId}:*`);

    return { lead, created: true, duplicate: false };
};

module.exports = {
    createOrUpdateLeadFromSource,
    normalizeEmail,
    normalizePhone,
};
