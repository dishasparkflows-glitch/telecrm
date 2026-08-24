const FollowUp = require('../models/FollowUp');
const Lead = require('../models/Lead');
const { ApiError } = require('@sparkcrm/shared-utils');
const { ACTIVITY_TYPES, recordLeadActivity } = require('./leadActivity.service');
const { publishEvent, EVENTS } = require('@sparkcrm/shared-events');

/**
 * Recalculates and syncs the next follow-up for a lead.
 */
const syncNextFollowUp = async (tenantId, leadId) => {
    // Find the next active follow up
    const nextFollowUp = await FollowUp.findOne({
        tenantId,
        leadId,
        status: 'scheduled',
        scheduledAt: { $gte: new Date() } // Has to be in the future (or very recently missed, we consider scheduled)
    }).sort({ scheduledAt: 1 }).lean();

    const lead = await Lead.findOne({ _id: leadId, tenantId });
    if (!lead) return;

    if (nextFollowUp) {
        await Lead.updateOne(
            { _id: leadId, tenantId },
            { $set: { 'lifecycle.followUpAt': nextFollowUp.scheduledAt } }
        );
        
        // Emit to notification-service
        await publishEvent(EVENTS.LEAD_FOLLOWUP_SCHEDULED, {
            tenantId,
            branchId: nextFollowUp.branchId,
            leadId,
            assignedTo: nextFollowUp.assignedUserId,
            followUpAt: nextFollowUp.scheduledAt,
            reminder: nextFollowUp.reminderMinutesBefore !== null && nextFollowUp.reminderMinutesBefore >= 0
                ? { enabled: true, offsetMinutes: nextFollowUp.reminderMinutesBefore }
                : { enabled: false },
            leadName: lead.fullName || 'this lead'
        });
    } else {
        await Lead.updateOne(
            { _id: leadId, tenantId },
            { $set: { 'lifecycle.followUpAt': null } }
        );

        // Emit with null followUpAt to cancel active reminder
        await publishEvent(EVENTS.LEAD_FOLLOWUP_SCHEDULED, {
            tenantId,
            leadId,
            assignedTo: lead.assignedTo,
            followUpAt: null
        });
    }
};

const createFollowUp = async (tenantId, leadId, userId, data) => {
    const lead = await Lead.findOne({ _id: leadId, tenantId }).lean();
    if (!lead) throw ApiError.notFound('Lead not found');

    const followUp = await FollowUp.create({
        tenantId,
        branchId: lead.branchId,
        leadId,
        assignedUserId: data.assignedUserId || userId,
        createdBy: userId,
        type: data.type,
        status: 'scheduled',
        scheduledAt: data.scheduledAt,
        note: data.note || '',
        reminderMinutesBefore: data.reminderMinutesBefore || 0,
    });

    await recordLeadActivity({
        tenantId,
        branchId: lead.branchId,
        leadId,
        actorId: userId,
        actorType: 'user',
        type: ACTIVITY_TYPES.FOLLOWUP_SCHEDULED,
        title: 'Follow-up Scheduled',
        description: `Scheduled a ${data.type} follow-up for ${new Date(data.scheduledAt).toLocaleString()}`,
        metadata: { followUpId: followUp._id }
    });

    await syncNextFollowUp(tenantId, leadId);
    return followUp;
};

const completeFollowUp = async (tenantId, followUpId, userId, data) => {
    const followUp = await FollowUp.findOne({ _id: followUpId, tenantId });
    if (!followUp) throw ApiError.notFound('Follow-up not found');
    if (followUp.status !== 'scheduled' && followUp.status !== 'missed') {
        throw ApiError.badRequest(`Cannot complete a follow-up that is ${followUp.status}`);
    }

    followUp.status = 'completed';
    followUp.completedAt = new Date();
    followUp.completedBy = userId;
    // We can optionally append notes
    if (data.note) {
        followUp.note = followUp.note ? `${followUp.note}\n---\nCompletion Note: ${data.note}` : `Completion Note: ${data.note}`;
    }
    await followUp.save();

    await recordLeadActivity({
        tenantId,
        branchId: followUp.branchId,
        leadId: followUp.leadId,
        actorId: userId,
        actorType: 'user',
        type: ACTIVITY_TYPES.FOLLOWUP_COMPLETED,
        title: 'Follow-up Completed',
        description: `Completed ${followUp.type} follow-up. ${data.note || ''}`,
        metadata: { followUpId: followUp._id }
    });

    await syncNextFollowUp(tenantId, followUp.leadId);

    // If user asked to schedule next follow-up immediately
    if (data.nextFollowUp) {
        await createFollowUp(tenantId, followUp.leadId, userId, data.nextFollowUp);
    }

    return followUp;
};

