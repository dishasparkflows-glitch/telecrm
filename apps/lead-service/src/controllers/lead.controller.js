const Lead = require('../models/Lead');
const LeadActivity = require('../models/LeadActivity');
const { calculateLeadScore } = require('../services/scoring.service');
const { createOrUpdateLeadFromSource, normalizeEmail, normalizePhone } = require('../services/leadIngestion.service');
const { ACTIVITY_TYPES, recordLeadActivity } = require('../services/leadActivity.service');
const { pagination, requireObjectId, escapeRegex } = require('../utils/input');
const { pickLeadCreateInput, pickLeadUpdateInput, applyAssignedToFilter } = require('../utils/leadDto');
const { ApiResponse, ApiError, asyncHandler, buildScopeFilter, canAccessRecord } = require('@sparkcrm/shared-utils');
const { publishEvent, EVENTS } = require('@sparkcrm/shared-events');
const { auditLogger } = require('@sparkcrm/shared-middleware');
const { getUsersBulk } = require('../services/serviceClients/user.client');
const { validateCustomFields } = require('../utils/customFieldValidator');

const LEAD_SORT_FIELDS = new Set(['createdAt', 'updatedAt', 'firstName', 'lastName', 'stage', 'priority', 'score', 'scoring.score', 'expectedValue', 'followUpAt']);

/**
 * POST /api/leads
 * Create a new lead
 */
const createLead = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const userId = req.headers['x-user-id'];
    const scope = buildScopeFilter(req, { ownerField: 'assignedTo', module: 'leads' });
    const leadData = pickLeadCreateInput(req.body);

    if (leadData.customFields) {
        await validateCustomFields(tenantId, 'Lead', leadData.customFields);
    }

    const result = await createOrUpdateLeadFromSource({
        tenantId,
        branchId: scope.branchId || null,
        source: leadData.source || 'manual',
        sourceDetails: leadData.sourceDetails || '',
        leadData,
        assignedTo: leadData.assignedTo !== undefined ? leadData.assignedTo : null,
        createdBy: userId,
        actorId: userId,
        actorType: 'user',
    });

    if (!result.created && result.duplicate) {
        return ApiResponse.success(res, result.lead, 'Lead already exists (duplicate detected)', 200);
    }

    await auditLogger.log({
        req,
        action: 'CREATE',
        module: 'leads',
        recordId: result.lead._id,
        recordType: 'Lead',
        details: { body: req.body, existingdata: null, updateddata: result.lead.toObject ? result.lead.toObject() : result.lead }
    });

    ApiResponse.created(res, result.lead, 'Lead created');
});

/**
 * GET /api/leads
 * List leads with filters, search, pagination
 */
