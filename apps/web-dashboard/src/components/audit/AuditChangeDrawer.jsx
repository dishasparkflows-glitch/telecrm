import { X, ArrowRight, Clock, ShieldCheck, Monitor, MapPin } from 'lucide-react'
import { useState, useEffect, useCallback } from 'react'

const ACTION_STYLES = {
  CREATE: 'bg-[#3577f1]/15 text-[#2b65ce] dark:text-[#3577f1] border border-[#3577f1]/30',
  UPDATE: 'bg-[#0ab39c]/15 text-[#088d7b] dark:text-[#0ab39c] border border-[#0ab39c]/30',
  DELETE: 'bg-[#f06548]/15 text-[#d93f20] dark:text-[#f06548] border border-[#f06548]/30',
  VIEW: 'bg-[#7047eb]/15 text-[#7047eb] border border-[#7047eb]/30',
}

const KeyValueTable = ({ data }) => {
  if (!data || typeof data !== 'object') return <span className="text-[var(--vz-heading)]">{String(data)}</span>;
  
  const renderValue = (val) => {
    if (val === null || val === undefined) return <span className="text-[var(--vz-text-muted)] italic">null</span>;
    if (typeof val === 'boolean') return <span className={val ? 'text-emerald-600 font-medium' : 'text-rose-600 font-medium'}>{val ? 'True' : 'False'}</span>;
    if (Array.isArray(val)) {
      if (val.length === 0) return <span className="text-[var(--vz-text-muted)] italic">Empty list</span>;
      return (
        <ul className="list-disc list-inside space-y-1">
          {val.map((item, i) => (
            <li key={i}>{renderValue(item)}</li>
          ))}
        </ul>
      );
    }
    if (typeof val === 'object') {
      if (Object.keys(val).length === 0) return <span className="text-[var(--vz-text-muted)] italic">Empty</span>;
      return (
        <div className="space-y-2 mt-0.5 border-l-2 border-[var(--vz-border)] pl-2 ml-1">
          {Object.entries(val).map(([k, v]) => {
            if (k === 'createdBy' || k === 'updatedBy' || k === '_id' || k === '__v') return null;
            return (
              <div key={k} className="flex flex-col">
                <span className="text-[10px] text-[var(--vz-heading)] font-bold capitalize">{k.replace(/([A-Z])/g, ' $1').trim()}</span>
                <span>{renderValue(v)}</span>
              </div>
            )
          })}
        </div>
      )
    }
    return <span className="text-[var(--vz-heading)] break-words">{String(val)}</span>;
  }

  return (
    <div className="w-full border border-[var(--vz-border)] rounded-md overflow-hidden mt-2">
      <table className="w-full text-left text-[11px]">
        <tbody className="divide-y divide-[var(--vz-border)]">
          {Object.entries(data).map(([key, value]) => {
            if (key === '_id' || key === '__v' || key === 'createdBy' || key === 'updatedBy') return null;
            return (
              <tr key={key} className="hover:bg-[var(--vz-table-hover-bg)] transition-colors">
                <td className="px-3 py-2 bg-[var(--vz-table-header-bg)] w-1/3 font-bold text-[var(--vz-heading)] capitalize border-r border-[var(--vz-border)] align-top">
                  {key.replace(/([A-Z])/g, ' $1').trim()}
                </td>
                <td className="px-3 py-2 w-2/3 align-top break-words">
                  {renderValue(value)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default function AuditChangeModal({ isOpen, onClose, event }) {
  const [drawerWidth, setDrawerWidth] = useState(800)
  const [isResizing, setIsResizing] = useState(false)

  const startResizing = useCallback((e) => {
    setIsResizing(true)
    e.preventDefault()
  }, [])

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing) return
      // For a centered modal, dragging the right edge means: distance from center * 2
      const newWidth = Math.abs(e.clientX - window.innerWidth / 2) * 2
      if (newWidth > 400 && newWidth < window.innerWidth - 32) {
        setDrawerWidth(newWidth)
      }
    }
    const handleMouseUp = () => {
      setIsResizing(false)
    }

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing])

  // Reset width when closed
  useEffect(() => {
    if (!isOpen) {
      setDrawerWidth(800)
      setIsResizing(false)
    }
  }, [isOpen])

  if (!isOpen || !event) return null

  const date = event.createdAt ? new Date(event.createdAt) : new Date()
  const formattedDate = date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  const formattedTime = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })

  const details = event.details || {}
  const actionKey = (event.action || 'UPDATE').toUpperCase()

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity cursor-pointer"
        onClick={onClose}
      />

      {/* Modal Card Panel */}
      <div 
        className="relative bg-[var(--vz-card-bg)] max-h-[80vh] shadow-2xl flex flex-col rounded-xl border border-[var(--vz-border)] z-10 transition-transform duration-300"
        style={{ width: `${drawerWidth}px`, maxWidth: '100%' }}
      >
        {/* Resize Drag Handle (Right Edge) */}
        <div 
          onMouseDown={startResizing}
          className={`absolute top-0 right-0 bottom-0 w-2 cursor-col-resize hover:bg-primary/50 active:bg-primary z-50 transition-colors rounded-r-xl ${isResizing ? 'bg-primary' : 'bg-transparent'}`}
        />

        {/* Drawer Header */}
        <div className="p-2 border-b border-[var(--vz-border)] flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-[var(--vz-text-muted)] hover:text-[var(--vz-heading)] hover:bg-[var(--vz-table-hover-bg)] cursor-pointer transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* User & Action Summary Header */}
        {!event.isSnapshot && (
          <div className="px-4 py-2 bg-[var(--vz-table-header-bg)] border-b border-[var(--vz-border)] flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                  ACTION_STYLES[actionKey] || ACTION_STYLES.UPDATE
                }`}
              >
                {actionKey}
              </span>
              <div className="text-[11px] font-semibold text-[var(--vz-heading)]">
                {(() => {
                  const raw = event?.userName
                  if (!raw) return 'System'
                  if (raw.includes('@')) {
                    return raw.split('@')[0].split(/[._-]/).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ')
                  }
                  return raw
                })()}
              </div>
            </div>

            <div className="flex items-center gap-4 text-[10px] text-[var(--vz-text-muted)]">
              <div className="flex items-center gap-1">
                <Clock size={11} />
                <span>{formattedDate} • {formattedTime}</span>
              </div>
              <div className="flex items-center gap-1">
                <MapPin size={11} />
                <span>{event.ipAddress || '192.168.1.105'}</span>
              </div>
            </div>
          </div>
        )}

        {/* Drawer Body - Changes List */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">

          {!details.body && !details.existingdata && !details.updateddata && (!event.changes || event.changes.length === 0) ? (
            <div className="p-4 text-center text-xs text-[var(--vz-text-muted)] italic bg-[var(--vz-table-header-bg)] rounded-md border border-[var(--vz-border)]">
              No detailed data recorded for this action.
            </div>
          ) : (
            <div className="space-y-4">
              {actionKey === 'UPDATE' && event.changes && event.changes.length > 0 && (
                <div className="space-y-2">
                  {event.changes.map((change, idx) => (
                    <div key={idx} className="p-3 bg-[var(--vz-card-bg)] border border-[var(--vz-border)] rounded-md text-[11px] flex items-center flex-wrap gap-2">
                      <span className="font-bold text-[var(--vz-heading)] capitalize">
                        {change.field.split('.').filter((_, i, arr) => arr.length === 1 || i > 0).map(p => p.replace(/([A-Z])/g, ' $1').trim()).join(' ➔ ')}
                      </span>
                      <span className="text-[var(--vz-text-muted)]">:</span>
                      <span className="text-rose-500 font-medium px-1.5 py-0.5 bg-rose-500/10 rounded break-all">
                        {String(change.oldValue === null || change.oldValue === undefined ? 'null' : (typeof change.oldValue === 'object' ? JSON.stringify(change.oldValue) : change.oldValue))}
                      </span>
                      <ArrowRight size={14} className="text-[var(--vz-text-muted)] flex-shrink-0" />
                      <span className="text-emerald-600 font-medium px-1.5 py-0.5 bg-emerald-500/10 rounded break-all">
                        {String(change.newValue === null || change.newValue === undefined ? 'null' : (typeof change.newValue === 'object' ? JSON.stringify(change.newValue) : change.newValue))}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {details.existingdata && (
                <div className="p-3.5 rounded-lg border border-[var(--vz-border)] bg-[var(--vz-card-bg)] shadow-xs">
                  <div className="text-[10px] uppercase font-sans font-bold text-[#c53030] dark:text-[#feb2b2] tracking-wider">Existing Data</div>
                  <KeyValueTable data={details.existingdata} />
                </div>
              )}
              
              {details.updateddata && (
                <div className="p-3.5 rounded-lg border border-[var(--vz-border)] bg-[var(--vz-card-bg)] shadow-xs">
                  {actionKey !== 'CREATE' && !event.isSnapshot && (
                    <div className="text-[10px] uppercase font-sans font-bold text-[#22543d] dark:text-[#9ae6b4] tracking-wider mb-2">
                      UPDATED DATA
                    </div>
                  )}
                  <KeyValueTable data={details.updateddata} />
                </div>
              )}

              {details.body && !details.existingdata && !details.updateddata && actionKey !== 'UPDATE' && actionKey !== 'CREATE' && (
                <div className="p-3.5 rounded-lg border border-[var(--vz-border)] bg-[var(--vz-card-bg)] shadow-xs">
                  <div className="text-[10px] uppercase font-sans font-bold text-[var(--vz-heading)] tracking-wider">Request Body</div>
                  <KeyValueTable data={details.body} />
                </div>
              )}
              
              {details.body && (details.existingdata || details.updateddata) && actionKey !== 'UPDATE' && actionKey !== 'CREATE' && (
                <div className="p-3.5 rounded-lg border border-[var(--vz-border)] bg-[var(--vz-card-bg)] shadow-xs opacity-70">
                  <div className="text-[10px] uppercase font-sans font-bold text-[var(--vz-text-muted)] tracking-wider">Request Body Context</div>
                  <KeyValueTable data={details.body} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
