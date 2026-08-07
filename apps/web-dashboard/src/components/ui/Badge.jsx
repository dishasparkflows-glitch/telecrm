const colorMap = {
  success: 'bg-secondary/10 text-secondary',
  danger: 'bg-danger/10 text-danger',
  warning: 'bg-warning/10 text-warning',
  info: 'bg-info/10 text-info',
  primary: 'bg-primary/10 text-primary',
  secondary: 'bg-secondary/10 text-secondary',
  dark: 'bg-[var(--vz-text)]/10 text-[var(--vz-text)]',
}

export default function Badge({ children, color = 'primary', className = '' }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium
        ${colorMap[color] || colorMap.primary} ${className}`}
    >
      {children}
    </span>
  )
}