const rescheduleFollowUp = async (tenantId, followUpId, userId, data) => {
    const followUp = await FollowUp.findOne({ _id: followUpId, tenantId });
    if (!followUp) throw ApiError.notFound('Follow-up not found');
    if (followUp.status !== 'scheduled' && followUp.status !== 'missed') {
        throw ApiError.badRequest(`Cannot reschedule a follow-up that is ${followUp.status}`);
    }

    // Cancel current
    followUp.status = 'cancelled';
    followUp.cancelledAt = new Date();
    followUp.cancelledBy = userId;
    await followUp.save();

    // Create new
    const newFollowUp = await FollowUp.create({
        tenantId,
        branchId: followUp.branchId,
        leadId: followUp.leadId,
        assignedUserId: data.assignedUserId || followUp.assignedUserId,
        createdBy: userId,
        type: data.type || followUp.type,
        status: 'scheduled',
        scheduledAt: data.scheduledAt,
        note: data.note || followUp.note,
        reminderMinutesBefore: data.reminderMinutesBefore !== undefined ? data.reminderMinutesBefore : followUp.reminderMinutesBefore,
        rescheduledFrom: followUp._id,
        rescheduleReason: data.rescheduleReason || ''
    });

    await recordLeadActivity({
        tenantId,
        branchId: followUp.branchId,
        leadId: followUp.leadId,
        actorId: userId,
        actorType: 'user',
        type: ACTIVITY_TYPES.FOLLOWUP_RESCHEDULED,
        title: 'Follow-up Rescheduled',
        description: `Rescheduled ${newFollowUp.type} follow-up to ${new Date(newFollowUp.scheduledAt).toLocaleString()}. Reason: ${data.rescheduleReason || 'None'}`,
        metadata: { oldFollowUpId: followUp._id, newFollowUpId: newFollowUp._id }
    });

    await syncNextFollowUp(tenantId, followUp.leadId);
    return newFollowUp;
};

const cancelFollowUp = async (tenantId, followUpId, userId, data) => {
    const followUp = await FollowUp.findOne({ _id: followUpId, tenantId });
    if (!followUp) throw ApiError.notFound('Follow-up not found');
    if (followUp.status !== 'scheduled' && followUp.status !== 'missed') {
        throw ApiError.badRequest(`Cannot cancel a follow-up that is ${followUp.status}`);
    }

    followUp.status = 'cancelled';
    followUp.cancelledAt = new Date();
    followUp.cancelledBy = userId;
    if (data.cancelReason) {
        followUp.note = followUp.note ? `${followUp.note}\n---\nCancel Reason: ${data.cancelReason}` : `Cancel Reason: ${data.cancelReason}`;
    }
    await followUp.save();

    await recordLeadActivity({
        tenantId,
        branchId: followUp.branchId,
        leadId: followUp.leadId,
        actorId: userId,
        actorType: 'user',
        type: ACTIVITY_TYPES.FOLLOWUP_CANCELLED,
        title: 'Follow-up Cancelled',
        description: `Cancelled ${followUp.type} follow-up. Reason: ${data.cancelReason || 'None'}`,
        metadata: { followUpId: followUp._id }
    });

    await syncNextFollowUp(tenantId, followUp.leadId);
    return followUp;
};

module.exports = {
    createFollowUp,
    completeFollowUp,
    rescheduleFollowUp,
    cancelFollowUp,
    syncNextFollowUp
};
