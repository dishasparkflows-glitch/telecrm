import React, { useState } from 'react'
import { Calendar, CheckCircle, Clock, Plus, Edit2, XCircle } from 'lucide-react'
import Button from '../../../components/ui/Button'
import Badge from '../../../components/ui/Badge'
import { useGetFollowUpsQuery, useCancelFollowUpMutation } from '../../../features/leads/followUpApi'
import ScheduleFollowUpModal from './ScheduleFollowUpModal'
import CompleteFollowUpModal from './CompleteFollowUpModal'
import RescheduleFollowUpModal from './RescheduleFollowUpModal'
import ConfirmModal from '../../../components/ui/ConfirmModal'
import { useToast } from '../../../components/ui/Toast'

const FollowUpCard = ({ lead }) => {
    const { addToast } = useToast()
    const { data: followUpsData, isLoading } = useGetFollowUpsQuery({ leadId: lead?._id, status: 'upcoming' }, { skip: !lead?._id })
    const [cancelFollowUp] = useCancelFollowUpMutation()

    const activeFollowUp = followUpsData?.data?.[0] // We get the closest upcoming one

    const [isScheduleOpen, setIsScheduleOpen] = useState(false)
    const [isCompleteOpen, setIsCompleteOpen] = useState(false)
    const [isRescheduleOpen, setIsRescheduleOpen] = useState(false)
    const [isCancelOpen, setIsCancelOpen] = useState(false)

    const handleCancel = async () => {
        try {
            await cancelFollowUp({ id: activeFollowUp._id, cancelReason: 'User cancelled from UI' }).unwrap()
            addToast('Follow-up cancelled', 'success')
            setIsCancelOpen(false)
        } catch (error) {
            addToast(error.data?.message || 'Failed to cancel follow-up', 'error')
        }
    }

    return (
        <>
            <div className="bg-white dark:bg-[var(--vz-card-bg)] rounded-lg border border-[var(--vz-border)] shadow-sm p-4 mb-4">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-[var(--vz-border)]">
                    <h6 className="text-xs font-bold text-[var(--vz-heading)] uppercase tracking-wider flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-primary" />
                        Follow-up
                    </h6>
                </div>

                {isLoading ? (
                    <div className="animate-pulse space-y-3">
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
                    </div>
                ) : activeFollowUp ? (
                    <div className="space-y-4">
                        <div className="flex items-start justify-between">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <Badge variant="primary" className="capitalize">{activeFollowUp.type}</Badge>
                                    <span className="text-xs font-semibold text-[var(--vz-text)]">
                                        {new Date(activeFollowUp.scheduledAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1.5 text-sm font-bold text-primary">
                                    <Clock className="w-4 h-4" />
                                    {new Date(activeFollowUp.scheduledAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                </div>
                            </div>
                        </div>

                        {activeFollowUp.note && (
                            <p className="text-sm text-[var(--vz-text-muted)] bg-primary/5 p-2 rounded border border-[var(--vz-border)]">
                                {activeFollowUp.note}
                            </p>
                        )}

                        <div className="grid grid-cols-2 gap-2 pt-2">
                            <Button 
                                variant="success" 
                                className="w-full text-xs py-1.5"
                                onClick={() => setIsCompleteOpen(true)}
                                icon={<CheckCircle className="w-3.5 h-3.5" />}
                            >
                                Complete
                            </Button>
                            <Button 
                                variant="soft" 
                                className="w-full text-xs py-1.5 bg-warning/10 text-warning hover:bg-warning/20 border-0"
                                onClick={() => setIsRescheduleOpen(true)}
                                icon={<Edit2 className="w-3.5 h-3.5" />}
                            >
                                Reschedule
                            </Button>
                        </div>
                        <div className="text-center">
                            <button 
                                onClick={() => setIsCancelOpen(true)}
                                className="text-xs text-danger hover:underline inline-flex items-center gap-1 mt-1"
                            >
                                <XCircle className="w-3 h-3" /> Cancel
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-4">
                        <p className="text-sm text-[var(--vz-text-muted)] mb-3">No upcoming follow-ups scheduled.</p>
                        <Button 
                            variant="primary" 
                            size="sm" 
                            className="w-full"
                            onClick={() => setIsScheduleOpen(true)}
                            icon={<Plus className="w-4 h-4" />}
                        >
                            Schedule Follow-up
                        </Button>
                    </div>
                )}
            </div>

            {/* Modals */}
            <ScheduleFollowUpModal 
                isOpen={isScheduleOpen} 
                onClose={() => setIsScheduleOpen(false)} 
                lead={lead} 
            />
            
            {activeFollowUp && (
                <>
                    <CompleteFollowUpModal 
                        isOpen={isCompleteOpen} 
                        onClose={() => setIsCompleteOpen(false)} 
                        followUp={activeFollowUp}
                        lead={lead}
                    />
                    <RescheduleFollowUpModal 
                        isOpen={isRescheduleOpen} 
                        onClose={() => setIsRescheduleOpen(false)} 
                        followUp={activeFollowUp}
                        lead={lead}
                    />
                    <ConfirmModal
                        isOpen={isCancelOpen}
                        onClose={() => setIsCancelOpen(false)}
                        title="Cancel Follow-up?"
                        message={`Are you sure you want to cancel this ${activeFollowUp.type} follow-up scheduled for ${new Date(activeFollowUp.scheduledAt).toLocaleString()}?`}
                        confirmText="Cancel Follow-up"
                        confirmVariant="danger"
                        onConfirm={handleCancel}
                    />
                </>
            )}
        </>
    )
}

export default FollowUpCard
