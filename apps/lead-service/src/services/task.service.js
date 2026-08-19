const Task = require('../models/Task');
const Lead = require('../models/Lead');
const { ApiError } = require('@sparkcrm/shared-utils');
const { ACTIVITY_TYPES, recordLeadActivity } = require('./leadActivity.service');
const { publishEvent, EVENTS } = require('@sparkcrm/shared-events');

/**
 * Creates a new task and records an activity if associated with a lead.
 */
const createTask = async (tenantId, userId, data) => {
    let leadNumber = null;
    let branchId = null;

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
        createdBy: userId
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
            description: `Task created: ${task.title}`
        });
    }

    // Publish event for notifications (assigned user)
    if (task.assignedTo) {
        await publishEvent(EVENTS.TASK_ASSIGNED, {
            tenantId,
            taskId: task._id,
            assignedTo: task.assignedTo,
            leadId: task.leadId,
            title: task.title,
            dueDate: task.dueDate
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
    const previousStatus = task.status;

    // Remove protected fields from update data
    delete data.tenantId;
    delete data.createdBy;
    delete data.leadId; // Lead connection shouldn't change
    delete data.leadNumber;

    if (data.status === 'COMPLETED' && task.status !== 'COMPLETED') {
        data.completedAt = new Date();
    } else if (data.status && data.status !== 'COMPLETED' && task.status === 'COMPLETED') {
        data.completedAt = null;
    }

    Object.assign(task, data);
    await task.save();

    if (task.leadId) {
        if (data.status && data.status !== previousStatus) {
            const isCompleted = task.status === 'COMPLETED';
            await recordLeadActivity({
                tenantId,
                branchId: task.branchId,
                leadId: task.leadId,
                actorId: userId,
                actorType: 'user',
                type: isCompleted ? ACTIVITY_TYPES.TASK_COMPLETED : ACTIVITY_TYPES.TASK_STATUS_CHANGED,
                title: isCompleted ? 'Task completed' : 'Task status changed',
                description: isCompleted ? `Completed task: ${task.title}` : `Task "${task.title}" status changed to ${task.status}`
            });
        }
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
                description: `Task "${task.title}" was reassigned`
            });
        }

        await publishEvent(EVENTS.TASK_ASSIGNED, {
            tenantId,
            taskId: task._id,
            assignedTo: task.assignedTo,
            leadId: task.leadId,
            title: task.title,
            dueDate: task.dueDate
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

    if (task.leadId) {
        await recordLeadActivity({
            tenantId,
            branchId: task.branchId,
            leadId: task.leadId,
            actorId: userId,
            actorType: 'user',
            type: ACTIVITY_TYPES.TASK_DELETED,
            title: 'Task deleted',
            description: `Deleted task: ${task.title}`
        });
    }

    return task;
};

module.exports = {
    createTask,
    updateTask,
    deleteTask
};
