import React, { useState } from 'react'
import Modal from '../../../components/ui/Modal'
import Input from '../../../components/ui/Input'
import Select from '../../../components/ui/Select'
import Button from '../../../components/ui/Button'
import { Phone, MessageCircle, Mail, Calendar, X, ChevronDown } from 'lucide-react'
import { useGetAllUsersListQuery } from '../../../features/users/userApi'
import { useGetActiveLeadsQuery } from '../../../features/leads/leadApi'
import { useScheduleFollowUpMutation } from '../../../features/leads/followUpApi'
import { useToast } from '../../../components/ui/Toast'
import { useSelector } from 'react-redux'
import { useGetReminderSettingsQuery } from '../../../features/notifications/notificationApi'

const ScheduleFollowUpModal = ({ isOpen, onClose, lead }) => {
    const addToast = useToast()
    const { activeBranchId } = useSelector(state => state.auth)
    const { data: usersData } = useGetAllUsersListQuery({ branchId: activeBranchId })
    const users = usersData?.data || []

    const { data: leadsData } = useGetActiveLeadsQuery({}, { skip: !!lead || !isOpen })
    const activeLeads = leadsData?.data || []

    const [scheduleFollowUp, { isLoading }] = useScheduleFollowUpMutation()
    const { data: reminderSettingsResp } = useGetReminderSettingsQuery(undefined, { skip: !isOpen })

    let defaultReminder = 15;
    if (reminderSettingsResp?.data?.defaultReminders?.followUp) {
        const followUpSettings = reminderSettingsResp.data.defaultReminders.followUp;
        if (!followUpSettings.enabled) defaultReminder = -1;
        else defaultReminder = followUpSettings.offsetMinutes;
    }

    const [form, setForm] = useState({
        leadId: lead?._id || '',
        type: 'call',
        scheduledDate: '',
        scheduledTime: '',
        assignedUserId: lead?.assignedTo || '',
        reminderMinutesBefore: defaultReminder,
        note: ''
    })

    const [prevSettingsData, setPrevSettingsData] = useState(null);
    if (isOpen && reminderSettingsResp?.data && reminderSettingsResp.data !== prevSettingsData) {
        setPrevSettingsData(reminderSettingsResp.data);
        setForm(prev => ({ ...prev, reminderMinutesBefore: defaultReminder }));
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!form.leadId) {
            return addToast('Please select a lead', 'error')
        }
        if (!form.scheduledDate || !form.scheduledTime) {
            return addToast('Please select a date and time', 'error')
        }

        const scheduledAt = new Date(`${form.scheduledDate}T${form.scheduledTime}`).toISOString()

        try {
            await scheduleFollowUp({
                leadId: form.leadId,
                type: form.type,
                scheduledAt,
                assignedUserId: form.assignedUserId,
                reminderMinutesBefore: Number(form.reminderMinutesBefore),
                note: form.note
            }).unwrap()
            
            addToast('Follow-up scheduled successfully', 'success')
            onClose()
        } catch (error) {
            addToast(error.data?.message || 'Failed to schedule follow-up', 'error')
        }
    }

    const typeOptions = [
        { id: 'call', label: 'Call', icon: Phone, color: 'text-blue-500', activeClass: 'border-blue-500 text-blue-600 bg-blue-50' },
        { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, color: 'text-green-500', activeClass: 'border-green-500 text-green-600 bg-green-50' },
        { id: 'email', label: 'Email', icon: Mail, color: 'text-purple-500', activeClass: 'border-purple-500 text-purple-600 bg-purple-50' },
        { id: 'meeting', label: 'Meeting', icon: Calendar, color: 'text-orange-500', activeClass: 'border-orange-500 text-orange-600 bg-orange-50' },
    ]

    const getLeadName = (l) => l?.fullName || (l?.contact ? `${l.contact.firstName || ''} ${l.contact.lastName || ''}`.trim() : '') || 'Unknown'
    const getInitials = (name) => name?.substring(0, 2).toUpperCase() || 'L'

    const selectedLeadObj = lead || activeLeads.find(l => l._id === form.leadId)
    const selectedUserObj = users.find(u => u._id === form.assignedUserId)

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={
            <div className="flex flex-col">
                <span className="text-lg font-semibold text-slate-900">Schedule Follow-up</span>
                <span className="text-xs font-normal text-slate-500">Schedule a follow-up for this lead</span>
            </div>
        } size="md">
            <form onSubmit={handleSubmit} className="space-y-5">
                
                {/* Lead Display/Select */}
                <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Lead <span className="text-red-500">*</span></label>
                    {selectedLeadObj ? (
                        <div className="flex items-center justify-between p-2.5 border border-slate-200 rounded-lg bg-white">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">
                                    {getInitials(getLeadName(selectedLeadObj))}
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-sm font-semibold text-slate-900">{getLeadName(selectedLeadObj)}</span>
                                    <span className="text-xs text-slate-500">
                                        {selectedLeadObj.contact?.phone || '+91 98765 43210'} • {selectedLeadObj.stage || 'New Lead'}
                                    </span>
                                </div>
                            </div>
                            {!lead && (
                                <div className="flex items-center gap-2 text-slate-400">
                                    <button type="button" onClick={() => setForm(prev => ({...prev, leadId: ''}))} className="hover:text-slate-600">
                                        <X size={16} />
                                    </button>
                                    <ChevronDown size={16} />
                                </div>
                            )}
                        </div>
                    ) : (
                        <Select
                            value={form.leadId}
                            onChange={(val) => setForm(prev => ({ ...prev, leadId: val }))}
                            options={activeLeads.map(l => ({ value: l._id, label: getLeadName(l) }))}
                            required
                        />
                    )}
                </div>

                {/* Follow-up Type Segmented Buttons */}
                <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Follow-up Type <span className="text-red-500">*</span></label>
                    <div className="grid grid-cols-4 gap-2">
                        {typeOptions.map(opt => {
                            const Icon = opt.icon
                            const isActive = form.type === opt.id
                            return (
                                <button
                                    key={opt.id}
                                    type="button"
                                    onClick={() => setForm(prev => ({ ...prev, type: opt.id }))}
                                    className={`flex items-center justify-center gap-1.5 py-2 px-1 rounded-lg border text-sm font-medium transition-colors ${
                                        isActive 
                                            ? opt.activeClass 
                                            : 'border-slate-200 text-slate-600 bg-white hover:bg-slate-50'
                                    }`}
                                >
                                    <Icon size={16} className={isActive ? '' : opt.color} />
                                    <span>{opt.label}</span>
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* Schedule For */}
                <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Schedule For <span className="text-red-500">*</span></label>
                    <div className="grid grid-cols-2 gap-3">
                        <Input
                            type="date"
                            value={form.scheduledDate}
                            onChange={(e) => setForm(prev => ({ ...prev, scheduledDate: e.target.value }))}
                            minDate={new Date()}
                            required
                        />
                        <Input
                            type="time"
                            value={form.scheduledTime}
                            onChange={(e) => setForm(prev => ({ ...prev, scheduledTime: e.target.value }))}
                            required
                        />
                    </div>
                </div>

                {/* Assigned To */}
                <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Assigned To <span className="text-red-500">*</span></label>
                    <Select
                        value={form.assignedUserId}
                        onChange={(val) => setForm(prev => ({ ...prev, assignedUserId: val }))}
                        options={users.map(u => ({ 
                            value: u._id, 
                            label: u.name,
                            avatar: u.avatar,
                            avatarPlaceholder: !u.avatar && u.name ? u.name.charAt(0).toUpperCase() : null
                        }))}
                        required
                    />
                </div>

                {/* Note */}
                <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Note / Agenda</label>
                    <div className="relative">
                        <textarea
                            className="w-full text-sm rounded-lg border border-[var(--vz-input-border)] bg-[var(--vz-input-bg)] text-[var(--vz-body-color)] px-3 py-2 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                            rows={3}
                            maxLength={500}
                            placeholder="E.g., Discuss pricing, answer remaining questions, send proposal..."
                            value={form.note}
                            onChange={(e) => setForm(prev => ({ ...prev, note: e.target.value }))}
                        />
                        <span className="absolute bottom-2 right-2 text-[10px] text-slate-400">
                            {form.note.length}/500
                        </span>
                    </div>
                </div>

                {/* Footer Buttons */}
                <div className="flex justify-end gap-3 pt-2">
                    <Button variant="secondary" onClick={onClose} type="button" className="w-full sm:w-auto">Cancel</Button>
                    <Button variant="primary" type="submit" isLoading={isLoading} className="w-full sm:w-auto flex items-center justify-center gap-2">
                        <Calendar size={16} />
                        Schedule Follow-up
                    </Button>
                </div>
            </form>
        </Modal>
    )
}

export default ScheduleFollowUpModal
