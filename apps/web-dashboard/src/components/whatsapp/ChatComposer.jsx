import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { FileText, Loader2, Paperclip, Send, Smile, X } from 'lucide-react'
import { useUploadMediaMutation } from '../../features/whatsapp/whatsappApi'

const EmojiPicker = lazy(() => import('emoji-picker-react'))
const MAX_MEDIA_BYTES = 15 * 1024 * 1024
const ACCEPTED_MEDIA = 'image/jpeg,image/png,image/webp,image/gif,video/mp4,video/3gpp,video/quicktime,video/webm,audio/mpeg,audio/mp4,audio/aac,audio/ogg,audio/wav,audio/webm,application/pdf,text/plain,text/csv,text/rtf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation'

const readAsDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(reader.result)
  reader.onerror = () => reject(new Error('Unable to read selected file'))
  reader.readAsDataURL(file)
})

const mediaTypeFor = (mimeType) => {
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('video/')) return 'video'
  if (mimeType.startsWith('audio/')) return 'audio'
  return 'document'
}

export default function ChatComposer({ value, onChange, onSendText, onSendMedia, sending, disabled, toast, placeholder = 'Type a message…' }) {
  const inputRef = useRef(null)
  const fileRef = useRef(null)
  const [showEmoji, setShowEmoji] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  const [uploadMedia, { isLoading: uploading }] = useUploadMediaMutation()
  const imagePreview = useMemo(() => selectedFile?.type.startsWith('image/') ? URL.createObjectURL(selectedFile) : null, [selectedFile])
  useEffect(() => () => { if (imagePreview) URL.revokeObjectURL(imagePreview) }, [imagePreview])

  const chooseFile = (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (file.size > MAX_MEDIA_BYTES) return toast?.('File must be 15 MB or smaller', 'error')
    setSelectedFile(file)
  }

  const submit = async () => {
    if (selectedFile) {
      try {
        const data = await readAsDataUrl(selectedFile)
        const uploaded = await uploadMedia({ data, mimeType: selectedFile.type, name: selectedFile.name }).unwrap()
        await onSendMedia({
          type: mediaTypeFor(selectedFile.type),
          content: value.trim(),
          mediaObjectKey: uploaded.data.objectKey,
          mediaName: uploaded.data.name,
          mediaMimeType: uploaded.data.mimeType,
          mediaSize: uploaded.data.size,
        })
        setSelectedFile(null)
        onChange('')
      } catch (error) {
        toast?.(error?.data?.message || error?.message || 'Failed to upload and send file', 'error')
      }
      return
    }
    if (value.trim()) await onSendText()
  }

  const onKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      submit()
    }
  }

  const busy = sending || uploading
  return (
    <div className="relative">
      {showEmoji && (
        <div className="absolute bottom-full left-0 mb-2 z-30 shadow-2xl rounded-xl overflow-hidden">
          <Suspense fallback={<div className="w-[350px] h-[420px] bg-[var(--vz-card-bg)] flex items-center justify-center"><Loader2 className="animate-spin" /></div>}>
            <EmojiPicker
              theme="auto"
              width={350}
              height={420}
              lazyLoadEmojis
              searchPlaceHolder="Search emojis"
              previewConfig={{ showPreview: false }}
              onEmojiClick={(emojiData) => {
                onChange(`${value}${emojiData.emoji}`)
                inputRef.current?.focus()
              }}
            />
          </Suspense>
        </div>
      )}
      {selectedFile && (
        <div className="mb-2 flex items-center gap-3 p-2.5 rounded-xl border border-[var(--vz-border)] bg-[var(--vz-input-bg)]">
          {selectedFile.type.startsWith('image/')
            ? <img src={imagePreview} alt="Selected attachment" className="w-12 h-12 rounded-lg object-cover" />
            : <span className="w-12 h-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center"><FileText size={20} /></span>}
          <div className="min-w-0 flex-1"><p className="text-xs font-semibold truncate">{selectedFile.name}</p><p className="text-[10px] text-[var(--vz-text-muted)]">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p></div>
          <button type="button" onClick={() => setSelectedFile(null)} className="p-1 text-danger hover:text-danger-dark"><X size={16} /></button>
        </div>
      )}
      <div className="flex items-end gap-2">
        <button type="button" onClick={() => setShowEmoji((open) => !open)} disabled={busy || disabled} title="Add emoji"
          className="w-9 h-9 rounded-full flex items-center justify-center text-[var(--vz-text-muted)] hover:bg-[var(--vz-input-bg)] disabled:opacity-40"><Smile size={18} /></button>
        <button type="button" onClick={() => fileRef.current?.click()} disabled={busy || disabled} title="Attach file"
          className="w-9 h-9 rounded-full flex items-center justify-center text-[var(--vz-text-muted)] hover:bg-[var(--vz-input-bg)] disabled:opacity-40"><Paperclip size={18} /></button>
        <input ref={fileRef} type="file" accept={ACCEPTED_MEDIA} onChange={chooseFile} className="hidden" />
        <textarea ref={inputRef} value={value} onChange={(event) => onChange(event.target.value)} onKeyDown={onKeyDown}
          placeholder={selectedFile ? 'Add a caption…' : placeholder} rows={1}
          className="flex-1 resize-none px-4 py-2.5 rounded-2xl bg-[var(--vz-input-bg)] border border-[var(--vz-border)] focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm text-[var(--vz-text)] max-h-[120px]"
          onInput={(event) => { event.target.style.height = 'auto'; event.target.style.height = `${Math.min(event.target.scrollHeight, 120)}px` }} />
        <button type="button" onClick={submit} disabled={busy || disabled || (!selectedFile && !value.trim())}
          className="w-10 h-10 rounded-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center text-white shrink-0 shadow-md">
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </div>
    </div>
  )
}
