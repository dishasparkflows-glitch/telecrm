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

const formatUserName = (log, users = []) => {
  const rawName = log.userName;
  if (!rawName) {
    if (log.userId) {
      const user = users.find((u) => String(u._id || u.id || u.userId) === String(log.userId));
      if (user) {
        return user.name || user.userName || (user.email ? user.email.split('@')[0] : 'User');
      }
      return String(log.userId).substring(0, 8) + '...';
    }
    return 'System';
  }
  if (rawName.includes('@')) {
    const prefix = rawName.split('@')[0]
    return prefix
      .split(/[._-]/)
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join(' ')
  }
  return rawName
}

export default function AuditTable({ logs = [], users = [], onViewChanges }) {
  const navigate = useNavigate()
  const [openMenuId, setOpenMenuId] = useState(null)

  const handleRecordClick = (recordId) => {
    if (!recordId) return
    navigate(`/audit/record/${encodeURIComponent(recordId)}`)
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return { formattedDate: '—', formattedTime: '' }
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
            <th className="px-4 py-3 text-[11px] font-semibold uppercase text-[var(--vz-text-muted)] tracking-wider w-40">
              Date & Time
            </th>
            <th className="px-4 py-3 text-[11px] font-semibold uppercase text-[var(--vz-text-muted)] tracking-wider w-48">
              User
            </th>
            <th className="px-4 py-3 text-[11px] font-semibold uppercase text-[var(--vz-text-muted)] tracking-wider w-32">
              Module
            </th>
            <th className="px-4 py-3 text-[11px] font-semibold uppercase text-[var(--vz-text-muted)] tracking-wider w-24">
              Action
            </th>
            <th className="px-4 py-3 text-[11px] font-semibold uppercase text-[var(--vz-text-muted)] tracking-wider w-full">
              Changes
            </th>
            <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase text-[var(--vz-text-muted)] tracking-wider w-12">
              
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--vz-border)]">
          {logs.map((log) => {
            const modKey = (log.module || 'system').toLowerCase()
            const ModuleIcon = MODULE_ICONS[modKey] || Users
            const { formattedDate, formattedTime } = formatDate(log.meta?.createdAt || log.createdAt)
            const recordIdStr = log.recordId || 'Unknown'
            return (
              <tr
                key={log._id || Math.random()}
                className="hover:bg-[var(--vz-table-hover-bg)] transition-colors group text-xs"
              >
                {/* DATE & TIME */}
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="font-semibold text-[var(--vz-heading)]">
                    {formattedDate}{formattedTime ? `, ${formattedTime}` : ''}
                  </div>
                </td>

                {/* USER */}
                <td className="px-4 py-3 whitespace-nowrap">
                  <div>
                    <div className="font-semibold text-[var(--vz-heading)] leading-snug">
                      {formatUserName(log, users)}
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
                  {log.action !== 'DELETE' && (
                    <button
                      type="button"
                      onClick={() => onViewChanges?.(log)}
                      className="text-[11px] font-medium text-[#3577f1] hover:underline cursor-pointer"
                    >
                      View changes
                    </button>
                  )}
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
                  </div>


                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
