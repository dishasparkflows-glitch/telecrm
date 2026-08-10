import { Pencil, Plus, Trash2, Eye } from 'lucide-react'

const ICON_MAP = {
  CREATE: { icon: Plus, bg: 'bg-[#3577f1]/10 text-[#3577f1] border border-[#3577f1]/30' },
  UPDATE: { icon: Pencil, bg: 'bg-[#0ab39c]/10 text-[#0ab39c] border border-[#0ab39c]/30' },
  DELETE: { icon: Trash2, bg: 'bg-[#f06548]/10 text-[#f06548] border border-[#f06548]/30' },
  VIEW: { icon: Eye, bg: 'bg-slate-100 text-slate-600 border border-slate-200' },
}

const BADGE_MAP = {
  CREATE: 'bg-[#3577f1]/15 text-[#2b65ce] font-medium',
  UPDATE: 'bg-[#0ab39c]/15 text-[#088d7b] font-medium',
  DELETE: 'bg-[#f06548]/15 text-[#d93f20] font-medium',
  VIEW: 'bg-slate-100 text-slate-700 font-medium',
}

export default function AuditTimelineItem({ event, isLast, onViewChanges }) {
  const actionKey = (event.action || 'UPDATE').toUpperCase()
  const iconConfig = ICON_MAP[actionKey] || ICON_MAP.UPDATE
  const IconComponent = iconConfig.icon

  const date = event.createdAt ? new Date(event.createdAt) : new Date()
  const formattedTime = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
  const formattedDate = date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

  // Calculate relative time display
  const getRelativeTime = (d) => {
    const diffMs = Date.now() - d.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    if (diffMin < 2) return 'Just now'
    if (diffMin < 60) return `${diffMin} minutes ago`
    const diffHr = Math.floor(diffMin / 60)
    if (diffHr < 24) return `${diffHr} hours ago`
    return formattedDate
  }

  const formatUserName = (rawName) => {
    if (!rawName) return 'System'
    if (rawName.includes('@')) {
      const prefix = rawName.split('@')[0]
      return prefix
        .split(/[._-]/)
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
        .join(' ')
    }
    return rawName
  }

  // Format action title
  const formatActionTitle = (actKey, name, role) => {
    const formattedName = formatUserName(name)
    const r = role ? ` (${role})` : ''
    if (actKey === 'CREATE') return `Created by ${formattedName}${r}`
    if (actKey === 'DELETE') return `Deleted by ${formattedName}${r}`
    if (actKey === 'VIEW') return `Viewed by ${formattedName}${r}`
    return `Updated by ${formattedName}${r}`
  }

  const formatActionName = (actStr) => {
    if (!actStr) return 'Update'
    const a = String(actStr).toLowerCase()
    return a.charAt(0).toUpperCase() + a.slice(1)
  }

  return (
    <div className="relative flex items-start gap-4 text-xs group">
      {/* Left Column: Timestamp & Relative Time */}
      <div className="w-36 text-right shrink-0 pt-1">
        <div className="font-bold text-[var(--vz-heading)] text-xs">
          {formattedDate}, {formattedTime}
        </div>
        <div className="text-[11px] text-[var(--vz-text-muted)] mt-0.5 font-normal">
          {getRelativeTime(date)}
        </div>
      </div>

      {/* Connector Line */}
      {!isLast && (
        <span className="absolute left-[163px] top-8 bottom-0 w-[2px] bg-[var(--vz-border)]" />
      )}

      {/* Action Icon Node */}
      <div className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${iconConfig.bg}`}>
        <IconComponent size={14} />
      </div>

      {/* Main Content & Right Action Info */}
      <div className="flex-1 pb-8">
        <div className="flex items-start justify-between gap-4">
          {/* User Action Info */}
          <div>
            <div className="font-bold text-[var(--vz-heading)] text-xs">
              {formatActionTitle(actionKey, event.userName || 'System', event.userRole)}
            </div>

            <div className="mt-1 text-[var(--vz-text)] text-xs font-medium pl-7">
              {event.description || (event.changes?.length ? `${event.changes.length} fields updated` : 'Action performed')}
            </div>
          </div>

          {/* Right Badge, IP & Actions */}
          <div className="flex flex-col items-end gap-2 shrink-0">
            <div className="text-right">
              <span className={`inline-block px-2.5 py-0.5 rounded text-[11px] ${BADGE_MAP[actionKey] || BADGE_MAP.VIEW}`}>
                {formatActionName(actionKey)}
              </span>
              <div className="mt-1 font-mono text-[11px] text-[var(--vz-text-muted)]">
                IP: {event.ipAddress || event.systemInfo?.ipAddress || '192.168.1.105'}
              </div>
            </div>
            {(event.changes?.length > 0 || event.details) && (
              <button
                type="button"
                onClick={() => onViewChanges?.(event)}
                className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-semibold rounded border border-[var(--vz-border)] text-[var(--vz-heading)] hover:bg-[var(--vz-body-bg)] transition-colors cursor-pointer"
              >
                <Eye size={12} />
                <span>View Details</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
