import { useState, useCallback, useMemo, createContext, useContext, useEffect } from 'react'
import { CheckCircle2, XCircle, AlertCircle, Info, X, User, Star, Flag, Bell } from 'lucide-react'

const ToastContext = createContext(null)

const icons = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertCircle,
  info: Info,
  lead: User,
  status: Star,
  stage: Flag,
  meeting: Bell,
}

const colors = {
  success: { bg: 'bg-[#10B981]/15', icon: 'text-[#10B981]', bar: 'bg-[#10B981]' },
  error: { bg: 'bg-[#EF4444]/15', icon: 'text-[#EF4444]', bar: 'bg-[#EF4444]' },
  warning: { bg: 'bg-[#F59E0B]/15', icon: 'text-[#F59E0B]', bar: 'bg-[#F59E0B]' },
  info: { bg: 'bg-[#3B82F6]/15', icon: 'text-[#3B82F6]', bar: 'bg-[#3B82F6]' },
  lead: { bg: 'bg-[#10B981]/15', icon: 'text-[#10B981]', bar: 'bg-[#10B981]' },
  status: { bg: 'bg-[#3B82F6]/15', icon: 'text-[#3B82F6]', bar: 'bg-[#3B82F6]' },
  stage: { bg: 'bg-[#8B5CF6]/15', icon: 'text-[#8B5CF6]', bar: 'bg-[#8B5CF6]' },
  meeting: { bg: 'bg-[#10B981]/15', icon: 'text-[#10B981]', bar: 'bg-[#10B981]' },
}

const ToastItem = ({ toast, removeToast }) => {
  const [isClosing, setIsClosing] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsClosing(true)
      setTimeout(() => removeToast(toast.id), 300)
    }, toast.duration)
    return () => clearTimeout(timer)
  }, [toast, removeToast])

  const handleClose = () => {
    setIsClosing(true)
    setTimeout(() => removeToast(toast.id), 300)
  }

  const isComplex = typeof toast.payload === 'object' && toast.payload !== null
  const titleText = isComplex ? toast.payload.title : ''
  let messageText = isComplex ? toast.payload.message : toast.payload
  
  if (!messageText && !titleText) messageText = 'Notification'

  let derivedType = toast.type
  const lowerTitle = (titleText || '').toLowerCase()
  if (lowerTitle.includes('lead')) derivedType = 'lead'
  else if (lowerTitle.includes('status')) derivedType = 'status'
  else if (lowerTitle.includes('stage')) derivedType = 'stage'
  else if (lowerTitle.includes('meeting')) derivedType = 'meeting'

  const theme = colors[derivedType] || colors[toast.type] || colors.info
  const Icon = icons[derivedType] || icons[toast.type] || icons.info

  return (
    <div
      className={`group relative flex items-start gap-4 p-4 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-[var(--vz-border)]
        bg-[var(--vz-card-bg)] pointer-events-auto min-w-[320px] max-w-sm overflow-hidden
        transform transition-all duration-300 ease-out origin-right
        ${isClosing ? 'opacity-0 translate-x-8 scale-95' : 'opacity-100 translate-x-0 scale-100 animate-in slide-in-from-right-8 fade-in'}
      `}
    >
      <div className={`shrink-0 flex items-center justify-center w-10 h-10 rounded-full ${theme.bg}`}>
        <Icon size={20} className={theme.icon} />
      </div>

      <div className="flex-1 pr-6 pt-1 relative z-10">
        {(titleText || !isComplex) && (
          <p className="text-[14px] font-semibold text-[var(--vz-heading)] mb-1 leading-tight">
            {titleText || (isComplex ? '' : messageText)}
          </p>
        )}
        {isComplex && messageText && (
          <div className="text-[13px] text-[var(--vz-text)] leading-relaxed whitespace-pre-line">
            {messageText}
          </div>
        )}
      </div>

      <button 
        type="button"
        onClick={handleClose} 
        className="absolute top-3 right-3 p-1.5 rounded-md text-[var(--vz-text-muted)] hover:text-[var(--vz-heading)] hover:bg-black/5 transition-all z-20"
      >
        <X size={16} />
      </button>

      {/* Progress Bar Container */}
      <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-[var(--vz-border)] overflow-hidden">
        <div 
          className={`h-full ${theme.bar} transition-all duration-100 ease-linear origin-left`}
          style={{
            animation: `toast-progress ${toast.duration}ms linear forwards`
          }}
        />
      </div>
    </div>
  )
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((payload, type = 'success', duration = 4000) => {
    const id = Date.now()
    setToasts((prev) => [...prev, { id, payload, type, duration }])
  }, [])

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const toast = useMemo(() => Object.assign(
    (payload, type = 'success', duration = 4000) => addToast(payload, type, duration),
    {
      success: (payload, duration) => addToast(payload, 'success', duration),
      error: (payload, duration) => addToast(payload, 'error', duration),
      warning: (payload, duration) => addToast(payload, 'warning', duration),
      info: (payload, duration) => addToast(payload, 'info', duration),
    },
  ), [addToast])

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <style>{`
        @keyframes toast-progress {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
      <div className="fixed top-6 right-6 z-[9999] flex flex-col gap-3 w-full md:w-auto p-4 md:p-0 items-end pointer-events-none">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} removeToast={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

// Kept colocated with ToastProvider to preserve the existing public module API.
// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  const addToast = useContext(ToastContext)
  if (!addToast) throw new Error('useToast must be used within <ToastProvider>')
  return addToast
}
