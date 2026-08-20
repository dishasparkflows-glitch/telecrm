import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function PageHeader({ title, breadcrumbs = [], action }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
      <div className="flex flex-col">
        <h1 className="text-base font-semibold text-[var(--vz-heading)] uppercase">{title}</h1>
      </div>
      <div className="flex items-center gap-4">
        {breadcrumbs.length > 0 && (
          <nav className="flex items-center gap-1 text-[13px]">
            {breadcrumbs.map((crumb, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <ChevronRight size={12} className="text-[var(--vz-text-muted)]" />}
                {crumb.path ? (
                  <Link to={crumb.path} className="text-[var(--vz-text-muted)] hover:text-primary transition-colors">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-[var(--vz-heading)]">{crumb.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}
        {action && <div className="flex items-center">{action}</div>}
      </div>
    </div>
  )
}
