import { lazy, Suspense, useState } from 'react'
import { Check, Copy, Forward, Info, Loader2, MessageCircleReply, MoreVertical, Plus, Smile, X } from 'lucide-react'
import { useForwardMessageMutation, useReactToMessageMutation } from '../../features/whatsapp/whatsappApi'

const EmojiPicker = lazy(() => import('emoji-picker-react'))
const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏']

export default function MessageActions({ message, contacts = [], onReply, toast }) {
  const [open, setOpen] = useState(false)
  const [showReactions, setShowReactions] = useState(false)
  const [showForward, setShowForward] = useState(false)
  const [showFullReactions, setShowFullReactions] = useState(false)
  const [forwardMessage, { isLoading: forwarding }] = useForwardMessageMutation()
  const [reactToMessage, { isLoading: reacting }] = useReactToMessageMutation()

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

  const forward = async (phone) => {
    try {
      await forwardMessage({ id: message._id, to: phone }).unwrap()
      toast?.('Message forwarded', 'success')
      setShowForward(false)
      setOpen(false)
    } catch (error) {
      toast?.(error?.data?.message || 'Unable to forward message', 'error')
    }
  }

  return (
    <div className="absolute top-1 right-1 z-20">
      <button type="button" onClick={() => setOpen((value) => !value)} className="p-1 rounded-full opacity-60 md:opacity-0 md:group-hover:opacity-100 focus:opacity-100 bg-black/10 hover:bg-black/20 transition-opacity" title="Message actions">
        <MoreVertical size={14} />
      </button>
      {open && (
        <div className="absolute right-0 top-7 w-44 py-1 rounded-xl border border-[var(--vz-border)] bg-[var(--vz-card-bg)] text-[var(--vz-text)] shadow-xl overflow-visible">
          <button type="button" onClick={() => { onReply(message); setOpen(false) }} className="w-full px-3 py-2 flex items-center gap-2 text-xs hover:bg-[var(--vz-input-bg)]"><MessageCircleReply size={14} /> Reply</button>
          <button type="button" onClick={() => setShowForward(true)} className="w-full px-3 py-2 flex items-center gap-2 text-xs hover:bg-[var(--vz-input-bg)]"><Forward size={14} /> Forward</button>
          <button type="button" onClick={() => setShowReactions(true)} className="w-full px-3 py-2 flex items-center gap-2 text-xs hover:bg-[var(--vz-input-bg)]"><Smile size={14} /> React</button>
          {(message.content || message.mediaName) && <button type="button" onClick={copyText} className="w-full px-3 py-2 flex items-center gap-2 text-xs hover:bg-[var(--vz-input-bg)]"><Copy size={14} /> Copy</button>}
          <button type="button" onClick={() => { toast?.(`${message.status || 'received'} · ${new Date(message.createdAt).toLocaleString()}`, 'info'); setOpen(false) }} className="w-full px-3 py-2 flex items-center gap-2 text-xs hover:bg-[var(--vz-input-bg)]"><Info size={14} /> Message info</button>
        </div>
      )}
      {showReactions && (
        <div className="absolute right-0 top-7 flex items-center gap-1 p-1.5 rounded-full border border-[var(--vz-border)] bg-[var(--vz-card-bg)] shadow-xl">
          {QUICK_REACTIONS.map((emoji) => <button disabled={reacting} key={emoji} type="button" onClick={() => react(emoji)} className="text-lg p-1 rounded-full hover:bg-[var(--vz-input-bg)]">{emoji}</button>)}
          <button type="button" title="More reactions" onClick={() => setShowFullReactions(true)} className="p-1 rounded-full hover:bg-[var(--vz-input-bg)]"><Plus size={14} /></button>
          <button type="button" onClick={() => setShowReactions(false)}><X size={13} /></button>
        </div>
      )}
      {showFullReactions && (
        <div className="absolute right-0 top-7 z-30 shadow-2xl rounded-xl overflow-hidden">
          <Suspense fallback={<div className="w-[350px] h-[420px] bg-[var(--vz-card-bg)] flex items-center justify-center"><Loader2 className="animate-spin" /></div>}>
            <EmojiPicker theme="auto" width={350} height={420} lazyLoadEmojis searchPlaceHolder="Search reactions"
              previewConfig={{ showPreview: false }} onEmojiClick={(emojiData) => { react(emojiData.emoji); setShowFullReactions(false) }} />
          </Suspense>
        </div>
      )}
      {showForward && (
        <div className="absolute right-0 top-7 w-64 max-h-64 overflow-y-auto rounded-xl border border-[var(--vz-border)] bg-[var(--vz-card-bg)] shadow-xl p-2">
          <div className="flex items-center justify-between px-1 pb-2"><span className="text-xs font-semibold">Forward to</span><button onClick={() => setShowForward(false)}><X size={14} /></button></div>
          {contacts.filter((contact) => contact.phone).map((contact) => (
            <button disabled={forwarding} type="button" key={`${contact.id || contact.phone}`} onClick={() => forward(contact.phone)} className="w-full p-2 flex items-center justify-between text-xs rounded-lg hover:bg-[var(--vz-input-bg)]">
              <span className="truncate">{contact.name || contact.phone}</span><Check size={13} />
            </button>
          ))}
          {!contacts.some((contact) => contact.phone) && <p className="text-xs text-[var(--vz-text-muted)] p-2">No contacts available</p>}
        </div>
      )}
    </div>
  )
}
