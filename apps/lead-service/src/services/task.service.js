const Task = require('../models/Task');
const Lead = require('../models/Lead');
const { ApiError, deleteMedia } = require('@sparkcrm/shared-utils');
const { ACTIVITY_TYPES, recordLeadActivity } = require('./leadActivity.service');
const { publishEvent, EVENTS } = require('@sparkcrm/shared-events');

/**
 * Creates a new task and records an activity if associated with a lead.
 */
const createTask = async (tenantId, userId, data) => {
    let leadNumber = null;
    let branchId = null;

    if (!data.assignedTo) {
        throw ApiError.badRequest('Assigned User is required');
    }

    if (data.leadId) {
        const lead = await Lead.findOne({ _id: data.leadId, tenantId }).lean();
        if (!lead) throw ApiError.notFound('Lead not found');
        leadNumber = lead.leadNumber;
        branchId = lead.branchId;
    }

    const task = await Task.create({
        ...data,
        tenantId,
        branchId: branchId || data.branchId || null,
        leadNumber,
        meta: {
            ...(data.meta || {}),
            createdBy: userId
        }
    });

    if (task.leadId) {
        await recordLeadActivity({
            tenantId,
            branchId: task.branchId,
            leadId: task.leadId,
            actorId: userId,
            actorType: 'user',
            type: ACTIVITY_TYPES.TASK_CREATED,
            title: 'Task created',
            description: `Task created: ${task.details?.title}`
        });
    }

    await publishEvent(EVENTS.TASK_CREATED, {
        tenantId,
        taskId: task._id,
        assignedTo: task.assignedTo || null,
        leadId: task.leadId,
        title: task.details?.title,
        dueDate: task.dueDate,
        reminder: task.details?.reminder
    });

    // Publish event for notifications (assigned user)
    if (task.assignedTo) {
        await publishEvent(EVENTS.TASK_ASSIGNED, {
            tenantId,
            taskId: task._id,
            assignedTo: task.assignedTo,
            leadId: task.leadId,
            title: task.details?.title,
            dueDate: task.dueDate,
            reminder: task.details?.reminder
        });
    }

    return task;
};

/**
 * Updates a task by ID.
 */
const updateTask = async (tenantId, taskId, userId, data) => {
    const task = await Task.findOne({ _id: taskId, tenantId });
    if (!task) throw ApiError.notFound('Task not found');

    const previousAssignee = task.assignedTo?.toString();
    const previousStatus = task.details?.status;
    const previousAttachments = task.attachments || [];

    if (data.assignedTo === "") {
        throw ApiError.badRequest('Assigned User is required');
    }

    // Remove protected fields from update data
    delete data.tenantId;
    delete data.createdBy;
    delete data.leadId; // Lead connection shouldn't change
    delete data.leadNumber;

    if (data.details?.status === 'COMPLETED' && task.details?.status !== 'COMPLETED') {
        data.details.completedAt = new Date();
    } else if (data.details?.status && data.details?.status !== 'COMPLETED' && task.details?.status === 'COMPLETED') {
        data.details.completedAt = null;
    }

    if (data.details) {
        task.details = { ...task.details, ...data.details };
        delete data.details;
    }
    Object.assign(task, data);
    await task.save();

    // Delete removed attachments from Cloudflare
    if (data.attachments) {
        const getAttachmentKey = (att) => typeof att === 'object' && att !== null ? att.key : att;
        const previousKeys = previousAttachments.map(getAttachmentKey).filter(Boolean);
        const newKeys = data.attachments.map(getAttachmentKey).filter(Boolean);
        
        const removedKeys = previousKeys.filter(key => !newKeys.includes(key));
        if (removedKeys.length > 0) {
            Promise.allSettled(removedKeys.map(key => deleteMedia(key))).catch(console.error);
        }
    }

    if (task.leadId) {
        if (data.details?.status && data.details?.status !== previousStatus) {
            const isCompleted = task.details?.status === 'COMPLETED';
            await recordLeadActivity({
                tenantId,
                branchId: task.branchId,
                leadId: task.leadId,
                actorId: userId,
                actorType: 'user',
                type: isCompleted ? ACTIVITY_TYPES.TASK_COMPLETED : ACTIVITY_TYPES.TASK_STATUS_CHANGED,
                title: isCompleted ? 'Task completed' : 'Task status changed',
                description: isCompleted ? `Completed task: ${task.details?.title}` : `Task "${task.details?.title}" status changed to ${task.details?.status}`
            });

            await publishEvent(isCompleted ? EVENTS.TASK_COMPLETED : 'task.updated', {
                tenantId,
                taskId: task._id,
                assignedTo: task.assignedTo || null,
                leadId: task.leadId,
                title: task.details?.title,
                status: task.details?.status,
                dueDate: task.dueDate,
                reminder: task.details?.reminder
            });
        }
    } else if (data.details?.status && data.details?.status !== previousStatus) {
        // If not attached to a lead, still publish the task event
        const isCompleted = task.details?.status === 'COMPLETED';
        await publishEvent(isCompleted ? EVENTS.TASK_COMPLETED : 'task.updated', {
            tenantId,
            taskId: task._id,
            assignedTo: task.assignedTo || null,
            leadId: null,
            title: task.details?.title,
            status: task.details?.status,
            dueDate: task.dueDate,
            reminder: task.details?.reminder
        });
    }

    // Notify new assignee if changed
    if (data.assignedTo && data.assignedTo !== previousAssignee) {
        if (task.leadId) {
            await recordLeadActivity({
                tenantId,
                branchId: task.branchId,
                leadId: task.leadId,
                actorId: userId,
                actorType: 'user',
                type: ACTIVITY_TYPES.TASK_ASSIGNED,
                title: 'Task reassigned',
                description: `Task "${task.details?.title}" was reassigned`
            });
        }

        await publishEvent(EVENTS.TASK_ASSIGNED, {
            tenantId,
            taskId: task._id,
            assignedTo: task.assignedTo,
            leadId: task.leadId,
            title: task.details?.title,
            dueDate: task.dueDate,
            reminder: task.details?.reminder
        });
    }

    return task;
};

/**
 * Deletes a task by ID.
 */
const deleteTask = async (tenantId, taskId, userId) => {
    const task = await Task.findOneAndDelete({ _id: taskId, tenantId });
    if (!task) throw ApiError.notFound('Task not found');

    // Delete all attachments from Cloudflare
    if (task.attachments && task.attachments.length > 0) {
        const getAttachmentKey = (att) => typeof att === 'object' && att !== null ? att.key : att;
        const keys = task.attachments.map(getAttachmentKey).filter(Boolean);
        if (keys.length > 0) {
            Promise.allSettled(keys.map(key => deleteMedia(key))).catch(console.error);
        }
    }

    if (task.leadId) {
        await recordLeadActivity({
            tenantId,
            branchId: task.branchId,
            leadId: task.leadId,
            actorId: userId,
            actorType: 'user',
            type: ACTIVITY_TYPES.TASK_DELETED,
            title: 'Task deleted',
            description: `Deleted task: ${task.details?.title}`
        });
    }

    return task;
};

module.exports = {
    createTask,
    updateTask,
    deleteTask
};
