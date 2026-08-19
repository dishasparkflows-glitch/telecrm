import { useState, useCallback, useMemo, createContext, useContext } from 'react'
import { CheckCircle, XCircle, AlertTriangle, Info, X, User, Star, Flag, Bell } from 'lucide-react'

const ToastContext = createContext(null)

const icons = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
  lead: User,
  status: Star,
  stage: Flag,
  meeting: Bell,
}

const colors = {
  success: { bg: 'bg-[#10B981]', text: 'text-[#10B981]' },
  error: { bg: 'bg-[#EF4444]', text: 'text-[#EF4444]' },
  warning: { bg: 'bg-[#F59E0B]', text: 'text-[#F59E0B]' },
  info: { bg: 'bg-[#3B82F6]', text: 'text-[#3B82F6]' },
  lead: { bg: 'bg-[#10B981]', text: 'text-[#10B981]' }, // Green
  status: { bg: 'bg-[#3B82F6]', text: 'text-[#3B82F6]' }, // Blue
  stage: { bg: 'bg-[#8B5CF6]', text: 'text-[#8B5CF6]' }, // Purple
  meeting: { bg: 'bg-[#10B981]', text: 'text-[#10B981]' }, // Green
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((payload, type = 'success', duration = 4000) => {
    const id = Date.now()
    setToasts((prev) => [...prev, { id, payload, type }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), duration)
  }, [])

  const removeToast = (id) => setToasts((prev) => prev.filter((t) => t.id !== id))

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
      <div className="fixed top-6 right-6 z-[9999] flex flex-col gap-3 max-w-sm w-full md:w-auto">
        {toasts.map((toast) => {
          const isComplex = typeof toast.payload === 'object' && toast.payload !== null;
          const titleText = isComplex ? toast.payload.title : '';
          let messageText = isComplex ? toast.payload.message : toast.payload;
          
          if (!messageText && !titleText) messageText = 'Notification';

          let derivedType = toast.type;
          const lowerTitle = (titleText || '').toLowerCase();
          if (lowerTitle.includes('lead')) derivedType = 'lead';
          else if (lowerTitle.includes('status')) derivedType = 'status';
          else if (lowerTitle.includes('stage')) derivedType = 'stage';
          else if (lowerTitle.includes('meeting')) derivedType = 'meeting';

          const colorTheme = colors[derivedType] || colors[toast.type] || colors.info;
          const Icon = icons[derivedType] || icons[toast.type] || icons.info;

          return (
            <div
              key={toast.id}
              className={`relative flex items-start gap-3.5 px-4 py-4 rounded-xl shadow-[0_4px_24px_rgb(0,0,0,0.08)] border border-[var(--vz-border)]
                transform transition-all duration-300 animate-in slide-in-from-right fade-in bg-[var(--vz-card-bg)] pointer-events-auto min-w-[280px] max-w-sm`}
            >
              <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${colorTheme.bg}`}>
                <Icon size={16} className="text-white" />
              </div>

              <div className="flex-1 pr-6 pt-0.5">
                {(titleText || !isComplex) && (
                  <p className={`text-[13px] font-semibold mb-0.5 leading-tight ${colorTheme.text}`}>
                    {titleText || (isComplex ? '' : messageText)}
                  </p>
                )}
                {isComplex && messageText && (
                  <div className="text-[12px] font-medium text-[var(--vz-heading)] leading-snug whitespace-pre-line">
                    {messageText}
                  </div>
                )}
              </div>

              <button onClick={() => removeToast(toast.id)} className="absolute top-4 right-4 text-[var(--vz-text-muted)] hover:text-[var(--vz-heading)] transition-colors">
                <X size={14} />
              </button>

              <div className="absolute bottom-3 right-3 opacity-20">
                <Icon size={12} className={colorTheme.text} />
              </div>
            </div>
          )
        })}
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
