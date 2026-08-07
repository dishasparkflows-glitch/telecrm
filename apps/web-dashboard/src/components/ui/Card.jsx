export default function Card({ children, className = '', noPadding = false }) {
  return (
    <div
      className={`bg-[var(--vz-card-bg)] border border-[var(--vz-border)] rounded-lg transition-colors duration-200 ${
        noPadding ? '' : 'p-4'
      } ${className}`}
      style={{ boxShadow: 'var(--vz-shadow)' }}
    >
      {children}
    </div>
  )
}

Card.Header = function CardHeader({ children, className = '' }) {
  return (
    <div className={`pb-3 mb-3 border-b border-[var(--vz-border)] ${className}`}>
      {children}
    </div>
  )
}

Card.Title = function CardTitle({ children, className = '' }) {
  return (
    <h5 className={`text-sm font-semibold text-[var(--vz-heading)] uppercase tracking-wide ${className}`}>
      {children}
    </h5>
  )
}