const getLeads = asyncHandler(async (req, res) => {
    const {
        search, stage, source, assignedTo, priority, tags,
        sortBy = 'createdAt', sortOrder = 'desc', isArchived = 'false',
    } = req.query;
    const { page, limit, skip } = pagination(req.query);

    // Build scope filter based on verified visibility; requested filters cannot widen it.
    const filter = buildScopeFilter(req, { ownerField: 'assignedTo', module: 'leads' });
    filter.isArchived = isArchived === 'true';

    if (assignedTo) {
        applyAssignedToFilter(filter, requireObjectId(assignedTo, 'assignedTo'));
    }
    if (stage) filter['pipeline.stage'] = stage;
    if (source) filter.source = source;
    if (priority) filter['lifecycle.priority'] = priority;
    if (tags) filter.tags = { $in: tags.split(',') };

    // Text search across name, email, phone, company
    if (search) {
        const escapedSearch = escapeRegex(search);
        filter.$or = [
            { 'contact.firstName': { $regex: escapedSearch, $options: 'i' } },
            { 'contact.lastName': { $regex: escapedSearch, $options: 'i' } },
            { 'contact.email': { $regex: escapedSearch, $options: 'i' } },
            { 'contact.phone': { $regex: escapedSearch, $options: 'i' } },
            { 'contact.company': { $regex: escapedSearch, $options: 'i' } },
        ];
    }

    if (!LEAD_SORT_FIELDS.has(sortBy)) throw ApiError.badRequest('Unsupported lead sort field');
    if (!['asc', 'desc'].includes(sortOrder)) throw ApiError.badRequest('sortOrder must be asc or desc');
    let dbSortBy = sortBy;
    if (['firstName', 'lastName'].includes(sortBy)) dbSortBy = `contact.${sortBy}`;
    else if (sortBy === 'stage') dbSortBy = 'pipeline.stage';
    else if (['priority', 'expectedValue', 'followUpAt'].includes(sortBy)) dbSortBy = `lifecycle.${sortBy}`;
    const sort = { [dbSortBy]: sortOrder === 'asc' ? 1 : -1 };

    const [dbLeads, total] = await Promise.all([
        Lead.find(filter).sort(sort).skip(skip).limit(limit),
        Lead.countDocuments(filter),
    ]);

    const tenantId = req.headers['x-tenant-id'];
    const userIds = [...new Set(dbLeads.map(l => l.assignedTo).filter(Boolean).map(String))];
    const users = await getUsersBulk(tenantId, userIds);
    const userMap = new Map(users.map(u => [String(u._id), u]));

    const leads = dbLeads.map(lead => {
        const obj = lead.toObject();
        obj.assignedTo = userMap.get(String(obj.assignedTo)) || null;
        return obj;
    });

    ApiResponse.paginated(res, leads, {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
    });
});

/**
 * GET /api/leads/:id
 * Get a single lead with full details
 */
const getLead = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const leadId = requireObjectId(req.params.id, 'lead ID');
    const lead = await Lead.findOne({ _id: leadId, tenantId });
    if (!lead) throw ApiError.notFound('Lead not found');

    if (!canAccessRecord(req, lead, { ownerField: 'assignedTo', module: 'leads' })) {
        throw ApiError.forbidden('You do not have access to this lead');
    }
    
    const obj = lead.toObject();
    if (obj.assignedTo) {
        const users = await getUsersBulk(tenantId, [String(obj.assignedTo)]);
        if (users && users.length > 0) {
            obj.assignedTo = users[0];
        }
    }

    ApiResponse.success(res, obj);
});

/**
 * PUT /api/leads/:id
 * Update a lead
 */
