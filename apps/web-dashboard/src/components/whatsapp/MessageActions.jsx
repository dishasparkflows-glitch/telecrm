import { lazy, Suspense, useState, useRef, useEffect } from 'react'
import { Check, Copy, Forward, Info, Loader2, MessageCircleReply, MoreVertical, Plus, Smile, X, Search } from 'lucide-react'
import { useForwardMessageMutation, useReactToMessageMutation } from '../../features/whatsapp/whatsappApi'

const EmojiPicker = lazy(() => import('emoji-picker-react'))
const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏']

export default function MessageActions({ message, outgoing = false, contacts = [], onReply, toast }) {
  const [open, setOpen] = useState(false)
  const [showReactions, setShowReactions] = useState(false)
  const [showForward, setShowForward] = useState(false)
  const [showFullReactions, setShowFullReactions] = useState(false)
  const [selectedContacts, setSelectedContacts] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [forwardMessage, { isLoading: forwarding }] = useForwardMessageMutation()
  const [reactToMessage, { isLoading: reacting }] = useReactToMessageMutation()
  
  const menuRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpen(false)
        setShowReactions(false)
        setShowForward(false)
        setShowFullReactions(false)
        setSelectedContacts([])
        setSearchQuery('')
      }
    }
    if (open || showReactions || showForward || showFullReactions) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open, showReactions, showForward, showFullReactions])

  const copyText = async () => {
    await navigator.clipboard.writeText(message.content || message.mediaName || '')
    toast?.('Copied to clipboard', 'success')
    setOpen(false)
  }

  const react = async (emoji) => {
    try {
      await reactToMessage({ id: message._id, emoji }).unwrap()
      setShowReactions(false)
      setOpen(false)
    } catch (error) {
      toast?.(error?.data?.message || 'Unable to react to this message', 'error')
    }
  }

  const handleForward = async () => {
    if (selectedContacts.length === 0) return
    try {
      await Promise.all(selectedContacts.map(phone => 
        forwardMessage({ id: message._id, to: phone }).unwrap()
      ))
      toast?.(`Message forwarded to ${selectedContacts.length} chat(s)`, 'success')
      setShowForward(false)
      setSelectedContacts([])
      setSearchQuery('')
      setOpen(false)
    } catch (error) {
      toast?.(error?.data?.message || 'Unable to forward message to some contacts', 'error')
    }
  }

  const toggleContact = (phone) => {
    setSelectedContacts(prev => prev.includes(phone) ? prev.filter(p => p !== phone) : [...prev, phone])
  }

  return (
    <div ref={menuRef} className="absolute top-1 right-1 z-20">
      <button type="button" onClick={() => setOpen((value) => !value)} className="p-1 rounded-full opacity-60 md:opacity-0 md:group-hover:opacity-100 focus:opacity-100 bg-black/10 hover:bg-black/20 transition-opacity" title="Message actions">
        <MoreVertical size={14} />
      </button>
      {open && (
        <div className={`absolute ${outgoing ? 'right-0' : 'left-0'} top-7 w-44 py-1 rounded-xl border border-[var(--vz-border)] bg-[var(--vz-card-bg)] text-[var(--vz-text)] shadow-xl overflow-visible z-30`}>
          <button type="button" onClick={() => { onReply(message); setOpen(false) }} className="w-full px-3 py-2 flex items-center gap-2 text-xs hover:bg-[var(--vz-input-bg)]"><MessageCircleReply size={14} /> Reply</button>
          <button type="button" onClick={() => setShowForward(true)} className="w-full px-3 py-2 flex items-center gap-2 text-xs hover:bg-[var(--vz-input-bg)]"><Forward size={14} /> Forward</button>
          <button type="button" onClick={() => setShowReactions(true)} className="w-full px-3 py-2 flex items-center gap-2 text-xs hover:bg-[var(--vz-input-bg)]"><Smile size={14} /> React</button>
          {(message.content || message.mediaName) && <button type="button" onClick={copyText} className="w-full px-3 py-2 flex items-center gap-2 text-xs hover:bg-[var(--vz-input-bg)]"><Copy size={14} /> Copy</button>}
          <button type="button" onClick={() => { toast?.(`${message.status || 'received'} · ${new Date(message.meta?.createdAt).toLocaleString()}`, 'info'); setOpen(false) }} className="w-full px-3 py-2 flex items-center gap-2 text-xs hover:bg-[var(--vz-input-bg)]"><Info size={14} /> Message info</button>
        </div>
      )}
      {showReactions && (
        <div className={`absolute ${outgoing ? 'right-0' : 'left-0'} top-7 flex items-center gap-1 p-1.5 rounded-full border border-[var(--vz-border)] bg-[var(--vz-card-bg)] text-[var(--vz-text)] shadow-xl z-30`}>
          {QUICK_REACTIONS.map((emoji) => <button disabled={reacting} key={emoji} type="button" onClick={() => react(emoji)} className="text-lg p-1 rounded-full hover:bg-[var(--vz-input-bg)]">{emoji}</button>)}
          <button type="button" title="More reactions" onClick={() => setShowFullReactions(true)} className="p-1 rounded-full hover:bg-[var(--vz-input-bg)]"><Plus size={14} /></button>
          <button type="button" onClick={() => setShowReactions(false)}><X size={13} /></button>
        </div>
      )}
      {showFullReactions && (
        <div className={`absolute ${outgoing ? 'right-0' : 'left-0'} top-7 z-40 shadow-2xl rounded-xl overflow-hidden text-[var(--vz-text)]`}>
          <Suspense fallback={<div className="w-[350px] h-[420px] bg-[var(--vz-card-bg)] flex items-center justify-center"><Loader2 className="animate-spin" /></div>}>
            <EmojiPicker theme="auto" width={350} height={420} lazyLoadEmojis searchPlaceHolder="Search reactions"
              previewConfig={{ showPreview: false }} onEmojiClick={(emojiData) => { react(emojiData.emoji); setShowFullReactions(false) }} />
          </Suspense>
        </div>
      )}
      {showForward && (
        <div className={`absolute ${outgoing ? 'right-0' : 'left-0'} top-7 w-72 max-h-96 flex flex-col rounded-xl border border-[var(--vz-border)] bg-[var(--vz-card-bg)] text-[var(--vz-text)] shadow-xl overflow-hidden z-40`}>
          <div className="flex items-center justify-between p-3 border-b border-[var(--vz-border)]">
            <span className="text-sm font-semibold">Forward to</span>
            <button onClick={() => { setShowForward(false); setSelectedContacts([]); setSearchQuery(''); }}><X size={16} className="text-[var(--vz-text-muted)] hover:text-[var(--vz-text)]" /></button>
          </div>
          <div className="p-2 border-b border-[var(--vz-border)]">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-2.5 text-[var(--vz-text-muted)]" />
              <input type="text" placeholder="Search contacts..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-8 pr-3 py-1.5 text-xs bg-[var(--vz-input-bg)] border border-[var(--vz-border)] rounded-lg outline-none focus:border-primary/50 text-[var(--vz-text)]" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {contacts
              .filter((c) => c.phone && (c.name?.toLowerCase().includes(searchQuery.toLowerCase()) || c.phone.includes(searchQuery)))
              .map((contact) => (
              <label key={`${contact.id || contact.phone}`} className="w-full p-2 flex items-center justify-between text-sm rounded-lg hover:bg-[var(--vz-input-bg)] cursor-pointer select-none">
                <span className="truncate">{contact.name || contact.phone}</span>
                <input type="checkbox" checked={selectedContacts.includes(contact.phone)} onChange={() => toggleContact(contact.phone)} className="w-4 h-4 rounded border border-[var(--vz-border)] text-primary focus:ring-primary focus:ring-1 cursor-pointer" />
              </label>
            ))}
            {!contacts.some((contact) => contact.phone) && <p className="text-xs text-[var(--vz-text-muted)] p-2 text-center">No contacts available</p>}
          </div>
          {selectedContacts.length > 0 && (
            <div className="p-3 border-t border-[var(--vz-border)] bg-[var(--vz-card-bg)]">
              <button disabled={forwarding} onClick={handleForward} className="w-full py-2 bg-primary text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
                {forwarding ? <Loader2 size={16} className="animate-spin" /> : <Forward size={16} />}
                Send to {selectedContacts.length} chat{selectedContacts.length > 1 ? 's' : ''}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
