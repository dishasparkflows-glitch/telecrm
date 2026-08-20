const Task = require('../models/Task');
const { ApiResponse, asyncHandler, buildScopeFilter } = require('@sparkcrm/shared-utils');
const taskService = require('../services/task.service');
const { getUsersBulk } = require('../services/serviceClients/user.client');

/**
 * GET /api/tasks
 */
const getTasks = asyncHandler(async (req, res) => {
    const { page = 1, limit = 50, status, priority, assignedTo, leadId, source, dueDate, search } = req.query;
    const tenantId = req.headers['x-tenant-id'];

    const filter = buildScopeFilter(req, { ownerField: 'assignedTo', module: 'tasks' });
    
    if (status) filter['details.status'] = status;
    if (priority) filter['details.priority'] = priority;
    if (assignedTo) filter.assignedTo = assignedTo;
    if (leadId) filter.leadId = leadId;
    if (source) filter.source = source;
    
    if (dueDate) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (dueDate === 'today') {
            filter.dueDate = {
                $gte: today,
                $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
            };
        } else if (dueDate === 'overdue') {
            filter.dueDate = { $lt: today };
            filter['details.status'] = { $nin: ['COMPLETED', 'CANCELLED'] };
        } else if (dueDate === 'upcoming') {
            filter.dueDate = { $gte: today };
        } else if (dueDate === 'none') {
            filter.dueDate = null;
        }
    }

    if (search) {
        filter.$or = [
            { 'details.title': { $regex: search, $options: 'i' } },
            { 'details.description': { $regex: search, $options: 'i' } },
            { leadNumber: { $regex: search, $options: 'i' } }
        ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Sort by Due Date, then priority
    const sort = {};
    sort.dueDate = 1;
    sort['details.priority'] = -1; // HIGH before LOW

    const [tasks, total] = await Promise.all([
        Task.find(filter)
            .sort(sort)
            .skip(skip)
            .limit(parseInt(limit))
            .lean(),
        Task.countDocuments(filter)
    ]);

    // Populate user references
    const userIds = [...new Set(tasks.map(t => t.assignedTo).filter(Boolean).map(String))];
    const users = userIds.length > 0 ? await getUsersBulk(tenantId, userIds) : [];
    const userMap = new Map(users.map(u => [String(u._id), u]));

    const populatedTasks = tasks.map(t => {
        const user = userMap.get(String(t.assignedTo));
        return {
            ...t,
            assignedUser: user ? { _id: user._id, name: user.contact?.name || 'Unknown User', avatarUrl: user.avatarUrl } : null
        };
    });

    ApiResponse.success(res, {
        tasks: populatedTasks,
        pagination: {
            total,
            page: parseInt(page),
            pages: Math.ceil(total / limit)
        }
    }, 'Tasks retrieved successfully');
});

/**
 * GET /api/tasks/stats
 */
const getTaskStats = asyncHandler(async (req, res) => {
    const filter = buildScopeFilter(req, { ownerField: 'assignedTo', module: 'tasks' });
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

    const [myTasksCount, dueTodayCount, overdueCount, completedCount] = await Promise.all([
        Task.countDocuments({ ...filter, assignedTo: req.headers['x-user-id'], 'details.status': { $nin: ['COMPLETED', 'CANCELLED'] } }),
        Task.countDocuments({ ...filter, dueDate: { $gte: today, $lt: tomorrow }, 'details.status': { $nin: ['COMPLETED', 'CANCELLED'] } }),
        Task.countDocuments({ ...filter, dueDate: { $lt: today }, 'details.status': { $nin: ['COMPLETED', 'CANCELLED'] } }),
        Task.countDocuments({ ...filter, 'details.status': 'COMPLETED' })
    ]);

    ApiResponse.success(res, {
        myTasks: myTasksCount,
        dueToday: dueTodayCount,
        overdue: overdueCount,
        completed: completedCount
    }, 'Task stats retrieved');
});

/**
 * POST /api/tasks
 */
const createTask = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const userId = req.headers['x-user-id'];
    const branchId = req.headers['x-branch-id'];

    if (!req.body.branchId && branchId && branchId !== 'all') {
        req.body.branchId = branchId;
    }
    
    // Authorization check is handled by route middleware (requirePermission('tasks', 'create'))
    
    const task = await taskService.createTask(tenantId, userId, req.body);
    ApiResponse.success(res, task, 'Task created successfully', 201);
});

/**
 * PUT /api/tasks/:id
 */
const updateTask = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const userId = req.headers['x-user-id'];
    
    const task = await taskService.updateTask(tenantId, req.params.id, userId, req.body);
    ApiResponse.success(res, task, 'Task updated successfully');
});

/**
 * DELETE /api/tasks/:id
 */
const deleteTask = asyncHandler(async (req, res) => {
    const tenantId = req.headers['x-tenant-id'];
    const userId = req.headers['x-user-id'];
    
    await taskService.deleteTask(tenantId, req.params.id, userId);
    ApiResponse.success(res, null, 'Task deleted successfully');
});

module.exports = {
    getTasks,
    getTaskStats,
    createTask,
    updateTask,
    deleteTask
};