const updateLead = asyncHandler(async (req, res) => {
    console.log("heeyyyyy")
    const tenantId = req.headers['x-tenant-id'];
    const leadId = requireObjectId(req.params.id, 'lead ID');
    const changes = pickLeadUpdateInput(req.body);
    const lead = await Lead.findOne({ _id: leadId, tenantId });
    if (!lead) throw ApiError.notFound('Lead not found');
    const existingdata = lead.toObject();

    if (changes.customFields) {
        await validateCustomFields(tenantId, 'Lead', changes.customFields);
    }

    // Check access — agents can only edit their assigned leads
    if (!canAccessRecord(req, lead, { ownerField: 'assignedTo', module: 'leads' })) {
        throw ApiError.forbidden('You do not have access to this lead');
    }

    if (changes.expectedValue !== undefined) {
        if (!changes.lifecycle) changes.lifecycle = {};
        changes.lifecycle.expectedValue = Number(changes.expectedValue);
        delete changes.expectedValue;
    }
    if (changes.followUpAt !== undefined) {
        if (!changes.lifecycle) changes.lifecycle = {};
        changes.lifecycle.followUpAt = changes.followUpAt ? new Date(changes.followUpAt) : null;
        delete changes.followUpAt;
    }
    if (changes.priority !== undefined) {
        if (!changes.lifecycle) changes.lifecycle = {};
        changes.lifecycle.priority = changes.priority;
        delete changes.priority;
    }

    const targetStage = changes.pipeline?.stage;
    const targetFollowUpAt = changes.lifecycle?.followUpAt !== undefined ? changes.lifecycle.followUpAt : undefined;
    const oldStage = lead.pipeline?.stage || lead.stage;
    const oldFollowUpAt = (lead.lifecycle?.followUpAt) ? new Date(lead.lifecycle?.followUpAt).getTime() : null;
    const changedFields = Object.keys(changes);
    if (changes.contact) {
        if (changes.contact.email !== undefined) changes.contact.emailNormalized = normalizeEmail(changes.contact.email);
        if (changes.contact.phone !== undefined) changes.contact.phoneNormalized = normalizePhone(changes.contact.phone);
        // Deep merge contact object so we don't overwrite unspecified properties
        lead.contact = { ...(lead.contact || {}), ...changes.contact };
        delete changes.contact;
    }
    if (changes.pipeline) {
        lead.pipeline = { ...(lead.pipeline || {}), ...changes.pipeline };
        delete changes.pipeline;
    }
    if (changes.lifecycle) {
        lead.lifecycle = { ...(lead.lifecycle || {}), ...changes.lifecycle };
        delete changes.lifecycle;
    }
    Object.assign(lead, changes);

    // Track stage changes
    if (targetStage && targetStage !== oldStage) {
        if (!lead.pipeline) lead.pipeline = {};
        lead.pipeline.stage = targetStage;
        lead.pipeline.previousStage = oldStage;
        lead.pipeline.stageChangedAt = new Date();
        if (!lead.lifecycle) lead.lifecycle = {};
        lead.lifecycle.lastActivityAt = new Date();

        await publishEvent(EVENTS.LEAD_STAGE_CHANGED, {
            tenantId,
            branchId: lead.branchId,
            leadId: lead._id,
            oldStage,
            newStage: targetStage,
        });

        await recordLeadActivity({
            tenantId,
            branchId: lead.branchId,
            leadId: lead._id,
            actorId: req.headers['x-user-id'],
            actorType: 'user',
            type: ACTIVITY_TYPES.LEAD_STAGE_CHANGED,
            title: 'Stage changed',
            description: `${oldStage || 'Unknown'} → ${targetStage}`,
            metadata: { oldStage, newStage: targetStage },
        });
    }

    // Recalculate score
    const { score, breakdown } = calculateLeadScore(lead);
    lead.scoring = {
        score,
        scoreBreakdown: breakdown,
        lastScoredAt: new Date(),
    };

    await lead.save();
    console.log("auditLogger")
    await auditLogger.log({
        req,
        action: 'UPDATE',
        module: 'leads',
        recordId: lead._id,
        recordType: 'Lead',
        details: { body: req.body, existingdata, updateddata: lead.toObject() }
    });

    if (targetFollowUpAt !== undefined) {
        const newFollowUpAt = (lead.lifecycle?.followUpAt) ? new Date(lead.lifecycle?.followUpAt).getTime() : null;
        if (newFollowUpAt !== oldFollowUpAt) {
            await publishEvent(EVENTS.LEAD_FOLLOWUP_SCHEDULED, {
                tenantId,
                branchId: lead.branchId,
                leadId: lead._id,
                assignedTo: lead.assignedTo,
                followUpAt: lead.lifecycle?.followUpAt,
                leadName: `${lead.contact?.firstName || ''} ${lead.contact?.lastName || ''}`.trim(),
            });
        }
    }

    await recordLeadActivity({
        tenantId,
        branchId: lead.branchId,
        leadId: lead._id,
        actorId: req.headers['x-user-id'],
        actorType: 'user',
        type: ACTIVITY_TYPES.LEAD_UPDATED,
        title: 'Lead updated',
        description: 'Lead details were updated',
        metadata: { fields: changedFields },
    });

    ApiResponse.success(res, lead, 'Lead updated');
});

/**
 * POST /api/leads/:id/notes
 * Add a note to a lead
 */
