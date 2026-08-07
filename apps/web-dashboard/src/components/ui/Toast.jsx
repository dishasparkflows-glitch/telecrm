import { useState, useCallback, useMemo, createContext, useContext } from 'react'
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'

const ToastContext = createContext(null)

const icons = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
}

const colors = {
  success: 'bg-secondary/10 text-secondary border-secondary/20',
  error: 'bg-danger/10 text-danger border-danger/20',
  warning: 'bg-warning/10 text-warning border-warning/20',
  info: 'bg-info/10 text-info border-info/20',
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
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
        {toasts.map((toast) => {
          const Icon = icons[toast.type]
          return (
            <div
              key={toast.id}
              className={`flex items-start gap-3 px-4 py-3 rounded-lg border shadow-lg
                transform transition-all duration-300 animate-in slide-in-from-right
                ${colors[toast.type]}`}
            >
              <Icon size={18} className="shrink-0 mt-0.5" />
              <p className="text-sm flex-1">{toast.message}</p>
              <button onClick={() => removeToast(toast.id)} className="shrink-0 opacity-60 hover:opacity-100">
                <X size={14} />
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
