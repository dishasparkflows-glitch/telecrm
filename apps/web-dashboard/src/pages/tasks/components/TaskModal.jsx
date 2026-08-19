import React, { useState, useEffect, useRef } from 'react'
import { ChevronDown, Search } from 'lucide-react'
import Modal from '../../../components/ui/Modal'
import Input from '../../../components/ui/Input'
import Select from '../../../components/ui/Select'
import Button from '../../../components/ui/Button'
import { useCreateTaskMutation, useUpdateTaskMutation } from '../../../features/tasks/tasksApi'
import { useGetActiveLeadsQuery } from '../../../features/leads/leadApi'
import { useToast } from '../../../components/ui/Toast'

export default function TaskModal({ isOpen, onClose, taskToEdit, users, prefilledLeadId }) {
    const [createTask, { isLoading: isCreating }] = useCreateTaskMutation()
    const [updateTask, { isLoading: isUpdating }] = useUpdateTaskMutation()
    const toast = useToast()

    const [formData, setFormData] = useState({
        title: '',
        description: '',
        leadId: prefilledLeadId || '',
        assignedTo: '',
        priority: 'MEDIUM',
        status: 'PENDING',
        dueDate: ''
    })

    const [leadSearchTerm, setLeadSearchTerm] = useState('')
    const [isDropdownOpen, setIsDropdownOpen] = useState(false)
    const { data: leadsData } = useGetActiveLeadsQuery({ search: leadSearchTerm, limit: 10 })
    const leads = leadsData?.data?.leads || leadsData?.data || []

    useEffect(() => {
        if (taskToEdit) {
            setFormData({
                title: taskToEdit.title,
                description: taskToEdit.description || '',
                leadId: taskToEdit.leadId || '',
                assignedTo: taskToEdit.assignedTo,
                priority: taskToEdit.priority,
                status: taskToEdit.status,
                dueDate: taskToEdit.dueDate ? new Date(taskToEdit.dueDate).toISOString().slice(0, 16) : ''
            })
            if (taskToEdit.leadId && taskToEdit.leadNumber) {
                // To keep it simple, we could just pre-populate lead search with lead number
                setLeadSearchTerm(taskToEdit.leadNumber)
            }
        }
    }, [taskToEdit])

    const handleSubmit = async (e) => {
        e.preventDefault()
        try {
            if (taskToEdit) {
                await updateTask({ id: taskToEdit._id, ...formData }).unwrap()
                toast('Task updated successfully', 'success')
            } else {
                await createTask(formData).unwrap()
                toast('Task created successfully', 'success')
            }
            onClose()
        } catch (error) {
            toast(error?.data?.message || 'Failed to save task', 'error')
        }
    }

    return (
        <Modal 
            isOpen={isOpen} 
            onClose={onClose} 
            title={taskToEdit ? "Edit Task" : "Create Task"}
            size="md"
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                    label="Task Title *"
                    required
                    value={formData.title}
                    onChange={e => setFormData({...formData, title: e.target.value})}
                    placeholder="e.g. Prepare quotation"
                />

                <Input
                    label="Description"
                    value={formData.description}
                    onChange={e => setFormData({...formData, description: e.target.value})}
                    placeholder="Add more details about this task..."
                />

                {!prefilledLeadId && (
                    <div className="space-y-1">
                        <label className="block text-sm font-medium text-[var(--vz-heading)] mb-1">
                            Associated Lead
                        </label>
                        <div className="relative">
                            <div className="relative">
                                <Input
                                    placeholder="Search by Lead Name, Phone, or Lead No..."
                                    value={leadSearchTerm}
                                    onChange={e => {
                                        setLeadSearchTerm(e.target.value)
                                        setIsDropdownOpen(true)
                                    }}
                                    onFocus={() => setIsDropdownOpen(true)}
                                    onBlur={() => setTimeout(() => setIsDropdownOpen(false), 200)}
                                />
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--vz-text-muted)] pointer-events-none">
                                    <ChevronDown size={16} />
                                </div>
                            </div>
                            {isDropdownOpen && leads.length > 0 && (
                                <div className="absolute z-50 w-full mt-1 bg-white dark:bg-[var(--vz-card-bg)] border border-[var(--vz-border)] rounded-md shadow-xl max-h-48 overflow-y-auto">
                                    {leads.map(lead => (
                                        <div 
                                            key={lead._id}
                                            onClick={() => {
                                                setFormData({...formData, leadId: lead._id})
                                                setLeadSearchTerm(`${lead.leadNumber || ''} - ${lead.contact?.firstName || ''} ${lead.contact?.lastName || ''}`.trim())
                                                setIsDropdownOpen(false)
                                            }}
                                            className="px-3 py-2 cursor-pointer hover:bg-[var(--vz-bg-light)] border-b border-[var(--vz-border)] last:border-0 flex justify-between items-center"
                                        >
                                            <div className="font-medium text-[var(--vz-heading)]">{lead.contact?.name || `${lead.contact?.firstName || ''} ${lead.contact?.lastName || ''}`.trim() || 'Unknown Lead'}</div>
                                            {lead.leadNumber && (
                                                <div className="text-xs text-[var(--vz-text-muted)] bg-[var(--vz-bg-light)] px-1.5 py-0.5 rounded border border-[var(--vz-border)]">
                                                    {lead.leadNumber}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                    <Select
                        label="Assigned To *"
                        required
                        value={formData.assignedTo}
                        onChange={val => setFormData({...formData, assignedTo: val})}
                        options={[
                            { value: '', label: 'Select User' },
                            ...users.map(u => ({ value: u._id, label: u.name }))
                        ]}
                    />

                    <Select
                        label="Priority *"
                        required
                        value={formData.priority}
                        onChange={val => setFormData({...formData, priority: val})}
                        options={[
                            { value: 'LOW', label: 'Low' },
                            { value: 'MEDIUM', label: 'Medium' },
                            { value: 'HIGH', label: 'High' },
                            { value: 'URGENT', label: 'Urgent' },
                        ]}
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <Select
                        label="Status"
                        value={formData.status}
                        onChange={val => setFormData({...formData, status: val})}
                        options={[
                            { value: 'PENDING', label: 'Pending' },
                            { value: 'IN_PROGRESS', label: 'In Progress' },
                            { value: 'COMPLETED', label: 'Completed' },
                            { value: 'CANCELLED', label: 'Cancelled' },
                        ]}
                    />

                    <Input
                        type="datetime-local"
                        label="Due Date"
                        value={formData.dueDate}
                        onChange={e => setFormData({...formData, dueDate: e.target.value})}
                    />
                </div>

                <div className="pt-4 flex justify-end gap-2 border-t border-[var(--vz-border)] mt-6">
                    <Button variant="ghost" type="button" onClick={onClose}>Cancel</Button>
                    <Button type="submit" disabled={isCreating || isUpdating}>
                        {taskToEdit ? 'Update Task' : 'Create Task'}
                    </Button>
                </div>
            </form>
        </Modal>
    )
}
