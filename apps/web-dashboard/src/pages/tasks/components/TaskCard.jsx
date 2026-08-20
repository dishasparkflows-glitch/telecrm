import React, { useState } from 'react'
import { CheckSquare, Plus, Clock, CheckCircle } from 'lucide-react'
import Card from '../../../components/ui/Card'
import Button from '../../../components/ui/Button'
import Badge from '../../../components/ui/Badge'
import TaskModal from './TaskModal'
import { useListTasksQuery } from '../../../features/tasks/tasksApi'
import { useSelector } from 'react-redux'
import { useGetAllUsersListQuery } from '../../../features/users/userApi'

export default function TaskCard({ lead }) {
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [taskToEdit, setTaskToEdit] = useState(null)
    
    const { activeBranchId } = useSelector(state => state.auth)
    const { data: usersData } = useGetAllUsersListQuery({ branchId: activeBranchId })
    const users = usersData?.data || []

    const { data: tasksData, isLoading } = useListTasksQuery({ leadId: lead._id, limit: 10 })
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

    const isOverdue = (date, status) => {
        if (status === 'COMPLETED' || status === 'CANCELLED' || !date) return false;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return new Date(date) < today;
    }

    return (
        <>
            <Card>
                <Card.Header className="flex items-center justify-between">
                    <Card.Title className="flex items-center gap-2">
                        <CheckSquare size={16} className="text-primary" />
                        Tasks
                    </Card.Title>
                    <Button variant="ghost" size="sm" onClick={() => { setTaskToEdit(null); setIsModalOpen(true) }}>
                        <Plus size={14} /> Add Task
                    </Button>
                </Card.Header>
                
                {isLoading ? (
                    <div className="py-4 text-center text-sm text-[var(--vz-text-muted)] animate-pulse">Loading tasks...</div>
                ) : tasks.length === 0 ? (
                    <div className="py-6 text-center">
                        <p className="text-sm text-[var(--vz-text-muted)] mb-3">No tasks found for this lead.</p>
                        <Button variant="soft-primary" size="sm" onClick={() => { setTaskToEdit(null); setIsModalOpen(true) }}>
                            Create Task
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {tasks.map((task) => (
                            <div 
                                key={task._id} 
                                onClick={() => { setTaskToEdit(task); setIsModalOpen(true); }}
                                className="p-3 border border-[var(--vz-border)] rounded-lg hover:border-primary/50 cursor-pointer transition-colors bg-[var(--vz-bg-body)]"
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <h4 className={`text-sm font-semibold ${task.details?.status === 'COMPLETED' ? 'text-[var(--vz-text-muted)] line-through' : 'text-[var(--vz-heading)]'}`}>
                                        {task.details?.title}
                                    </h4>
                                    <Badge color={getPriorityColor(task.details?.priority)}>{task.details?.priority}</Badge>
                                </div>
                                
                                <div className="flex items-center justify-between text-xs text-[var(--vz-text-muted)]">
                                    <div className="flex items-center gap-1.5">
                                        {task.details?.status === 'COMPLETED' ? (
                                            <><CheckCircle size={12} className="text-success" /> <span className="text-success font-medium">Completed</span></>
                                        ) : task.dueDate ? (
                                            <>
                                                <Clock size={12} className={isOverdue(task.dueDate, task.details?.status) ? 'text-danger' : ''} /> 
                                                <span className={isOverdue(task.dueDate, task.details?.status) ? 'text-danger font-medium' : ''}>
                                                    {isOverdue(task.dueDate, task.details?.status) ? 'Overdue' : new Date(task.dueDate).toLocaleDateString()}
                                                </span>
                                            </>
                                        ) : <span>No due date</span>}
                                    </div>
                                    <span className="font-medium">{task.assignedUser?.name}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </Card>

            {isModalOpen && (
                <TaskModal 
                    isOpen={isModalOpen}
                    onClose={() => { setIsModalOpen(false); setTaskToEdit(null); }}
                    taskToEdit={taskToEdit}
                    users={users}
                    prefilledLeadId={lead._id}
                />
            )}
        </>
    )
}
