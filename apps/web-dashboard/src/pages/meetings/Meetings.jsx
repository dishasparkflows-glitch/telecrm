import { useState } from 'react'
import { useGetMeetingsQuery, useScheduleMeetingMutation, useUpdateMeetingMutation, useDeleteMeetingMutation, useGetBookingLinksQuery, useCreateBookingLinkMutation, useDeleteBookingLinkMutation } from '../../features/meetings/meetingApi'
import { useGetAllUsersListQuery } from '../../features/users/userApi'
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
  const [showLinkDetail, setShowLinkDetail] = useState(false)
  const [selectedLink, setSelectedLink] = useState(null)
  const [selectedMeeting, setSelectedMeeting] = useState(null)
  const [meetingData, setMeetingData] = useState({ title: '', leadId: '', dateTime: '', duration: 30, attendees: [], meetingUrl: '', provider: 'sparkcrm', meetingType: 'online', location: '', customFields: {} })
  const [editMeetingForm, setEditMeetingForm] = useState(null)
  const [selectedAttendee, setSelectedAttendee] = useState('')
  const [linkData, setLinkData] = useState({ 
    title: '', 
    assignmentType: 'specific_user',
    assignedUserId: '',
    assignedUserIds: [],
    fallbackUserId: '',
    durationOptions: [30],
    defaultDuration: 30,
    slotInterval: 15,
    provider: 'sparkcrm',
    availability: { days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'], startTime: '09:00', endTime: '18:00' }
  })
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 25

  const { data: meetingsData, isLoading } = useGetMeetingsQuery({ page, limit: PAGE_SIZE })
  const { data: linksData, isFetching: isFetchingLinks } = useGetBookingLinksQuery(undefined, { skip: activeTab !== 'links' })
  const { data: usersData, isFetching: isFetchingUsers } = useGetAllUsersListQuery(undefined, { skip: !showSchedule && !showCreateLink && !showEdit })
  const { data: fieldsData } = useGetCustomFieldsQuery({ entity: 'Meeting' }, { skip: !showSchedule && !showEdit })
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
      const { dateTime, leadId, title, duration, meetingUrl, attendees, provider, meetingType, location, customFields } = meetingData
      
      const meetingFields = fieldsData?.data || [];
      for (const field of meetingFields) {
        if (field.isRequired && !customFields[field.name]) {
          return toast(`${field.label} is required`, 'error')
        }
      }

      const payload = { 
        provider: meetingType === 'online' ? provider : null,
        meetingType,
        location: meetingType === 'offline' ? location : null,
        meeting: { title, scheduledAt: dateTime, duration, link: meetingType === 'online' ? meetingUrl : null },
        attendees: attendees.map(a => ({ userId: a.userId })),
        customFields 
      }
      if (leadId) payload.leadId = leadId
      await scheduleMeeting(payload).unwrap()
      toast('Meeting scheduled', 'success')
      setShowSchedule(false)
      setMeetingData({ title: '', leadId: '', dateTime: '', duration: 30, attendees: [], meetingUrl: '', provider: 'sparkcrm', meetingType: 'online', location: '', customFields: {} })
    } catch { toast('Failed to schedule', 'error') }
  }

  const handleEditOpen = (meeting) => {
    setEditMeetingForm({
      id: meeting._id,
      title: meeting.meeting?.title || '',
      dateTime: new Date(meeting.meeting?.scheduledAt || new Date()).toISOString().slice(0, 16),
      duration: meeting.meeting?.duration || 30,
      status: meeting.meeting?.status || 'scheduled',
      attendees: meeting.attendees || [],
      meetingUrl: meeting.meetingUrl || ''
    })
    setShowEdit(true)
  }

  const handleUpdate = async () => {
    try {
      await updateMeeting({
        id: editMeetingForm.id,
        meeting: {
          title: editMeetingForm.title,
          scheduledAt: editMeetingForm.dateTime,
          duration: editMeetingForm.duration,
          status: editMeetingForm.status,
        },
        attendees: editMeetingForm.attendees.map(a => ({ userId: a.userId?._id || a.userId })),
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
      await createLink({ 
        title: linkData.title, 
        durationOptions: linkData.durationOptions,
        defaultDuration: linkData.defaultDuration,
        slotInterval: linkData.slotInterval,
        availability: linkData.availability,
        provider: linkData.provider
      }).unwrap()
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
    { key: 'links', label: 'Booking Links', icon: Link2, count: activeTab === 'links' ? bookingLinks.length : undefined },
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
                    <span className="text-xs font-bold text-primary">{new Date(m.meeting?.scheduledAt).toLocaleDateString('en', { month: 'short' })}</span>
                    <span className="text-lg font-bold text-primary leading-none">{new Date(m.meeting?.scheduledAt).getDate()}</span>
                  </div>
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => { setSelectedMeeting(m); setShowDetail(true); }}>
                    <p className="text-sm font-semibold text-[var(--vz-heading)] hover:text-primary transition-colors">{m.meeting?.title}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-[var(--vz-text-muted)]">
                      <span className="flex items-center gap-1"><Clock size={11} /> {new Date(m.meeting?.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      <span className="flex items-center gap-1"><Video size={11} /> {m.meeting?.duration}min</span>
                      {m.meetingType && (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 capitalize border border-gray-200">{m.meetingType}</span>
                      )}
                      {m.conference?.provider === 'google_meet' && (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">Google Meet</span>
                      )}
                      {(m.attendees?.length > 0 || m.guest) && (
                        <span className="flex items-center gap-1">
                          <Plus size={11} /> 
                          {(m.attendees?.length || 0) + (m.guest ? 1 : 0)} Attendees
                        </span>
                      )}
                    </div>
                    {m.meeting?.link && (
                      <div className="mt-2">
                        <a href={m.meeting.link} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
                          Join Meeting
                        </a>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge color={m.meeting?.status === 'confirmed' ? 'success' : m.meeting?.status === 'cancelled' ? 'danger' : 'warning'}>{m.meeting?.status || 'pending'}</Badge>
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
          {isFetchingLinks ? (
            <div className="text-center py-12 text-[var(--vz-text-muted)]">Loading links...</div>
          ) : bookingLinks.length === 0 ? (
            <EmptyState icon={Link2} title="No booking links" description="Create a shareable link so leads can book meetings with you" />
          ) : (
            <div className="space-y-3">
              {bookingLinks.map((link) => (
                <div key={link._id} className="flex items-center justify-between p-3 rounded-lg border border-[var(--vz-border)] hover:border-primary/50 transition-colors cursor-pointer" onClick={() => { setSelectedLink(link); setShowLinkDetail(true); }}>
                  <div>
                    <p className="text-sm font-medium text-[var(--vz-heading)]">{link.title}</p>
                    <a 
                      href={`${window.location.origin}/book/${link.slug}`} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-xs text-primary mt-0.5 hover:underline block"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {window.location.origin}/book/{link.slug}
                    </a>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(`${window.location.origin}/book/${link.slug}`); toast('Link copied!', 'success') }}>
                      <Copy size={14} /> Copy
                    </Button>
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteLink(link._id) }} className="p-1.5 rounded hover:bg-danger/10 text-danger hover:text-danger-dark transition-colors" title="Delete">
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
          <Select 
            label="Meeting Type" 
            value={meetingData.meetingType} 
            onChange={(val) => setMeetingData({ ...meetingData, meetingType: val })} 
            options={[ { value: 'online', label: 'Online' }, { value: 'offline', label: 'Offline / In-person' }, { value: 'phone', label: 'Phone Call' } ]} 
          />
          {meetingData.meetingType === 'online' && (
            <>
              <Select 
                label="Meeting Provider" 
                value={meetingData.provider} 
                onChange={(val) => setMeetingData({ ...meetingData, provider: val })} 
                options={[ { value: 'sparkcrm', label: 'Default / Custom' }, { value: 'google_meet', label: 'Google Meet (Auto-generate)' } ]} 
              />
              {meetingData.provider !== 'google_meet' && (
                <Input label="Custom Meeting URL" placeholder="Zoom/Google Meet link" value={meetingData.meetingUrl} onChange={(e) => setMeetingData({ ...meetingData, meetingUrl: e.target.value })} />
              )}
            </>
          )}
          {meetingData.meetingType === 'offline' && (
            <Input label="Meeting Location / Address" placeholder="e.g. 123 Main St, New York, NY" value={meetingData.location} onChange={(e) => setMeetingData({ ...meetingData, location: e.target.value })} />
          )}
          
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-[var(--vz-heading)]">Internal Attendees</label>
            <div className="flex gap-2">
              <Select
                value={selectedAttendee}
                onChange={(val) => setSelectedAttendee(val)}
                className="flex-1"
                options={[
                  { value: '', label: isFetchingUsers ? 'Loading users...' : 'Select User' },
                  ...(usersData?.data || []).map(u => ({ value: u._id, label: u.email ? `${u.name} (${u.email})` : u.name }))
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
          {fieldsData?.data?.length > 0 && (
            <div className="pt-3 border-t border-[var(--vz-border)] space-y-3">
              <h6 className="text-xs font-bold text-[var(--vz-heading)] uppercase tracking-wider text-primary">Additional Information</h6>
              <div className="grid grid-cols-2 gap-3">
                {fieldsData.data.map(field => (
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
        <div className="space-y-4">
          <Input label="Link Title" placeholder="e.g. 30-min Demo Call" value={linkData.title} onChange={(e) => setLinkData({ ...linkData, title: e.target.value })} />
          <div className="space-y-2">
            <label className="block text-sm font-medium text-[var(--vz-heading)]">Meeting Duration</label>
            <div className="flex flex-wrap gap-3">
              {[15, 30, 45, 60].map(dur => (
                <label key={dur} className="flex items-center gap-1.5 text-sm text-[var(--vz-text)] cursor-pointer">
                  <input
                    type="checkbox"
                    className="rounded border-[var(--vz-border)] text-primary focus:ring-primary w-4 h-4"
                    checked={linkData.durationOptions.includes(dur)}
                    onChange={(e) => {
                      let newOpts = e.target.checked 
                        ? [...linkData.durationOptions, dur].sort((a,b)=>a-b)
                        : linkData.durationOptions.filter(d => d !== dur);
                      if (newOpts.length === 0) newOpts = [30];
                      let newDefault = linkData.defaultDuration;
                      if (!newOpts.includes(newDefault)) newDefault = newOpts[0];
                      setLinkData({ ...linkData, durationOptions: newOpts, defaultDuration: newDefault });
                    }}
                  />
                  {dur} min
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-[var(--vz-heading)]">Assignment Type</label>
            <Select
              value={linkData.assignmentType}
              onChange={(val) => setLinkData({ ...linkData, assignmentType: val })}
              options={[
                { value: 'specific_user', label: 'Specific User' },
                { value: 'round_robin', label: 'Round Robin' }
              ]}
            />
          </div>
          {linkData.assignmentType === 'specific_user' && (
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-[var(--vz-heading)]">Assigned User</label>
              <Select
                value={linkData.assignedUserId}
                onChange={(val) => setLinkData({ ...linkData, assignedUserId: val })}
                options={[{ value: '', label: 'Myself (Default)' }, ...(usersData?.data || []).map(u => ({ value: u._id, label: u.name || u.email }))]}
              />
            </div>
          )}
          {linkData.assignmentType === 'round_robin' && (
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-[var(--vz-heading)]">Select Team Members (Select multiple)</label>
              <div className="max-h-32 overflow-y-auto border border-[var(--vz-border)] rounded-md p-2 space-y-1">
                {(usersData?.data || []).map(user => (
                  <label key={user._id} className="flex items-center gap-2 text-sm text-[var(--vz-text)] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={linkData.assignedUserIds.includes(user._id)}
                      onChange={(e) => {
                        const newIds = e.target.checked 
                          ? [...linkData.assignedUserIds, user._id]
                          : linkData.assignedUserIds.filter(id => id !== user._id);
                        setLinkData({ ...linkData, assignedUserIds: newIds });
                      }}
                    />
                    {user.name || user.email}
                  </label>
                ))}
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-[var(--vz-heading)]">Default Duration</label>
              <Select
                value={linkData.defaultDuration}
                onChange={(val) => setLinkData({ ...linkData, defaultDuration: +val })}
                options={linkData.durationOptions.map(dur => ({ value: dur, label: `${dur} min` }))}
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-[var(--vz-heading)]">Slot Interval</label>
              <Select
                value={linkData.slotInterval}
                onChange={(val) => setLinkData({ ...linkData, slotInterval: +val })}
                options={[
                  { value: 15, label: '15 min' },
                  { value: 30, label: '30 min' },
                  { value: 60, label: '60 min' }
                ]}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-[var(--vz-heading)]">Meeting Provider</label>
            <Select
              value={linkData.provider}
              onChange={(val) => setLinkData({ ...linkData, provider: val })}
              options={[
                { value: 'sparkcrm', label: 'Default' },
                { value: 'google_meet', label: 'Google Meet' }
              ]}
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-[var(--vz-heading)]">Availability Days</label>
            <div className="flex flex-wrap gap-2">
              {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(day => (
                <button
                  key={day}
                  onClick={() => {
                    const days = linkData.availability?.days?.includes(day)
                      ? linkData.availability.days.filter(d => d !== day)
                      : [...(linkData.availability?.days || []), day];
                    setLinkData({ ...linkData, availability: { ...linkData.availability, days } })
                  }}
                  className={`px-3 py-1.5 text-xs font-medium rounded transition-colors border ${
                    linkData.availability?.days?.includes(day)
                      ? 'bg-primary text-white border-primary'
                      : 'bg-transparent border-[var(--vz-border)] text-[var(--vz-text-muted)] hover:border-primary/50 hover:text-primary'
                  }`}
                >
                  {day.charAt(0).toUpperCase() + day.slice(1, 3)}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input label="Start Time" type="time" value={linkData.availability?.startTime || ''} onChange={(e) => setLinkData({ ...linkData, availability: { ...linkData.availability, startTime: e.target.value } })} />
            <Input label="End Time" type="time" value={linkData.availability?.endTime || ''} onChange={(e) => setLinkData({ ...linkData, availability: { ...linkData.availability, endTime: e.target.value } })} />
          </div>
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

              <div className="space-y-1.5 pt-3 border-t border-[var(--vz-border)]">
                <label className="block text-sm font-medium text-[var(--vz-heading)]">Internal Attendees</label>
                <div className="flex gap-2">
                  <Select
                    value={selectedAttendee}
                    onChange={(val) => setSelectedAttendee(val)}
                    className="flex-1"
                    options={[
                      { value: '', label: isFetchingUsers ? 'Loading users...' : 'Select User' },
                      ...(usersData?.data || []).map(u => ({ value: u._id, label: u.email ? `${u.name} (${u.email})` : u.name }))
                    ]}
                  />
                  <Button size="sm" variant="ghost" onClick={() => {
                    if (!selectedAttendee) return
                    const user = usersData?.data?.find(u => u._id === selectedAttendee)
                    if (user && !editMeetingForm.attendees.some(a => (a.userId?._id || a.userId) === user._id)) {
                      setEditMeetingForm({ 
                        ...editMeetingForm, 
                        attendees: [...editMeetingForm.attendees, { userId: user._id, name: user.name, email: user.email }] 
                      })
                    }
                    setSelectedAttendee('')
                  }}>Add</Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {editMeetingForm.attendees.map(a => {
                    const attendeeId = a.userId?._id || a.userId;
                    const attendeeName = a.name || a.userId?.name || usersData?.data?.find(u => u._id === attendeeId)?.name || 'Unknown';
                    return (
                      <Badge key={attendeeId} color="primary" className="flex items-center gap-1">
                        {attendeeName}
                        <X size={12} className="cursor-pointer" onClick={() => setEditMeetingForm({ ...editMeetingForm, attendees: editMeetingForm.attendees.filter(att => (att.userId?._id || att.userId) !== attendeeId) })} />
                      </Badge>
                    )
                  })}
                </div>
              </div>
            </div>
            <Modal.Footer>
              <Button variant="ghost" size="sm" onClick={() => setShowEdit(false)}>Cancel</Button>
              <Button size="sm" onClick={handleUpdate} disabled={updating}>{updating ? 'Updating...' : 'Save Changes'}</Button>
            </Modal.Footer>
          </>
        )}
      </Modal>

      {/* Detail Modal */}
      {showDetail && (
        <MeetingDetail 
          isOpen={showDetail} 
          onClose={() => setShowDetail(false)} 
          meeting={selectedMeeting} 
        />
      )}

      {/* Booking Link Detail Modal */}
      <Modal isOpen={showLinkDetail} onClose={() => setShowLinkDetail(false)} title="Booking Link Details" size="sm">
        {selectedLink && (
          <div className="space-y-4 text-sm text-[var(--vz-text)]">
            <div>
              <p className="text-xs font-semibold text-[var(--vz-text-muted)] uppercase mb-1">Link Title</p>
              <p className="font-medium text-[var(--vz-heading)]">{selectedLink.title}</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold text-[var(--vz-text-muted)] uppercase mb-1">Durations</p>
                <div className="flex gap-1 flex-wrap">
                  {selectedLink.durationOptions?.map(d => (
                    <Badge key={d} color="primary">{d} min</Badge>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-[var(--vz-text-muted)] uppercase mb-1">Provider</p>
                <p className="capitalize">{selectedLink.provider?.replace('_', ' ') || 'Default'}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold text-[var(--vz-text-muted)] uppercase mb-1">Default Duration</p>
                <p className="capitalize">{selectedLink.defaultDuration || selectedLink.durationOptions?.[0]} min</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-[var(--vz-text-muted)] uppercase mb-1">Slot Interval</p>
                <p className="capitalize">{selectedLink.slotInterval || 15} min</p>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-[var(--vz-text-muted)] uppercase mb-1">Availability</p>
              <p className="capitalize">{selectedLink.availability?.days?.join(', ')}</p>
              <p className="text-xs text-[var(--vz-text-muted)] mt-1">{selectedLink.availability?.startTime} - {selectedLink.availability?.endTime} ({selectedLink.availability?.timezone})</p>
            </div>
            
            <div className="pt-4 border-t border-[var(--vz-border)]">
              <p className="text-xs font-semibold text-[var(--vz-text-muted)] uppercase mb-2">Booking URL</p>
              <div className="flex items-center gap-2">
                <input 
                  type="text" 
                  readOnly 
                  value={`${window.location.origin}/book/${selectedLink.slug}`}
                  className="flex-1 text-xs bg-[var(--vz-body-bg)] border border-[var(--vz-border)] rounded px-2 py-1.5 focus:outline-none"
                />
                <Button size="sm" onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/book/${selectedLink.slug}`); toast('Copied!', 'success') }}>
                  Copy
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}
