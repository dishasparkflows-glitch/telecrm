import { useState, useEffect } from 'react'
import { AlertTriangle, CheckCircle, X } from 'lucide-react'
import Button from './Button'

/**
 * Reusable Confirmation Modal
 * 
 * Usage:
 *   <ConfirmModal
 *     isOpen={showConfirm}
 *     title="Downgrade Plan?"
 *     message="You will lose access to advanced features."
 *     confirmText="Downgrade"
 *     variant="danger"
 *     loading={isLoading}
 *     onConfirm={handleDowngrade}
 *     onCancel={() => setShowConfirm(false)}
 *   />
 */
export default function ConfirmModal({
  isOpen,
  onConfirm,
  onCancel,
  title = 'Are you sure?',
  message = '',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'primary',  // 'primary' | 'danger' | 'warning'
  loading = false,
  icon: CustomIcon,
}) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => setShow(true))
    } else {
      setShow(false)
    }
  }, [isOpen])

  if (!isOpen) return null

  const Icon = CustomIcon || (variant === 'danger' ? AlertTriangle : CheckCircle)

  const iconBg = {
    primary: 'bg-primary/10',
    danger: 'bg-danger/10',
    warning: 'bg-warning/10',
  }[variant] || 'bg-primary/10'

  const iconColor = {
    primary: 'text-primary',
    danger: 'text-danger',
    warning: 'text-warning',
  }[variant] || 'text-primary'

  const confirmVariant = {
    primary: 'primary',
    danger: 'danger',
    warning: 'warning',
  }[variant] || 'primary'

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-200 ${show ? 'opacity-100' : 'opacity-0'}`}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={!loading ? onCancel : undefined} />

      {/* Modal */}
      <div className={`relative bg-[var(--vz-card-bg)] rounded-xl shadow-2xl w-full max-w-md border border-[var(--vz-border)] transform transition-all duration-200 ${show ? 'scale-100 translate-y-0' : 'scale-95 translate-y-2'}`}>
        {/* Close button */}
        <button
          onClick={!loading ? onCancel : undefined}
          className="absolute top-3 right-3 p-1 rounded-lg text-[var(--vz-text-muted)] hover:text-[var(--vz-text)] hover:bg-[var(--vz-input-bg)] transition-colors"
        >
          <X size={16} />
        </button>

        <div className="p-6 text-center">
          {/* Icon */}
          <div className={`w-14 h-14 rounded-full ${iconBg} flex items-center justify-center mx-auto mb-4`}>
            <Icon size={24} className={iconColor} />
          </div>

          {/* Title */}
          <h3 className="text-lg font-semibold text-[var(--vz-heading)] mb-2">{title}</h3>

          {/* Message */}
          {message && (
            <p className="text-sm text-[var(--vz-text-muted)] mb-6 leading-relaxed">{message}</p>
          )}

          {/* Actions */}
          <div className="flex gap-3 justify-center">
            <Button
              variant="soft-light"
              size="sm"
              onClick={onCancel}
              disabled={loading}
              className="min-w-[100px]"
            >
              {cancelText}
            </Button>
            <Button
              variant={confirmVariant}
              size="sm"
              onClick={onConfirm}
              disabled={loading}
              className="min-w-[100px]"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Processing...
                </span>
              ) : confirmText}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
