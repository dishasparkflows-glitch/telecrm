import { useState, useCallback, useMemo, createContext, useContext } from 'react'
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'

const ToastContext = createContext(null)

const icons = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
}

const styles = {
  success: 'border-l-secondary',
  error: 'border-l-danger',
  warning: 'border-l-warning',
  info: 'border-l-info',
}

const iconColors = {
  success: 'text-secondary',
  error: 'text-danger',
  warning: 'text-warning',
  info: 'text-info',
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((message, type = 'success', duration = 4000) => {
    const id = Date.now()
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), duration)
  }, [])

  const removeToast = (id) => setToasts((prev) => prev.filter((t) => t.id !== id))

  // Keep the original callable API while also supporting toast.success/error
  // used by the Owner panel.
  const toast = useMemo(() => Object.assign(
    (message, type = 'success', duration = 4000) => addToast(message, type, duration),
    {
      success: (message, duration) => addToast(message, 'success', duration),
      error: (message, duration) => addToast(message, 'error', duration),
      warning: (message, duration) => addToast(message, 'warning', duration),
      info: (message, duration) => addToast(message, 'info', duration),
    },
  ), [addToast])

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {/* Toast Container */}
      <div className="fixed top-6 right-6 z-[9999] flex flex-col gap-3 max-w-sm w-full md:w-auto">
        {toasts.map((toast) => {
          const Icon = icons[toast.type]
          return (
            <div
              key={toast.id}
              className={`flex items-start gap-3 px-4 py-3.5 rounded-lg shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-[var(--vz-border)] border-l-[4px]
                transform transition-all duration-300 animate-in slide-in-from-right fade-in bg-[var(--vz-card-bg)] text-[var(--vz-heading)] pointer-events-auto
                ${styles[toast.type]}`}
            >
              <Icon size={20} className={`shrink-0 mt-0.5 ${iconColors[toast.type]}`} />
              <p className="text-sm font-medium flex-1 pt-[1px] leading-relaxed">{toast.message}</p>
              <button onClick={() => removeToast(toast.id)} className="shrink-0 text-[var(--vz-text-muted)] hover:text-[var(--vz-heading)] transition-colors mt-0.5">
                <X size={16} />
              </button>
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
