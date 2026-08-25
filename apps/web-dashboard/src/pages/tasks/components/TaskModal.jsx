import React, { useState, useEffect, useRef } from 'react'
import { Search, X, Paperclip, FileText, ClipboardList, Eye, Download, Trash2, File as FileIcon, Image as ImageIcon, FileSpreadsheet, FileArchive, Video, FileAudio, Upload } from 'lucide-react'
import Modal from '../../../components/ui/Modal'
import Input from '../../../components/ui/Input'
import Select from '../../../components/ui/Select'
import Button from '../../../components/ui/Button'
import { useCreateTaskMutation, useUpdateTaskMutation } from '../../../features/tasks/tasksApi'
import { useGetActiveLeadsQuery } from '../../../features/leads/leadApi'
import { useGetUploadUrlMutation, useGetDownloadUrlMutation } from '../../../features/uploads/uploadApi'
import { useGetReminderSettingsQuery } from '../../../features/notifications/notificationApi'
import { useToast } from '../../../components/ui/Toast'

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
            noDueDate: false
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
            noDueDate: !dateObj
        };
    };

    const [formData, setFormData] = useState(() => buildFormData(taskToEdit))
    const [leadSearchTerm, setLeadSearchTerm] = useState(
        taskToEdit?.leadId && taskToEdit?.leadNumber ? taskToEdit.leadNumber : ''
    )
    const [isDropdownOpen, setIsDropdownOpen] = useState(false)
    const { data: leadsData } = useGetActiveLeadsQuery({ search: leadSearchTerm, limit: 10 })
    const leads = leadsData?.data?.leads || leadsData?.data || []

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
            
            let finalDueDate = null;
            if (!rawSubmitData.noDueDate) {
                if (rawSubmitData.dueDate && rawSubmitData.dueTime) {
                    finalDueDate = new Date(`${rawSubmitData.dueDate}T${rawSubmitData.dueTime}`).toISOString()
                } else if (rawSubmitData.dueDate) {
                    finalDueDate = new Date(`${rawSubmitData.dueDate}T00:00:00`).toISOString()
                }
            }

            const submitData = {
                details: {
                    title: rawSubmitData.title,
                    description: rawSubmitData.description,
                    taskType: rawSubmitData.taskType,
                    status: rawSubmitData.status,
                    priority: rawSubmitData.priority,
                },
                leadId: rawSubmitData.leadId || null,
                assignedTo: rawSubmitData.assignedTo,
                dueDate: finalDueDate,
                attachments: rawSubmitData.attachments,
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
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                        <ClipboardList size={20} />
                    </div>
                    <div>
                        <div className="text-lg font-semibold text-slate-900">{taskToEdit ? "Edit Task" : "Add New Task"}</div>
                        <div className="text-xs text-slate-500 font-normal">Create a new task and assign it to the right person</div>
                    </div>
                </div>
            }
            size="xl"
        >
            <form onSubmit={handleSubmit} className="space-y-5 px-1 pb-2">
                
                {/* Row 1 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <Input
                        label="Task Title *"
                        required
                        value={formData.title}
                        onChange={e => setFormData({...formData, title: e.target.value})}
                        placeholder="Enter task title..."
                    />
                    <Select
                        label={
                            <div className="flex items-center gap-1">
                                Status <span className="text-slate-400">ⓘ</span>
                            </div>
                        }
                        value={formData.status}
                        onChange={val => setFormData({...formData, status: val})}
                        options={[
                            { value: 'PENDING', label: 'Pending' },
                            { value: 'IN_PROGRESS', label: 'In Progress' },
                            { value: 'COMPLETED', label: 'Completed' },
                            { value: 'CANCELLED', label: 'Cancelled' },
                        ]}
                    />
                </div>

                {/* Row 2 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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

                {/* Row 3: Related To */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <Select
                        label="Related To"
                        value="Lead"
                        onChange={() => {}}
                        options={[{ value: 'Lead', label: 'Lead' }]}
                    />
                    {!prefilledLeadId ? (
                        <div className="relative pt-[22px]">
                            <div className="relative">
                                <Input
                                    placeholder="Search and select lead..."
                                    value={leadSearchTerm}
                                    onChange={e => {
                                        setLeadSearchTerm(e.target.value)
                                        setIsDropdownOpen(true)
                                    }}
                                    onFocus={() => setIsDropdownOpen(true)}
                                    onBlur={() => setTimeout(() => setIsDropdownOpen(false), 200)}
                                />
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                                    <Search size={16} />
                                </div>
                            </div>
                            {isDropdownOpen && leads.length > 0 && (
                                <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-md shadow-xl max-h-48 overflow-y-auto">
                                    {leads.map(lead => (
                                        <div 
                                            key={lead._id}
                                            onClick={() => {
                                                setFormData({...formData, leadId: lead._id})
                                                setLeadSearchTerm(`${lead.leadNumber || ''} - ${lead.contact?.firstName || ''} ${lead.contact?.lastName || ''}`.trim())
                                                setIsDropdownOpen(false)
                                            }}
                                            className="px-3 py-2 cursor-pointer hover:bg-slate-50 border-b border-slate-100 last:border-0 flex justify-between items-center"
                                        >
                                            <div className="font-medium text-slate-800">{lead.contact?.name || `${lead.contact?.firstName || ''} ${lead.contact?.lastName || ''}`.trim() || 'Unknown Lead'}</div>
                                            {lead.leadNumber && (
                                                <div className="text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                                    {lead.leadNumber}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="pt-[22px]">
                            <Input value={leadSearchTerm} disabled />
                        </div>
                    )}
                </div>

                {/* Selected Lead UI logic is hidden now because search input acts as the display */}

                {/* Row 4: Assign To */}
                <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Assign To <span className="text-red-500">*</span></label>
                    <Select
                        required
                        value={formData.assignedTo}
                        onChange={val => setFormData({...formData, assignedTo: val})}
                        options={[
                            { value: '', label: 'Select User' },
                            ...users.map(u => ({ 
                                value: u._id, 
                                label: u.name,
                                avatar: u.avatar,
                                avatarPlaceholder: !u.avatar && u.name ? u.name.charAt(0).toUpperCase() : null
                            }))
                        ]}
                    />
                </div>

                {/* Row 5: Due Date */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-end">
                    <div className="flex flex-col gap-1.5">
                        <label className="block text-xs font-semibold text-slate-700">Due Date</label>
                        <div className="flex items-center gap-4">
                            <div className="flex-1">
                                <Input
                                    type="date"
                                    value={formData.dueDate}
                                    onChange={e => setFormData({...formData, dueDate: e.target.value})}
                                    minDate={new Date()}
                                    disabled={formData.noDueDate}
                                />
                            </div>
                            <label className="flex items-center gap-2 cursor-pointer shrink-0">
                                <input 
                                    type="checkbox" 
                                    className="rounded text-primary border-slate-300 focus:ring-primary h-4 w-4"
                                    checked={formData.noDueDate}
                                    onChange={(e) => setFormData({...formData, noDueDate: e.target.checked})}
                                />
                                <span className="text-sm font-medium text-slate-700">No due date</span>
                            </label>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">Due Time</label>
                        <Input
                            type="time"
                            value={formData.dueTime}
                            onChange={e => setFormData({...formData, dueTime: e.target.value})}
                            disabled={formData.noDueDate}
                        />
                    </div>
                </div>

                {/* Row 6: Description */}
                <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Description (Optional)</label>
                    <div className="relative">
                        <textarea
                            className="w-full text-sm rounded-lg border border-slate-200 bg-white text-slate-800 px-3 py-2 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all min-h-[100px] resize-none"
                            maxLength={500}
                            placeholder="Describe the task in detail..."
                            value={formData.description}
                            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                        />
                        <span className="absolute bottom-2 right-3 text-[10px] text-slate-400 font-medium">
                            {formData.description.length} / 500
                        </span>
                    </div>
                </div>

                {/* Row 7: Attach files */}
                <div>
                    <input 
                        type="file" 
                        multiple 
                        ref={fileInputRef} 
                        className="hidden" 
                        onChange={handleAttachmentUpload} 
                        accept=".jpg,.jpeg,.png,.webp,.gif,.mp4,.mov,.avi,.mkv,.pdf,.txt,.doc,.docx,.mp3,.aac,.ogg,.wav,.webm,.3gp,image/*,video/*,audio/*,application/pdf,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    />
                    <div className={`border border-slate-200 rounded-lg p-4 flex items-center justify-between transition-colors bg-white hover:bg-slate-50 ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}>
                        <div className="flex items-center gap-3">
                            <div className="text-indigo-600 bg-indigo-50 p-2.5 rounded-full shrink-0">
                                <Paperclip size={20} />
                            </div>
                            <div>
                                <div className="text-sm font-semibold text-slate-800">Attach files (Optional)</div>
                                <div className="text-xs text-slate-500 mt-0.5">{isUploading ? 'Uploading...' : 'Upload documents or images (Max. 10 MB)'}</div>
                            </div>
                        </div>
                        <button 
                            type="button" 
                            onClick={() => fileInputRef.current?.click()}
                            className="flex items-center gap-2 border border-slate-200 rounded-lg px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
                        >
                            <Upload size={16} className="text-indigo-600" /> Choose File
                        </button>
                    </div>

                    {/* Uploaded attachments list */}
                    {formData.attachments.length > 0 && (
                        <div className="mt-3 space-y-2">
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
                                <div key={idx} className={`flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg shadow-sm group transition-colors ${border}`}>
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <div className={`w-10 h-10 rounded flex items-center justify-center shrink-0 ${color}`}>
                                            <Icon size={20} />
                                        </div>
                                        <div className="flex flex-col truncate">
                                            <span className="text-sm font-medium text-slate-800 truncate">{name}</span>
                                            <span className="text-xs text-slate-500">
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
                                            className="p-1.5 rounded border border-slate-200 hover:border-indigo-600 hover:text-indigo-600 bg-white text-slate-400 transition-colors"
                                            title="View"
                                        >
                                            <Eye size={16} />
                                        </button>
                                        <button 
                                            type="button"
                                            onClick={() => setFormData(prev => ({...prev, attachments: prev.attachments.filter((_, i) => i !== idx)}))}
                                            className="p-1.5 rounded border border-slate-200 hover:border-red-500 hover:text-red-500 bg-white text-slate-400 transition-colors"
                                            title="Delete"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            )})}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-6">
                    <Button variant="secondary" type="button" onClick={onClose} className="px-6 py-2 bg-white hover:bg-slate-50 text-slate-700 border-slate-200">
                        Cancel
                    </Button>
                    <Button variant="primary" type="submit" disabled={isCreating || isUpdating} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700">
                        {taskToEdit ? 'Update Task' : 'Create Task'}
                    </Button>
                </div>
            </form>
        </Modal>
    )
}
