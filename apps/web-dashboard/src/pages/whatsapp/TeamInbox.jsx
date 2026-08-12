import { useState, useEffect, useMemo, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { io as socketIO } from 'socket.io-client'
import { whatsappApi, useGetTeamInboxQuery, useGetInboxChatQuery, useSendMessageMutation, useReplyToMessageMutation, useMarkInboxReadMutation, flattenMessage } from '../../features/whatsapp/whatsappApi'
import PageHeader from '../../components/layout/PageHeader'
import { useToast } from '../../components/ui/Toast'
import ChatComposer from '../../components/whatsapp/ChatComposer'
import MessageMedia from '../../components/whatsapp/MessageMedia'
import MessageActions from '../../components/whatsapp/MessageActions'
import {
  Inbox, MessageSquare, Search, Phone,
  CheckCheck, Check, Loader2, RefreshCw, ArrowLeft,
} from 'lucide-react'

const WA_SOCKET_URL = import.meta.env.VITE_WS_URL || window.location.origin

/* ── Helpers ───────────────────────────────────────────────── */
function timeAgo(dateStr) {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

function formatTime(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function getInitials(name) {
  if (!name) return '?'
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

/* ── Message bubble ────────────────────────────────────────── */
function MessageBubble({ msg, contacts, onReply, toast }) {
  const isOut = msg.direction === 'outbound'
  return (
    <div id={`wa-inbox-message-${msg._id}`} className={`group flex ${isOut ? 'justify-end' : 'justify-start'} mb-2`}>
      <div
        className={`relative max-w-[72%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm ${
          isOut
            ? 'bg-[#dcf8c6] text-gray-800 rounded-br-sm'
            : 'bg-[var(--vz-card-bg)] text-[var(--vz-heading)] rounded-bl-sm border border-[var(--vz-border)]'
        }`}
      >
        <MessageActions message={msg} contacts={contacts} onReply={onReply} toast={toast} />
        {msg.isForwarded && <p className="text-[10px] italic text-gray-500 mb-1">Forwarded</p>}
        {msg.replyTo?.snapshot && <div className="border-l-2 border-emerald-500 bg-black/5 rounded px-2 py-1.5 mb-1.5 text-xs truncate">{msg.replyTo.snapshot.content || msg.replyTo.snapshot.mediaName || msg.replyTo.snapshot.type}</div>}
        {['image', 'video', 'audio', 'document'].includes(msg.type) && <MessageMedia message={msg} outgoing={isOut} />}
        {msg.content && <p className={`break-words ${msg.type !== 'text' ? 'mt-1.5' : ''}`}>{msg.content}</p>}
        {msg.reactions?.length > 0 && <div className="flex flex-wrap gap-1 mt-1">{msg.reactions.map((reaction, index) => <span key={`${reaction.emoji}-${index}`} className="px-1.5 py-0.5 rounded-full bg-black/10">{reaction.emoji}</span>)}</div>}
        <div className={`flex items-center gap-1 mt-1 ${isOut ? 'justify-end' : 'justify-start'}`}>
          <span className="text-[10px] text-gray-500">{formatTime(msg.meta?.createdAt)}</span>
          {isOut && (
            msg.status === 'read'
              ? <CheckCheck size={12} className="text-blue-500" />
              : msg.status === 'delivered'
              ? <CheckCheck size={12} className="text-gray-400" />
              : <Check size={12} className="text-gray-400" />
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Conversation row ──────────────────────────────────────── */
function ConvRow({ conv, active, onClick }) {
  const phone = conv._id
  const lastMsg = conv.lastMessage || {}
  const isUnread = conv.unreadCount > 0

  return (
    <button
      onClick={onClick}
      className={`w-full text-left flex items-center gap-3 px-4 py-3.5 border-b border-[var(--vz-border)] transition-colors relative ${
        active
          ? 'bg-primary/10 border-l-4 border-l-primary pl-3'
          : 'hover:bg-[var(--vz-input-bg)] border-l-4 border-l-transparent'
      }`}
    >
      {/* Avatar */}
      <div className={`w-11 h-11 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-bold
        ${active ? 'bg-primary text-white' : 'bg-emerald-500/20 text-emerald-600'}`}>
        {getInitials(conv.leadName || phone?.slice(-4))}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <p className={`text-sm truncate ${isUnread ? 'font-bold text-[var(--vz-heading)]' : 'font-medium text-[var(--vz-heading)]'}`}>
            {conv.leadName || phone}
          </p>
          <span className="text-[10px] text-[var(--vz-text-muted)] ml-2 flex-shrink-0">
            {timeAgo(lastMsg.meta?.createdAt)}
          </span>
        </div>
        <div className="flex items-center justify-between mt-0.5">
          <p className={`text-xs truncate max-w-[180px] ${isUnread ? 'text-[var(--vz-text)] font-medium' : 'text-[var(--vz-text-muted)]'}`}>
            {lastMsg.direction === 'outbound' ? '✓ ' : ''}{lastMsg.content || ''}
          </p>
          {isUnread && (
            <span className="ml-2 flex-shrink-0 px-1.5 py-0.5 text-[10px] font-bold bg-emerald-500 text-white rounded-full min-w-[20px] text-center">
              {conv.unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}

/* ── Main Component ────────────────────────────────────────── */
export default function TeamInbox() {
  const toast = useToast()
  const dispatch = useDispatch()
  const token = useSelector((state) => state.auth.token)

  const [selectedPhone, setSelectedPhone] = useState(null)
  const [search, setSearch] = useState('')
  const [reply, setReply] = useState('')
  const [replyingTo, setReplyingTo] = useState(null)
  const [mobileShowChat, setMobileShowChat] = useState(false)

  const messagesEndRef = useRef(null)

  // Polling: refresh inbox every 30 seconds
  const { data: inboxData, isLoading: inboxLoading, refetch } = useGetTeamInboxQuery(
    {},
    { pollingInterval: 30000 }
  )
  const conversations = (inboxData?.data || [])

  // Auto-poll selected chat every 10 seconds when open
  const { data: chatData, isLoading: chatLoading } = useGetInboxChatQuery(selectedPhone, {
    skip: !selectedPhone,
    pollingInterval: 10000,
  })
  const messages = useMemo(() => chatData?.data || [], [chatData?.data])

  const [sendMessage, { isLoading: sending }] = useSendMessageMutation()
  const [replyToMessage, { isLoading: replying }] = useReplyToMessageMutation()
  const [markRead] = useMarkInboxReadMutation()

  useEffect(() => {
    if (!token) return undefined
    const socket = socketIO(WA_SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
    })

    socket.on('wa:message', ({ message }) => {
      if (!message?._id) return
      const flatMsg = flattenMessage(message)
      const phone = flatMsg.direction === 'inbound' ? flatMsg.from : flatMsg.to
      dispatch(whatsappApi.util.updateQueryData('getInboxChat', phone, (draft) => {
        if (!Array.isArray(draft?.data)) return
        const index = draft.data.findIndex((item) => item._id === flatMsg._id)
        if (index >= 0) draft.data[index] = flatMsg
        else draft.data.push(flatMsg)
        draft.data.sort((a, b) => new Date(a.meta?.createdAt) - new Date(b.meta?.createdAt))
      }))
      dispatch(whatsappApi.util.invalidateTags([{ type: 'WhatsApp', id: 'INBOX' }]))
    })

    return () => socket.disconnect()
  }, [dispatch, token])

  // Auto-scroll to bottom when messages load
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Mark as read when opening a conversation
  useEffect(() => {
    if (selectedPhone) {
      markRead(selectedPhone).catch(() => {})
    }
  }, [selectedPhone, markRead])

  const selectedConv = conversations.find(c => c._id === selectedPhone)

  const filteredConvs = conversations.filter(c => {
    const q = search.toLowerCase()
    return !q || (c._id || '').includes(q) || (c.leadName || '').toLowerCase().includes(q)
  })

  const totalUnread = conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0)
  const actionContacts = conversations.map((conversation) => ({ id: conversation._id, phone: conversation._id, name: conversation.leadName || conversation._id }))

  const handleSend = async () => {
    if (!reply.trim() || !selectedPhone) return
    const text = reply.trim()
    setReply('')
    try {
      if (replyingTo) await replyToMessage({ id: replyingTo._id, to: selectedPhone, content: text, type: 'text' }).unwrap()
      else await sendMessage({ to: selectedPhone, content: text, type: 'text' }).unwrap()
      setReplyingTo(null)
    } catch (e) {
      toast(e?.data?.message || 'Failed to send message', 'error')
      setReply(text) // restore on failure
    }
  }

  const handleSendMedia = async (media) => {
    if (!selectedPhone) throw new Error('Select a conversation first')
    if (replyingTo) await replyToMessage({ id: replyingTo._id, to: selectedPhone, ...media }).unwrap()
    else await sendMessage({ to: selectedPhone, ...media }).unwrap()
    setReplyingTo(null)
  }



  const handleSelectConv = (phone) => {
    setSelectedPhone(phone)
    setMobileShowChat(true)
  }

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            Team Inbox
            {totalUnread > 0 && (
              <span className="px-2 py-0.5 text-[11px] font-bold bg-emerald-500 text-white rounded-full">
                {totalUnread}
              </span>
            )}
          </span>
        }
        breadcrumbs={[{ label: 'WhatsApp', path: '/whatsapp' }, { label: 'Team Inbox' }]}
        actions={
          <button
            onClick={refetch}
            className="p-2 rounded-lg border border-[var(--vz-border)] hover:bg-[var(--vz-input-bg)] text-[var(--vz-text-muted)] transition-colors"
            title="Refresh"
          >
            <RefreshCw size={15} />
          </button>
        }
      />

      <div className="flex h-[calc(100vh-160px)] rounded-xl overflow-hidden border border-[var(--vz-border)] shadow-sm bg-[var(--vz-card-bg)]">

        {/* ── Left Panel: Conversation List ── */}
        <div className={`flex flex-col w-full md:w-[320px] lg:w-[360px] flex-shrink-0 border-r border-[var(--vz-border)]
          ${mobileShowChat ? 'hidden md:flex' : 'flex'}`}>

          {/* Search header */}
          <div className="p-3 border-b border-[var(--vz-border)] bg-[var(--vz-input-bg)]/40">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--vz-text-muted)]" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search conversations…"
                className="w-full pl-8 pr-3 py-2 text-sm rounded-lg bg-[var(--vz-card-bg)] border border-[var(--vz-border)] focus:outline-none focus:ring-2 focus:ring-primary/30 text-[var(--vz-text)]"
              />
            </div>
          </div>

          {/* Conversation list */}
          <div className="flex-1 overflow-y-auto">
            {inboxLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 size={24} className="animate-spin text-[var(--vz-text-muted)]" />
              </div>
            ) : filteredConvs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-6">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                  <Inbox size={24} className="text-emerald-500" />
                </div>
                <div>
                  <p className="font-semibold text-[var(--vz-heading)]">Inbox is clear</p>
                  <p className="text-xs text-[var(--vz-text-muted)] mt-1">
                    {search ? 'No conversations match your search' : 'No inbound messages yet'}
                  </p>
                </div>
              </div>
            ) : (
              filteredConvs.map(conv => (
                <ConvRow
                  key={conv._id}
                  conv={conv}
                  active={conv._id === selectedPhone}
                  onClick={() => handleSelectConv(conv._id)}
                />
              ))
            )}
          </div>
        </div>

        {/* ── Right Panel: Chat ── */}
        <div className={`flex flex-col flex-1 min-w-0 ${!mobileShowChat ? 'hidden md:flex' : 'flex'}`}>

          {selectedPhone && selectedConv ? (
            <>
              {/* Chat header */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--vz-border)] bg-[var(--vz-input-bg)]/30">
                <button
                  className="md:hidden p-1 rounded hover:bg-[var(--vz-border)] mr-1"
                  onClick={() => setMobileShowChat(false)}
                >
                  <ArrowLeft size={18} />
                </button>
                <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-sm font-bold text-emerald-600">
                  {getInitials(selectedConv.leadName || selectedPhone?.slice(-4))}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-[var(--vz-heading)] truncate">
                    {selectedConv.leadName || selectedPhone}
                  </p>
                  <p className="text-xs text-[var(--vz-text-muted)] flex items-center gap-1">
                    <Phone size={10} />
                    {selectedPhone}
                  </p>
                </div>
                <div className="flex items-center gap-1 text-[11px] text-[var(--vz-text-muted)]">
                  <MessageSquare size={12} />
                  {selectedConv.messageCount || 0} msgs
                </div>
              </div>

              {/* Messages area */}
              <div
                className="flex-1 overflow-y-auto p-4 space-y-3"
                style={{
                  backgroundColor: 'var(--vz-body-bg)',
                  backgroundImage: 'radial-gradient(circle, rgba(0,0,0,0.03) 1px, transparent 1px)',
                  backgroundSize: '20px 20px',
                }}
              >
                {chatLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 size={20} className="animate-spin text-[var(--vz-text-muted)]" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-sm text-[var(--vz-text-muted)]">
                    No messages yet
                  </div>
                ) : (
                  messages.map(msg => <MessageBubble key={msg._id} msg={msg} contacts={actionContacts} onReply={setReplyingTo} toast={toast} />)
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Reply input */}
              <div className="p-3 border-t border-[var(--vz-border)] bg-[var(--vz-card-bg)]">
                {replyingTo && (
                  <div className="mb-2 px-3 py-2 border-l-2 border-emerald-500 rounded-lg bg-emerald-500/5 flex items-center justify-between">
                    <div className="min-w-0"><p className="text-[10px] font-semibold text-emerald-600">Replying to</p><p className="text-xs truncate">{replyingTo.content || replyingTo.mediaName || replyingTo.type}</p></div>
                    <button type="button" onClick={() => setReplyingTo(null)} className="text-[var(--vz-text-muted)]">×</button>
                  </div>
                )}
                <ChatComposer
                  leadId={conversations.find(c => c._id === selectedPhone)?.leadId || null}
                  value={reply}
                  onChange={setReply}
                  onSendText={handleSend}
                  onSendMedia={handleSendMedia}
                  sending={sending || replying}
                  disabled={!selectedPhone}
                  toast={toast}
                  placeholder="Type a message… (Enter to send)"
                />
                <p className="text-[10px] text-[var(--vz-text-muted)] mt-1.5 px-1">
                  Images, video, audio, PDFs and documents up to 15 MB are supported.
                </p>
              </div>
            </>
          ) : (
            /* Empty state when no convo selected */
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
              <div className="w-20 h-20 rounded-3xl bg-emerald-500/10 flex items-center justify-center">
                <MessageSquare size={36} className="text-emerald-500" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[var(--vz-heading)]">Select a Conversation</h3>
                <p className="text-sm text-[var(--vz-text-muted)] mt-1.5 max-w-xs">
                  Pick a conversation from the left panel to view messages and reply to customers.
                </p>
              </div>
              {conversations.length > 0 && (
                <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 text-emerald-600 text-sm font-medium">
                  <Inbox size={14} />
                  {conversations.length} conversation{conversations.length !== 1 ? 's' : ''} waiting
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
