import { useState, useMemo } from 'react'
import { useGetMeetingsQuery, useGetMeetingStatsQuery, useScheduleMeetingMutation, useUpdateMeetingMutation, useDeleteMeetingMutation, useGetBookingLinksQuery, useCreateBookingLinkMutation, useDeleteBookingLinkMutation, useCheckAvailabilityMutation } from '../../features/meetings/meetingApi'
import { useGetAllUsersListQuery } from '../../features/users/userApi'
import { useGetActiveLeadsQuery } from '../../features/leads/leadApi'
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
import KPICard from '../../components/ui/KPICard'
import { useToast } from '../../components/ui/Toast'
import DynamicCustomFieldInput from '../../components/ui/DynamicCustomFieldInput'
import { Calendar, Plus, Clock, Video, Link2, Copy, Pencil, Trash2, X, CheckCircle, Ban, Search, Filter, MoreVertical, CheckCircle2 } from 'lucide-react'
import Pagination from '../../components/ui/Pagination'
import { useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'

export default function Meetings() {
  const toast = useToast()
  const navigate = useNavigate()
  const { user } = useSelector(state => state.auth)
  const [activeTab, setActiveTab] = useState('all')
  const [showSchedule, setShowSchedule] = useState(false)
  const [showCreateLink, setShowCreateLink] = useState(false)
  
  const [meetingData, setMeetingData] = useState({ title: '', leadId: '', date: '', startTime: '09:00', endTime: '10:00', duration: 60, attendees: [], meetingUrl: '', provider: 'sparkcrm', meetingType: 'online', category: 'general', location: '', description: '', customFields: {} })
  
  const [linkData, setLinkData] = useState({ 
    title: '', assignmentType: 'specific_user', assignedUserId: '', assignedUserIds: [], fallbackUserId: '', durationOptions: [30], defaultDuration: 30, slotInterval: 15, provider: 'sparkcrm', availability: { days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'], startTime: '09:00', endTime: '18:00' }
  })
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 25

  const queryParams = useMemo(() => {
    const params = { page, limit: PAGE_SIZE }
    const todayStr = new Date().toISOString().split('T')[0]
    
    if (activeTab === 'upcoming') {
      params.from = todayStr
      params.status = 'scheduled,confirmed,in_progress'
    } else if (activeTab === 'today') {
      params.from = todayStr
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      params.to = tomorrow.toISOString().split('T')[0]
    } else if (activeTab === 'completed') {
      params.status = 'completed'
    } else if (activeTab === 'cancelled') {
      params.status = 'cancelled,no_show'
    }
    return params
  }, [activeTab, page])

  const { data: statsData } = useGetMeetingStatsQuery()
  const { data: meetingsData, isLoading } = useGetMeetingsQuery(queryParams, { skip: activeTab === 'links' })
  const { data: linksData, isFetching: isFetchingLinks } = useGetBookingLinksQuery(undefined, { skip: activeTab !== 'links' })
  const { data: usersData, isFetching: isFetchingUsers } = useGetAllUsersListQuery(undefined, { skip: !showSchedule && !showCreateLink })
  const { data: leadsData } = useGetActiveLeadsQuery({ page: 1, limit: 100 }, { skip: !showSchedule })
  const { data: fieldsData } = useGetCustomFieldsQuery({ entity: 'Meeting' }, { skip: !showSchedule })
  
  const [scheduleMeeting, { isLoading: scheduling }] = useScheduleMeetingMutation()
  const [deleteMeeting] = useDeleteMeetingMutation()
  const [createLink, { isLoading: creatingLink }] = useCreateBookingLinkMutation()
  const [deleteLink] = useDeleteBookingLinkMutation()
  const [checkAvailability, { isLoading: checkingAvailability }] = useCheckAvailabilityMutation()
  
  const [availabilityResult, setAvailabilityResult] = useState(null)
  const [selectedAttendee, setSelectedAttendee] = useState('')

  const stats = statsData?.data || { today: 0, upcoming: 0, completed: 0, cancelled: 0 }
  const meetings = meetingsData?.data || []
  const pagination = meetingsData?.pagination || {}
  const bookingLinks = linksData?.data || []

  const handleSchedule = async () => {
    try {
      const { date, startTime, leadId, title, duration, meetingUrl, attendees, provider, meetingType, category, location, description, customFields } = meetingData
      
      if (!date || !startTime) return toast('Date and Time are required', 'error')

      const dateTime = new Date(`${date}T${startTime}:00`).toISOString()

      const meetingFields = fieldsData?.data || [];
      for (const field of meetingFields) {
        if (field.isRequired && !customFields[field.name]) {
          return toast(`${field.label} is required`, 'error')
        }
      }

      const payload = { 
        provider: meetingType === 'online' ? 'google_meet' : null,
        category,
        meeting: { 
            title, 
            description, 
            scheduledAt: dateTime, 
            duration, 
            link: meetingType === 'online' ? meetingUrl : null,
            meetingType,
            location: meetingType === 'offline' ? location : null
        },
        attendees: attendees.map(a => ({ userId: a.userId })),
        customFields 
      }
      if (leadId) payload.leadId = leadId
      await scheduleMeeting(payload).unwrap()
      toast('Meeting scheduled', 'success')
      setShowSchedule(false)
      setMeetingData({ title: '', leadId: '', date: '', startTime: '09:00', endTime: '10:00', duration: 60, attendees: [], meetingUrl: '', provider: 'sparkcrm', meetingType: 'online', category: 'general', location: '', description: '', customFields: {} })
      setAvailabilityResult(null)
    } catch { toast('Failed to schedule', 'error') }
  }

  const handleCheckAvailability = async () => {
    if (!meetingData.date || !meetingData.duration) return toast('Select date and duration first', 'warning')
    try {
        const participants = [user?._id, ...meetingData.attendees.map(a => a.userId)].filter(Boolean)
        const { data } = await checkAvailability({ date: meetingData.date, duration: meetingData.duration, participants }).unwrap()
        setAvailabilityResult(data.existingMeetings || [])
    } catch {
        toast('Failed to check availability', 'error')
    }
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
    { key: 'all', label: 'All', count: activeTab === 'all' ? pagination.total || meetings.length : undefined },
    { key: 'my_meetings', label: 'My Meetings', count: activeTab === 'my_meetings' ? pagination.total || meetings.length : undefined },
    { key: 'team_meetings', label: 'Team Meetings', count: activeTab === 'team_meetings' ? pagination.total || meetings.length : undefined },
    { key: 'upcoming', label: 'Upcoming', count: activeTab === 'upcoming' ? pagination.total || meetings.length : undefined },
    { key: 'completed', label: 'Completed', count: activeTab === 'completed' ? pagination.total || meetings.length : undefined },
    { key: 'cancelled', label: 'Cancelled', count: activeTab === 'cancelled' ? pagination.total || meetings.length : undefined },
    { key: 'links', label: 'Booking Links', count: activeTab === 'links' ? bookingLinks.length : undefined },
  ]

  return (
    <>
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
        <h1 className="text-2xl font-bold text-slate-900">Meetings</h1>
        <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-80 hidden md:block">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="text" placeholder="Search lead, customer, meeting..." className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-full text-sm shadow-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
            </div>
            <Button size="sm" onClick={() => setShowSchedule(true)}>
            <Plus size={14} className="mr-1"/> Schedule Meeting
            </Button>
        </div>
      </div>

      <div className="mb-6 border-b border-slate-200">
        <Tabs tabs={tabs} activeTab={activeTab} onChange={(t) => { setActiveTab(t); setPage(1); }} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <KPICard title="Today" value={String(stats.today).padStart(2, '0')} change="Meetings" changeType="up" icon={Calendar} iconColor="primary" />
        <KPICard title="Upcoming" value={String(stats.upcoming).padStart(2, '0')} change="This Week" changeType="up" icon={Calendar} iconColor="info" />
        <KPICard title="Completed" value={String(stats.completed).padStart(2, '0')} change="This Month" changeType="up" icon={CheckCircle} iconColor="success" />
        <KPICard title="Cancelled" value={String(stats.cancelled).padStart(2, '0')} change="This Month" changeType="down" icon={Ban} iconColor="danger" />
      </div>

      {activeTab !== 'links' && (
        <Card className="p-0 overflow-hidden border border-slate-200 shadow-sm">
          <div className="p-4 border-b border-slate-200 bg-white flex items-center justify-between gap-4 flex-wrap">
             <div className="flex items-center gap-3 flex-1 min-w-[300px] relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="text" placeholder="Search meeting title, lead, participant..." className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-primary" />
             </div>
             <div className="flex items-center gap-3">
                 <Select options={[{value: '', label: 'All Users'}]} value="" onChange={()=>{}} className="w-36 bg-slate-50" />
                 <Select options={[{value: '', label: 'All Types'}]} value="" onChange={()=>{}} className="w-36 bg-slate-50" />
                 <Input type="date" value="" onChange={()=>{}} className="w-40 bg-slate-50" />
                 <Button variant="outline" className="flex items-center gap-2"><Filter size={14}/> Filters</Button>
             </div>
          </div>

          {isLoading ? (
            <div className="text-center py-12 text-slate-500">Loading...</div>
          ) : meetings.length === 0 ? (
            <EmptyState icon={Calendar} title="No meetings found" description="No meetings match your current view."
              action={<Button size="sm" onClick={() => setShowSchedule(true)}><Plus size={14} /> Schedule</Button>} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-medium">
                  <tr>
                    <th className="px-6 py-4">Title</th>
                    <th className="px-6 py-4">Lead / Customer</th>
                    <th className="px-6 py-4">Date & Time</th>
                    <th className="px-6 py-4">Type</th>
                    <th className="px-6 py-4">Participants</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {meetings.map((m) => {
                    const attendeesCount = (m.attendees?.length || 0) + (m.guest ? 1 : 0);
                    return (
                      <tr key={m._id} className="hover:bg-slate-50 cursor-pointer transition-colors" onClick={() => navigate(`/meetings/${m._id}`)}>
                        <td className="px-6 py-4">
                          <p className="font-semibold text-slate-900">{m.meeting?.title}</p>
                          {m.meeting?.description && <p className="text-xs text-slate-500 truncate max-w-[200px]">{m.meeting.description}</p>}
                        </td>
                        <td className="px-6 py-4">
                          {m.leadId ? (
                             <p className="text-slate-700 font-medium">{m.leadId.name || 'Unknown Lead'}</p>
                          ) : m.guest ? (
                             <p className="text-slate-700 font-medium">{m.guest.name}</p>
                          ) : (
                             <p className="text-slate-500 text-xs italic">Internal</p>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-slate-900 font-medium">{new Date(m.meeting?.scheduledAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                          <p className="text-slate-500 text-xs">{new Date(m.meeting?.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1.5 text-slate-700">
                            {m.meeting?.meetingType === 'online' ? <Video size={14} className="text-primary"/> : m.meeting?.meetingType === 'phone' ? <Clock size={14} className="text-warning"/> : <Calendar size={14} className="text-slate-400"/>}
                            <span className="capitalize">{m.meeting?.meetingType}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                           <div className="flex items-center">
                              <div className="flex -space-x-2">
                                 <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center border-2 border-white text-xs font-bold text-primary">U</div>
                                 {attendeesCount > 1 && <div className="w-8 h-8 rounded-full bg-secondary/20 flex items-center justify-center border-2 border-white text-xs font-bold text-secondary">A</div>}
                              </div>
                              {attendeesCount > 2 && <span className="ml-2 text-xs font-medium text-slate-500">+{attendeesCount - 2}</span>}
                           </div>
                        </td>
                        <td className="px-6 py-4">
                           <span className={`px-2.5 py-1 text-xs font-medium rounded-md capitalize border ${m.meeting?.status === 'confirmed' ? 'bg-green-50 text-green-700 border-green-200' : m.meeting?.status === 'completed' ? 'bg-green-100 text-green-800 border-green-200' : m.meeting?.status === 'scheduled' ? 'bg-blue-50 text-blue-700 border-blue-200' : m.meeting?.status === 'cancelled' || m.meeting?.status === 'no_show' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-yellow-50 text-yellow-700 border-yellow-200'}`}>
                              {m.meeting?.status?.replace('_', ' ')}
                           </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                           <button onClick={(e) => { e.stopPropagation(); }} className="p-1.5 rounded hover:bg-slate-200 text-slate-500 transition-colors">
                              <MoreVertical size={16} />
                           </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {pagination.totalPages > 1 && (
            <div className="p-4 border-t border-slate-200">
              <Pagination currentPage={page} totalPages={pagination.totalPages || 1} totalItems={pagination.total} pageSize={PAGE_SIZE} onPageChange={setPage} />
            </div>
          )}
        </Card>
      )}

      {activeTab === 'links' && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900">Booking Links</h3>
            <Button size="sm" onClick={() => setShowCreateLink(true)}><Plus size={14} className="mr-1"/> Create Link</Button>
          </div>
          {isFetchingLinks ? (
            <div className="text-center py-12 text-slate-500">Loading links...</div>
          ) : bookingLinks.length === 0 ? (
            <EmptyState icon={Link2} title="No booking links" description="Create a shareable link so leads can book meetings with you" />
          ) : (
            <div className="space-y-3">
              {bookingLinks.map((link) => (
                <div key={link._id} className="flex items-center justify-between p-4 rounded-xl border border-slate-200 hover:border-primary/50 transition-colors bg-white">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{link.title}</p>
                    <a 
                      href={`${window.location.origin}/book/${link.slug}`} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-xs text-primary mt-1 hover:underline block"
                    >
                      {window.location.origin}/book/{link.slug}
                    </a>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/book/${link.slug}`); toast('Link copied!', 'success') }}>
                      <Copy size={14} className="mr-1"/> Copy
                    </Button>
                    <button onClick={() => handleDeleteLink(link._id)} className="p-2 rounded-lg hover:bg-danger/10 text-danger transition-colors">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Schedule Modal */}
      <Modal isOpen={showSchedule} onClose={() => setShowSchedule(false)} title="Schedule Meeting" size="lg">
        <div className="space-y-5">
          <div className="space-y-1.5">
             <label className="text-sm font-medium text-slate-700">Lead / Customer <span className="text-danger">*</span></label>
             <Select 
                value={meetingData.leadId} 
                onChange={(val) => setMeetingData({ ...meetingData, leadId: val })} 
                options={[ 
                   { value: '', label: 'Select Lead / Customer' }, 
                   ...(leadsData?.data || []).map(lead => ({ value: lead._id, label: `${lead.contact?.firstName || ''} ${lead.contact?.lastName || ''}`.trim() || lead.leadNumber || 'Unknown Lead' })) 
                ]} 
             />
          </div>

          <div className="space-y-1.5">
             <label className="text-sm font-medium text-slate-700">Meeting Title <span className="text-danger">*</span></label>
             <Input placeholder="e.g. Product Demo Discussion" value={meetingData.title} onChange={(e) => setMeetingData({ ...meetingData, title: e.target.value })} />
          </div>

          <div className="space-y-1.5">
             <label className="text-sm font-medium text-slate-700">Meeting Type</label>
             <div className="flex items-center">
                 <button 
                    onClick={() => setMeetingData({ ...meetingData, meetingType: 'online' })} 
                    className={`px-6 py-2 text-sm font-medium rounded-l-md border ${meetingData.meetingType === 'online' ? 'bg-primary text-white border-primary' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                    Online
                 </button>
                 <button 
                    onClick={() => setMeetingData({ ...meetingData, meetingType: 'offline' })} 
                    className={`px-6 py-2 text-sm font-medium rounded-r-md border-y border-r ${meetingData.meetingType === 'offline' ? 'bg-primary text-white border-primary' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                    Offline
                 </button>
             </div>
          </div>

          {meetingData.meetingType === 'offline' && (
              <div className="space-y-1.5">
                 <label className="text-sm font-medium text-slate-700">Location <span className="text-danger">*</span></label>
                 <Input placeholder="e.g. Main Office / 123 Street" value={meetingData.location} onChange={(e) => setMeetingData({ ...meetingData, location: e.target.value })} />
              </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div className="space-y-1.5">
                 <label className="text-sm font-medium text-slate-700">Date <span className="text-danger">*</span></label>
                 <Input type="date" value={meetingData.date} onChange={(e) => { setMeetingData({ ...meetingData, date: e.target.value }); setAvailabilityResult(null); }} />
             </div>
             <div className="space-y-1.5 flex flex-col justify-end">
                 <label className="text-sm font-medium text-slate-700">Time <span className="text-danger">*</span></label>
                 <div className="flex items-center gap-2">
                     <Input type="time" value={meetingData.startTime} onChange={(e) => setMeetingData({ ...meetingData, startTime: e.target.value })} />
                     <span className="text-slate-500 text-sm">to</span>
                     <Input type="time" value={meetingData.endTime} onChange={(e) => setMeetingData({ ...meetingData, endTime: e.target.value })} />
                 </div>
             </div>
          </div>

          <div className="space-y-1.5">
             <label className="text-sm font-medium text-slate-700">Duration</label>
             <Select 
                value={meetingData.duration} 
                onChange={(val) => setMeetingData({ ...meetingData, duration: +val })} 
                options={[ { value: 15, label: '15 min' }, { value: 30, label: '30 min' }, { value: 45, label: '45 min' }, { value: 60, label: '1 hour' } ]} 
             />
          </div>
          
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">Participants</label>
            <div className="flex items-center flex-wrap gap-2 mb-2">
               <Badge className="flex items-center gap-1 bg-slate-100 text-slate-700 border border-slate-200 rounded-md py-1">{user?.name || 'You'} (Host)</Badge>
               {meetingData.attendees.map(a => (
                 <Badge key={a.userId} className="flex items-center gap-1 bg-slate-100 text-slate-700 border border-slate-200 rounded-md py-1">
                   {a.name}
                   <X size={12} className="cursor-pointer" onClick={() => setMeetingData({ ...meetingData, attendees: meetingData.attendees.filter(att => att.userId !== a.userId) })} />
                 </Badge>
               ))}
               <Select
                  value={selectedAttendee}
                  onChange={(val) => {
                     if (!val) return
                     const user = usersData?.data?.find(u => u._id === val)
                     if (user && !meetingData.attendees.some(a => a.userId === user._id)) {
                        setMeetingData({ 
                           ...meetingData, 
                           attendees: [...meetingData.attendees, { userId: user._id, name: user.name, email: user.email }] 
                        })
                     }
                     setSelectedAttendee('')
                  }}
                  className="w-48 text-xs border-0 shadow-none focus:ring-0"
                  options={[
                  { value: '', label: isFetchingUsers ? 'Loading...' : '+ Add Participant' },
                  ...(usersData?.data || []).map(u => ({ value: u._id, label: u.name || u.email }))
                  ]}
               />
            </div>
          </div>

          <div className="space-y-1.5">
             <label className="text-sm font-medium text-slate-700">Description / Agenda</label>
             <textarea 
                className="w-full bg-white border border-slate-200 rounded-md p-2 text-sm focus:outline-none focus:border-primary min-h-[80px]" 
                placeholder="Product demo for Acme Corp team..."
                value={meetingData.description}
                onChange={(e) => setMeetingData({ ...meetingData, description: e.target.value })}
             />
          </div>

          <div className="space-y-2 pt-2">
             <label className="text-sm font-medium text-slate-700">Check Availability</label>
             <div className="flex gap-2">
                 <Select value="host" options={[{value: 'host', label: user?.name || 'You'}]} onChange={()=>{}} className="flex-1"/>
                 <Button variant="outline" onClick={handleCheckAvailability} disabled={checkingAvailability || !meetingData.date}>
                    {checkingAvailability ? 'Checking...' : 'Check'}
                 </Button>
             </div>
             {availabilityResult && (
                <div className="mt-3">
                   <p className="text-xs font-semibold text-slate-500 mb-2">Available Slots</p>
                   <div className="flex flex-wrap gap-2">
                      <span className="px-3 py-1.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200 flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-green-500"></div> 11:00 AM - 12:00 PM</span>
                      <span className="px-3 py-1.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200 flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-green-500"></div> 12:30 PM - 01:30 PM</span>
                   </div>
                </div>
             )}
          </div>

          <div className="pt-4 flex items-center justify-end border-t border-slate-200">
             <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setShowSchedule(false)}>Cancel</Button>
                <Button onClick={handleSchedule} disabled={scheduling}>{scheduling ? 'Scheduling...' : 'Schedule Meeting'}</Button>
             </div>
          </div>
        </div>
      </Modal>

    </>
  )
}
