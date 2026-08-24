import React, { useState } from 'react'
import Modal from '../../../components/ui/Modal'
import Input from '../../../components/ui/Input'
import Select from '../../../components/ui/Select'
import Button from '../../../components/ui/Button'
import { useGetAllUsersListQuery } from '../../../features/users/userApi'
import { useScheduleFollowUpMutation } from '../../../features/leads/followUpApi'
import { useToast } from '../../../components/ui/Toast'
import { useSelector } from 'react-redux'
import { useGetReminderSettingsQuery } from '../../../features/notifications/notificationApi'

const ScheduleFollowUpModal = ({ isOpen, onClose, lead }) => {
    const { addToast } = useToast()
    const { activeBranchId } = useSelector(state => state.auth)
    const { data: usersData } = useGetAllUsersListQuery({ branchId: activeBranchId })
    const users = usersData?.data || []

    const [scheduleFollowUp, { isLoading }] = useScheduleFollowUpMutation()
    const { data: reminderSettingsResp } = useGetReminderSettingsQuery(undefined, { skip: !isOpen })

    let defaultReminder = 15;
    if (reminderSettingsResp?.data?.defaultReminders?.followUp) {
        const followUpSettings = reminderSettingsResp.data.defaultReminders.followUp;
        if (!followUpSettings.enabled) defaultReminder = -1; // -1 to indicate disabled
        else defaultReminder = followUpSettings.offsetMinutes;
    }

    const [form, setForm] = useState({
        type: 'call',
        scheduledDate: '',
        scheduledTime: '',
        assignedUserId: lead?.assignedTo || '',
        reminderMinutesBefore: defaultReminder,
        note: ''
    })

    // Update form when defaults load if the form hasn't been modified yet
    React.useEffect(() => {
        if (isOpen && reminderSettingsResp?.data) {
            setForm(prev => ({ ...prev, reminderMinutesBefore: defaultReminder }));
        }
    }, [reminderSettingsResp, isOpen]);

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!form.scheduledDate || !form.scheduledTime) {
            return addToast('Please select a date and time', 'error')
        }

        const scheduledAt = new Date(`${form.scheduledDate}T${form.scheduledTime}`).toISOString()

        try {
            await scheduleFollowUp({
                leadId: lead._id,
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

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Schedule Follow-up" size="md">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="bg-primary/5 p-3 -mx-6 -mt-4 mb-4 border-b border-[var(--vz-border)]">
                    <p className="text-sm font-semibold text-primary">Lead: {lead?.fullName || lead?.contact?.name || 'Unknown'}</p>
                </div>
                
                <Select
                    label="Type"
                    value={form.type}
                    onChange={(val) => setForm(prev => ({ ...prev, type: val }))}
                    options={[
                        { value: 'call', label: '📞 Call' },
                        { value: 'whatsapp', label: '💬 WhatsApp' },
                        { value: 'email', label: '📧 Email' },
                        { value: 'other', label: '📝 Other' },
                    ]}
                    required
                />
                
                <div className="grid grid-cols-2 gap-4">
                    <Input
                        label="Date"
                        type="date"
                        value={form.scheduledDate}
                        onChange={(e) => setForm(prev => ({ ...prev, scheduledDate: e.target.value }))}
                        minDate={new Date()}
                        required
                    />
                    <Input
                        label="Time"
                        type="time"
                        value={form.scheduledTime}
                        onChange={(e) => setForm(prev => ({ ...prev, scheduledTime: e.target.value }))}
                        required
                    />
                </div>

                <Select
                    label="Assigned To"
                    value={form.assignedUserId}
                    onChange={(val) => setForm(prev => ({ ...prev, assignedUserId: val }))}
                    options={users.map(u => ({ value: u._id, label: u.name }))}
                    required
                />


                <Input
                    label="Note"
                    type="textarea"
                    rows={3}
                    placeholder="E.g., Discuss quotation..."
                    value={form.note}
                    onChange={(e) => setForm(prev => ({ ...prev, note: e.target.value }))}
                />

                <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-[var(--vz-border)]">
                    <Button variant="secondary" onClick={onClose} type="button">Cancel</Button>
                    <Button variant="primary" type="submit" isLoading={isLoading}>Schedule Follow-up</Button>
                </div>
            </form>
        </Modal>
    )
}

export default ScheduleFollowUpModal
