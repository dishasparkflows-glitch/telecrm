import { useState } from 'react'
import { ArrowRight, History, X } from 'lucide-react'

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

export default function AuditFieldHistory({ history = [] }) {
  const [selectedField, setSelectedField] = useState(null)

  // Aggregate field changes across lifetime
  const fieldMap = {}

  history.forEach((event) => {
    let changes = []
    
    if (event.changes && event.changes.length > 0) {
      changes = event.changes
    } else if (event.details?.existingdata && event.details?.updateddata) {
      const existing = event.details.existingdata
      const updated = event.details.updateddata
      const allKeys = new Set([...Object.keys(existing), ...Object.keys(updated)])
      
      allKeys.forEach(key => {
        if (['updatedAt', 'updatedBy', '__v'].includes(key)) return;
        
        const oldV = existing[key]
        const newV = updated[key]
        
        const strOld = typeof oldV === 'object' ? JSON.stringify(oldV) : String(oldV)
        const strNew = typeof newV === 'object' ? JSON.stringify(newV) : String(newV)
        
        if (strOld !== strNew) {
          changes.push({
            field: key,
            oldValue: oldV,
            newValue: newV
          })
        }
      })
    }
    
    changes.forEach((c) => {
      const fname = c.field || 'Unspecified'
      if (!fieldMap[fname]) {
        fieldMap[fname] = {
          field: fname,
          firstValue: c.oldValue,
          currentValue: c.newValue,
          count: 0,
          history: [],
        }
      }
      fieldMap[fname].count += 1
      fieldMap[fname].currentValue = c.newValue // since history is descending (latest first)
      if (c.oldValue !== null && c.oldValue !== undefined) {
        fieldMap[fname].firstValue = c.oldValue
      }
      fieldMap[fname].history.push({
        date: event.createdAt,
        userName: event.userName,
        userRole: event.userRole,
        oldValue: c.oldValue,
        newValue: c.newValue,
      })
    })
  })

  const fieldsList = Object.values(fieldMap)

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-[var(--vz-table-header-bg)] border-b border-[var(--vz-border)]">
              <th className="px-4 py-3 font-semibold uppercase text-[var(--vz-text-muted)] tracking-wider">Field</th>
              <th className="px-4 py-3 font-semibold uppercase text-[var(--vz-text-muted)] tracking-wider">First Value</th>
              <th className="px-4 py-3 font-semibold uppercase text-[var(--vz-text-muted)] tracking-wider">Current Value</th>
              <th className="px-4 py-3 font-semibold uppercase text-[var(--vz-text-muted)] tracking-wider text-center">Changes</th>
              <th className="px-4 py-3 font-semibold uppercase text-[var(--vz-text-muted)] tracking-wider text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--vz-border)]">
            {fieldsList.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-xs text-[var(--vz-text-muted)] italic">
                  No field history recorded yet.
                </td>
              </tr>
            ) : (
              fieldsList.map((row) => (
                <tr
                  key={row.field}
                  className="hover:bg-[var(--vz-table-hover-bg)] transition-colors cursor-pointer"
                  onClick={() => setSelectedField(row)}
                >
                  <td className="px-4 py-3 font-semibold text-[var(--vz-heading)] capitalize">{row.field}</td>
                  <td className="px-4 py-3 font-mono text-[var(--vz-text-muted)]">{formatVal(row.firstValue)}</td>
                  <td className="px-4 py-3 font-mono text-emerald-600 font-semibold">{formatVal(row.currentValue)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full font-bold bg-primary/10 text-primary text-[11px]">
                      {row.count}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedField(row)
                      }}
                      className="text-primary font-medium hover:underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      <History size={13} />
                      <span>View History</span>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Field History Modal */}
      {selectedField && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-[var(--vz-card-bg)] border border-[var(--vz-border)] rounded-lg shadow-xl overflow-hidden">
            <div className="p-4 border-b border-[var(--vz-border)] flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase text-[var(--vz-heading)]">
                {selectedField.field} History
              </h3>
              <button
                type="button"
                onClick={() => setSelectedField(null)}
                className="p-1 rounded text-[var(--vz-text-muted)] hover:text-[var(--vz-heading)] cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 max-h-[60vh] overflow-y-auto space-y-3">
              {selectedField.history.length === 0 ? (
                <div className="text-xs text-[var(--vz-text-muted)] text-center py-4">
                  No modification log entries recorded for this field.
                </div>
              ) : (
                selectedField.history.map((h, i) => (
                  <div key={i} className="p-3 border border-[var(--vz-border)] rounded-md bg-[var(--vz-body-bg)] space-y-1 text-xs">
                    <div className="flex items-center justify-between text-[11px] text-[var(--vz-text-muted)]">
                      <span>{new Date(h.date).toLocaleString()}</span>
                      <span className="font-medium text-[var(--vz-heading)]">{h.userName} ({h.userRole || 'user'})</span>
                    </div>
                    <div className="flex items-center gap-2 pt-1 font-mono text-[11px]">
                      <span className="text-rose-600 font-semibold">{formatVal(h.oldValue)}</span>
                      <ArrowRight size={13} className="text-[var(--vz-text-muted)]" />
                      <span className="text-emerald-600 font-semibold">{formatVal(h.newValue)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
