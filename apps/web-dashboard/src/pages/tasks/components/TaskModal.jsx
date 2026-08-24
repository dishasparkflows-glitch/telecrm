import React, { useState, useEffect, useRef } from 'react'
import { Search, X, Paperclip, FileText, ClipboardList, Eye, Download, Trash2, File as FileIcon, Image as ImageIcon, FileSpreadsheet, FileArchive, Video, FileAudio } from 'lucide-react'
import Modal from '../../../components/ui/Modal'
import Input from '../../../components/ui/Input'
import Select from '../../../components/ui/Select'
import Button from '../../../components/ui/Button'
import { useCreateTaskMutation, useUpdateTaskMutation } from '../../../features/tasks/tasksApi'
import { useGetActiveLeadsQuery } from '../../../features/leads/leadApi'
import { useGetUploadUrlMutation, useGetDownloadUrlMutation } from '../../../features/uploads/uploadApi'
import { useGetReminderSettingsQuery } from '../../../features/notifications/notificationApi'
import { REMINDER_OPTIONS } from '../../../utils/constants'
import { useToast } from '../../../components/ui/Toast'

const SectionTitle = ({ children, number }) => (
    <h3 className="text-sm font-semibold text-primary mb-3 flex gap-1">
        <span>{number}.</span> <span>{children}</span>
    </h3>
)

const formatBytes = (bytes) => {
    if (bytes === undefined || bytes === null) return null;
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

const formatDate = (dateStr) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const getFileIconAndColor = (filename, mimeType) => {
    const ext = filename?.split('.').pop().toLowerCase() || '';
    
    if (ext === 'pdf' || mimeType?.includes('pdf')) {
        return { Icon: FileText, color: 'text-danger bg-danger/10', border: 'hover:border-danger/50' };
    }
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext) || mimeType?.includes('image')) {
        return { Icon: ImageIcon, color: 'text-primary bg-primary/10', border: 'hover:border-primary/50' };
    }
    if (['xls', 'xlsx', 'csv'].includes(ext) || mimeType?.includes('spreadsheet') || mimeType?.includes('excel')) {
        return { Icon: FileSpreadsheet, color: 'text-success bg-success/10', border: 'hover:border-success/50' };
    }
    if (['doc', 'docx'].includes(ext) || mimeType?.includes('word')) {
        return { Icon: FileText, color: 'text-info bg-info/10', border: 'hover:border-info/50' };
    }
    if (['zip', 'rar', 'tar', 'gz'].includes(ext) || mimeType?.includes('zip')) {
        return { Icon: FileArchive, color: 'text-warning bg-warning/10', border: 'hover:border-warning/50' };
    }
    if (mimeType?.includes('video') || ['mp4', 'mov', 'avi'].includes(ext)) {
        return { Icon: Video, color: 'text-secondary bg-secondary/10', border: 'hover:border-secondary/50' };
    }
    if (mimeType?.includes('audio') || ['mp3', 'wav', 'ogg'].includes(ext)) {
        return { Icon: FileAudio, color: 'text-secondary bg-secondary/10', border: 'hover:border-secondary/50' };
    }
    
    return { Icon: FileIcon, color: 'text-[var(--vz-text-muted)] bg-[var(--vz-bg-light)]', border: 'hover:border-primary/50' };
}

