const Lead = require('../models/Lead');
const LeadActivity = require('../models/LeadActivity');
const { calculateLeadScore } = require('../services/scoring.service');
const { createOrUpdateLeadFromSource, normalizeEmail, normalizePhone } = require('../services/leadIngestion.service');
const { ACTIVITY_TYPES, recordLeadActivity } = require('../services/leadActivity.service');
const { pagination, requireObjectId, escapeRegex } = require('../utils/input');
const { pickLeadCreateInput, pickLeadUpdateInput, applyAssignedToFilter } = require('../utils/leadDto');
const { ApiResponse, ApiError, asyncHandler, buildScopeFilter, canAccessRecord, cacheHelper } = require('@sparkcrm/shared-utils');
const { publishEvent, EVENTS } = require('@sparkcrm/shared-events');
const { auditLogger } = require('@sparkcrm/shared-middleware');
const { getUsersBulk } = require('../services/serviceClients/user.client');
const { getFormsBulk } = require('../services/serviceClients/form.client');
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
    const tenantId = req.headers['x-tenant-id'];
    const cacheKey = cacheHelper.generateKey(`leads:${tenantId}:list`, req.query);

    const data = await cacheHelper.getOrSet(cacheKey, 3600, async () => {
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

    const LIST_PROJECTION = 'contact pipeline.stage scoring.score scoring.scoreBreakdown source assignedTo fullName';

    const [dbLeads, total] = await Promise.all([
        Lead.find(filter).select(LIST_PROJECTION).sort(sort).skip(skip).limit(limit),
        Lead.countDocuments(filter),
    ]);

    const userIds = [...new Set(dbLeads.map(l => l.assignedTo).filter(Boolean).map(String))];
    const users = await getUsersBulk(tenantId, userIds);
    const userMap = new Map(users.map(u => [String(u._id), u]));
    const leads = dbLeads.map(lead => {
        const obj = lead.toObject();
        obj.assignedTo = userMap.get(String(obj.assignedTo)) || null;
        return obj;
    });

    return {
        leads,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        }
    };
    });
    ApiResponse.paginated(res, data.leads, data.pagination);
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
    const userIdsToFetch = new Set();
    if (obj.assignedTo) userIdsToFetch.add(String(obj.assignedTo));
    if (obj.notes && obj.notes.length > 0) {
        obj.notes.forEach(n => {
            if (n.createdBy) userIdsToFetch.add(String(n.createdBy));
        });
    }

    // --- POPULATE FORM DATA ---
    const formIdsToFetch = new Set();
    const addFormId = (id) => {
        if (id) formIdsToFetch.add(String(id));
    };
    addFormId(obj.firstTouch?.formId);
    addFormId(obj.lastTouch?.formId);
    if (obj.origin?.provider === 'smart_form') addFormId(obj.origin?.sourceId);

    if (formIdsToFetch.size > 0) {
        const forms = await getFormsBulk(tenantId, Array.from(formIdsToFetch));
        const formMap = new Map(forms.map(f => [String(f._id), f.name]));
        
        if (obj.firstTouch?.formId && formMap.has(obj.firstTouch.formId)) {
            obj.firstTouch.formName = formMap.get(obj.firstTouch.formId);
        }
        if (obj.lastTouch?.formId && formMap.has(obj.lastTouch.formId)) {
            obj.lastTouch.formName = formMap.get(obj.lastTouch.formId);
        }
        if (obj.origin?.sourceId && obj.origin?.provider === 'smart_form' && formMap.has(obj.origin.sourceId)) {
            obj.origin.sourceName = `Form: ${formMap.get(obj.origin.sourceId)}`;
        }
    }

    if (userIdsToFetch.size > 0) {
        const users = await getUsersBulk(tenantId, Array.from(userIdsToFetch));
        const userMap = new Map(users.map(u => [String(u._id), u]));
        if (obj.assignedTo) {
            obj.assignedTo = userMap.get(String(obj.assignedTo)) || obj.assignedTo;
        }
        if (obj.notes && obj.notes.length > 0) {
            obj.notes = obj.notes.map(n => {
                if (n.createdBy && userMap.has(String(n.createdBy))) {
                    n.createdBy = userMap.get(String(n.createdBy));
                }
                return n;
            });
        }
    }

    ApiResponse.success(res, obj);
});

