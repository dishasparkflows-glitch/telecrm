const Task = require('../models/Task');
const { ApiError, deleteMedia } = require('@sparkcrm/shared-utils');
const { publishEvent, EVENTS } = require('@sparkcrm/shared-events');

// Optionally, we could call an API to validate meeting overlap, 
// but for now we'll rely on the existing event publishing pattern.

/**
 * Creates a new task.
 */
const createTask = async (tenantId, userId, data) => {
    let branchId = data.branchId || null;

    if (!data.assignedTo) {
        throw ApiError.badRequest('Assigned User is required');
    }

    // Convert leadId to relatedEntity if sent by older frontend
    if (data.leadId) {
        data.relatedEntity = {
            entityType: 'lead',
            entityId: data.leadId
        };
        delete data.leadId;
    }

    // Minimal validation for relatedEntity if needed can be added here (e.g., via service clients)
    
    // We skip synchronous meeting overlap checks here unless we import the meeting client
    // For a pure microservice, we could check via API, but let's assume it's moved to frontend or handled async.
    
    const task = await Task.create({
        ...data,
        tenantId,
        branchId,
        meta: {
            ...(data.meta || {}),
            createdBy: userId
        }
    });

    await publishEvent(EVENTS.TASK_CREATED, {
        tenantId,
        taskId: task._id,
        assignedTo: task.assignedTo || null,
        relatedEntity: task.relatedEntity,
        title: task.details?.title,
        dueDate: task.dueDate,
        reminder: task.details?.reminder
    });

    if (task.assignedTo) {
        await publishEvent(EVENTS.TASK_ASSIGNED, {
            tenantId,
            taskId: task._id,
            assignedTo: task.assignedTo,
            relatedEntity: task.relatedEntity,
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

    // Convert leadId for backward compatibility
    if (data.leadId) {
        data.relatedEntity = {
            entityType: 'lead',
            entityId: data.leadId
        };
        delete data.leadId;
    }

    // Remove protected fields from update data
    delete data.tenantId;
    delete data.createdBy;
    delete data.relatedEntity; // Usually shouldn't change entity link

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

    if (data.details?.status && data.details?.status !== previousStatus) {
        const isCompleted = task.details?.status === 'COMPLETED';
        await publishEvent(isCompleted ? EVENTS.TASK_COMPLETED : 'task.updated', {
            tenantId,
            taskId: task._id,
            assignedTo: task.assignedTo || null,
            relatedEntity: task.relatedEntity,
            title: task.details?.title,
            status: task.details?.status,
            dueDate: task.dueDate,
            reminder: task.details?.reminder
        });
    }

    // Notify new assignee if changed
    if (data.assignedTo && data.assignedTo !== previousAssignee) {
        await publishEvent(EVENTS.TASK_ASSIGNED, {
            tenantId,
            taskId: task._id,
            assignedTo: task.assignedTo,
            relatedEntity: task.relatedEntity,
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

    await publishEvent('task.deleted', {
        tenantId,
        taskId: task._id,
        relatedEntity: task.relatedEntity,
        title: task.details?.title
    });

    return task;
};

module.exports = {
    createTask,
    updateTask,
    deleteTask
};
