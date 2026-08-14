import { useState } from 'react'
import { useDispatch } from 'react-redux'
import { useParams, useNavigate } from 'react-router-dom'
import { openDialer } from '../../slices/uiSlice'
import { useGetLeadQuery, useGetLeadTimelineQuery, useUpdateLeadMutation, useAddNoteMutation, useAssignLeadMutation } from '../../features/leads/leadApi'
import { useGetAllUsersListQuery } from '../../features/users/userApi'
import { useGetCustomFieldsQuery } from '../../features/custom-fields/customFieldApi'
import { useGetProfileQuery } from '../../features/tenant/tenantApi'
import { useGetChatQuery } from '../../features/whatsapp/whatsappApi'
import { useGetCallLogsQuery } from '../../features/calls/callApi'

import PageHeader from '../../components/layout/PageHeader'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Tabs from '../../components/ui/Tabs'
import Modal from '../../components/ui/Modal'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import { useToast } from '../../components/ui/Toast'
import FollowUpCard from './components/FollowUpCard'
import {
  Phone, MessageSquare, Mail, MapPin, Building2, Calendar, Star,
  Edit3, Send, Clock, StickyNote, Activity, Megaphone
} from 'lucide-react'

const stageColors = {
  new: 'primary', contacted: 'info', qualified: 'warning',
  negotiation: 'warning', won: 'success', lost: 'danger',
}

const defaultStages = ['new', 'contacted', 'qualified', 'negotiation', 'won', 'lost']

