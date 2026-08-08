import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Check } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export default function Select({
  label,
  options = [],
  value,
  onChange,
  placeholder = 'Select...',
  disabled = false,
  error,
  className = '',
  icon: Icon
}) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef(null)
  const buttonRef = useRef(null)
  const dropdownRef = useRef(null)
  const [dropdownStyle, setDropdownStyle] = useState({})

  const selectedOption = options.find((opt) => opt.value === value)
  const displayValue = selectedOption ? selectedOption.label : placeholder

  const updatePosition = () => {
    if (buttonRef.current && isOpen) {
      const rect = buttonRef.current.getBoundingClientRect()
      
      setDropdownStyle({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width
      })
    }
  }

  useLayoutEffect(() => {
    updatePosition()
    if (isOpen) {
      window.addEventListener('scroll', updatePosition, true)
      window.addEventListener('resize', updatePosition)
    }
    return () => {
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
    }
  }, [isOpen, options.length])

  // Handle click outside to close
  useEffect(() => {
    function handleClickOutside(event) {
      if (
        containerRef.current && !containerRef.current.contains(event.target) &&
        (!dropdownRef.current || !dropdownRef.current.contains(event.target))
      ) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleSelect = (option) => {
    if (disabled) return
    onChange(option.value)
    setIsOpen(false)
  }

  return (
    <div className={`space-y-1.5 ${className}`} ref={containerRef}>
      {label && (
        <label className="block text-sm font-medium text-[var(--vz-heading)]">
          {label}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--vz-text-muted)] pointer-events-none z-10">
            <Icon size={16} />
          </div>
        )}
        <button
          ref={buttonRef}
          type="button"
          onClick={() => !disabled && setIsOpen((prev) => !prev)}
          className={`w-full flex items-center justify-between rounded-md border text-sm px-3 py-2 outline-none transition-all duration-200
            ${Icon ? 'pl-9' : ''}
            ${isOpen ? 'border-primary ring-1 ring-primary/30' : 'border-[var(--vz-input-border)]'}
            ${error ? 'border-danger focus:border-danger focus:ring-danger/30' : ''}
            ${disabled ? 'opacity-50 cursor-not-allowed bg-[var(--vz-input-bg)]' : 'bg-[var(--vz-input-bg)] hover:border-[var(--vz-border)]'}
            text-[var(--vz-heading)]`}
        >
          <span className={`${!selectedOption ? 'text-[var(--vz-text-muted)]' : 'truncate'}`}>
            {displayValue}
          </span>
          <ChevronDown
            size={16}
            className={`text-[var(--vz-text-muted)] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {typeof document !== 'undefined' && createPortal(
          <AnimatePresence>
            {isOpen && (
              <motion.div
                ref={dropdownRef}
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.15 }}
                style={{ ...dropdownStyle }}
                className="absolute z-[9999] mt-1 bg-[var(--vz-card-bg)] border border-[var(--vz-border)] rounded-md shadow-lg overflow-hidden"
              >
                <ul className="max-h-60 overflow-y-auto py-1 custom-scrollbar">
                  {options.length === 0 ? (
                    <li className="px-3 py-2 text-sm text-[var(--vz-text-muted)] text-center">
                      No options available
                    </li>
                  ) : (
                    options.map((option) => (
                      <li
                        key={option.value}
                        onClick={() => handleSelect(option)}
                        className={`flex items-center justify-between px-3 py-2 text-sm cursor-pointer transition-colors
                          ${value === option.value ? 'bg-primary/10 text-primary font-medium' : 'text-[var(--vz-heading)] hover:bg-primary/10 hover:text-primary'}`}
                      >
                        <span className="truncate">{option.label}</span>
                        {value === option.value && <Check size={14} className="text-primary flex-shrink-0" />}
                      </li>
                    ))
                  )}
                </ul>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  )
}
