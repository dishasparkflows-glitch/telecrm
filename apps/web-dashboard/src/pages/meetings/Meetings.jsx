import { useState } from 'react'
import { useGetMeetingsQuery, useScheduleMeetingMutation, useUpdateMeetingMutation, useDeleteMeetingMutation, useGetBookingLinksQuery, useCreateBookingLinkMutation, useDeleteBookingLinkMutation } from '../../features/meetings/meetingApi'
import { useGetUsersQuery } from '../../features/auth/authApi'
import { useGetCustomFieldsQuery } from '../../features/custom-fields/customFieldApi'
import PageHeader from '../../components/layout/PageHeader'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import Tabs from '../../components/ui/Tabs'
import EmptyState from '../../components/ui/EmptyState'
import { useToast } from '../../components/ui/Toast'
import MeetingDetail from '../../components/meetings/MeetingDetail'
import { Calendar, Plus, Clock, Video, Link2, Copy, Pencil, Trash2, X } from 'lucide-react'
import Pagination from '../../components/ui/Pagination'

export default function Meetings() {
  const toast = useToast()
  const [activeTab, setActiveTab] = useState('upcoming')
  const [showSchedule, setShowSchedule] = useState(false)
  const [showCreateLink, setShowCreateLink] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [showDetail, setShowDetail] = useState(false)
  const [selectedMeeting, setSelectedMeeting] = useState(null)
  const [meetingData, setMeetingData] = useState({ title: '', leadId: '', dateTime: '', duration: 30, attendees: [], meetingUrl: '', customFields: {} })
  const [editMeetingForm, setEditMeetingForm] = useState(null)
  const [selectedAttendee, setSelectedAttendee] = useState('')
  const [linkData, setLinkData] = useState({ title: '', duration: 30 })
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 25

  const { data: meetingsData, isLoading } = useGetMeetingsQuery({ page, limit: PAGE_SIZE })
  const { data: linksData } = useGetBookingLinksQuery()
  const { data: usersData } = useGetUsersQuery({ limit: 100 })
  const { data: fieldsData } = useGetCustomFieldsQuery()
  const [scheduleMeeting, { isLoading: scheduling }] = useScheduleMeetingMutation()
  const [updateMeeting, { isLoading: updating }] = useUpdateMeetingMutation()

  const [deleteMeeting] = useDeleteMeetingMutation()
  const [createLink, { isLoading: creatingLink }] = useCreateBookingLinkMutation()
  const [deleteLink] = useDeleteBookingLinkMutation()

  const meetings = meetingsData?.data || []
  const pagination = meetingsData?.pagination || {}
  const bookingLinks = linksData?.data || []

  const handleSchedule = async () => {
    try {
      // Map frontend 'dateTime' to backend 'scheduledAt'
      const { dateTime, leadId, ...rest } = meetingData
      const payload = { ...rest, scheduledAt: dateTime }
      if (leadId) payload.leadId = leadId
      await scheduleMeeting(payload).unwrap()
      toast('Meeting scheduled', 'success')
      setShowSchedule(false)
      setMeetingData({ title: '', leadId: '', dateTime: '', duration: 30, attendees: [], meetingUrl: '', customFields: {} })
    } catch { toast('Failed to schedule', 'error') }
  }

  const handleEditOpen = (meeting) => {
    setEditMeetingForm({
      id: meeting._id,
      title: meeting.title,
      dateTime: new Date(meeting.scheduledAt || meeting.dateTime).toISOString().slice(0, 16),
      duration: meeting.duration,
      status: meeting.status || 'scheduled',
      attendees: meeting.attendees || [],
      meetingUrl: meeting.meetingUrl || ''
    })
    setShowEdit(true)
  }

  const handleUpdate = async () => {
    try {
      await updateMeeting({
        id: editMeetingForm.id,
        title: editMeetingForm.title,
        scheduledAt: editMeetingForm.dateTime,
        duration: editMeetingForm.duration,
        status: editMeetingForm.status,
      }).unwrap()
      toast('Meeting updated', 'success')
      setShowEdit(false)
    } catch { toast('Failed to update meeting', 'error') }
  }

  const handleDeleteMeeting = async (id) => {
    if (!confirm('Are you sure you want to delete this meeting?')) return
    try {
      await deleteMeeting(id).unwrap()
      toast('Meeting deleted', 'success')
    } catch { toast('Failed to delete meeting', 'error') }
  }

  const handleCreateLink = async () => {
    try {
      await createLink({ title: linkData.title, durationOptions: [linkData.duration] }).unwrap()
      toast('Booking link created', 'success')
      setShowCreateLink(false)
    } catch { toast('Failed to create link', 'error') }
  }

  const handleDeleteLink = async (id) => {
    if (!confirm('Are you sure you want to delete this booking link?')) return
    try {
      await deleteLink(id).unwrap()
      toast('Booking link deleted', 'success')
    } catch { toast('Failed to delete link', 'error') }
  }

  const tabs = [
    { key: 'upcoming', label: 'Upcoming', icon: Calendar, count: pagination.total || meetings.length },
    { key: 'links', label: 'Booking Links', icon: Link2, count: bookingLinks.length },
  ]

  return (
    <>
      <PageHeader title="Meetings" breadcrumbs={[{ label: 'CRM', path: '/dashboard' }, { label: 'Meetings' }]} />

      <div className="flex items-center justify-between mb-4">
        <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
        <Button size="sm" onClick={() => activeTab === 'upcoming' ? setShowSchedule(true) : setShowCreateLink(true)}>
          <Plus size={14} /> {activeTab === 'upcoming' ? 'Schedule' : 'Create Link'}
        </Button>
      </div>

      {activeTab === 'upcoming' && (
        <Card>
          {isLoading ? (
            <div className="text-center py-12 text-[var(--vz-text-muted)]">Loading...</div>
          ) : meetings.length === 0 ? (
            <EmptyState icon={Calendar} title="No meetings scheduled" description="Schedule your first meeting to get started"
              action={<Button size="sm" onClick={() => setShowSchedule(true)}><Plus size={14} /> Schedule</Button>} />
          ) : (
            <div className="space-y-3">
              {meetings.map((m) => (
                <div key={m._id} className="flex items-start gap-4 p-3 rounded-lg border border-[var(--vz-border)] hover:border-primary/30 transition-colors">
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex flex-col items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-primary">{new Date(m.scheduledAt).toLocaleDateString('en', { month: 'short' })}</span>
                    <span className="text-lg font-bold text-primary leading-none">{new Date(m.scheduledAt).getDate()}</span>
                  </div>
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => { setSelectedMeeting(m); setShowDetail(true); }}>
                    <p className="text-sm font-semibold text-[var(--vz-heading)] hover:text-primary transition-colors">{m.title}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-[var(--vz-text-muted)]">
                      <span className="flex items-center gap-1"><Clock size={11} /> {new Date(m.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      <span className="flex items-center gap-1"><Video size={11} /> {m.duration}min</span>
                      {m.attendees?.length > 0 && <span className="flex items-center gap-1"><Plus size={11} /> {m.attendees.length} Attendees</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge color={m.status === 'confirmed' ? 'success' : m.status === 'cancelled' ? 'danger' : 'warning'}>{m.status || 'pending'}</Badge>
                    <button onClick={() => handleEditOpen(m)} className="p-1.5 rounded hover:bg-[var(--vz-body-bg)] text-[var(--vz-text-muted)] hover:text-primary transition-colors" title="Edit">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => handleDeleteMeeting(m._id)} className="p-1.5 rounded hover:bg-danger/10 text-danger hover:text-danger-dark transition-colors" title="Delete">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'upcoming' && pagination.totalPages > 1 && (
            <Pagination currentPage={page} totalPages={pagination.totalPages || 1} totalItems={pagination.total} pageSize={PAGE_SIZE} onPageChange={setPage} />
          )}
        </Card>
      )}

      {activeTab === 'links' && (
        <Card>
          {bookingLinks.length === 0 ? (
            <EmptyState icon={Link2} title="No booking links" description="Create a shareable link so leads can book meetings with you" />
          ) : (
            <div className="space-y-3">
              {bookingLinks.map((link) => (
                <div key={link._id} className="flex items-center justify-between p-3 rounded-lg border border-[var(--vz-border)]">
                  <div>
                    <p className="text-sm font-medium text-[var(--vz-heading)]">{link.title}</p>
                    <p className="text-xs text-primary mt-0.5">{window.location.origin}/book/{link.slug}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/book/${link.slug}`); toast('Link copied!', 'success') }}>
                      <Copy size={14} /> Copy
                    </Button>
                    <button onClick={() => handleDeleteLink(link._id)} className="p-1.5 rounded hover:bg-danger/10 text-danger hover:text-danger-dark transition-colors" title="Delete">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Schedule Modal */}
      <Modal isOpen={showSchedule} onClose={() => setShowSchedule(false)} title="Schedule Meeting" size="md">
        <div className="space-y-3">
          <Input label="Title" placeholder="Meeting title" value={meetingData.title} onChange={(e) => setMeetingData({ ...meetingData, title: e.target.value })} />
          <Input label="Date & Time" type="datetime-local" value={meetingData.dateTime} onChange={(e) => setMeetingData({ ...meetingData, dateTime: e.target.value })} />
          <Input label="Duration (min)" type="number" value={meetingData.duration} onChange={(e) => setMeetingData({ ...meetingData, duration: +e.target.value })} />
          <Input label="Meeting URL" placeholder="Zoom/Google Meet link" value={meetingData.meetingUrl} onChange={(e) => setMeetingData({ ...meetingData, meetingUrl: e.target.value })} />
          
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-[var(--vz-heading)]">Internal Attendees</label>
            <div className="flex gap-2">
              <Select
                value={selectedAttendee}
                onChange={(val) => setSelectedAttendee(val)}
                className="flex-1"
                options={[
                  { value: '', label: 'Select User' },
                  ...(usersData?.data || []).map(u => ({ value: u._id, label: `${u.name} (${u.role})` }))
                ]}
              />
              <Button size="sm" variant="ghost" onClick={() => {
                if (!selectedAttendee) return
                const user = usersData?.data?.find(u => u._id === selectedAttendee)
                if (user && !meetingData.attendees.some(a => a.userId === user._id)) {
                  setMeetingData({ 
                    ...meetingData, 
                    attendees: [...meetingData.attendees, { userId: user._id, name: user.name, email: user.email }] 
                  })
                }
                setSelectedAttendee('')
              }}>Add</Button>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {meetingData.attendees.map(a => (
                <Badge key={a.userId} color="primary" className="flex items-center gap-1">
                  {a.name}
                  <X size={12} className="cursor-pointer" onClick={() => setMeetingData({ ...meetingData, attendees: meetingData.attendees.filter(att => att.userId !== a.userId) })} />
                </Badge>
              ))}
            </div>
          </div>

          {/* Dynamic Custom Fields */}
          {fieldsData?.data?.filter(f => f.targetEntity === 'Meeting').length > 0 && (
            <div className="pt-3 border-t border-[var(--vz-border)] space-y-3">
              <h6 className="text-xs font-bold text-[var(--vz-heading)] uppercase tracking-wider text-primary">Meeting Details (Custom)</h6>
              <div className="grid grid-cols-2 gap-3">
                {fieldsData.data.filter(f => f.targetEntity === 'Meeting').map(field => (
                  <div key={field._id} className={field.type === 'textarea' ? 'col-span-2' : ''}>
                    <label className="block text-sm font-medium text-[var(--vz-heading)] mb-1.5">{field.name} {field.required && <span className="text-danger">*</span>}</label>
                    <Input 
                      type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                      placeholder={field.name}
                      value={meetingData.customFields[field.name] || ''}
                      onChange={(e) => setMeetingData({ ...meetingData, customFields: { ...meetingData.customFields, [field.name]: e.target.value } })}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <Modal.Footer>
          <Button variant="ghost" size="sm" onClick={() => setShowSchedule(false)}>Cancel</Button>
          <Button size="sm" onClick={handleSchedule} disabled={scheduling}>{scheduling ? 'Scheduling...' : 'Schedule'}</Button>
        </Modal.Footer>
      </Modal>

      {/* Create Link Modal */}
      <Modal isOpen={showCreateLink} onClose={() => setShowCreateLink(false)} title="Create Booking Link" size="sm">
        <div className="space-y-3">
          <Input label="Link Title" placeholder="e.g. 30-min Demo Call" value={linkData.title} onChange={(e) => setLinkData({ ...linkData, title: e.target.value })} />
          <Input label="Duration (min)" type="number" value={linkData.duration} onChange={(e) => setLinkData({ ...linkData, duration: +e.target.value })} />
        </div>
        <Modal.Footer>
          <Button variant="ghost" size="sm" onClick={() => setShowCreateLink(false)}>Cancel</Button>
          <Button size="sm" onClick={handleCreateLink} disabled={creatingLink}>{creatingLink ? 'Creating...' : 'Create'}</Button>
        </Modal.Footer>
      </Modal>
      {/* Edit Meeting Modal */}
      <Modal isOpen={showEdit} onClose={() => setShowEdit(false)} title="Edit Meeting" size="md">
        {editMeetingForm && (
          <>
            <div className="space-y-3">
              <Input label="Title" placeholder="Meeting title" value={editMeetingForm.title} onChange={(e) => setEditMeetingForm({ ...editMeetingForm, title: e.target.value })} />
              <Input label="Date & Time" type="datetime-local" value={editMeetingForm.dateTime} onChange={(e) => setEditMeetingForm({ ...editMeetingForm, dateTime: e.target.value })} />
              <Input label="Duration (min)" type="number" value={editMeetingForm.duration} onChange={(e) => setEditMeetingForm({ ...editMeetingForm, duration: +e.target.value })} />
              <Select
                value={editMeetingForm.status}
                onChange={(val) => setEditMeetingForm({ ...editMeetingForm, status: val })}
                options={[
                  { value: 'scheduled', label: 'Scheduled' },
                  { value: 'confirmed', label: 'Confirmed' },
                  { value: 'cancelled', label: 'Cancelled' },
                  { value: 'completed', label: 'Completed' }
                ]}
              />
            </div>
            <Modal.Footer>
              <Button variant="ghost" size="sm" onClick={() => setShowEdit(false)}>Cancel</Button>
              <Button size="sm" onClick={handleUpdate} disabled={updating}>{updating ? 'Updating...' : 'Save Changes'}</Button>
            </Modal.Footer>
          </>
        )}
      </Modal>

      {/* Detail Modal */}
      <MeetingDetail 
        isOpen={showDetail} 
        onClose={() => setShowDetail(false)} 
        meeting={selectedMeeting} 
      />
    </>
  )
}
