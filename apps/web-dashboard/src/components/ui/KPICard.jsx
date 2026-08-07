import Card from './Card'
import { TrendingUp, TrendingDown } from 'lucide-react'

export default function KPICard({ title, value, change, changeType = 'up', icon: Icon, iconColor = 'primary' }) {
  const iconBgMap = {
    primary: 'bg-primary/10 text-primary',
    success: 'bg-secondary/10 text-secondary',
    warning: 'bg-warning/10 text-warning',
    danger: 'bg-danger/10 text-danger',
    info: 'bg-info/10 text-info',
  }

  return (
    <Card>
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--vz-text-muted)]">
            {title}
          </p>
          <h3 className="text-[22px] font-semibold text-[var(--vz-heading)]">{value}</h3>
          {change !== undefined && (
            <div className="flex items-center gap-1">
              {changeType === 'up' ? (
                <TrendingUp size={14} className="text-secondary" />
              ) : (
                <TrendingDown size={14} className="text-danger" />
              )}
              <span className={`text-xs font-semibold ${changeType === 'up' ? 'text-secondary' : 'text-danger'}`}>
                {change}
              </span>
            </div>
          )}
        </div>
        {Icon && (
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${iconBgMap[iconColor] || iconBgMap.primary}`}>
            <Icon size={22} />
          </div>
        )}
      </div>
    </Card>
  )
}
