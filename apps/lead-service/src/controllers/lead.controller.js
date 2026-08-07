const Lead = require('../models/Lead');
const LeadActivity = require('../models/LeadActivity');
const { calculateLeadScore } = require('../services/scoring.service');
const { createOrUpdateLeadFromSource, normalizeEmail, normalizePhone } = require('../services/leadIngestion.service');
const { ACTIVITY_TYPES, recordLeadActivity } = require('../services/leadActivity.service');
const { pagination, requireObjectId, escapeRegex } = require('../utils/input');
const { pickLeadCreateInput, pickLeadUpdateInput, applyAssignedToFilter } = require('../utils/leadDto');
const { ApiResponse, ApiError, asyncHandler, buildScopeFilter, canAccessRecord } = require('@sparkcrm/shared-utils');
const { publishEvent, EVENTS } = require('@sparkcrm/shared-events');

const LEAD_SORT_FIELDS = new Set(['createdAt', 'updatedAt', 'firstName', 'lastName', 'stage', 'priority', 'score', 'expectedValue', 'followUpAt']);

/**
 * POST /api/leads
 * Create a new lead
 */
const createLead = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const userId = req.headers['x-user-id'];
    const scope = buildScopeFilter(req, { ownerField: 'assignedTo', module: 'leads' });
    const leadData = pickLeadCreateInput(req.body);

    const result = await createOrUpdateLeadFromSource({
        tenantId,
        branchId: scope.branchId || null,
        source: leadData.source || 'manual',
        sourceDetails: leadData.sourceDetails || '',
        leadData,
        assignedTo: userId,
        createdBy: userId,
        actorId: userId,
        actorType: 'user',
    });

    if (!result.created && result.duplicate) {
        return ApiResponse.success(res, result.lead, 'Lead already exists (duplicate detected)', 200);
    }

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
    if (stage) filter.stage = stage;
    if (source) filter.source = source;
    if (priority) filter.priority = priority;
    if (tags) filter.tags = { $in: tags.split(',') };

    // Text search across name, email, phone, company
    if (search) {
        const escapedSearch = escapeRegex(search);
        filter.$or = [
            { firstName: { $regex: escapedSearch, $options: 'i' } },
            { lastName: { $regex: escapedSearch, $options: 'i' } },
            { email: { $regex: escapedSearch, $options: 'i' } },
            { phone: { $regex: escapedSearch, $options: 'i' } },
            { company: { $regex: escapedSearch, $options: 'i' } },
        ];
    }

    if (!LEAD_SORT_FIELDS.has(sortBy)) throw ApiError.badRequest('Unsupported lead sort field');
    if (!['asc', 'desc'].includes(sortOrder)) throw ApiError.badRequest('sortOrder must be asc or desc');
    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const [leads, total] = await Promise.all([
        Lead.find(filter).sort(sort).skip(skip).limit(limit),
        Lead.countDocuments(filter),
    ]);

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
    ApiResponse.success(res, lead);
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

    // Check access — agents can only edit their assigned leads
    if (!canAccessRecord(req, lead, { ownerField: 'assignedTo', module: 'leads' })) {
        throw ApiError.forbidden('You do not have access to this lead');
    }

    const oldStage = lead.stage;
    const oldFollowUpAt = lead.followUpAt ? new Date(lead.followUpAt).getTime() : null;
    const changedFields = Object.keys(changes);
    if (changes.email !== undefined) changes.emailNormalized = normalizeEmail(changes.email);
    if (changes.phone !== undefined) changes.phoneNormalized = normalizePhone(changes.phone);
    Object.assign(lead, changes);

    // Track stage changes
    if (changes.stage && changes.stage !== oldStage) {
        lead.previousStage = oldStage;
        lead.stageChangedAt = new Date();
        lead.lastActivityAt = new Date();

        await publishEvent(EVENTS.LEAD_STAGE_CHANGED, {
            tenantId,
            branchId: lead.branchId,
            leadId: lead._id,
            oldStage,
            newStage: changes.stage,
        });

        await recordLeadActivity({
            tenantId,
            branchId: lead.branchId,
            leadId: lead._id,
            actorId: req.headers['x-user-id'],
            actorType: 'user',
            type: ACTIVITY_TYPES.LEAD_STAGE_CHANGED,
            title: 'Stage changed',
            description: `${oldStage || 'Unknown'} → ${changes.stage}`,
            metadata: { oldStage, newStage: changes.stage },
        });
    }

    // Recalculate score
    const { score, breakdown } = calculateLeadScore(lead);
    lead.score = score;
    lead.scoreBreakdown = breakdown;
    lead.lastScoredAt = new Date();

    await lead.save();

    if (Object.prototype.hasOwnProperty.call(changes, 'followUpAt')) {
        const newFollowUpAt = lead.followUpAt ? new Date(lead.followUpAt).getTime() : null;
        if (newFollowUpAt !== oldFollowUpAt) {
            await publishEvent(EVENTS.LEAD_FOLLOWUP_SCHEDULED, {
                tenantId,
                branchId: lead.branchId,
                leadId: lead._id,
                assignedTo: lead.assignedTo,
                followUpAt: lead.followUpAt,
                leadName: `${lead.firstName || ''} ${lead.lastName || ''}`.trim(),
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
    lead.lastActivityAt = new Date();

    // Recalculate score (engagement factor changes)
    const { score, breakdown } = calculateLeadScore(lead);
    lead.score = score;
    lead.scoreBreakdown = breakdown;

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

    ApiResponse.success(res, lead.notes, 'Note added');
});

/**
 * PUT /api/leads/:id/assign
 * Assign a lead to a user
 */
const assignLead = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const leadId = requireObjectId(req.params.id, 'lead ID');
    const assignedTo = requireObjectId(req.body?.assignedTo, 'assignedTo');
    const lead = await Lead.findOne({ _id: leadId, tenantId });

    if (!lead) throw ApiError.notFound('Lead not found');
    if (!canAccessRecord(req, lead, { ownerField: 'assignedTo', module: 'leads' })) {
        throw ApiError.forbidden('You do not have access to this lead');
    }

    lead.assignedTo = assignedTo;
    lead.assignedAt = new Date();
    lead.lastActivityAt = new Date();
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
        title: 'Lead assigned',
        description: 'Lead assignment changed',
        metadata: { assignedTo },
    });

    ApiResponse.success(res, lead, 'Lead assigned');
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
            if (!data.firstName) {
                results.errors.push({ row: index + 1, error: 'First name is required' });
                continue;
            }

            // Dedup check
            if (data.email || data.phone) {
                const orConds = [];
                if (data.email) orConds.push({ email: data.email.toLowerCase() });
                if (data.phone) orConds.push({ phone: data.phone });
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
                assignedTo: userId,
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
            { $group: { _id: '$stage', count: { $sum: 1 } } },
        ]),
        Lead.aggregate([
            { $match: match },
            { $group: { _id: '$source', count: { $sum: 1 } } },
        ]),
        Lead.countDocuments(filter),
        Lead.aggregate([
            { $match: match },
            { $group: { _id: null, avgScore: { $avg: '$score' } } },
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

    const lead = await Lead.findOne(leadFilter).select('_id branchId assignedTo');
    if (!lead) throw ApiError.notFound('Lead not found');

    if (!canAccessRecord(req, lead, { ownerField: 'assignedTo', module: 'leads' })) {
        throw ApiError.forbidden('You do not have access to this lead');
    }

    const filter = { tenantId, leadId: req.params.id };
    if (type) filter.type = type;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [activities, total] = await Promise.all([
        LeadActivity.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
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
    if (!phone)    throw ApiError.badRequest('phone required');

    // Normalise: strip leading + and non-digit chars, then try bare 10-digit and full international
    const digits = phone.replace(/[^0-9]/g, '');
    const variants = [digits];
    if (digits.length === 10)  variants.push(`91${digits}`);
    if (digits.length === 12 && digits.startsWith('91')) variants.push(digits.slice(2));

    const lead = await Lead.findOne({
        tenantId,
        phone: { $in: variants },
        isActive: { $ne: false },
    }).select('_id firstName lastName phone').lean();

    if (!lead) {
        return ApiResponse.success(res, null, 'No lead found for this phone number', 404);
    }

    ApiResponse.success(res, lead, 'Lead found');
});

module.exports = {
    createLead,
    getLeads,
    getLead,
    updateLead,
    addNote,
    assignLead,
    importLeads,
    archiveLead,
    getStats,
    getLeadTimeline,
    getLeadByPhone,
};
