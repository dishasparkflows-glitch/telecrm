import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckSquare, Calendar, Clock, CheckCircle, Search, Filter, Edit3, Trash2 } from 'lucide-react'
import PageHeader from '../../components/layout/PageHeader'
import Card from '../../components/ui/Card'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import EmptyState from '../../components/ui/EmptyState'
import { useListTasksQuery, useGetTaskStatsQuery, useUpdateTaskStatusMutation, useDeleteTaskMutation } from '../../features/tasks/tasksApi'
import { useGetAllUsersListQuery } from '../../features/users/userApi'
import { useSelector } from 'react-redux'
import { useToast } from '../../components/ui/Toast'
import TaskModal from './components/TaskModal'
import ConfirmModal from '../../components/ui/ConfirmModal'

const TasksList = () => {
    const navigate = useNavigate()
    const { activeBranchId } = useSelector(state => state.auth)
    const { data: usersData } = useGetAllUsersListQuery({ branchId: activeBranchId })
    const users = usersData?.data || []
    const toast = useToast()

    const [filters, setFilters] = useState({
        status: '',
        priority: '',
        dueDate: 'all',
        assignedTo: '',
        search: ''
    })

    const [isModalOpen, setIsModalOpen] = useState(false)
    const [taskToEdit, setTaskToEdit] = useState(null)
    const [taskToDelete, setTaskToDelete] = useState(null)

    const { data: statsData } = useGetTaskStatsQuery()
    const { data: tasksData, isLoading } = useListTasksQuery({ 
        ...filters,
        limit: 100
    })

    const [updateStatus] = useUpdateTaskStatusMutation()
    const [deleteTask, { isLoading: isDeleting }] = useDeleteTaskMutation()

    const stats = statsData?.data || { myTasks: 0, dueToday: 0, overdue: 0, completed: 0 }
    const tasks = tasksData?.data?.tasks || []

    const getPriorityColor = (priority) => {
        switch (priority) {
            case 'URGENT': return 'danger'
            case 'HIGH': return 'warning'
            case 'MEDIUM': return 'primary'
            case 'LOW': return 'secondary'
            default: return 'secondary'
        }
    }

    const getStatusColor = (status) => {
        switch (status) {
            case 'COMPLETED': return 'success'
            case 'IN_PROGRESS': return 'primary'
            case 'PENDING': return 'secondary'
            case 'CANCELLED': return 'danger'
            default: return 'secondary'
        }
    }

    const isOverdue = (date, status) => {
        if (status === 'COMPLETED' || status === 'CANCELLED' || !date) return false;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return new Date(date) < today;
    }

    const handleStatusChange = async (id, newStatus) => {
        try {
            await updateStatus({ id, status: newStatus }).unwrap()
            toast('Task status updated', 'success')
        } catch (error) {
            toast('Failed to update status', 'error')
        }
    }

    const handleDelete = async () => {
        if (!taskToDelete) return
        try {
            await deleteTask(taskToDelete._id).unwrap()
            toast('Task deleted', 'success')
            setTaskToDelete(null)
        } catch (error) {
            toast('Failed to delete task', 'error')
        }
    }

    return (
        <div className="space-y-6">
            <PageHeader 
                title="Tasks"
                breadcrumbs={[
                    { label: 'CRM', path: '/dashboard' },
                    { label: 'Tasks' }
                ]}
                action={
                    <Button onClick={() => { setTaskToEdit(null); setIsModalOpen(true) }}>
                        + Create Task
                    </Button>
                }
            />

            {/* Counters */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="hover:border-primary/50 cursor-pointer transition-colors" onClick={() => setFilters({ ...filters, assignedTo: 'me' })}>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-[var(--vz-text-muted)]">My Tasks</p>
                            <h4 className="text-2xl font-bold text-[var(--vz-heading)] mt-1">{stats.myTasks}</h4>
                        </div>
                        <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                            <CheckSquare size={24} />
                        </div>
                    </div>
                </Card>
                
                <Card className="hover:border-warning/50 cursor-pointer transition-colors" onClick={() => setFilters({ ...filters, dueDate: 'today' })}>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-[var(--vz-text-muted)]">Due Today</p>
                            <h4 className="text-2xl font-bold text-[var(--vz-heading)] mt-1">{stats.dueToday}</h4>
                        </div>
                        <div className="w-12 h-12 bg-warning/10 rounded-lg flex items-center justify-center text-warning">
                            <Calendar size={24} />
                        </div>
                    </div>
                </Card>
                
                <Card className="hover:border-danger/50 cursor-pointer transition-colors" onClick={() => setFilters({ ...filters, dueDate: 'overdue' })}>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-[var(--vz-text-muted)]">Overdue</p>
                            <h4 className="text-2xl font-bold text-[var(--vz-heading)] mt-1">{stats.overdue}</h4>
                        </div>
                        <div className="w-12 h-12 bg-danger/10 rounded-lg flex items-center justify-center text-danger">
                            <Clock size={24} />
                        </div>
                    </div>
                </Card>
                
                <Card className="hover:border-success/50 cursor-pointer transition-colors" onClick={() => setFilters({ ...filters, status: 'COMPLETED' })}>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-[var(--vz-text-muted)]">Completed</p>
                            <h4 className="text-2xl font-bold text-[var(--vz-heading)] mt-1">{stats.completed}</h4>
                        </div>
                        <div className="w-12 h-12 bg-success/10 rounded-lg flex items-center justify-center text-success">
                            <CheckCircle size={24} />
                        </div>
                    </div>
                </Card>
            </div>

            <Card>
                <div className="flex flex-col sm:flex-row items-center gap-4 mb-6">
                    <div className="flex-1 w-full relative">
                        <Input 
                            placeholder="Search tasks..." 
                            className="pl-9"
                            value={filters.search}
                            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                        />
                        <Search className="w-4 h-4 text-[var(--vz-text-muted)] absolute left-3 top-3" />
                    </div>
                    
                    <Select
                        className="w-full sm:w-48"
                        value={filters.status}
                        onChange={(val) => setFilters({ ...filters, status: val })}
                        options={[
                            { value: '', label: 'All Statuses' },
                            { value: 'PENDING', label: 'Pending' },
                            { value: 'IN_PROGRESS', label: 'In Progress' },
                            { value: 'COMPLETED', label: 'Completed' },
                            { value: 'CANCELLED', label: 'Cancelled' },
                        ]}
                    />

                    <Select
                        className="w-full sm:w-48"
                        value={filters.priority}
                        onChange={(val) => setFilters({ ...filters, priority: val })}
                        options={[
                            { value: '', label: 'All Priorities' },
                            { value: 'LOW', label: 'Low' },
                            { value: 'MEDIUM', label: 'Medium' },
                            { value: 'HIGH', label: 'High' },
                            { value: 'URGENT', label: 'Urgent' },
                        ]}
                    />

                    <Select
                        className="w-full sm:w-48"
                        value={filters.dueDate}
                        onChange={(val) => setFilters({ ...filters, dueDate: val })}
                        options={[
                            { value: 'all', label: 'All Dates' },
                            { value: 'today', label: 'Due Today' },
                            { value: 'overdue', label: 'Overdue' },
                            { value: 'upcoming', label: 'Upcoming' },
                        ]}
                    />

                    <Select
                        className="w-full sm:w-48"
                        value={filters.assignedTo}
                        onChange={(val) => setFilters({ ...filters, assignedTo: val })}
                        options={[
                            { value: '', label: 'All Assignees' },
                            ...users.map(u => ({ value: u._id, label: u.name }))
                        ]}
                    />
                </div>

                {isLoading ? (
                    <div className="space-y-4 animate-pulse">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-16 bg-gray-100 dark:bg-[var(--vz-border)] rounded-lg"></div>
                        ))}
                    </div>
                ) : tasks.length > 0 ? (
                    <div className="border border-[var(--vz-border)] rounded-lg overflow-hidden">
                        <div className="overflow-x-auto custom-scrollbar">
                            <table className="w-full text-left border-collapse min-w-[1000px]">
                                <thead>
                                    <tr className="bg-[var(--vz-bg-body)] border-b border-[var(--vz-border)] text-xs font-semibold text-[var(--vz-text-muted)] uppercase tracking-wider">
                                        <th className="px-4 py-3">Task</th>
                                        <th className="px-4 py-3">Lead</th>
                                        <th className="px-4 py-3">Due Date</th>
                                        <th className="px-4 py-3">Priority</th>
                                        <th className="px-4 py-3">Assignee</th>
                                        <th className="px-4 py-3">Status</th>
                                        <th className="px-4 py-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--vz-border)]">
                                    {tasks.map(task => (
                                        <tr key={task._id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                                            <td className="px-4 py-3">
                                                <div className="font-semibold text-[var(--vz-heading)]">{task.title}</div>
                                                {task.description && <div className="text-xs text-[var(--vz-text-muted)] truncate max-w-[250px]">{task.description}</div>}
                                            </td>
                                            <td className="px-4 py-3">
                                                {task.leadId ? (
                                                    <span 
                                                        onClick={() => navigate(`/leads/${task.leadId}`)} 
                                                        className="text-primary hover:underline cursor-pointer font-medium"
                                                    >
                                                        {task.leadNumber || 'View Lead'}
                                                    </span>
                                                ) : (
                                                    <span className="text-[var(--vz-text-muted)] text-sm">-</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                {task.dueDate ? (
                                                    <div className={`text-sm font-medium ${isOverdue(task.dueDate, task.status) ? 'text-danger' : 'text-[var(--vz-heading)]'}`}>
                                                        {new Date(task.dueDate).toLocaleDateString()}
                                                        {isOverdue(task.dueDate, task.status) && <span className="ml-1 text-xs text-danger">(Overdue)</span>}
                                                    </div>
                                                ) : <span className="text-[var(--vz-text-muted)] text-sm">No Due Date</span>}
                                            </td>
                                            <td className="px-4 py-3">
                                                <Badge color={getPriorityColor(task.priority)}>{task.priority}</Badge>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    {task.assignedUser?.avatarUrl ? (
                                                        <img src={task.assignedUser.avatarUrl} alt="Avatar" className="w-6 h-6 rounded-full" />
                                                    ) : (
                                                        <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px] font-bold">
                                                            {task.assignedUser?.name?.[0] || 'U'}
                                                        </div>
                                                    )}
                                                    <span className="text-sm font-medium text-[var(--vz-heading)]">{task.assignedUser?.name}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <Select 
                                                    value={task.status} 
                                                    onChange={(val) => handleStatusChange(task._id, val)}
                                                    options={[
                                                        { value: 'PENDING', label: 'Pending' },
                                                        { value: 'IN_PROGRESS', label: 'In Progress' },
                                                        { value: 'COMPLETED', label: 'Completed' },
                                                        { value: 'CANCELLED', label: 'Cancelled' },
                                                    ]}
                                                    className="w-32 text-xs"
                                                />
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button onClick={() => { setTaskToEdit(task); setIsModalOpen(true); }} className="p-1.5 text-[var(--vz-text-muted)] hover:text-primary transition-colors bg-black/5 dark:bg-white/5 rounded">
                                                        <Edit3 size={14} />
                                                    </button>
                                                    <button onClick={() => setTaskToDelete(task)} className="p-1.5 text-[var(--vz-text-muted)] hover:text-danger transition-colors bg-black/5 dark:bg-white/5 rounded">
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    <EmptyState 
                        icon={CheckSquare} 
                        title="No tasks found" 
                        description="Try changing your filters or create a new task."
                        action={<Button onClick={() => { setTaskToEdit(null); setIsModalOpen(true) }}>Create Task</Button>}
                    />
                )}
            </Card>

            {isModalOpen && (
                <TaskModal 
                    isOpen={isModalOpen}
                    onClose={() => { setIsModalOpen(false); setTaskToEdit(null); }}
                    taskToEdit={taskToEdit}
                    users={users}
                />
            )}

            <ConfirmModal
                isOpen={!!taskToDelete}
                onClose={() => setTaskToDelete(null)}
                onConfirm={handleDelete}
                title="Delete Task"
                message={`Are you sure you want to delete "${taskToDelete?.title}"? This action cannot be undone.`}
                confirmText="Delete"
                variant="danger"
                isLoading={isDeleting}
            />
        </div>
    )
}

export default TasksList
