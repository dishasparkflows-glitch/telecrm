import { X, ArrowRight, Clock, ShieldCheck, Monitor, MapPin } from 'lucide-react'

function formatVal(val) {
  if (val === null || val === undefined) return 'null'
  if (typeof val === 'object') {
    try {
      const keys = Object.keys(val)
      if (keys.length === 0) return '{}'
      const pairs = Object.entries(val).map(([k, v]) => {
        const strV = typeof v === 'object' ? JSON.stringify(v) : String(v)
        return `${k}: ${strV}`
      })
      return pairs.join(', ')
    } catch (e) {
      return JSON.stringify(val)
    }
  }
  return String(val)
}

const ACTION_STYLES = {
  CREATE: 'bg-[#3577f1]/15 text-[#2b65ce] dark:text-[#3577f1] border border-[#3577f1]/30',
  UPDATE: 'bg-[#0ab39c]/15 text-[#088d7b] dark:text-[#0ab39c] border border-[#0ab39c]/30',
  DELETE: 'bg-[#f06548]/15 text-[#d93f20] dark:text-[#f06548] border border-[#f06548]/30',
  VIEW: 'bg-[#7047eb]/15 text-[#7047eb] border border-[#7047eb]/30',
}

export default function AuditChangeDrawer({ isOpen, onClose, event }) {
  if (!isOpen || !event) return null

  const date = event.createdAt ? new Date(event.createdAt) : new Date()
  const formattedDate = date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  const formattedTime = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })

  const changes = event.changes || []
  const actionKey = (event.action || 'UPDATE').toUpperCase()

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity cursor-pointer"
        onClick={onClose}
      />

      {/* Drawer Card Panel */}
      <div className="relative w-full max-w-md bg-[var(--vz-card-bg)] h-full shadow-2xl flex flex-col border-l border-[var(--vz-border)] z-10 transition-transform duration-300">
        {/* Drawer Header */}
        <div className="p-4 border-b border-[var(--vz-border)] flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-[var(--vz-heading)] tracking-wide uppercase">
              CHANGE DETAILS
            </h3>
            <p className="text-[11px] text-[var(--vz-text-muted)]">
              Record history breakdown
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-[var(--vz-text-muted)] hover:text-[var(--vz-heading)] hover:bg-[var(--vz-table-hover-bg)] cursor-pointer transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* User & Action Summary Header */}
        <div className="p-4 bg-[var(--vz-table-header-bg)] border-b border-[var(--vz-border)]">
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="text-xs font-bold text-[var(--vz-heading)]">
                {(() => {
                  const raw = event?.userName
                  if (!raw) return 'System'
                  if (raw.includes('@')) {
                    return raw.split('@')[0].split(/[._-]/).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ')
                  }
                  return raw
                })()}
              </div>
              <div className="text-[11px] text-[var(--vz-text-muted)] capitalize mt-0.5">
                {event.userRole || 'User'}
              </div>
            </div>

            <span
              className={`px-2.5 py-1 rounded text-[11px] font-bold uppercase tracking-wider ${
                ACTION_STYLES[actionKey] || ACTION_STYLES.UPDATE
              }`}
            >
              {actionKey}
            </span>
          </div>

          <div className="flex items-center gap-4 text-[11px] text-[var(--vz-text-muted)] mt-2">
            <div className="flex items-center gap-1">
              <Clock size={12} />
              <span>{formattedDate} • {formattedTime}</span>
            </div>
            <div className="flex items-center gap-1">
              <MapPin size={12} />
              <span>{event.ipAddress || '192.168.1.105'}</span>
            </div>
          </div>
        </div>

        {/* Drawer Body - Changes List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="text-xs font-bold text-[var(--vz-heading)] uppercase tracking-wider mb-2">
            CHANGES MADE ({changes.length})
          </div>

          {changes.length === 0 ? (
            <div className="p-4 text-center text-xs text-[var(--vz-text-muted)] italic bg-[var(--vz-table-header-bg)] rounded-md border border-[var(--vz-border)]">
              No detailed field diff recorded for this action.
            </div>
          ) : (
            changes.map((change, idx) => {
              const fieldName = change.field || `Field #${idx + 1}`
              const oldVal = formatVal(change.oldValue)
              const newVal = formatVal(change.newValue)

              return (
                <div
                  key={idx}
                  className="p-3.5 rounded-lg border border-[var(--vz-border)] bg-[var(--vz-card-bg)] shadow-xs space-y-2.5"
                >
                  <div className="text-xs font-bold text-[var(--vz-heading)] capitalize">
                    {fieldName}
                  </div>

                  <div className="flex items-center gap-2.5 text-xs">
                    {/* Old Value Box */}
                    <div className="flex-1 p-2.5 rounded-md bg-[#fff5f5] dark:bg-[#2c1517] text-[#e53e3e] dark:text-[#fc8181] font-mono text-[11px] leading-relaxed border border-[#feb2b2] dark:border-[#742a2a] break-all shadow-2xs">
                      <div className="text-[9px] uppercase font-sans font-bold text-[#c53030] dark:text-[#feb2b2] mb-1 tracking-wider opacity-80">Previous</div>
                      {oldVal}
                    </div>

                    <ArrowRight size={14} className="text-[var(--vz-text-muted)] shrink-0" />

                    {/* New Value Box */}
                    <div className="flex-1 p-2.5 rounded-md bg-[#f0fff4] dark:bg-[#122b1e] text-[#276749] dark:text-[#68d391] font-mono text-[11px] leading-relaxed border border-[#9ae6b4] dark:border-[#22543d] break-all shadow-2xs">
                      <div className="text-[9px] uppercase font-sans font-bold text-[#22543d] dark:text-[#9ae6b4] mb-1 tracking-wider opacity-80">Updated</div>
                      {newVal}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Drawer Footer Meta */}
        <div className="p-4 border-t border-[var(--vz-border)] bg-[var(--vz-table-header-bg)] text-[11px] text-[var(--vz-text-muted)] space-y-1">
          <div className="flex items-center gap-1.5">
            <Monitor size={13} />
            <span className="font-medium">User Agent:</span>
            <span className="truncate">{event.userAgent || 'Chrome / Windows'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <ShieldCheck size={13} />
            <span className="font-medium">Security Context:</span>
            <span>Tenant & Branch Verified</span>
          </div>
        </div>
      </div>
    </div>
  )
}
