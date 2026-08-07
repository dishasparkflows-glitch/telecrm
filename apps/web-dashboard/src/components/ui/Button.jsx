const variants = {
  primary: 'bg-primary text-white hover:bg-primary-hover',
  secondary: 'bg-secondary text-white hover:bg-secondary-hover',
  danger: 'bg-danger text-white hover:opacity-90',
  warning: 'bg-warning text-white hover:opacity-90',
  info: 'bg-info text-white hover:opacity-90',
  outline: 'border border-primary text-primary hover:bg-primary hover:text-white',
  ghost: 'text-[var(--vz-text)] hover:bg-[var(--vz-input-bg)]',
  'soft-primary': 'bg-primary/10 text-primary hover:bg-primary/20',
  'soft-success': 'bg-secondary/10 text-secondary hover:bg-secondary/20',
  'soft-danger': 'bg-danger/10 text-danger hover:bg-danger/20',
  'soft-info': 'bg-info/10 text-info hover:bg-info/20',
  'soft-warning': 'bg-warning/10 text-warning hover:bg-warning/20',
}

const sizes = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-sm',
}

export default function Button({
  children, variant = 'primary', size = 'md',
  className = '', disabled = false, type = 'button', onClick, ...props
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 font-medium rounded-md
        transition-all duration-200 cursor-pointer
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variants[variant] || variants.primary}
        ${sizes[size] || sizes.md}
        ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