const addNote = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const userId = req.headers['x-user-id'];
    const leadId = requireObjectId(req.params.id, 'lead ID');
    const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';

    if (!text) throw ApiError.badRequest('Note text is required');

    const lead = await Lead.findOne({ _id: leadId, tenantId });
    if (!lead) throw ApiError.notFound('Lead not found');
    if (!canAccessRecord(req, lead, { ownerField: 'assignedTo', module: 'leads' })) {
        throw ApiError.forbidden('You do not have access to this lead');
    }

    lead.notes.push({ text, createdBy: userId });
    if (!lead.lifecycle) lead.lifecycle = {};
    lead.lifecycle.lastActivityAt = new Date();

    // Recalculate score (engagement factor changes)
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
        actorId: userId,
        actorType: 'user',
        type: ACTIVITY_TYPES.NOTE_ADDED,
        title: 'Note added',
        description: text,
    });

    ApiResponse.success(res, null, 'Note added');
});

/**
 * PUT /api/leads/:id/assign
 * Assign a lead to a user
 */
const assignLead = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const leadId = requireObjectId(req.params.id, 'lead ID');
    const rawAssignedTo = req.body?.assignedTo;
    const assignedTo = (rawAssignedTo !== null && rawAssignedTo !== undefined && rawAssignedTo !== '')
        ? requireObjectId(rawAssignedTo, 'assignedTo')
        : null;

    const lead = await Lead.findOne({ _id: leadId, tenantId });

    if (!lead) throw ApiError.notFound('Lead not found');
    if (!canAccessRecord(req, lead, { ownerField: 'assignedTo', module: 'leads' })) {
        throw ApiError.forbidden('You do not have access to this lead');
    }

    lead.assignedTo = assignedTo;
    lead.assignedAt = assignedTo ? new Date() : null;
    if (!lead.lifecycle) lead.lifecycle = {};
    lead.lifecycle.lastActivityAt = new Date();
    await lead.save();

    await publishEvent(EVENTS.LEAD_ASSIGNED, {
        tenantId,
        branchId: lead.branchId,
        leadId: lead._id,
        assignedTo,
    });

    await recordLeadActivity({
        tenantId,
        branchId: lead.branchId,
        leadId: lead._id,
        actorId: req.headers['x-user-id'],
        actorType: 'user',
        type: ACTIVITY_TYPES.LEAD_ASSIGNED,
        title: assignedTo ? 'Lead assigned' : 'Lead unassigned',
        description: assignedTo ? 'Lead assignment changed' : 'Lead set to unassigned',
        metadata: { assignedTo },
    });

    ApiResponse.success(res, null, assignedTo ? 'Lead assigned' : 'Lead unassigned');
});

/**
 * POST /api/leads/import
 * Bulk import leads from CSV data
 */
const importLeads = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const userId = req.headers['x-user-id'];
    const scope = buildScopeFilter(req, { ownerField: 'assignedTo', module: 'leads' });
    const leadsData = req.body?.leads;

    if (!Array.isArray(leadsData) || leadsData.length === 0) {
        throw ApiError.badRequest('Leads array is required');
    }

    if (leadsData.length > 5000) {
        throw ApiError.badRequest('Maximum 5000 leads per import');
    }

    const results = { created: 0, duplicates: 0, errors: [] };

    for (const [index, sourceRow] of leadsData.entries()) {
        try {
            const data = pickLeadCreateInput(sourceRow);
            if (!data.contact?.firstName) {
                results.errors.push({ row: index + 1, error: 'First name is required' });
                continue;
            }

            // Dedup check
            if (data.contact?.email || data.contact?.phone) {
                const orConds = [];
                if (data.contact.email) orConds.push({ 'contact.email': data.contact.email.toLowerCase() });
                if (data.contact.phone) orConds.push({ 'contact.phone': data.contact.phone });
                const existing = await Lead.findOne({ tenantId, $or: orConds });
                if (existing) {
                    results.duplicates++;
                    continue;
                }
            }

            const result = await createOrUpdateLeadFromSource({
                tenantId,
                branchId: scope.branchId || null,
                source: data.source || 'csv',
                sourceDetails: data.sourceDetails || 'CSV Import',
                leadData: data,
                assignedTo: data.assignedTo !== undefined ? data.assignedTo : null,
                createdBy: userId,
                actorId: userId,
                actorType: 'user',
            });
            if (result.duplicate) results.duplicates++;
            else results.created++;
        } catch (err) {
            results.errors.push({ row: index + 1, error: err.message });
        }
    }

    ApiResponse.success(res, results, `Import complete: ${results.created} created, ${results.duplicates} duplicates`);
});