export default function LeadDetail() {
  const { id } = useParams()
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const toast = useToast()
  const [activeTab, setActiveTab] = useState('overview')
  const [noteText, setNoteText] = useState('')
  const [showEdit, setShowEdit] = useState(false)
  const [editForm, setEditForm] = useState(null)

  const { data, isLoading } = useGetLeadQuery(id)
  const { data: timelineData, isFetching: timelineFetching } = useGetLeadTimelineQuery({ id, limit: 100 }, { skip: activeTab !== 'timeline' })
  const { data: usersData } = useGetAllUsersListQuery()
  const { data: fieldsData } = useGetCustomFieldsQuery({ entity: 'Lead' })
  const { data: profileData } = useGetProfileQuery()
  const { data: whatsappChatData, isFetching: whatsappFetching } = useGetChatQuery(id, { skip: activeTab !== 'whatsapp' })
  const { data: callLogsData, isFetching: callsFetching } = useGetCallLogsQuery({ leadId: id, limit: 50 }, { skip: activeTab !== 'calls' })
  const [updateLead] = useUpdateLeadMutation()
  const [addNote, { isLoading: addingNote }] = useAddNoteMutation()
  const [assignLead] = useAssignLeadMutation()


  const lead = data?.data
  const users = usersData?.data || []
  const timeline = timelineData?.data || []
  const whatsappMessages = whatsappChatData?.data || []
  const callLogs = callLogsData?.data || []
  const configuredStages = profileData?.data?.pipelineStages?.length
    ? [...profileData.data.pipelineStages].sort((a, b) => (a.order || 0) - (b.order || 0)).map((s) => s.slug)
    : defaultStages
  const assignedToId = typeof lead?.assignedTo === 'object' ? lead.assignedTo?._id : lead?.assignedTo
  const assignedUser = users.find((u) => u._id === assignedToId)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!lead) {
    return (
      <div className="text-center py-20 text-[var(--vz-text-muted)]">Lead not found</div>
    )
  }
  const currentStage = lead.pipeline?.stage
  const currentExpectedValue = lead.lifecycle?.expectedValue ?? 0
  const currentFollowUpAt = lead.lifecycle?.followUpAt

  const handleStageChange = async (newStage) => {
    try {
      await updateLead({ id, pipeline: { stage: newStage } }).unwrap()
      toast('Stage updated', 'success')
    } catch { toast('Failed to update stage', 'error') }
  }

  const handleAddNote = async () => {
    if (!noteText.trim()) return
    try {
      await addNote({ id, text: noteText }).unwrap()
      setNoteText('')
      toast('Note added', 'success')
    } catch { toast('Failed to add note', 'error') }
  }

  const handleEditOpen = () => {
    setEditForm({
      contact: {
        firstName: lead.contact?.firstName || '',
        lastName: lead.contact?.lastName || '',
        email: lead.contact?.email || '',
        phone: lead.contact?.phone || '',
        company: lead.contact?.company || '',
      },
      lifecycle: {
        expectedValue: currentExpectedValue,
        followUpAt: currentFollowUpAt ? new Date(new Date(currentFollowUpAt).getTime() - new Date(currentFollowUpAt).getTimezoneOffset() * 60_000).toISOString().slice(0, 16) : '',
      },
      expectedValue: currentExpectedValue,
      followUpAt: currentFollowUpAt ? new Date(new Date(currentFollowUpAt).getTime() - new Date(currentFollowUpAt).getTimezoneOffset() * 60_000).toISOString().slice(0, 16) : '',
      customFields: lead.customFields || {}
    })
    setShowEdit(true)
  }

  const handleUpdateLead = async (e) => {
    e.preventDefault()
    if (!editForm.contact.firstName?.trim()) return toast('First name is required', 'error')
    if (!editForm.contact.lastName?.trim()) return toast('Last name is required', 'error')
    if (!editForm.contact.email?.trim()) return toast('Email is required', 'error')
    if (!editForm.contact.phone?.trim() || editForm.contact.phone.length !== 10) return toast('Phone number must be exactly 10 digits', 'error')
    
    const leadFields = fieldsData?.data || [];
    for (const field of leadFields) {
      if (field.isRequired && !editForm.customFields[field.name]) {
        return toast(`${field.label} is required`, 'error')
      }
    }

    try {
      await updateLead({ id, ...editForm }).unwrap()
      toast('Lead updated', 'success')
      setShowEdit(false)
    } catch { toast('Failed to update lead', 'error') }
  }

  const handleAssign = async (userId) => {
    try {
      await assignLead({ id, assignedTo: userId === '' ? null : userId }).unwrap()
      toast('Lead assigned', 'success')
    } catch { toast('Failed to assign', 'error') }
  }

  const handleCall = () => {
    if (lead.contact?.phone) {
      const fullPhone = lead.contact?.countryCode && lead.contact?.phone ? `${lead.contact.countryCode}${lead.contact.phone}` : lead.contact?.phone;
      dispatch(openDialer({ phone: fullPhone, leadId: lead._id }))
    }
  }


  const leadScoreVal = lead.scoring?.score ?? lead.score ?? 0
  const scoreColor = leadScoreVal >= 70 ? 'text-secondary' : leadScoreVal >= 40 ? 'text-warning' : 'text-danger'

  const tabs = [
    { key: 'overview', label: 'Overview', icon: Activity },
    { key: 'notes', label: 'Notes', icon: StickyNote, count: lead.notes?.length || 0 },
    { key: 'whatsapp', label: 'WhatsApp', icon: MessageSquare, count: whatsappChatData ? whatsappMessages.length : undefined },
    { key: 'calls', label: 'Calls', icon: Phone, count: callLogsData ? callLogs.length : undefined },
    { key: 'timeline', label: 'Timeline', icon: Clock },
  ]

  return (
    <>
      <PageHeader
        title={`${lead.contact?.firstName} ${lead.contact?.lastName}`}
        breadcrumbs={[
          { label: 'CRM', path: '/dashboard' },
          { label: 'Leads', path: '/leads' },
          { label: `${lead.contact?.firstName} ${lead.contact?.lastName}` },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Profile Card */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <div className="text-center pb-4 border-b border-[var(--vz-border)]">
              <div className="w-16 h-16 mx-auto rounded-full bg-primary/20 flex items-center justify-center text-xl font-bold text-primary mb-3">
                {lead.contact?.firstName?.[0]}{lead.contact?.lastName?.[0]}
              </div>
              <h4 className="text-lg font-semibold text-[var(--vz-heading)]">
                {lead.contact?.firstName} {lead.contact?.lastName}
              </h4>
              {lead.contact?.company && <p className="text-sm text-[var(--vz-text-muted)]">{lead.contact?.company}</p>}
              <div className="flex items-center justify-center gap-2 mt-2">
                <Badge color={stageColors[currentStage]}>{currentStage?.toUpperCase()}</Badge>
                <span className={`text-sm font-semibold ${scoreColor}`}>
                  <Star size={14} className="inline -mt-0.5" /> {leadScoreVal}
                </span>
                <button onClick={handleEditOpen} className="p-1 rounded hover:bg-primary/10 text-primary transition-colors" title="Edit details">
                  <Edit3 size={14} />
                </button>
              </div>
            </div>

            <div className="space-y-3 pt-4">
              {lead.contact?.email && (
                <div className="flex items-center gap-3 text-sm">
                  <Mail size={15} className="text-[var(--vz-text-muted)] shrink-0" />
                  <span className="text-[var(--vz-text)] truncate">{lead.contact?.email}</span>
                </div>
              )}
              {lead.contact?.phone && (
                <div className="flex items-center gap-3 text-sm">
                  <Phone size={15} className="text-[var(--vz-text-muted)] shrink-0" />
                  <span className="text-[var(--vz-text)]">{lead.contact?.countryCode ? `${lead.contact.countryCode} ` : ''}{lead.contact?.phone}</span>
                </div>
              )}
              {lead.contact?.company && (
                <div className="flex items-center gap-3 text-sm">
                  <Building2 size={15} className="text-[var(--vz-text-muted)] shrink-0" />
                  <span className="text-[var(--vz-text)]">{lead.contact?.company}</span>
                </div>
              )}
              {lead.source && (
                <div className="flex items-center gap-3 text-sm">
                  <MapPin size={15} className="text-[var(--vz-text-muted)] shrink-0" />
                  <span className="text-[var(--vz-text)] capitalize">{lead.source?.replace('_', ' ')}</span>
                </div>
              )}
              <div className="flex items-center gap-3 text-sm">
                <Calendar size={15} className="text-[var(--vz-text-muted)] shrink-0" />
                <span className="text-[var(--vz-text)]">{lead.meta?.createdAt || lead.createdAt ? new Date(lead.meta?.createdAt || lead.createdAt).toLocaleDateString() : '—'}</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 mt-4 pt-4 border-t border-[var(--vz-border)]">
              <Button variant="soft-primary" size="sm" className="flex-1" onClick={handleCall} disabled={!lead.contact?.phone}>
                <Phone size={14} /> Call
              </Button>
              <Button variant="soft-success" size="sm" className="flex-1" onClick={() => navigate(`/whatsapp?lead=${id}`)}>
                <MessageSquare size={14} /> WhatsApp
              </Button>
            </div>
          </Card>

          <FollowUpCard lead={lead} />

          {/* Stage Pipeline */}
          <Card>
            <Card.Header><Card.Title>Pipeline Stage</Card.Title></Card.Header>
            <div className="space-y-1.5">
              {configuredStages.map((s) => (
                <button
                  key={s}
                  onClick={() => handleStageChange(s)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-all
                    ${currentStage === s
                      ? 'bg-primary text-white font-medium'
                      : 'text-[var(--vz-text)] hover:bg-[var(--vz-input-bg)]'}`}
                >
                  <div className={`w-2 h-2 rounded-full ${currentStage === s ? 'bg-white' : 'bg-[var(--vz-text-muted)]'}`} />
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </Card>

          {/* Assign */}
          <Card>
            <Card.Header><Card.Title>Assigned To</Card.Title></Card.Header>
            <p className="text-xs text-[var(--vz-text-muted)] mb-2">
              Current: {assignedUser ? `${assignedUser.firstName || assignedUser.name || ''} ${assignedUser.lastName || ''}`.trim() : 'Unassigned'}
            </p>
            <Select
              value={assignedToId || ''}
              onChange={(val) => handleAssign(val)}
              options={[
                { value: '', label: 'Unassigned' },
                ...users.map((u) => ({ value: u._id, label: u.name || u.email }))
              ]}
            />
          </Card>
        </div>

        {/* Right: Tabs Content */}
        <div className="lg:col-span-2">
          <Card>
            <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} className="mb-4" />

            {activeTab === 'overview' && (
              <div className="space-y-4">
                {/* Custom Fields */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg bg-[var(--vz-input-bg)]">
                    <p className="text-xs text-[var(--vz-text-muted)] mb-1">Lead Score</p>
                    <p className={`text-xl font-bold ${scoreColor}`}>{leadScoreVal}/100</p>
                  </div>
                  <div className="p-3 rounded-lg bg-[var(--vz-input-bg)]">
                    <p className="text-xs text-[var(--vz-text-muted)] mb-1">Deal Value</p>
                    <p className="text-xl font-bold text-[var(--vz-heading)]">₹{currentExpectedValue.toLocaleString()}</p>
                  </div>
                </div>

                {(lead.origin?.provider || lead.firstTouch?.campaignName || lead.firstTouch?.formName) && (
                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-[var(--vz-text-muted)] uppercase flex items-center gap-1"><Megaphone size={13} /> Lead Attribution</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="p-3 rounded-lg border border-[var(--vz-border)]">
                        <p className="text-[10px] text-[var(--vz-text-muted)] uppercase">Provider / Source</p>
                        <p className="text-sm font-medium text-[var(--vz-heading)]">{lead.origin?.provider || lead.source || '—'} · {lead.origin?.sourceName || lead.sourceDetails || '—'}</p>
                      </div>
                      <div className="p-3 rounded-lg border border-[var(--vz-border)]">
                        <p className="text-[10px] text-[var(--vz-text-muted)] uppercase">Campaign</p>
                        <p className="text-sm font-medium text-[var(--vz-heading)]">{lead.firstTouch?.campaignName || lead.firstTouch?.campaignId || '—'}</p>
                      </div>
                      <div className="p-3 rounded-lg border border-[var(--vz-border)]">
                        <p className="text-[10px] text-[var(--vz-text-muted)] uppercase">Ad / Ad Set</p>
                        <p className="text-sm font-medium text-[var(--vz-heading)]">{lead.firstTouch?.adName || lead.firstTouch?.adId || '—'} · {lead.firstTouch?.adSetName || lead.firstTouch?.adSetId || '—'}</p>
                      </div>
                      <div className="p-3 rounded-lg border border-[var(--vz-border)]">
                        <p className="text-[10px] text-[var(--vz-text-muted)] uppercase">Lead Form</p>
                        <p className="text-sm font-medium text-[var(--vz-heading)]">{lead.firstTouch?.formName || lead.firstTouch?.formId || '—'}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Custom Fields Display */}
                {fieldsData?.data?.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-[var(--vz-text-muted)] uppercase">Custom Details</p>
                    <div className="grid grid-cols-2 gap-4">
                      {fieldsData.data.map(field => (
                        <div key={field._id} className="p-3 rounded-lg border border-[var(--vz-border)] bg-[var(--vz-body-bg)]/50">
                          <p className="text-[10px] text-[var(--vz-text-muted)] uppercase font-bold mb-1">{field.name}</p>
                          <p className="text-sm text-[var(--vz-heading)] font-medium">
                            {lead.customFields?.[field.name] || <span className="text-[var(--vz-text-muted)] italic">Not set</span>}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tags */}
                {lead.tags?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-[var(--vz-text-muted)] uppercase mb-2">Tags</p>
                    <div className="flex flex-wrap gap-1.5">
                      {lead.tags.map((tag) => (
                        <span key={tag} className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs">{tag}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent Notes Preview */}
                {lead.notes?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-[var(--vz-text-muted)] uppercase mb-2">Recent Notes</p>
                    {lead.notes.slice(-3).reverse().map((note, i) => (
                      <div key={i} className="flex gap-3 py-2 border-b border-[var(--vz-border)] last:border-0">
                        <div className="w-6 h-6 rounded-full bg-info/10 flex items-center justify-center shrink-0 mt-0.5">
                          <StickyNote size={12} className="text-info" />
                        </div>
                        <div>
                          <p className="text-sm text-[var(--vz-heading)]">{note.text}</p>
                          <p className="text-xs text-[var(--vz-text-muted)] mt-0.5">
                            {(typeof note.createdBy === 'object' ? note.createdBy?.contact?.name : null) || 'System'} · {note.createdAt ? new Date(note.createdAt).toLocaleDateString() : '—'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'notes' && (
              <div>
                {/* Add Note */}
                <div className="flex gap-2 mb-4">
                  <input
                    type="text"
                    placeholder="Add a note..."
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
                    className="flex-1 px-3 py-2 rounded-md border border-[var(--vz-input-border)] bg-[var(--vz-input-bg)]
                      text-sm text-[var(--vz-heading)] placeholder:text-[var(--vz-text-muted)] outline-none
                      focus:border-primary focus:ring-1 focus:ring-primary/30"
                  />
                  <Button size="sm" onClick={handleAddNote} disabled={addingNote || !noteText.trim()}>
                    <Send size={14} />
                  </Button>
                </div>

                {/* Notes List */}
                {(!lead.notes || lead.notes.length === 0) ? (
                  <p className="text-center text-sm text-[var(--vz-text-muted)] py-8">No notes yet. Add your first note above.</p>
                ) : (
                  <div className="space-y-0">
                    {[...lead.notes].reverse().map((note, i) => (
                      <div key={i} className="flex gap-3 py-3 border-b border-[var(--vz-border)] last:border-0">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <span className="text-xs font-semibold text-primary">
                            {(typeof note.createdBy === 'object' ? note.createdBy?.contact?.name?.[0] : null) || 'S'}
                          </span>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-[var(--vz-heading)]">
                              {(typeof note.createdBy === 'object' ? note.createdBy?.contact?.name : null) || 'System'}
                            </p>
                            <p className="text-xs text-[var(--vz-text-muted)]">
                              {note.createdAt || note.meta?.createdAt ? new Date(note.createdAt || note.meta?.createdAt).toLocaleString() : '—'}
                            </p>
                          </div>
                          <p className="text-sm text-[var(--vz-text)] mt-1">{note.text}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'whatsapp' && (
              <div className="space-y-3">
                {whatsappFetching ? (
                  <p className="text-center text-sm text-[var(--vz-text-muted)] py-8">Loading WhatsApp conversation...</p>
                ) : whatsappMessages.length === 0 ? (
                  <p className="text-center text-sm text-[var(--vz-text-muted)] py-8">No WhatsApp conversation recorded for this lead.</p>
                ) : whatsappMessages.map((message) => (
                  <div key={message._id} className={`flex ${message.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] p-3 rounded-xl ${message.direction === 'outbound' ? 'bg-primary/10 border border-primary/20' : 'bg-[var(--vz-input-bg)] border border-[var(--vz-border)]'}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge color={message.direction === 'outbound' ? 'primary' : 'success'}>{message.direction}</Badge>
                        <span className="text-[10px] text-[var(--vz-text-muted)]">{message.type} · {message.status}</span>
                      </div>
                      <p className="text-sm text-[var(--vz-heading)]">{message.content || (message.templateName ? `Template: ${message.templateName}` : 'Media message')}</p>
                      <p className="text-[10px] text-[var(--vz-text-muted)] mt-1">{message.createdAt || message.meta?.createdAt ? new Date(message.createdAt || message.meta?.createdAt).toLocaleString() : '—'}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'calls' && (
              <div>
                {callsFetching ? (
                  <p className="text-center text-sm text-[var(--vz-text-muted)] py-8">Loading calls...</p>
                ) : callLogs.length === 0 ? (
                  <p className="text-center text-sm text-[var(--vz-text-muted)] py-8">No call history recorded for this lead.</p>
                ) : (
                  <div className="space-y-2">
                    {callLogs.map((call) => (
                      <div key={call._id} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-[var(--vz-border)]">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center"><Phone size={15} /></div>
                          <div>
                            <p className="text-sm font-medium text-[var(--vz-heading)] capitalize">{call.call?.direction || 'outbound'} call · {call.call?.status}</p>
                            {call.call?.status === 'failed' && call.provider?.data?.error?.code === 'EXOTEL_KYC_REQUIRED' && (
                              <p className="text-[10px] text-danger mt-0.5 font-medium">Exotel KYC verification required</p>
                            )}
                            <p className="text-xs text-[var(--vz-text-muted)] mt-0.5">{call.call?.to || lead.contact?.phone} · {call.call?.duration ? `${call.call?.duration}s` : 'No duration'}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          {call.disposition?.code && <Badge color="info">{call.disposition.code}</Badge>}
                          {call.recording?.playbackUrl && <a href={call.recording.playbackUrl} target="_blank" rel="noopener noreferrer" className="block ml-auto text-[10px] text-primary hover:underline mt-1">Play recording</a>}
                          <p className="text-[10px] text-[var(--vz-text-muted)] mt-1">{call.call?.initiatedAt || call.startedAt || call.audit?.createdAt || call.meta?.createdAt ? new Date(call.call?.initiatedAt || call.startedAt || call.audit?.createdAt || call.meta?.createdAt).toLocaleString() : '—'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'timeline' && (
              <div>
                {timelineFetching ? (
                  <p className="text-center text-sm text-[var(--vz-text-muted)] py-8">Loading activity...</p>
                ) : timeline.length === 0 ? (
                  <p className="text-center text-sm text-[var(--vz-text-muted)] py-8">No activity yet.</p>
                ) : (
                  <div className="relative pl-6 space-y-0">
                    <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-[var(--vz-border)]" />
                    {timeline.map((event, i) => (
                      <div key={i} className="relative flex gap-3 py-3">
                        <div className="absolute left-[-18px] top-4 w-3 h-3 rounded-full bg-primary border-2 border-[var(--vz-card-bg)]" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-[var(--vz-heading)]">{event.title || event.action}</p>
                          {event.description && <p className="text-sm text-[var(--vz-text)] mt-0.5">{event.description}</p>}
                          <p className="text-xs text-[var(--vz-text-muted)] mt-0.5">
                            {event.meta?.createdAt ? new Date(event.meta?.createdAt).toLocaleString() : '—'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Edit Lead Modal */}
      <Modal isOpen={showEdit} onClose={() => setShowEdit(false)} title="Edit Lead Details" size="md">
        {editForm && (
          <form onSubmit={handleUpdateLead} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <Input label="First Name" value={editForm.contact.firstName} onChange={(e) => setEditForm({ ...editForm, contact: { ...editForm.contact, firstName: e.target.value } })} />
              <Input label="Last Name" value={editForm.contact.lastName} onChange={(e) => setEditForm({ ...editForm, contact: { ...editForm.contact, lastName: e.target.value } })} />
            </div>
            <Input label="Email Address" type="email" value={editForm.contact.email} onChange={(e) => setEditForm({ ...editForm, contact: { ...editForm.contact, email: e.target.value } })} />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Phone Number" maxLength={10} value={editForm.contact.phone} onChange={(e) => setEditForm({ ...editForm, contact: { ...editForm.contact, phone: e.target.value.replace(/[^\d]/g, '') } })} />
              <Input label="Company" value={editForm.contact.company} onChange={(e) => setEditForm({ ...editForm, contact: { ...editForm.contact, company: e.target.value } })} />
            </div>
            <Input label="Expected Deal Value (₹)" type="number" value={editForm.lifecycle?.expectedValue ?? editForm.expectedValue ?? ''} onChange={(e) => {
              const val = Number(e.target.value);
              setEditForm({ ...editForm, expectedValue: val, lifecycle: { ...(editForm.lifecycle || {}), expectedValue: val } });
            }} />

            
            {/* Dynamic Custom Fields in Edit */}
            {fieldsData?.data?.length > 0 && (
              <div className="pt-3 border-t border-[var(--vz-border)] space-y-3">
                <h6 className="text-xs font-bold text-[var(--vz-heading)] uppercase tracking-wider text-primary">Custom Information</h6>
                <div className="grid grid-cols-2 gap-3">
                  {fieldsData.data.map(field => (
                    <div key={field._id} className={field.type === 'textarea' ? 'col-span-2' : ''}>
                      <label className="block text-sm font-medium text-[var(--vz-heading)] mb-1.5">{field.name}</label>
                      <Input 
                        type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                        placeholder={field.name}
                        value={editForm.customFields[field.name] || ''}
                        onChange={(e) => setEditForm({ ...editForm, customFields: { ...editForm.customFields, [field.name]: e.target.value } })}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowEdit(false)}>Cancel</Button>
              <Button type="submit" size="sm">Save Changes</Button>
            </div>
          </form>
        )}
      </Modal>
    </>
  )
}
