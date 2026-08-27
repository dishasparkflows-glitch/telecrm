const Task = require('../models/Task');
const { ApiResponse, asyncHandler, buildScopeFilter } = require('@sparkcrm/shared-utils');
const taskService = require('../services/task.service');

// Note: getUsersBulk might need to be imported via service client if we want populated tasks
// We will mock/require it here assuming we have a user client available or create it.
// const { getUsersBulk } = require('../services/serviceClients/user.client');
const { getLeadsBulk } = require('../services/serviceClients/lead.client');

/**
 * GET /api/tasks
 */
const getTasks = asyncHandler(async (req, res) => {
    const { page = 1, limit = 50, status, priority, assignedTo, leadId, source, dueDate, search } = req.query;
    // const tenantId = req.headers['x-tenant-id'];

    const filter = buildScopeFilter(req, { ownerField: 'assignedTo', module: 'tasks' });
    
    if (status) filter['details.status'] = status;
    if (priority) filter['details.priority'] = priority;
    if (assignedTo) filter.assignedTo = assignedTo;
    
    // Backward compatibility for leadId
    if (leadId) {
        filter['relatedEntity.entityId'] = leadId;
        filter['relatedEntity.entityType'] = 'lead';
    }
    
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
            { 'details.description': { $regex: search, $options: 'i' } }
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

    // Fetch lead details for tasks related to leads
    const leadIds = [...new Set(tasks.map(t => t.relatedEntity?.entityType === 'lead' ? t.relatedEntity.entityId : null).filter(Boolean))];
    let leadsMap = {};
    if (leadIds.length > 0) {
        const tenantId = req.headers['x-tenant-id'];
        const leads = await getLeadsBulk(tenantId, leadIds);
        leadsMap = leads.reduce((acc, lead) => {
            acc[lead._id] = lead;
            return acc;
        }, {});
    }

    // Inject leadName into tasks
    const mappedTasks = tasks.map(t => {
        if (t.relatedEntity && t.relatedEntity.entityType === 'lead') {
            t.leadId = t.relatedEntity.entityId;
            if (leadsMap[t.leadId]) {
                const lead = leadsMap[t.leadId];
                t.leadName = lead.fullName || `${lead.contact?.firstName || ''} ${lead.contact?.lastName || ''}`.trim() || lead.leadNumber;
                t.leadNumber = lead.leadNumber;
            }
        }
        return t;
    });
    
    ApiResponse.success(res, {
        tasks: mappedTasks,
        pagination: {
            total,
            page: parseInt(page),
            pages: Math.ceil(total / limit)
        }
    }, 'Tasks retrieved successfully');
});

/**
 * GET /api/tasks/calendar
 */
const getCalendarTasks = asyncHandler(async (req, res) => {
    const { from, to } = req.query;
    const filter = buildScopeFilter(req, { ownerField: 'assignedTo', module: 'tasks' });

    if (from || to) {
        filter.dueDate = {};
        if (from) {
            const fromDate = new Date(from);
            if (!Number.isNaN(fromDate.getTime())) {
                filter.dueDate.$gte = fromDate;
            }
        }
        if (to) {
            const toDate = new Date(to);
            if (!Number.isNaN(toDate.getTime())) {
                filter.dueDate.$lte = toDate;
            }
        }
    }

    const tasks = await Task.find(filter)
        .select('_id dueDate details.title relatedEntity')
        .lean();
    
    // Backward compatibility: inject leadId for older frontend
    const mappedTasks = tasks.map(t => {
        if (t.relatedEntity && t.relatedEntity.entityType === 'lead') {
            t.leadId = t.relatedEntity.entityId;
        }
        return t;
    });

    ApiResponse.success(res, { tasks: mappedTasks });
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
    getCalendarTasks,
    getTaskStats,
    createTask,
    updateTask,
    deleteTask
};