/**
 * DELETE /api/leads/:id
 * Archive a lead (soft delete)
 */
const archiveLead = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const lead = await Lead.findOne({ _id: req.params.id, tenantId });
    if (!lead) throw ApiError.notFound('Lead not found');

    // Check access
    if (!canAccessRecord(req, lead, { ownerField: 'assignedTo', module: 'leads' })) {
        throw ApiError.forbidden('You do not have access to this lead');
    }

    lead.isArchived = true;
    await lead.save();
    ApiResponse.success(res, null, 'Lead archived');
});

/**
 * GET /api/leads/stats
 * Get lead pipeline statistics
 */
const getStats = asyncHandler(async (req, res) => {
    // Use buildScopeFilter for consistent scoping with getLeads
    const filter = buildScopeFilter(req, { ownerField: 'assignedTo', module: 'leads' });
    filter.isArchived = false;

    // Convert tenantId string to ObjectId for aggregation
    const match = { ...filter };
    if (typeof match.tenantId === 'string') {
        match.tenantId = new (require('mongoose').Types.ObjectId)(match.tenantId);
    }
    if (typeof match.branchId === 'string') {
        match.branchId = new (require('mongoose').Types.ObjectId)(match.branchId);
    }
    if (typeof match.assignedTo === 'string') {
        match.assignedTo = new (require('mongoose').Types.ObjectId)(match.assignedTo);
    }

    const [stageCounts, sourceCounts, totalLeads, avgScore] = await Promise.all([
        Lead.aggregate([
            { $match: match },
            { $group: { _id: { $ifNull: ['$pipeline.stage', '$stage'] }, count: { $sum: 1 } } },
        ]),
        Lead.aggregate([
            { $match: match },
            { $group: { _id: '$source', count: { $sum: 1 } } },
        ]),
        Lead.countDocuments(filter),
        Lead.aggregate([
            { $match: match },
            { $group: { _id: null, avgScore: { $avg: { $ifNull: ['$scoring.score', '$score'] } } } },
        ]),
    ]);

    ApiResponse.success(res, {
        totalLeads,
        avgScore: avgScore[0]?.avgScore || 0,
        byStage: Object.fromEntries(stageCounts.map((s) => [s._id, s.count])),
        bySource: Object.fromEntries(sourceCounts.map((s) => [s._id, s.count])),
    });
});

/**
 * GET /api/leads/by-phone/:phone
 * Internal endpoint — resolves a phone number to a lead.
 * Used by whatsapp-service to link inbound Baileys messages to the correct lead.
 */
const getLeadTimeline = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const branchId = req.headers['x-branch-id'] || req.headers['x-user-branch-id'];
    const { page = 1, limit = 100, type } = req.query;

    const leadFilter = { _id: req.params.id, tenantId };
    if (branchId && branchId !== 'all') leadFilter.branchId = branchId;

    const lead = await Lead.findOne(leadFilter).select('_id tenantId branchId assignedTo');
    if (!lead) throw ApiError.notFound('Lead not found');

    if (!canAccessRecord(req, lead, { ownerField: 'assignedTo', module: 'leads' })) {
        throw ApiError.forbidden('You do not have access to this lead');
    }

    const filter = { tenantId, leadId: req.params.id };
    if (type) filter.type = type;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [activities, total] = await Promise.all([
        LeadActivity.find(filter)
            .select('meta.createdAt _id tenantId leadId actorId type title description')
            .sort({ 'meta.createdAt': -1 })
            .skip(skip)
            .limit(parseInt(limit)),
        LeadActivity.countDocuments(filter),
    ]);

    ApiResponse.paginated(res, activities.reverse(), {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
    });
});

