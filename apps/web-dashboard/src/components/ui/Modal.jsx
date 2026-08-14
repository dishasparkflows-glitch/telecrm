import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

export default function Modal({ isOpen, onClose, title, children, size = 'md', className = '' }) {
  const overlayRef = useRef(null)

  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') onClose() }
    if (isOpen) {
      document.addEventListener('keydown', handleEsc)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleEsc)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-6xl',
  }

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in"
      onClick={(e) => e.target === overlayRef.current && onClose()}
    >
      <div
        className={`w-full ${sizeClasses[size]} bg-[var(--vz-card-bg)] border border-[var(--vz-border)] rounded-lg shadow-xl
          transform transition-all duration-200 ${className}`}
      >
        {/* Header */}
        {title && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--vz-border)]">
            <h5 className="text-base font-semibold text-[var(--vz-heading)]">{title}</h5>
            <button onClick={onClose} className="p-1 rounded-md text-[var(--vz-text-muted)] hover:text-[var(--vz-heading)] hover:bg-[var(--vz-input-bg)] transition-colors">
              <X size={18} />
            </button>
          </div>
        )}
        {/* Body */}
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  )
}

Modal.Footer = function ModalFooter({ children, className = '' }) {
  return (
    <div className={`flex items-center justify-end gap-2 px-5 py-3 border-t border-[var(--vz-border)] bg-[var(--vz-card-bg)] -mx-5 -mb-4 mt-5 ${className}`}>
      {children}
    </div>
  )
}
