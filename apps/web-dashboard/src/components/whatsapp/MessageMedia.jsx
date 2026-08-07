import { Download, FileText, Loader2 } from 'lucide-react'
import { useGetMessageMediaQuery, useLazyGetMessageMediaQuery } from '../../features/whatsapp/whatsappApi'

const safeLegacyUrl = (value) => {
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : null
  } catch {
    return null
  }
}

const formatBytes = (bytes) => {
  const value = Number(bytes) || 0
  if (!value) return ''
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

export default function MessageMedia({ message, outgoing = false }) {
  const hasPrivateMedia = Boolean(message.mediaObjectKey || message.mediaName || message.mediaMimeType)
  const { data, isLoading } = useGetMessageMediaQuery(
    { id: message._id },
    { skip: !hasPrivateMedia }
  )
  const [getDownload, { isFetching: downloading }] = useLazyGetMessageMediaQuery()
  const mediaUrl = data?.data?.url || safeLegacyUrl(message.mediaUrl)
  const type = message.type
  const name = message.mediaName || (type === 'document' ? 'Document' : `WhatsApp ${type}`)

  const handleDownload = async () => {
    try {
      let url = safeLegacyUrl(message.mediaUrl)
      if (hasPrivateMedia) {
        const result = await getDownload({ id: message._id, download: true }).unwrap()
        url = result?.data?.url
      }
      if (url) window.open(url, '_blank', 'noopener,noreferrer')
    } catch {
      // The normal query error state remains visible; do not navigate to an unsafe URL.
    }
  }

  if (isLoading) {
    return <div className="w-48 h-24 flex items-center justify-center"><Loader2 size={20} className="animate-spin" /></div>
  }

  if (type === 'image' && mediaUrl) {
    return (
      <div className="space-y-1.5">
        <button type="button" onClick={() => window.open(mediaUrl, '_blank', 'noopener,noreferrer')} className="block">
          <img src={mediaUrl} alt={name} className="max-w-full w-auto max-h-72 rounded-lg object-contain bg-black/5" loading="lazy" />
        </button>
        <button type="button" onClick={handleDownload} className={`flex items-center gap-1 text-[11px] ${outgoing ? 'text-white/80' : 'text-primary'}`}>
          <Download size={11} /> Download image
        </button>
      </div>
    )
  }

  if (type === 'video' && mediaUrl) {
    return (
      <div className="space-y-1.5">
        <video src={mediaUrl} controls preload="metadata" className="max-w-full max-h-72 rounded-lg bg-black" />
        <button type="button" onClick={handleDownload} className={`flex items-center gap-1 text-[11px] ${outgoing ? 'text-white/80' : 'text-primary'}`}>
          <Download size={11} /> Download video
        </button>
      </div>
    )
  }

  if (type === 'audio' && mediaUrl) {
    return (
      <div className="space-y-1.5">
        <audio src={mediaUrl} controls preload="metadata" className="max-w-full" />
        <button type="button" onClick={handleDownload} className={`flex items-center gap-1 text-[11px] ${outgoing ? 'text-white/80' : 'text-primary'}`}>
          <Download size={11} /> Download audio
        </button>
      </div>
    )
  }

  return (
    <button type="button" onClick={handleDownload} disabled={downloading || (!hasPrivateMedia && !mediaUrl)}
      className={`flex items-center gap-3 min-w-52 max-w-full p-3 rounded-xl text-left disabled:opacity-60 ${outgoing ? 'bg-white/10' : 'bg-black/5 dark:bg-white/5'}`}>
      <span className="w-10 h-10 rounded-lg flex items-center justify-center bg-red-500/15 text-red-500 shrink-0"><FileText size={20} /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold truncate">{name}</span>
        <span className={`block text-[10px] mt-0.5 ${outgoing ? 'text-white/60' : 'text-[var(--vz-text-muted)]'}`}>
          {message.mediaMimeType || 'Document'}{message.mediaSize ? ` · ${formatBytes(message.mediaSize)}` : ''}
        </span>
      </span>
      {downloading ? <Loader2 size={16} className="animate-spin shrink-0" /> : <Download size={16} className="shrink-0" />}
    </button>
  )
}