const getLeadByPhone = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const { phone } = req.params;

    if (!tenantId) throw ApiError.badRequest('tenantId required');
    if (!phone) throw ApiError.badRequest('phone required');

    // Normalise: strip leading + and non-digit chars, then try bare 10-digit and full international
    const digits = phone.replace(/[^0-9]/g, '');
    const variants = [digits];
    if (digits.length === 10) variants.push(`91${digits}`);
    if (digits.length === 12 && digits.startsWith('91')) variants.push(digits.slice(2));

    const lead = await Lead.findOne({
        tenantId,
        'contact.phone': { $in: variants },
        isActive: { $ne: false },
    }).select('_id contact.firstName contact.lastName contact.phone').lean();

    if (!lead) {
        return ApiResponse.success(res, null, 'No lead found for this phone number', 404);
    }

    ApiResponse.success(res, lead, 'Lead found');
});

const getActiveLeads = asyncHandler(async (req, res) => {
    const hasPagination = req.query.page !== undefined || req.query.limit !== undefined;
    const { page, limit, skip } = pagination(req.query);
    const { search } = req.query;

    // Build scope filter based on verified visibility
    const filter = buildScopeFilter(req, { ownerField: 'assignedTo', module: 'leads' });
    filter.isArchived = false;
    filter['contact.phone'] = { $ne: '', $exists: true, $type: 'string' };

    if (search) {
        const escapedSearch = escapeRegex(search);
        filter.$or = [
            { 'contact.firstName': { $regex: escapedSearch, $options: 'i' } },
            { 'contact.lastName': { $regex: escapedSearch, $options: 'i' } },
            { 'contact.phone': { $regex: escapedSearch, $options: 'i' } },
        ];
    }

    let query = Lead.find(filter)
        .select('_id contact')
        .sort({ 'lifecycle.lastActivityAt': -1, 'meta.updatedAt': -1 });

    if (hasPagination) {
        query = query.skip(skip).limit(limit);
    }

    const [leads, total] = await Promise.all([
        query.lean(),
        Lead.countDocuments(filter),
    ]);

    if (hasPagination) {
        ApiResponse.paginated(res, leads, {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        });
    } else {
        ApiResponse.success(res, leads, 'Success');
    }
});

const getLeadsBulk = asyncHandler(async (req, res) => {
    const tenantId = req.query.tenantId || req.headers['x-tenant-id'];
    const { ids } = req.query;

    if (!tenantId) throw ApiError.badRequest('tenantId required');
    if (!ids) throw ApiError.badRequest('ids required');

    const idsArray = ids.split(',').map(id => id.trim()).filter(Boolean);
    if (idsArray.length === 0) {
        return ApiResponse.success(res, [], 'No leads found');
    }
    if (idsArray.length > 200) {
        throw ApiError.badRequest('Maximum 200 IDs allowed');
    }

    const leads = await Lead.find({
        tenantId,
        _id: { $in: idsArray },
        isActive: { $ne: false },
    }).select('_id contact.firstName contact.lastName contact.phone').lean();

    ApiResponse.success(res, leads, 'Leads fetched successfully');
});

module.exports = {
    createLead,
    getLeads,
    getActiveLeads,
    getLead,
    updateLead,
    addNote,
    assignLead,
    importLeads,
    archiveLead,
    getStats,
    getLeadTimeline,
    getLeadByPhone,
    getLeadsBulk,
};
