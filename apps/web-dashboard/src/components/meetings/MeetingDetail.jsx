import { useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { X, Send, Paperclip, Clock, Video, User, Download, MessageSquare, FileText, CheckCircle, Ban, Edit, Calendar, MapPin, ArrowLeft, MoreVertical, Share2, CheckSquare } from 'lucide-react'
import { useAddCommentMutation, useAddAttachmentMutation, useGetMeetingQuery, useCompleteMeetingMutation, useUpdateMeetingMutation } from '../../features/meetings/meetingApi'
import { useGetUploadUrlMutation } from '../../features/uploads/uploadApi'
import { useGetAllUsersListQuery } from '../../features/users/userApi'
import { useCreateTaskMutation } from '../../features/tasks/tasksApi'
import { useToast } from '../ui/Toast'
import { useSelector } from 'react-redux'

import Badge from '../ui/Badge'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import Input from '../ui/Input'
import Select from '../ui/Select'

export default function MeetingDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { user } = useSelector(state => state.auth)

  const [showCompleteModal, setShowCompleteModal] = useState(false)
  const [completeData, setCompleteData] = useState({ outcome: '', notes: '', nextFollowUpDate: '', nextFollowUpTime: '', followUpNotes: '', createTask: false, scheduleNext: false, taskAssignedTo: '' })
  
  const [showNotesEdit, setShowNotesEdit] = useState(false)
  const [tempNotes, setTempNotes] = useState('')
  const [commentText, setCommentText] = useState('')
  const [showAddParticipant, setShowAddParticipant] = useState(false)
  const fileInputRef = useRef(null)
  
  const { data: usersData } = useGetAllUsersListQuery()
  const { data: meetingResp, isLoading } = useGetMeetingQuery(id)
  
  const [addAttachment, { isLoading: addingFile }] = useAddAttachmentMutation()
  const [addComment, { isLoading: addingComment }] = useAddCommentMutation()
  const [completeMeeting, { isLoading: completing }] = useCompleteMeetingMutation()
  const [updateMeeting] = useUpdateMeetingMutation()
  const [createTask] = useCreateTaskMutation()
  const [getUploadUrl] = useGetUploadUrlMutation()

  const meeting = meetingResp?.data

  if (isLoading) return <div className="p-8 text-center text-slate-500">Loading meeting details...</div>
  if (!meeting) return <div className="p-8 text-center text-slate-500">Meeting not found</div>

  const attendeesCount = (meeting.attendees?.length || 0) + (meeting.guest ? 1 : 0) + 1; // +1 for host

  const timeline = [
      ...(meeting.comments || []).map(c => ({ ...c, type: 'comment' })),
      ...(meeting.attachments || []).map(a => ({ ...a, type: 'attachment', createdAt: a.uploadedAt || a.createdAt || new Date() }))
  ].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))

  const handleAddParticipant = async (userId) => {
    try {
      const newAttendees = [...(meeting.attendees || []), { userId, role: 'participant', status: 'invited' }]
      await updateMeeting({ id: meeting._id, meeting: { ...meeting.meeting, attendees: newAttendees } }).unwrap()
      setShowAddParticipant(false)
      toast('Participant added', 'success')
    } catch { toast('Failed to add participant', 'error') }
  }

  const handleStatusChange = async (status) => {
    try {
      await updateMeeting({ id: meeting._id, meeting: { ...meeting.meeting, status } }).unwrap()
      toast(`Meeting marked as ${status.replace('_', ' ')}`, 'success')
    } catch { toast('Failed to update status', 'error') }
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    try {
      const { data: uploadData } = await getUploadUrl({ uploadType: 'attachments', meetingId: meeting._id, fileType: file.type, fileSize: file.size }).unwrap()
      await fetch(uploadData.uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })
      await addAttachment({ id: meeting._id, name: file.name, media: uploadData.key, fileType: file.type }).unwrap()
      toast('File attached', 'success')
    } catch (err) { toast(err?.data?.message || 'Failed to attach file', 'error') }
  }

  const handleSaveNotes = async () => {
    try {
      await updateMeeting({ id: meeting._id, meeting: { ...meeting.meeting, notes: tempNotes } }).unwrap()
      setShowNotesEdit(false)
      toast('Notes updated', 'success')
    } catch { toast('Failed to update notes', 'error') }
  }

  const handleSendComment = async (e) => {
    e?.preventDefault()
    if (!commentText.trim()) return
    try {
      await addComment({ id: meeting._id, text: commentText }).unwrap()
      setCommentText('')
    } catch { toast('Failed to post message', 'error') }
  }

  const handleCompleteMeeting = async () => {
    try {
      let nextFollowUpAt = undefined;
      if (completeData.nextFollowUpDate) {
        nextFollowUpAt = new Date(`${completeData.nextFollowUpDate}T${completeData.nextFollowUpTime || '09:00'}:00`).toISOString();
      }

      await completeMeeting({
        id: meeting._id,
        outcome: completeData.outcome || undefined,
        notes: completeData.notes || undefined,
        nextFollowUpAt,
        followUpNotes: completeData.followUpNotes || undefined
      }).unwrap()

      if (completeData.createTask) {
        await createTask({
          title: `Follow up: ${meeting.meeting?.title}`,
          description: completeData.followUpNotes || `Outcome: ${completeData.outcome}\nNotes: ${completeData.notes}`,
          dueDate: completeData.nextFollowUpDate || new Date().toISOString().slice(0, 10),
          assignedTo: completeData.taskAssignedTo || user._id,
          leadId: meeting.leadId
        }).unwrap()
        toast('Task created', 'success')
      }

      toast('Meeting completed', 'success')
      setShowCompleteModal(false)

      if (completeData.scheduleNext) {
        navigate('/meetings', { state: { scheduleNext: true, leadId: meeting.leadId } })
      }
    } catch { toast('Failed to complete meeting', 'error') }
  }

  const toggleAgendaItem = async (agendaIdx) => {
      if (!meeting.meeting?.agenda) return
      const newAgenda = [...meeting.meeting.agenda]
      newAgenda[agendaIdx] = { ...newAgenda[agendaIdx], completed: !newAgenda[agendaIdx].completed }
      try {
          await updateMeeting({ id: meeting._id, meeting: { ...meeting.meeting, agenda: newAgenda } }).unwrap()
      } catch {
          toast('Failed to update agenda', 'error')
      }
  }

  // Lifecycle status
  const statuses = ['scheduled', 'confirmed', 'in_progress', 'completed']
  let currentStatusIdx = statuses.indexOf(meeting.meeting?.status)
  if (currentStatusIdx === -1) currentStatusIdx = statuses.length; // cancelled/no show

  return (
    <div className="max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/meetings')} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-2xl font-bold text-slate-900">Meeting Details</h1>
        </div>
        <button className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors">
            <MoreVertical size={20} />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
             <div className="flex items-start justify-between mb-2">
                 <h2 className="text-xl font-bold text-slate-900">{meeting.meeting?.title}</h2>
                 <Badge variant={meeting.meeting?.status === 'confirmed' ? 'success-outline' : meeting.meeting?.status === 'completed' ? 'success' : meeting.meeting?.status === 'scheduled' ? 'primary-outline' : meeting.meeting?.status === 'cancelled' || meeting.meeting?.status === 'no_show' ? 'danger' : 'warning'} className="capitalize">
                    {meeting.meeting?.status?.replace('_', ' ')}
                 </Badge>
             </div>
             <p className="text-sm text-slate-500 mb-6">
                 Lead: <span className="font-medium text-slate-700">{meeting.leadId?.name || meeting.guest?.name || 'Internal'}</span>
             </p>

             <div className="space-y-4 mb-6">
                 <div className="flex items-center gap-3 text-sm text-slate-700">
                     <Calendar size={16} className="text-slate-400" />
                     <span className="font-medium">{new Date(meeting.meeting?.scheduledAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', weekday: 'short' })}</span>
                 </div>
                 <div className="flex items-center gap-3 text-sm text-slate-700">
                     <Clock size={16} className="text-slate-400" />
                     <span>{new Date(meeting.meeting?.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({meeting.meeting?.duration >= 60 ? `${meeting.meeting.duration/60} hr` : `${meeting.meeting.duration} min`})</span>
                 </div>
                 <div className="flex items-center gap-3 text-sm text-slate-700">
                     <Video size={16} className="text-slate-400" />
                     <span className="capitalize">{meeting.meetingType} Meeting</span>
                 </div>
                 {meeting.meeting?.link && (
                 <div className="flex items-center gap-3 text-sm">
                     <div className="w-4 h-4 rounded-full bg-blue-100 flex items-center justify-center"><Video size={10} className="text-blue-600"/></div>
                     <span className="text-slate-700">Google Meet</span>
                     <Button size="sm" variant="outline" className="ml-auto py-1 px-3 h-auto text-xs font-medium text-primary border-primary hover:bg-primary/5" onClick={() => window.open(meeting.meeting.link, '_blank')}>Join Meeting</Button>
                 </div>
                 )}
                 <div className="flex items-center gap-3 text-sm text-slate-700">
                     <MapPin size={16} className="text-slate-400" />
                     <span>{meeting.location || '-'}</span>
                 </div>
             </div>

             <div className="border-t border-slate-100 pt-4 mb-6">
                 <div className="flex items-center justify-between mb-3 relative">
                     <h3 className="text-sm font-semibold text-slate-900">Participants ({attendeesCount})</h3>
                     <button onClick={() => setShowAddParticipant(!showAddParticipant)} className="text-xs font-medium text-primary hover:underline">+ Add Participant</button>
                     {showAddParticipant && (
                         <div className="absolute top-full right-0 mt-1 w-48 bg-white border border-slate-200 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                             <div className="p-2 text-xs font-semibold text-slate-500 border-b border-slate-100">Select User</div>
                             {usersData?.data?.filter(u => u._id !== meeting.hostId?._id && !meeting.attendees?.find(a => String(a.userId?._id || a.userId) === String(u._id))).map(u => (
                                 <button key={u._id} onClick={() => handleAddParticipant(u._id)} className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 truncate">
                                     {u.name || u.email}
                                 </button>
                             ))}
                             {(!usersData?.data || usersData.data.length === 0) && <div className="p-3 text-xs text-slate-400 text-center">No users found</div>}
                         </div>
                     )}
                 </div>
                 <div className="space-y-3">
                     <div className="flex items-center gap-3">
                         <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs uppercase">
                            {((meeting.hostId?.contact?.firstName ? meeting.hostId.contact.firstName[0] : null) || (meeting.hostId?.contact?.name ? meeting.hostId.contact.name[0] : null) || 'H')}
                         </div>
                         <div>
                             <p className="text-sm font-medium text-slate-900">{meeting.hostId?.contact?.firstName ? `${meeting.hostId.contact.firstName} ${meeting.hostId.contact.lastName || ''}`.trim() : (meeting.hostId?.contact?.name || 'Host')} {meeting.hostId?._id === user?._id && '(You)'}</p>
                             <p className="text-xs text-slate-500">Host</p>
                         </div>
                     </div>
                     {meeting.guest?.name && (
                     <div className="flex items-center gap-3">
                         <div className="w-8 h-8 rounded-full bg-secondary/20 flex items-center justify-center text-secondary font-bold text-xs uppercase">
                            {meeting.guest.name[0]}
                         </div>
                         <div>
                             <p className="text-sm font-medium text-slate-900">{meeting.guest.name}</p>
                             <p className="text-xs text-slate-500">Guest</p>
                         </div>
                     </div>
                     )}
                     {meeting.attendees?.map(a => (
                     <div key={a.userId?._id || a.userId} className="flex items-center gap-3">
                         <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold text-xs uppercase">
                            {((a.userId?.contact?.firstName ? a.userId.contact.firstName[0] : null) || (a.userId?.contact?.name ? a.userId.contact.name[0] : null) || 'U')}
                         </div>
                         <div>
                             <p className="text-sm font-medium text-slate-900">{a.userId?.contact?.firstName ? `${a.userId.contact.firstName} ${a.userId.contact.lastName || ''}`.trim() : (a.userId?.contact?.name || 'Unknown')}</p>
                             <p className="text-xs text-slate-500 capitalize">{a.role}</p>
                         </div>
                     </div>
                     ))}
                 </div>
             </div>

             <div className="border-t border-slate-100 pt-4 mb-6">
                 <h3 className="text-sm font-semibold text-slate-900 mb-2">Description / Agenda</h3>
                 <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{meeting.meeting?.description || 'No description provided.'}</p>
             </div>

             <div className="border-t border-slate-100 pt-4 mb-6">
                 <div className="flex items-center justify-between mb-2">
                     <h3 className="text-sm font-semibold text-slate-900">Reminder</h3>
                     <button className="text-slate-400 hover:text-slate-600"><Edit size={14}/></button>
                 </div>
                 <p className="text-sm text-slate-600">Email & WhatsApp - 1 day before</p>
             </div>

             <div className="border-t border-slate-100 pt-4">
                 {meeting.meeting?.status !== 'completed' && meeting.meeting?.status !== 'cancelled' && (
                     <Button className="w-full" onClick={() => setShowCompleteModal(true)}>
                         Mark as Completed
                     </Button>
                 )}
             </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Grid Content */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Meeting Agenda / Discussion */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm min-h-[300px] flex flex-col">
                  <h3 className="text-sm font-bold text-slate-900 mb-4">Meeting Agenda</h3>
                  <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-2 max-h-[300px]">
                      {timeline.map((item, idx) => (
                          <div key={idx} className="flex gap-3">
                              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 text-xs font-bold uppercase shrink-0 mt-0.5">
                                  {item.type === 'comment' ? (((item.userId?.contact?.firstName ? item.userId.contact.firstName[0] : null) || (item.userId?.contact?.name ? item.userId.contact.name[0] : null) || item.userName?.[0] || 'U')) : <Paperclip size={14} />}
                              </div>
                              <div className="flex-1">
                                  <div className="flex items-baseline gap-2 mb-1">
                                      <p className="text-sm font-semibold text-slate-800">
                                          {item.type === 'comment' ? (item.userId?.contact?.firstName ? `${item.userId.contact.firstName} ${item.userId.contact.lastName || ''}`.trim() : (item.userId?.contact?.name || item.userName || 'Unknown')) : 'Attachment Uploaded'}
                                      </p>
                                      <p className="text-[10px] text-slate-400">{new Date(item.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                                  </div>
                                  {item.type === 'comment' ? (
                                      <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl rounded-tl-none text-sm text-slate-700">
                                          {item.text}
                                      </div>
                                  ) : (
                                      <a href={item.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3 rounded-xl rounded-tl-none border border-slate-100 hover:bg-slate-50 transition-colors group">
                                          <div className="w-8 h-8 rounded bg-red-50 flex items-center justify-center text-red-500">
                                              <FileText size={16} />
                                          </div>
                                          <div className="flex-1 min-w-0">
                                              <p className="text-sm font-medium text-slate-700 truncate">{item.name}</p>
                                              <p className="text-xs text-slate-500 mt-0.5">{(item.fileSize ? (item.fileSize / 1024 / 1024).toFixed(1) + ' MB' : 'Attachment')}</p>
                                          </div>
                                          <Download size={16} className="text-slate-400 group-hover:text-primary transition-colors" />
                                      </a>
                                  )}
                              </div>
                          </div>
                      ))}
                      {timeline.length === 0 && (
                          <p className="text-sm text-slate-500 italic text-center py-8">No agenda or discussion items yet.</p>
                      )}
                  </div>
                  <form onSubmit={handleSendComment} className="flex gap-2 mt-auto pt-3 border-t border-slate-100 items-end">
                      <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} disabled={addingFile} />
                      <button type="button" onClick={() => fileInputRef.current?.click()} className="h-[38px] w-[38px] p-0 flex items-center justify-center rounded-full text-slate-400 hover:text-primary hover:bg-primary/10 transition-colors shrink-0 mb-1">
                          <Paperclip size={18} />
                      </button>
                      <Input 
                          placeholder="Type an agenda item or message..." 
                          value={commentText} 
                          onChange={(e) => setCommentText(e.target.value)} 
                          wrapperClassName="flex-1 mb-0"
                      />
                      <Button type="submit" size="sm" disabled={addingComment || !commentText.trim()} className="mb-1 shrink-0 h-[38px] w-[38px] p-0 flex items-center justify-center rounded-full bg-primary hover:bg-primary/90 text-white">
                          <Send size={16} className="-ml-0.5" />
                      </Button>
                  </form>
              </div>

              <div className="space-y-6">
                  {/* Notes & Outcome */}
                  <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm min-h-[250px]">
                  <h3 className="text-sm font-bold text-slate-900 mb-4">Notes & Outcome</h3>
                  <div className="space-y-4">
                      <div>
                          <div className="flex items-center justify-between mb-1">
                              <p className="text-xs font-semibold text-slate-500">Notes</p>
                              {!showNotesEdit && (
                                  <button onClick={() => { setTempNotes(meeting.meeting?.notes || ''); setShowNotesEdit(true); }} className="text-[10px] text-primary hover:underline">Edit</button>
                              )}
                          </div>
                          {showNotesEdit ? (
                              <div className="space-y-2">
                                  <textarea className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm text-slate-700 min-h-[80px] outline-none focus:border-primary focus:ring-1 focus:ring-primary" value={tempNotes} onChange={(e) => setTempNotes(e.target.value)} placeholder="Type notes here..." />
                                  <div className="flex justify-end gap-2">
                                      <Button variant="ghost" size="sm" onClick={() => setShowNotesEdit(false)}>Cancel</Button>
                                      <Button size="sm" onClick={handleSaveNotes}>Save</Button>
                                  </div>
                              </div>
                          ) : (
                              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm text-slate-700 min-h-[80px] whitespace-pre-wrap">
                                  {meeting.meeting?.notes || 'No notes available.'}
                              </div>
                          )}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                          <div>
                              <p className="text-xs font-semibold text-slate-500 mb-1">Outcome</p>
                              {meeting.meeting?.outcome ? (
                                  <Badge color="primary" className="capitalize">{meeting.meeting.outcome.replace(/_/g, ' ')}</Badge>
                              ) : (
                                  <span className="text-sm text-slate-400">-</span>
                              )}
                          </div>
                          <div>
                              <p className="text-xs font-semibold text-slate-500 mb-1">Next Follow-up</p>
                              <div className="flex items-center gap-2 text-sm text-slate-700">
                                  {meeting.meeting?.nextFollowUpAt ? (
                                      <><Calendar size={14} className="text-slate-400"/> {new Date(meeting.meeting.nextFollowUpAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</>
                                  ) : '-'}
                              </div>
                          </div>
                      </div>
                      <button onClick={() => navigate(`/follow-ups?action=create&meetingId=${meeting._id}`)} className="text-sm font-medium text-primary hover:underline">+ Add Follow-up Task</button>
                  </div>
              </div>

              {/* Follow-up & Tasks */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm min-h-[250px]">
                  <h3 className="text-sm font-bold text-slate-900 mb-4">Follow-up & Tasks</h3>
                  <div className="space-y-3 mb-4">
                      {/* Assuming we might fetch tasks related to this meeting later. Mocking for now based on design */}
                      {meeting.meeting?.nextFollowUpAt && (
                      <div className="flex items-start gap-3 p-3 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors">
                          <div className="mt-0.5 w-4 h-4 rounded border border-slate-300"></div>
                          <div className="flex-1">
                              <p className="text-sm font-medium text-slate-700">Follow-up Meeting</p>
                              <p className="text-xs text-slate-500 mt-0.5">{user?.name} • {new Date(meeting.meeting.nextFollowUpAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</p>
                          </div>
                      </div>
                      )}
                      {!meeting.meeting?.nextFollowUpAt && (
                          <p className="text-sm text-slate-500 italic">No tasks created.</p>
                      )}
                  </div>
                  <button onClick={() => navigate(`/tasks?action=create&meetingId=${meeting._id}`)} className="text-sm font-medium text-primary hover:underline">+ Add Task</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Completion Modal */}
      <Modal isOpen={showCompleteModal} onClose={() => setShowCompleteModal(false)} title="Complete Meeting" size="md">
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700">Meeting Notes</label>
            <textarea 
              className="w-full bg-white border border-slate-200 rounded-md p-2 text-sm text-slate-700 focus:ring-1 focus:ring-primary focus:border-primary outline-none"
              rows={4}
              placeholder="What happened in the meeting?"
              value={completeData.notes}
              onChange={e => setCompleteData({...completeData, notes: e.target.value})}
            />
          </div>

          <Select 
            label="Outcome" 
            value={completeData.outcome} 
            onChange={val => setCompleteData({...completeData, outcome: val})}
            options={[
              { value: '', label: 'Select Outcome' },
              { value: 'interested', label: 'Interested' },
              { value: 'very_interested', label: 'Very Interested' },
              { value: 'needs_follow_up', label: 'Needs Follow-up' },
              { value: 'proposal_required', label: 'Proposal Required' },
              { value: 'negotiation', label: 'Negotiation' },
              { value: 'won', label: 'Won' },
              { value: 'lost', label: 'Lost' },
              { value: 'not_interested', label: 'Not Interested' },
              { value: 'other', label: 'Other' },
            ]}
          />

          <div className="pt-4 border-t border-slate-200">
            <h4 className="text-sm font-bold text-slate-900 mb-3">Next Steps</h4>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <Input label="Follow-up Date" type="date" value={completeData.nextFollowUpDate} onChange={e => setCompleteData({...completeData, nextFollowUpDate: e.target.value})} />
              <Input label="Follow-up Time" type="time" value={completeData.nextFollowUpTime} onChange={e => setCompleteData({...completeData, nextFollowUpTime: e.target.value})} />
            </div>
            
            <div className="space-y-2 mt-4">
              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input type="checkbox" className="rounded text-primary focus:ring-primary" checked={completeData.createTask} onChange={e => setCompleteData({...completeData, createTask: e.target.checked})} />
                Create Follow-up Task
              </label>
              
              {completeData.createTask && (
                <div className="pl-6 space-y-2">
                  <Input 
                    label="Task Notes" 
                    value={completeData.followUpNotes} 
                    onChange={e => setCompleteData({...completeData, followUpNotes: e.target.value})} 
                    placeholder="e.g. Send Enterprise Proposal"
                  />
                  <Select 
                    label="Assign To" 
                    value={completeData.taskAssignedTo} 
                    onChange={val => setCompleteData({...completeData, taskAssignedTo: val})}
                    options={[
                      { value: '', label: 'Assign to me' },
                      ...(usersData?.data || []).map(u => ({ value: u._id, label: u.name || u.email }))
                    ]}
                  />
                </div>
              )}

              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer mt-2">
                <input type="checkbox" className="rounded text-primary focus:ring-primary" checked={completeData.scheduleNext} onChange={e => setCompleteData({...completeData, scheduleNext: e.target.checked})} />
                Schedule Next Meeting
              </label>
            </div>
          </div>
        </div>
        <Modal.Footer>
          <Button variant="ghost" size="sm" onClick={() => setShowCompleteModal(false)}>Cancel</Button>
          <Button size="sm" onClick={handleCompleteMeeting} disabled={completing}>{completing ? 'Saving...' : 'Save & Complete'}</Button>
        </Modal.Footer>
      </Modal>
    </div>
  )
}