export default function TaskModal({ isOpen, onClose, taskToEdit, users, prefilledLeadId }) {
    const [createTask, { isLoading: isCreating }] = useCreateTaskMutation()
    const [updateTask, { isLoading: isUpdating }] = useUpdateTaskMutation()
    const [getUploadUrl] = useGetUploadUrlMutation()
    const [getDownloadUrl] = useGetDownloadUrlMutation()
    const toast = useToast()
    const fileInputRef = useRef(null)
    const [isUploading, setIsUploading] = useState(false)
    const { data: reminderSettingsResp } = useGetReminderSettingsQuery(undefined, { skip: !isOpen || !!taskToEdit })

    const buildFormData = (task) => {
        let defaultReminder = 30; // fallback
        if (reminderSettingsResp?.data?.defaultReminders?.task) {
            const taskSettings = reminderSettingsResp.data.defaultReminders.task;
            if (!taskSettings.enabled) defaultReminder = null;
            else defaultReminder = taskSettings.offsetMinutes;
        }
        
        if (!task) return {
            title: '',
            description: '',
            leadId: prefilledLeadId || '',
            assignedTo: '',
            priority: 'HIGH',
            status: 'PENDING',
            taskType: 'Follow-up',
            dueDate: '',
            dueTime: '',
            reminder: defaultReminder,
            attachments: [],
            internalNote: ''
        };
        const dateObj = task.dueDate ? new Date(task.dueDate) : null;
        
        let existingReminder = task.details?.reminder || task.reminder;
        if (typeof existingReminder === 'object' && existingReminder !== null) {
            existingReminder = existingReminder.enabled ? existingReminder.offsetMinutes : null;
        } else if (typeof existingReminder === 'string') {
            if (existingReminder === '15 minutes before') existingReminder = 15;
            else if (existingReminder === '30 minutes before') existingReminder = 30;
            else if (existingReminder === '1 hour before') existingReminder = 60;
            else existingReminder = defaultReminder;
        } else if (existingReminder === undefined) {
            existingReminder = defaultReminder;
        }

        return {
            title: task.details?.title || task.title || '',
            description: task.details?.description || task.description || '',
            leadId: task.leadId || '',
            assignedTo: task.assignedTo || '',
            priority: task.details?.priority || task.priority || 'HIGH',
            status: task.details?.status || task.status || 'PENDING',
            taskType: task.details?.taskType || task.taskType || 'Follow-up',
            dueDate: dateObj ? dateObj.toISOString().slice(0, 10) : '',
            dueTime: dateObj ? dateObj.toISOString().slice(11, 16) : '',
            reminder: existingReminder,
            attachments: task.attachments || [],
            internalNote: task.internalNote || ''
        };
    };

    const [formData, setFormData] = useState(() => buildFormData(taskToEdit))
    const [leadSearchTerm, setLeadSearchTerm] = useState(
        taskToEdit?.leadId && taskToEdit?.leadNumber ? taskToEdit.leadNumber : ''
    )
    const [isDropdownOpen, setIsDropdownOpen] = useState(false)
    const { data: leadsData } = useGetActiveLeadsQuery({ search: leadSearchTerm, limit: 10 })
    const leads = leadsData?.data?.leads || leadsData?.data || []

    // Sync form when taskToEdit changes (e.g. modal re-used for different task)
    const prevTaskId = useRef(taskToEdit?._id)
    useEffect(() => {
        if (taskToEdit?._id !== prevTaskId.current) {
            prevTaskId.current = taskToEdit?._id;
            setTimeout(() => {
                setFormData(buildFormData(taskToEdit));
                setLeadSearchTerm(taskToEdit?.leadId && taskToEdit?.leadNumber ? taskToEdit.leadNumber : '');
            }, 0);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [taskToEdit?._id])

    const handleAttachmentUpload = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        setIsUploading(true);
        try {
            const uploadedAttachments = [];
            for (const file of files) {
                const res = await getUploadUrl({
                    uploadType: 'tasks',
                    taskId: taskToEdit?._id,
                    fileType: file.type,
                    fileSize: file.size
                }).unwrap();

                const { uploadUrl, key } = res.data;

                await fetch(uploadUrl, {
                    method: 'PUT',
                    body: file,
                    headers: { 'Content-Type': file.type }
                });

                uploadedAttachments.push({
                    key,
                    name: file.name,
                    size: file.size,
                    type: file.type,
                    uploadedAt: new Date().toISOString()
                });
            }

            setFormData(prev => ({
                ...prev,
                attachments: [...prev.attachments, ...uploadedAttachments]
            }));
            toast(`${files.length} file(s) uploaded successfully`, 'success');
        } catch (error) {
            toast(error?.data?.message || 'Failed to upload file(s)', 'error');
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        try {
            const rawSubmitData = { ...formData }
            if (rawSubmitData.dueDate && rawSubmitData.dueTime) {
                rawSubmitData.dueDate = new Date(`${rawSubmitData.dueDate}T${rawSubmitData.dueTime}`).toISOString()
            } else if (rawSubmitData.dueDate) {
                rawSubmitData.dueDate = new Date(`${rawSubmitData.dueDate}T00:00:00`).toISOString()
            }

            const submitData = {
                details: {
                    title: rawSubmitData.title,
                    description: rawSubmitData.description,
                    taskType: rawSubmitData.taskType,
                    status: rawSubmitData.status,
                    priority: rawSubmitData.priority,
                    reminder: rawSubmitData.reminder !== null ? { enabled: true, offsetMinutes: Number(rawSubmitData.reminder) } : { enabled: false },
                },
                leadId: rawSubmitData.leadId || null,
                assignedTo: rawSubmitData.assignedTo,
                dueDate: rawSubmitData.dueDate,
                attachments: rawSubmitData.attachments,
                internalNote: rawSubmitData.internalNote
            }

            if (taskToEdit) {
                await updateTask({ id: taskToEdit._id, ...submitData }).unwrap()
                toast('Task updated successfully', 'success')
            } else {
                await createTask(submitData).unwrap()
                toast('Task created successfully', 'success')
            }
            onClose()
        } catch (error) {
            toast(error?.data?.message || 'Failed to save task', 'error')
        }
    }



    const selectedLead = leads.find(l => l._id === formData.leadId) || (taskToEdit?.leadId === formData.leadId ? { _id: taskToEdit.leadId, leadNumber: taskToEdit.leadNumber, contact: { name: leadSearchTerm } } : null)

    return (
        <Modal 
            isOpen={isOpen} 
            onClose={onClose} 
            title={
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                        <ClipboardList size={18} />
                    </div>
                    <div>
                        <div className="font-semibold text-[var(--vz-heading)]">{taskToEdit ? "Edit Task" : "Add New Task"}</div>
                        <div className="text-xs text-[var(--vz-text-muted)] font-normal">Create a task and assign it to the right person</div>
                    </div>
                </div>
            }
            size="xl"
        >
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Left Column */}
                    <div className="space-y-6">
                        <div>
                            <SectionTitle number="1">Task Information</SectionTitle>
                            <div className="space-y-4">
                                <Input
                                    label="Task Title *"
                                    required
                                    value={formData.title}
                                    onChange={e => setFormData({...formData, title: e.target.value})}
                                    placeholder="Enter task title"
                                />
                                <div className="grid grid-cols-2 gap-4">
                                    <Select
                                        label="Task Type *"
                                        required
                                        value={formData.taskType}
                                        onChange={val => setFormData({...formData, taskType: val})}
                                        options={[
                                            { value: 'Follow-up', label: 'Follow-up' },
                                            { value: 'Call', label: 'Call' },
                                            { value: 'Meeting', label: 'Meeting' },
                                            { value: 'Email', label: 'Email' },
                                            { value: 'Other', label: 'Other' },
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
                                <div className="space-y-1.5">
                                    <label className="block text-sm font-medium text-[var(--vz-heading)] mb-1">
                                        Description
                                    </label>
                                    <textarea
                                        className="w-full rounded-md border border-[var(--vz-input-border)] bg-[var(--vz-input-bg)] text-sm text-[var(--vz-heading)] placeholder:text-[var(--vz-text-muted)] px-3 py-2 outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 min-h-[120px] resize-none"
                                        value={formData.description}
                                        onChange={e => setFormData({...formData, description: e.target.value})}
                                        placeholder="Describe the task in detail..."
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column */}
                    <div className="space-y-6">
                        <div>
                            <SectionTitle number="2">Related To</SectionTitle>
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <Select
                                        label="Related To *"
                                        value="Lead"
                                        onChange={() => {}}
                                        options={[{ value: 'Lead', label: 'Lead' }]}
                                    />
                                    {!prefilledLeadId && (
                                        <div className="space-y-1 pt-[22px]">
                                            <div className="relative">
                                                <div className="relative">
                                                    <Input
                                                        placeholder="Search lead..."
                                                        value={leadSearchTerm}
                                                        onChange={e => {
                                                            setLeadSearchTerm(e.target.value)
                                                            setIsDropdownOpen(true)
                                                        }}
                                                        onFocus={() => setIsDropdownOpen(true)}
                                                        onBlur={() => setTimeout(() => setIsDropdownOpen(false), 200)}
                                                    />
                                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--vz-text-muted)] pointer-events-none">
                                                        <Search size={16} />
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
                                </div>
                                
                                {/* Selected Lead Chip */}
                                {formData.leadId && selectedLead && (
                                    <div className="flex items-center gap-3 p-3 bg-white dark:bg-[var(--vz-card-bg)] border border-[var(--vz-border)] rounded-md shadow-sm">
                                        <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-sm">
                                            {selectedLead.contact?.name ? selectedLead.contact.name.substring(0,2).toUpperCase() : 'LD'}
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-sm font-medium text-[var(--vz-heading)]">{selectedLead.contact?.name || 'Unknown'}</div>
                                            <div className="text-xs text-[var(--vz-text-muted)] mt-0.5 flex gap-2">
                                                <span className="text-primary bg-primary/10 px-1.5 rounded">{selectedLead.leadNumber}</span>
                                            </div>
                                        </div>
                                        <button type="button" onClick={() => { setFormData({...formData, leadId: ''}) }}>
                                            <X size={16} className="text-[var(--vz-text-muted)] hover:text-danger" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div>
                            <SectionTitle number="3">Assignment</SectionTitle>
                            <div className="grid grid-cols-1 gap-4">
                                <Select
                                    label="Assign To *"
                                    required
                                    value={formData.assignedTo}
                                    onChange={val => setFormData({...formData, assignedTo: val})}
                                    options={[
                                        { value: '', label: 'Select User' },
                                        ...users.map(u => ({ value: u._id, label: u.name }))
                                    ]}
                                />
                                {taskToEdit && (
                                    <div className="mt-2 flex items-center gap-3">
                                        {(() => {
                                            const creator = users.find(u => u._id === taskToEdit.createdBy);
                                            const date = taskToEdit.meta?.createdAt || taskToEdit.createdAt;
                                            return (
                                                <>
                                                    {creator?.avatarUrl || creator?.profilePic ? (
                                                        <img src={creator.avatarUrl || creator.profilePic} alt={creator.name} className="w-8 h-8 rounded-full object-cover" />
                                                    ) : (
                                                        <div className="w-8 h-8 rounded-full bg-[var(--vz-bg-light)] text-[var(--vz-text-muted)] flex items-center justify-center font-medium text-xs border border-[var(--vz-border)]">
                                                            {creator?.name ? creator.name.substring(0,2).toUpperCase() : 'U'}
                                                        </div>
                                                    )}
                                                    <div>
                                                        <div className="text-sm font-semibold text-[var(--vz-heading)]">
                                                            Created By: <span className="font-normal text-[var(--vz-text-muted)]">{creator?.name || 'Unknown User'}</span>
                                                        </div>
                                                        <div className="text-xs text-[var(--vz-text-muted)] mt-0.5">
                                                            {date ? formatDate(date) : ''}
                                                        </div>
                                                    </div>
                                                </>
                                            );
                                        })()}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Schedule */}
                <div>
                    <SectionTitle number="4">Schedule</SectionTitle>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input
                            type="date"
                            label="Due Date *"
                            required
                            value={formData.dueDate}
                            onChange={e => setFormData({...formData, dueDate: e.target.value})}
                            minDate={new Date()}
                        />
                        <Input
                            type="time"
                            label="Due Time *"
                            required
                            value={formData.dueTime}
                            onChange={e => setFormData({...formData, dueTime: e.target.value})}
                        />
                    </div>
                </div>

                {/* Additional Details */}
                <div>
                    <SectionTitle number="5">Additional Details (Optional)</SectionTitle>
                    <div className="flex flex-col md:flex-row gap-4 items-start">
                        {/* Attachment */}
                        <div className="flex-1 w-full">
                            <input 
                                type="file" 
                                multiple 
                                ref={fileInputRef} 
                                className="hidden" 
                                onChange={handleAttachmentUpload} 
                                accept=".jpg,.jpeg,.png,.webp,.gif,.mp4,.mov,.avi,.mkv,.pdf,.txt,.doc,.docx,.mp3,.aac,.ogg,.wav,.webm,.3gp,image/*,video/*,audio/*,application/pdf,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                            />
                            <div 
                                onClick={() => fileInputRef.current?.click()}
                                className={`border border-[var(--vz-border)] rounded-md p-4 flex items-center justify-between cursor-pointer hover:bg-[var(--vz-bg-light)] transition-colors ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="text-primary bg-primary/10 p-2 rounded-full">
                                        <Paperclip size={18} />
                                    </div>
                                    <div>
                                        <div className="text-sm font-semibold text-[var(--vz-heading)]">Attachment</div>
                                        <div className="text-xs text-[var(--vz-text-muted)]">{isUploading ? 'Uploading...' : 'Add files or documents'}</div>
                                    </div>
                                </div>
                                <span className="text-primary text-xl font-light">+</span>
                            </div>
                            {/* Uploaded attachments list */}
                            {formData.attachments.length > 0 && (
                                <div className="mt-4 space-y-2">
                                    {formData.attachments.map((att, idx) => {
                                        const isObject = typeof att === 'object' && att !== null;
                                        const key = isObject ? att.key : att;
                                        const name = isObject ? att.name : att.split('/').pop();
                                        const size = isObject ? att.size : null;
                                        const type = isObject ? att.type : '';
                                        
                                        let uploadedAt = isObject ? att.uploadedAt : null;
                                        if (!isObject) {
                                            const timestampStr = name.split('-')[0];
                                            const timestamp = parseInt(timestampStr, 10);
                                            if (!isNaN(timestamp) && timestamp > 1600000000000) {
                                                uploadedAt = new Date(timestamp).toISOString();
                                            }
                                        }
                                        
                                        const { Icon, color, border } = getFileIconAndColor(name, type);
                                        const formattedSize = formatBytes(size);
                                        const formattedDate = formatDate(uploadedAt);
                                        
                                        return (
                                        <div key={idx} className={`flex items-center justify-between p-3 bg-white dark:bg-[var(--vz-card-bg)] border border-[var(--vz-border)] rounded-md shadow-sm group transition-colors ${border}`}>
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                <div className={`w-10 h-10 rounded flex items-center justify-center shrink-0 ${color}`}>
                                                    <Icon size={20} />
                                                </div>
                                                <div className="flex flex-col truncate">
                                                    <span className="text-sm font-medium text-[var(--vz-heading)] truncate">{name}</span>
                                                    <span className="text-xs text-[var(--vz-text-muted)]">
                                                        {formattedSize ? `${formattedSize} • ` : ''} 
                                                        {formattedDate ? `Uploaded on ${formattedDate}` : 'Uploaded file'}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1.5 shrink-0 ml-2">
                                                <button 
                                                    type="button"
                                                    onClick={async () => {
                                                        try {
                                                            const res = await getDownloadUrl({ key }).unwrap();
                                                            window.open(res.data.downloadUrl, '_blank');
                                                        } catch (e) {
                                                            toast('Failed to view file', 'error');
                                                        }
                                                    }}
                                                    className="p-1.5 rounded border border-[var(--vz-border)] hover:border-primary hover:text-primary bg-[var(--vz-bg-light)] text-[var(--vz-text-muted)] transition-colors"
                                                    title="View"
                                                >
                                                    <Eye size={16} />
                                                </button>
                                                <button 
                                                    type="button"
                                                    onClick={async () => {
                                                        try {
                                                            const res = await getDownloadUrl({ key, downloadFilename: name }).unwrap();
                                                            const a = document.createElement('a');
                                                            a.href = res.data.downloadUrl;
                                                            a.download = name;
                                                            document.body.appendChild(a);
                                                            a.click();
                                                            document.body.removeChild(a);
                                                        } catch (e) {
                                                            toast('Failed to download file', 'error');
                                                        }
                                                    }}
                                                    className="p-1.5 rounded border border-[var(--vz-border)] hover:border-primary hover:text-primary bg-[var(--vz-bg-light)] text-[var(--vz-text-muted)] transition-colors"
                                                    title="Download"
                                                >
                                                    <Download size={16} />
                                                </button>
                                                <button 
                                                    type="button"
                                                    onClick={() => setFormData(prev => ({...prev, attachments: prev.attachments.filter((_, i) => i !== idx)}))}
                                                    className="p-1.5 rounded border border-[var(--vz-border)] hover:border-danger hover:text-danger bg-[var(--vz-bg-light)] text-[var(--vz-text-muted)] transition-colors"
                                                    title="Delete"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    )})}
                                    <div className="text-xs text-[var(--vz-text-muted)] mt-2 pl-1 font-medium">{formData.attachments.length} file{formData.attachments.length !== 1 ? 's' : ''} attached</div>
                                </div>
                            )}
                        </div>

                        {/* Internal Note */}
                        <div className="flex-1 w-full">
                            <div className="w-full">
                                <label className="block text-sm font-medium text-[var(--vz-heading)] mb-1">Internal Note</label>
                                <textarea
                                    className="w-full rounded-md border border-[var(--vz-input-border)] bg-[var(--vz-input-bg)] text-sm text-[var(--vz-heading)] placeholder:text-[var(--vz-text-muted)] px-3 py-2 outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 min-h-[80px] resize-none"
                                    value={formData.internalNote}
                                    onChange={e => setFormData({...formData, internalNote: e.target.value})}
                                    placeholder="Add internal note here..."
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="pt-4 flex justify-end gap-3 mt-6">
                    <Button variant="ghost" type="button" onClick={onClose} className="px-6 py-2">Cancel</Button>
                    <Button type="submit" disabled={isCreating || isUpdating} className="px-6 py-2">
                        {taskToEdit ? 'Update Task' : 'Create Task'}
                    </Button>
                </div>
            </form>
        </Modal>
    )
}
