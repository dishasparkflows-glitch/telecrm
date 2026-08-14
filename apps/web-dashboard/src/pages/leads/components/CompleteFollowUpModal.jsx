import React, { useState } from 'react'
import Modal from '../../../components/ui/Modal'
import Input from '../../../components/ui/Input'
import Select from '../../../components/ui/Select'
import Button from '../../../components/ui/Button'
import { useCompleteFollowUpMutation } from '../../../features/leads/followUpApi'
import { useToast } from '../../../components/ui/Toast'

const CompleteFollowUpModal = ({ isOpen, onClose, followUp, lead }) => {
    const { addToast } = useToast()
    const [completeFollowUp, { isLoading }] = useCompleteFollowUpMutation()

    const [form, setForm] = useState({
        outcome: 'Interested',
        note: '',
        scheduleNext: false,
        nextDate: '',
        nextTime: '',
        nextType: 'call'
    })

    const handleSubmit = async (e) => {
        e.preventDefault()

        const payload = {
            note: `Outcome: ${form.outcome}${form.note ? `\nDetails: ${form.note}` : ''}`
        }

        if (form.scheduleNext) {
            if (!form.nextDate || !form.nextTime) {
                return addToast('Please select date and time for the next follow-up', 'error')
            }
            payload.nextFollowUp = {
                type: form.nextType,
                scheduledAt: new Date(`${form.nextDate}T${form.nextTime}`).toISOString(),
                assignedUserId: followUp.assignedUserId, // Default to same user
                reminderMinutesBefore: 15
            }
        }

        try {
            await completeFollowUp({ id: followUp._id, ...payload }).unwrap()
            addToast('Follow-up completed successfully', 'success')
            onClose()
        } catch (error) {
            addToast(error.data?.message || 'Failed to complete follow-up', 'error')
        }
    }

    if (!followUp) return null

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Complete Follow-up" size="md">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="bg-primary/5 p-3 -mx-6 -mt-4 mb-4 border-b border-[var(--vz-border)]">
                    <p className="text-xs text-[var(--vz-text-muted)] mb-1">Completing Follow-up for</p>
                    <p className="text-sm font-semibold text-primary">{lead?.fullName || 'Unknown Lead'}</p>
                    <p className="text-xs text-[var(--vz-text)] mt-1 capitalize">
                        {followUp.type} • {new Date(followUp.scheduledAt).toLocaleString()}
                    </p>
                </div>

                <Select
                    label="Outcome"
                    value={form.outcome}
                    onChange={(val) => setForm(prev => ({ ...prev, outcome: val }))}
                    options={[
                        { value: 'Interested', label: 'Interested' },
                        { value: 'Not Interested', label: 'Not Interested' },
                        { value: 'No Answer', label: 'No Answer' },
                        { value: 'Call Back Later', label: 'Call Back Later' },
                        { value: 'Meeting Booked', label: 'Meeting Booked' },
                        { value: 'Other', label: 'Other' },
                    ]}
                    required
                />

                <Input
                    label="Notes"
                    type="textarea"
                    rows={3}
                    placeholder="E.g., Customer requested quotation..."
                    value={form.note}
                    onChange={(e) => setForm(prev => ({ ...prev, note: e.target.value }))}
                />

                <div className="border-t border-[var(--vz-border)] pt-4 mt-2">
                    <label className="flex items-center gap-2 cursor-pointer mb-3">
                        <input 
                            type="checkbox" 
                            className="rounded border-[var(--vz-border)] text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                            checked={form.scheduleNext}
                            onChange={(e) => setForm(prev => ({ ...prev, scheduleNext: e.target.checked }))}
                        />
                        <span className="text-sm font-medium text-[var(--vz-heading)]">Schedule next follow-up?</span>
                    </label>

                    {form.scheduleNext && (
                        <div className="space-y-3 pl-6 border-l-2 border-primary/20 ml-2">
                            <Select
                                label="Type"
                                value={form.nextType}
                                onChange={(val) => setForm(prev => ({ ...prev, nextType: val }))}
                                options={[
                                    { value: 'call', label: '📞 Call' },
                                    { value: 'whatsapp', label: '💬 WhatsApp' },
                                    { value: 'email', label: '📧 Email' },
                                    { value: 'other', label: '📝 Other' },
                                ]}
                            />
                            <div className="grid grid-cols-2 gap-3">
                                <Input
                                    label="Date"
                                    type="date"
                                    value={form.nextDate}
                                    onChange={(e) => setForm(prev => ({ ...prev, nextDate: e.target.value }))}
                                    required={form.scheduleNext}
                                />
                                <Input
                                    label="Time"
                                    type="time"
                                    value={form.nextTime}
                                    onChange={(e) => setForm(prev => ({ ...prev, nextTime: e.target.value }))}
                                    required={form.scheduleNext}
                                />
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-[var(--vz-border)]">
                    <Button variant="secondary" onClick={onClose} type="button">Cancel</Button>
                    <Button variant="success" type="submit" isLoading={isLoading}>Complete Follow-up</Button>
                </div>
            </form>
        </Modal>
    )
}

export default CompleteFollowUpModal
