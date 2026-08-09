import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MoreVertical, Users, Building2, UserCog, Shield, Settings, Zap, Phone, MessageCircle, Eye } from 'lucide-react'

const MODULE_ICONS = {
  leads: Users,
  branches: Building2,
  users: UserCog,
  roles: Shield,
  settings: Settings,
  automations: Zap,
  calls: Phone,
  whatsapp: MessageCircle,
}

const MODULE_COLORS = {
  leads: 'bg-[#7047eb]/10 text-[#7047eb]',
  branches: 'bg-[#0ab39c]/10 text-[#0ab39c]',
  users: 'bg-[#f7b84b]/20 text-[#b27605]',
  roles: 'bg-[#3577f1]/10 text-[#3577f1]',
  settings: 'bg-[#405189]/10 text-[#405189]',
  automations: 'bg-[#299cdb]/10 text-[#299cdb]',
  calls: 'bg-[#0ab39c]/10 text-[#0ab39c]',
  whatsapp: 'bg-[#0ab39c]/10 text-[#0ab39c]',
}

const ACTION_BADGES = {
  CREATE: 'bg-[#3577f1]/15 text-[#2b65ce] font-medium',
  UPDATE: 'bg-[#0ab39c]/15 text-[#088d7b] font-medium',
  DELETE: 'bg-[#f06548]/15 text-[#d93f20] font-medium',
  VIEW: 'bg-slate-100 text-slate-700 font-medium',
  LOGIN: 'bg-[#7047eb]/15 text-[#7047eb] font-medium',
  LOGOUT: 'bg-slate-100 text-slate-700 font-medium',
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

export default function AuditTable({ logs = [], onViewChanges }) {
  const navigate = useNavigate()
  const [openMenuId, setOpenMenuId] = useState(null)

  const handleRecordClick = (recordId) => {
    if (!recordId) return
    navigate(`/audit/record/${encodeURIComponent(recordId)}`)
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '—'
    const date = new Date(dateStr)
    const formattedDate = date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    const formattedTime = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
    return { formattedDate, formattedTime }
  }

  const formatActionName = (actionStr) => {
    if (!actionStr) return 'Update'
    const act = String(actionStr).toLowerCase()
    return act.charAt(0).toUpperCase() + act.slice(1)
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-[var(--vz-table-header-bg)] border-b border-[var(--vz-border)]">
            <th className="px-4 py-3 text-[11px] font-semibold uppercase text-[var(--vz-text-muted)] tracking-wider">
              Date & Time
            </th>
            <th className="px-4 py-3 text-[11px] font-semibold uppercase text-[var(--vz-text-muted)] tracking-wider">
              User
            </th>
            <th className="px-4 py-3 text-[11px] font-semibold uppercase text-[var(--vz-text-muted)] tracking-wider">
              Module
            </th>
            <th className="px-4 py-3 text-[11px] font-semibold uppercase text-[var(--vz-text-muted)] tracking-wider">
              Record
            </th>
            <th className="px-4 py-3 text-[11px] font-semibold uppercase text-[var(--vz-text-muted)] tracking-wider">
              Action
            </th>
            <th className="px-4 py-3 text-[11px] font-semibold uppercase text-[var(--vz-text-muted)] tracking-wider">
              Changes
            </th>
            <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase text-[var(--vz-text-muted)] tracking-wider">
              
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--vz-border)]">
          {logs.map((log) => {
            const modKey = (log.module || 'system').toLowerCase()
            const ModuleIcon = MODULE_ICONS[modKey] || Users
            const { formattedDate, formattedTime } = formatDate(log.createdAt)
            const recordIdStr = log.recordId || log.resourceId || 'LEAD-2025-00125'

            return (
              <tr
                key={log._id || Math.random()}
                className="hover:bg-[var(--vz-table-hover-bg)] transition-colors group text-xs"
              >
                {/* DATE & TIME */}
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="font-semibold text-[var(--vz-heading)]">{formattedDate}, {formattedTime}</div>
                </td>

                {/* USER */}
                <td className="px-4 py-3 whitespace-nowrap">
                  <div>
                    <div className="font-semibold text-[var(--vz-heading)] leading-snug">
                      {formatUserName(log.userName)}
                    </div>
                    <div className="text-[11px] text-[var(--vz-text-muted)] capitalize">
                      {log.userRole || 'User'}
                    </div>
                  </div>
                </td>

                {/* MODULE */}
                <td className="px-4 py-3 whitespace-nowrap">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium capitalize ${
                      MODULE_COLORS[modKey] || 'bg-slate-100 text-slate-700 font-medium'
                    }`}
                  >
                    <ModuleIcon size={14} />
                    {log.module ? log.module.charAt(0).toUpperCase() + log.module.slice(1) : 'System'}
                  </span>
                </td>

                {/* RECORD */}
                <td className="px-4 py-3 whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => handleRecordClick(recordIdStr)}
                    className="text-left font-bold text-[#3577f1] hover:underline block leading-tight cursor-pointer"
                  >
                    {recordIdStr}
                  </button>
                  <div className="text-[11px] text-[var(--vz-text-muted)] truncate max-w-[140px] mt-0.5">
                    {log.recordName || log.resource || 'Record'}
                  </div>
                </td>

                {/* ACTION */}
                <td className="px-4 py-3 whitespace-nowrap">
                  <span
                    className={`inline-block px-2.5 py-0.5 rounded text-[11px] ${
                      ACTION_BADGES[log.action] || ACTION_BADGES.VIEW
                    }`}
                  >
                    {formatActionName(log.action)}
                  </span>
                </td>

                {/* CHANGES */}
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="font-semibold text-[var(--vz-heading)]">
                    {log.description || (log.changes?.length ? `${log.changes.length} fields updated` : 'No changes')}
                  </div>
                  <button
                    type="button"
                    onClick={() => onViewChanges?.(log)}
                    className="text-[11px] font-medium text-[#3577f1] hover:underline cursor-pointer"
                  >
                    View changes
                  </button>
                </td>

                {/* ACTION MENU (3 DOTS & EYE) */}
                <td className="px-4 py-3 whitespace-nowrap text-right relative">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => handleRecordClick(recordIdStr)}
                      title="View Record History"
                      className="p-1 rounded text-[var(--vz-text-muted)] hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                    >
                      <Eye size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setOpenMenuId(openMenuId === log._id ? null : log._id)}
                      className="p-1 rounded text-[var(--vz-text-muted)] hover:text-[var(--vz-heading)] hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                    >
                      <MoreVertical size={15} />
                    </button>
                  </div>

                  {openMenuId === log._id && (
                    <div className="absolute right-4 top-10 w-44 bg-[var(--vz-card-bg)] border border-[var(--vz-border)] rounded-md shadow-lg py-1 z-20 text-left">
                      <button
                        type="button"
                        onClick={() => {
                          setOpenMenuId(null)
                          handleRecordClick(recordIdStr)
                        }}
                        className="w-full px-3 py-1.5 text-xs text-[var(--vz-heading)] hover:bg-[var(--vz-table-hover-bg)] text-left cursor-pointer"
                      >
                        View Record History
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setOpenMenuId(null)
                          onViewChanges?.(log)
                        }}
                        className="w-full px-3 py-1.5 text-xs text-[var(--vz-heading)] hover:bg-[var(--vz-table-hover-bg)] text-left cursor-pointer"
                      >
                        View Change Details
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
