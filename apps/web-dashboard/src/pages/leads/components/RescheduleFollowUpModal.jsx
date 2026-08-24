import React, { useState } from 'react'
import Modal from '../../../components/ui/Modal'
import Input from '../../../components/ui/Input'
import Button from '../../../components/ui/Button'
import { useRescheduleFollowUpMutation } from '../../../features/leads/followUpApi'
import { useToast } from '../../../components/ui/Toast'

const RescheduleFollowUpModal = ({ isOpen, onClose, followUp, lead }) => {
    const { addToast } = useToast()
    const [rescheduleFollowUp, { isLoading }] = useRescheduleFollowUpMutation()

    const [form, setForm] = useState({
        newDate: '',
        newTime: '',
        reason: ''
    })

    const handleSubmit = async (e) => {
        e.preventDefault()

        if (!form.newDate || !form.newTime) {
            return addToast('Please select a new date and time', 'error')
        }

        const scheduledAt = new Date(`${form.newDate}T${form.newTime}`).toISOString()

        try {
            await rescheduleFollowUp({
                id: followUp._id,
                scheduledAt,
                rescheduleReason: form.reason
            }).unwrap()
            
            addToast('Follow-up rescheduled successfully', 'success')
            onClose()
        } catch (error) {
            addToast(error.data?.message || 'Failed to reschedule follow-up', 'error')
        }
    }

    if (!followUp) return null

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Reschedule Follow-up" size="md">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="bg-warning/10 p-3 -mx-6 -mt-4 mb-4 border-b border-warning/20">
                    <p className="text-xs text-warning/80 mb-1">Current Schedule</p>
                    <p className="text-sm font-bold text-warning capitalize">
                        {followUp.type} • {new Date(followUp.scheduledAt).toLocaleString()}
                    </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <Input
                        label="New Date"
                        type="date"
                        value={form.newDate}
                        onChange={(e) => setForm(prev => ({ ...prev, newDate: e.target.value }))}
                        minDate={new Date()}
                        required
                    />
                    <Input
                        label="New Time"
                        type="time"
                        value={form.newTime}
                        onChange={(e) => setForm(prev => ({ ...prev, newTime: e.target.value }))}
                        required
                    />
                </div>

                <Input
                    label="Reason (Optional)"
                    type="textarea"
                    rows={2}
                    placeholder="E.g., Customer unavailable..."
                    value={form.reason}
                    onChange={(e) => setForm(prev => ({ ...prev, reason: e.target.value }))}
                />

                <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-[var(--vz-border)]">
                    <Button variant="secondary" onClick={onClose} type="button">Cancel</Button>
                    <Button variant="primary" type="submit" isLoading={isLoading}>Reschedule</Button>
                </div>
            </form>
        </Modal>
    )
}

export default RescheduleFollowUpModal
