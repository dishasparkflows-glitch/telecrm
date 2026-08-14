import { useState } from 'react'
import { X, Send, Paperclip, Clock, Video, User, Download, MessageSquare } from 'lucide-react'
import { useAddCommentMutation, useAddAttachmentMutation, useGetMeetingQuery } from '../../features/meetings/meetingApi'
import { useGetUploadUrlMutation } from '../../features/uploads/uploadApi'
import { useGetCustomFieldsQuery } from '../../features/custom-fields/customFieldApi'
import { useGetAllUsersListQuery } from '../../features/users/userApi'
import { useToast } from '../ui/Toast'
import { useSelector } from 'react-redux'

import Badge from '../ui/Badge'
import Modal from '../ui/Modal'

export default function MeetingDetail({ meeting: initialMeeting, isOpen, onClose }) {
  const toast = useToast()
  const { user } = useSelector(state => state.auth)
  const [commentText, setCommentText] = useState('')
  const { data: fieldsResp } = useGetCustomFieldsQuery()
  const { data: usersData } = useGetAllUsersListQuery()
  const { data: meetingResp } = useGetMeetingQuery(initialMeeting?._id, { skip: !initialMeeting?._id })
  const [addComment, { isLoading: addingComment }] = useAddCommentMutation()
  const [getUploadUrl] = useGetUploadUrlMutation()
  const [addAttachment, { isLoading: addingFile }] = useAddAttachmentMutation()
  const meeting = meetingResp?.data || initialMeeting

  if (!meeting) return null

  const handleSendComment = async () => {
    if (!commentText.trim()) return
    try {
      await addComment({ 
        id: meeting._id, 
        text: commentText, 
        userName: user?.name || 'User' 
      }).unwrap()
      setCommentText('')
    } catch { toast('Failed to post comment', 'error') }
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    try {
      // 1. Get presigned URL
      const { data: uploadData } = await getUploadUrl({
        uploadType: 'attachments',
        meetingId: meeting._id,
        fileType: file.type,
        fileSize: file.size
      }).unwrap()

      const { uploadUrl } = uploadData

      // 2. Upload to Cloudflare/S3
      await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type }
      })

      // 3. Save attachment metadata to meeting
      await addAttachment({
        id: meeting._id,
        name: file.name,
        media: uploadData.key,
        fileType: file.type
      }).unwrap()

      toast('File attached', 'success')
    } catch (err) { 
      toast(err?.data?.message || 'Failed to attach file', 'error') 
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={meeting.meeting?.title} size="lg">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Info */}
        <div className="md:col-span-1 space-y-6">
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-[var(--vz-heading)] uppercase tracking-wider">Details</h4>
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-[var(--vz-text-muted)]">
                <Clock size={16} className="text-primary" />
                <span>{new Date(meeting.meeting?.scheduledAt).toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-[var(--vz-text-muted)]">
                <Video size={16} className="text-primary" />
                <span>{meeting.meeting?.duration} Minutes</span>
              </div>
              {meeting.meeting?.link && (
                <div className="flex items-center gap-2 text-sm text-primary font-medium hover:underline">
                  <Video size={16} />
                  <a href={meeting.meeting?.link} target="_blank" rel="noreferrer">Join Meeting</a>
                </div>
              )}
              <div className="pt-2">
                <Badge color={meeting.meeting?.status === 'confirmed' ? 'success' : 'warning'}>{meeting.meeting?.status || 'scheduled'}</Badge>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-sm font-bold text-[var(--vz-heading)] uppercase tracking-wider">Attendees</h4>
            <div className="space-y-2">
              <div className="flex items-center gap-2 p-2 rounded bg-primary/5">
                <User size={14} className="text-primary" />
                <span className="text-xs font-medium text-[var(--vz-heading)]">{meeting.hostId?.contact?.name || 'Host'} (Host)</span>
              </div>
              {meeting.attendees?.map((a, i) => {
                const userName = a.userId?.contact?.name || usersData?.data?.find(u => u._id === (a.userId?._id || a.userId))?.contact?.name || 'Unknown User'
                return (
                  <div key={i} className="flex items-center gap-2 p-2 rounded hover:bg-[var(--vz-body-bg)]">
                    <User size={14} className="text-[var(--vz-text-muted)]" />
                    <span className="text-xs text-[var(--vz-heading)]">{userName}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Custom Fields */}
          {fieldsResp?.data?.filter(f => f.targetEntity === 'Meeting').length > 0 && (
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-[var(--vz-heading)] uppercase tracking-wider">Extended Info</h4>
              <div className="space-y-3">
                {fieldsResp.data.filter(f => f.targetEntity === 'Meeting').map(field => (
                  <div key={field._id} className="p-2 rounded border border-[var(--vz-border)] bg-[var(--vz-input-bg)]/50">
                    <p className="text-[10px] text-[var(--vz-text-muted)] uppercase font-bold">{field.name}</p>
                    <p className="text-xs text-[var(--vz-heading)]">{meeting.customFields?.[field.name] || '—'}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Collaboration */}
        <div className="md:col-span-2 space-y-6 flex flex-col h-[500px]">
          <h4 className="text-sm font-bold text-[var(--vz-heading)] uppercase tracking-wider flex items-center gap-2">
            <MessageSquare size={16} /> Discussion
          </h4>

          {/* Activity List */}
          <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
            {meeting.comments?.length === 0 ? (
               <div className="text-center py-10 text-[var(--vz-text-muted)] text-xs italic">No discussion yet. Start the conversation!</div>
            ) : (
                meeting.comments?.map((c, i) => (
                  <div key={i} className={`flex flex-col ${c.userId === user?._id ? 'items-end' : 'items-start'}`}>
                    <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${c.userId === user?._id ? 'bg-primary text-white rounded-tr-none' : 'bg-[var(--vz-body-bg)] text-[var(--vz-heading)] rounded-tl-none'}`}>
                        {c.text}
                    </div>
                    <span className="text-[10px] text-[var(--vz-text-muted)] mt-1 px-1">
                      {c.userId?.contact?.name || 'Unknown'} • {new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))
            )}

            {/* Attachments List */}
            {meeting.attachments?.length > 0 && (
              <div className="pt-4 border-t border-[var(--vz-border)]">
                <p className="text-[10px] font-bold text-[var(--vz-text-muted)] uppercase mb-2">Attachments</p>
                <div className="flex flex-wrap gap-2">
                  {meeting.attachments.map((at, i) => (
                    <a key={i} href={at.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--vz-border)] hover:bg-[var(--vz-body-bg)] transition-colors group">
                      <Paperclip size={14} className="text-primary" />
                      <span className="text-xs text-[var(--vz-heading)] truncate max-w-[120px]">{at.name}</span>
                      <Download size={12} className="text-[var(--vz-text-muted)] group-hover:text-primary" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="pt-4 border-t border-[var(--vz-border)]">
              <div className="flex items-center gap-2 bg-[var(--vz-body-bg)] p-2 rounded-xl focus-within:ring-1 focus-within:ring-primary/30 transition-shadow">
                <label className="p-2 text-[var(--vz-text-muted)] hover:text-primary transition-colors cursor-pointer">
                  <Paperclip size={18} />
                  <input type="file" className="hidden" onChange={handleFileUpload} disabled={addingFile} />
                </label>
                <input 
                  type="text"
                  placeholder="Type a message..."
                  className="flex-1 bg-transparent text-sm outline-none text-[var(--vz-heading)]"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendComment()}
                />
                <button 
                  onClick={handleSendComment}
                  disabled={!commentText.trim() || addingComment}
                  className="p-2 bg-primary text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  <Send size={18} />
                </button>
              </div>
              {addingFile && <p className="text-[10px] text-primary animate-pulse mt-1 px-2">Uploading file...</p>}
          </div>
        </div>
      </div>
    </Modal>
  )
}