/**
 * PUT /api/leads/:id
 * Update a lead
 */
const updateLead = asyncHandler(async (req, res) => {
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
    if (changes.customFields) {
        if (!lead.customFields) {
            lead.customFields = {};
        }
        for (const [key, value] of Object.entries(changes.customFields)) {
            if (lead.customFields instanceof Map) {
                lead.customFields.set(key, value);
            } else {
                lead.customFields[key] = value;
            }
        }
        lead.markModified('customFields');
        delete changes.customFields;
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

    await cacheHelper.deleteByPattern(`leads:${tenantId}:*`);

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
    await cacheHelper.deleteByPattern(`leads:${tenantId}:*`);

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
    await cacheHelper.deleteByPattern(`leads:${tenantId}:*`);

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
    await cacheHelper.deleteByPattern(`leads:${tenantId}:*`);

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
    
    await cacheHelper.deleteByPattern(`leads:${tenantId}:*`);
    
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


/**
 * PATCH /api/leads/bulk
 * Bulk update multiple leads
 */
const bulkUpdateLeads = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const actorId = req.headers['x-user-id'];
    const { leadIds, updates } = req.body;

    if (!Array.isArray(leadIds) || leadIds.length === 0) {
        throw ApiError.badRequest('leadIds array is required and must not be empty');
    }
    if (leadIds.length > 500) {
        throw ApiError.badRequest('Maximum 500 leads can be updated at once');
    }
    if (!updates || Object.keys(updates).length === 0) {
        throw ApiError.badRequest('updates object is required');
    }

    const changes = pickLeadUpdateInput(updates);
    if (Object.keys(changes).length === 0) {
        throw ApiError.badRequest('No valid fields provided for bulk update');
    }

    if (changes.customFields) {
        await validateCustomFields(tenantId, 'Lead', changes.customFields);
    }
    
    // Normalize target values for lifecycle/contact mapping
    const targetStage = changes.pipeline?.stage;
    let targetFollowUpAt = undefined;
    if (changes.expectedValue !== undefined) {
        if (!changes.lifecycle) changes.lifecycle = {};
        changes.lifecycle.expectedValue = Number(changes.expectedValue);
        delete changes.expectedValue;
    }
    if (changes.followUpAt !== undefined) {
        if (!changes.lifecycle) changes.lifecycle = {};
        changes.lifecycle.followUpAt = changes.followUpAt ? new Date(changes.followUpAt) : null;
        targetFollowUpAt = changes.lifecycle.followUpAt;
        delete changes.followUpAt;
    }
    if (changes.priority !== undefined) {
        if (!changes.lifecycle) changes.lifecycle = {};
        changes.lifecycle.priority = changes.priority;
        delete changes.priority;
    }
    if (changes.contact) {
        if (changes.contact.email !== undefined) changes.contact.emailNormalized = normalizeEmail(changes.contact.email);
        if (changes.contact.phone !== undefined) changes.contact.phoneNormalized = normalizePhone(changes.contact.phone);
    }

    // Fetch leads
    const leads = await Lead.find({ _id: { $in: leadIds }, tenantId });
    if (leads.length === 0) {
        throw ApiError.notFound('No matching leads found');
    }

    let modifiedCount = 0;
    let failedCount = 0;
    const failures = [];

    // Process leads iteratively to preserve business logic
    for (const lead of leads) {
        try {
            if (!canAccessRecord(req, lead, { ownerField: 'assignedTo', module: 'leads' })) {
                failedCount++;
                failures.push({ leadId: lead._id, reason: 'Permission denied' });
                continue;
            }

            const oldStage = lead.pipeline?.stage || lead.stage;
            const oldFollowUpAt = lead.lifecycle?.followUpAt ? new Date(lead.lifecycle?.followUpAt).getTime() : null;

            // Apply updates
            if (changes.contact) {
                lead.contact = { ...(lead.contact || {}), ...changes.contact };
            }
            if (changes.pipeline) {
                lead.pipeline = { ...(lead.pipeline || {}), ...changes.pipeline };
            }
            if (changes.lifecycle) {
                lead.lifecycle = { ...(lead.lifecycle || {}), ...changes.lifecycle };
            }
            // Copy top-level properties
            const topLevelKeys = Object.keys(changes).filter(k => !['contact', 'pipeline', 'lifecycle'].includes(k));
            for (const k of topLevelKeys) {
                lead[k] = changes[k];
            }

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
                    actorId,
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
            modifiedCount++;

            // Handle followup events
            if (targetFollowUpAt !== undefined) {
                const newFollowUpAt = lead.lifecycle?.followUpAt ? new Date(lead.lifecycle?.followUpAt).getTime() : null;
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

            // Individual activity record for the bulk update
            await recordLeadActivity({
                tenantId,
                branchId: lead.branchId,
                leadId: lead._id,
                actorId,
                actorType: 'user',
                type: ACTIVITY_TYPES.LEAD_UPDATED,
                title: 'Lead updated (Bulk)',
                description: `Bulk updated fields: ${Object.keys(changes).join(', ')}`,
            });
        } catch (err) {
            failedCount++;
            failures.push({ leadId: lead._id, reason: err.message });
        }
    }

    // Macro-level audit log
    await auditLogger.log({
        req,
        action: 'BULK_UPDATE',
        module: 'leads',
        recordType: 'Lead',
        details: { matchedCount: leads.length, modifiedCount, failedCount, fieldsUpdated: Object.keys(changes) }
    });

    await cacheHelper.deleteByPattern(`leads:${tenantId}:*`);

    ApiResponse.success(res, {
        matchedCount: leads.length,
        modifiedCount,
        failedCount,
        failures
    }, 'Bulk update completed');
});

/**
 * GET /api/leads/export-data
 * Fetch leads data for Excel/CSV export
 */
const exportLeadsData = asyncHandler(async (req, res) => {
    const { search, stage, source, assignedTo, priority, tags, isArchived = 'false', sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

    const filter = buildScopeFilter(req, { ownerField: 'assignedTo', module: 'leads' });
    filter.isArchived = isArchived === 'true';

    if (assignedTo) applyAssignedToFilter(filter, requireObjectId(assignedTo, 'assignedTo'));
    if (stage) filter['pipeline.stage'] = stage;
    if (source) filter.source = source;
    if (priority) filter['lifecycle.priority'] = priority;
    if (tags) filter.tags = { $in: tags.split(',') };

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
    let dbSortBy = sortBy;
    if (['firstName', 'lastName'].includes(sortBy)) dbSortBy = `contact.${sortBy}`;
    else if (sortBy === 'stage') dbSortBy = 'pipeline.stage';
    else if (['priority', 'expectedValue', 'followUpAt'].includes(sortBy)) dbSortBy = `lifecycle.${sortBy}`;
    const sort = { [dbSortBy]: sortOrder === 'asc' ? 1 : -1 };

    const LIST_PROJECTION = 'contact pipeline.stage source scoring.score meta.createdAt assignedTo';

    // Fetch up to 10000 leads for export to avoid memory issues
    const dbLeads = await Lead.find(filter).select(LIST_PROJECTION).sort(sort).limit(10000).lean();

    const tenantId = req.headers['x-tenant-id'];
    const userIds = [...new Set(dbLeads.map(l => l.assignedTo).filter(Boolean).map(String))];
    let userMap = new Map();
    if (userIds.length > 0) {
        const users = await getUsersBulk(tenantId, userIds);
        userMap = new Map(users.map(u => [String(u._id), u]));
    }

    const leads = dbLeads.map(lead => {
        lead.assignedTo = userMap.get(String(lead.assignedTo)) || null;
        return lead;
    });

    ApiResponse.success(res, leads, 'Export data fetched');
});

/**
 * POST /internal/leads/ingest
 * Used by other microservices to ingest leads via leadIngestion.service.js
 */
const ingestLeadInternal = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const payload = req.body;
    
    // Default assignment parameters if provided by the caller
    const result = await createOrUpdateLeadFromSource({
        tenantId,
        branchId: payload.branchId || null,
        source: payload.source || 'api',
        sourceDetails: payload.sourceDetails || '',
        leadData: payload.leadData || {},
        assignedTo: payload.assignedTo || null,
        actorId: payload.actorId || null,
        actorType: 'system',
        publishCreatedEvent: true,
    });
    
    ApiResponse.success(res, result, 'Lead ingested internally');
});

module.exports = {
    bulkUpdateLeads,
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
    exportLeadsData,
    ingestLeadInternal,
};
