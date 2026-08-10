import { useState, useMemo } from 'react'
import { useGetNotificationsQuery, useMarkAsReadMutation, useMarkAllReadMutation, useDeleteNotificationMutation } from '../../features/notifications/notificationApi'
import EmptyState from '../../components/ui/EmptyState'
import Pagination from '../../components/ui/Pagination'
import { useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../../components/ui/Toast'
import { Bell, Check, Users, Phone, FileText, Zap, CreditCard, MessageSquare, Trash2, Calendar, CheckCheck, BellOff } from 'lucide-react'

const typeIcons = {
  lead: Users, call: Phone, form: FileText, automation: Zap,
  billing: CreditCard, whatsapp: MessageSquare, meeting: Calendar, default: Bell,
}

// HSL-based soft background + icon color per type
const typeStyles = {
  lead:       { bg: 'bg-primary/10',    text: 'text-primary' },
  call:       { bg: 'bg-orange-500/10', text: 'text-orange-500' },
  form:       { bg: 'bg-blue-500/10',   text: 'text-blue-500' },
  automation: { bg: 'bg-emerald-500/10', text: 'text-emerald-500' },
  billing:    { bg: 'bg-emerald-500/10', text: 'text-emerald-500' },
  whatsapp:   { bg: 'bg-green-600/10',  text: 'text-green-600' },
  meeting:    { bg: 'bg-rose-500/10',   text: 'text-rose-500' },
  default:    { bg: 'bg-primary/10',    text: 'text-primary' },
}

const formatNotificationTime = (dateStr) => {
  if (!dateStr) return { time: '', date: '' }
  const date = new Date(dateStr)
  return {
    time: date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
    date: date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
  }
}

/* ── Skeleton loader for individual rows ── */
function NotificationSkeleton() {
  return (
    <div className="flex items-center gap-4 px-6 py-5 border-b border-[var(--vz-border)] animate-pulse">
      <div className="w-4 h-4 rounded bg-[var(--vz-border)]" />
      <div className="relative w-11 h-11 rounded-xl bg-[var(--vz-border)]" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-40 rounded bg-[var(--vz-border)]" />
        <div className="h-3 w-64 rounded bg-[var(--vz-border)]" />
      </div>
      <div className="space-y-1.5 text-right">
        <div className="h-3 w-16 rounded bg-[var(--vz-border)] ml-auto" />
        <div className="h-3 w-20 rounded bg-[var(--vz-border)] ml-auto" />
      </div>
      <div className="w-9 h-9 rounded-lg bg-[var(--vz-border)]" />
    </div>
  )
}

export default function Notifications() {
  const { user } = useSelector((s) => s.auth)
  const toast = useToast()

  const [activeTab, setActiveTab] = useState('all')
  const [selectedIds, setSelectedIds] = useState([])
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  const { data, isLoading } = useGetNotificationsQuery(
    { limit: 100, userId: user?._id || user?.id },
    { skip: !(user?._id || user?.id) }
  )
  const [markAsRead] = useMarkAsReadMutation()
  const [markAllRead] = useMarkAllReadMutation()
  const [deleteNotification] = useDeleteNotificationMutation()

  const allNotifications = data?.data || []
  const navigate = useNavigate()
  const unreadCount = allNotifications.filter((n) => !n.isRead).length
  const userId = user?._id || user?.id

  const filteredNotifications = useMemo(() => {
    if (activeTab === 'unread') return allNotifications.filter((n) => !n.isRead)
    return allNotifications
  }, [allNotifications, activeTab])

  const totalPages = Math.ceil(filteredNotifications.length / pageSize)
  const paginatedNotifications = filteredNotifications.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  )

  const handleMarkRead = async (id) => {
    try { await markAsRead({ ids: [id], userId }).unwrap() } catch { }
  }

  const handleNotificationClick = async (notif) => {
    if (!notif.isRead) await handleMarkRead(notif._id)
    if (notif.actionUrl) navigate(notif.actionUrl)
  }

  const handleMarkAll = async () => {
    try {
      await markAllRead({ userId }).unwrap()
      toast('All marked as read', 'success')
      setSelectedIds([])
    } catch { }
  }

  const handleMarkSelectedAsRead = async () => {
    if (!selectedIds.length) return
    try {
      await markAsRead({ ids: selectedIds, userId }).unwrap()
      setSelectedIds([])
      toast('Selected marked as read', 'success')
    } catch { }
  }

  const handleSelectAll = (e) => {
    setSelectedIds(e.target.checked ? paginatedNotifications.map((n) => n._id) : [])
  }

  const toggleSelection = (e, id) => {
    e.stopPropagation()
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
  }

  const handleDelete = async (e, id) => {
    e.stopPropagation()
    try {
      await deleteNotification(id).unwrap()
      setSelectedIds((prev) => prev.filter((x) => x !== id))
      toast('Notification deleted', 'success')
    } catch { toast('Failed to delete', 'error') }
  }

  const handleDeleteSelected = async () => {
    if (!selectedIds.length) return
    try {
      await Promise.all(selectedIds.map((id) => deleteNotification(id).unwrap()))
      setSelectedIds([])
      toast('Deleted selected notifications', 'success')
    } catch { toast('Failed to delete some', 'error') }
  }

  const isAllSelected = paginatedNotifications.length > 0 && selectedIds.length === paginatedNotifications.length
  const isIndeterminate = selectedIds.length > 0 && selectedIds.length < paginatedNotifications.length

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h1 className="text-2xl font-bold text-[var(--vz-heading)]">Notifications</h1>
        <nav className="flex items-center gap-1.5 text-sm text-[var(--vz-text-muted)]">
          <span>CRM</span>
          <span className="text-[var(--vz-text-muted)]">&gt;</span>
          <span className="text-[var(--vz-heading)]">Notifications</span>
        </nav>
      </div>

      {/* ── Main Card ── */}
      <div className="bg-[var(--vz-card-bg)] border border-[var(--vz-border)] rounded-xl overflow-hidden" style={{ boxShadow: 'var(--vz-shadow)' }}>

        {/* ── Tabs ── */}
        <div className="flex items-center border-b border-[var(--vz-border)] px-6">
          {[
            { key: 'all',    label: 'All Notifications', count: allNotifications.length },
            { key: 'unread', label: 'Unread',            count: unreadCount },
          ].map((tab) => {
            const active = activeTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => { setActiveTab(tab.key); setCurrentPage(1); setSelectedIds([]) }}
                className={`
                  relative flex items-center gap-2 px-1 py-4 mr-8 text-sm font-medium transition-colors
                  ${active
                    ? 'text-primary'
                    : 'text-[var(--vz-text-muted)] hover:text-[var(--vz-heading)]'
                  }
                `}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span className={`
                    inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full text-[11px] font-semibold leading-none
                    ${active
                      ? 'bg-[var(--vz-heading)] text-white'
                      : 'bg-[var(--vz-input-bg)] text-[var(--vz-text-muted)]'
                    }
                  `}>
                    {tab.count}
                  </span>
                )}
                {active && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary rounded-t-full" />
                )}
              </button>
            )
          })}
        </div>

        {/* ── Select All + Actions Row ── */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-[var(--vz-border)]">
          <label className="flex items-center gap-2.5 cursor-pointer select-none text-sm text-[var(--vz-text-muted)]">
            <input
              type="checkbox"
              checked={isAllSelected}
              ref={(el) => { if (el) el.indeterminate = isIndeterminate }}
              onChange={handleSelectAll}
              className="w-4 h-4 rounded cursor-pointer accent-[var(--vz-primary)]"
            />
            Select All
          </label>

          <div className="flex items-center gap-2">
            {selectedIds.length > 0 ? (
              <>
                <span className="text-xs text-[var(--vz-text-muted)] mr-1">
                  {selectedIds.length} selected
                </span>
                <button
                  onClick={handleMarkSelectedAsRead}
                  className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg text-[var(--vz-heading)] hover:bg-[var(--vz-input-bg)] transition-colors"
                >
                  <Check size={15} /> Mark read
                </button>
                <button
                  onClick={handleDeleteSelected}
                  className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg text-[var(--vz-danger)] hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 size={15} /> Delete
                </button>
              </>
            ) : (
              <button
                onClick={handleMarkAll}
                className="inline-flex items-center gap-2 text-sm font-medium text-[var(--vz-heading)] hover:text-primary transition-colors"
              >
                <CheckCheck size={16} className="text-[var(--vz-text-muted)]" />
                Mark all as read
              </button>
            )}
          </div>
        </div>

        {/* ── Notification List ── */}
        {isLoading ? (
          <div>
            {[...Array(5)].map((_, i) => <NotificationSkeleton key={i} />)}
          </div>
        ) : filteredNotifications.length === 0 ? (
          <EmptyState
            icon={BellOff}
            title={activeTab === 'unread' ? 'No unread notifications' : 'No notifications'}
            description={activeTab === 'unread'
              ? "You've read everything. Great job staying on top of things!"
              : "You're all caught up! Notifications will appear here."
            }
          />
        ) : (
          <div>
            {paginatedNotifications.map((notif) => {
              const Icon = typeIcons[notif.type] || typeIcons.default
              const style = typeStyles[notif.type] || typeStyles.default
              const isSelected = selectedIds.includes(notif._id)
              const { time, date } = formatNotificationTime(notif.sentAt)

              return (
                <div
                  key={notif._id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`
                    group flex items-center gap-4 px-6 py-5 cursor-pointer transition-colors border-b border-[var(--vz-border)] last:border-b-0
                    ${isSelected
                      ? 'bg-primary/[0.06]'
                      : notif.isRead
                        ? 'bg-[var(--vz-card-bg)] hover:bg-[var(--vz-body-bg)]/40'
                        : 'hover:bg-primary/[0.04]'
                    }
                  `}
                >
                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => toggleSelection(e, notif._id)}
                    className="w-4 h-4 rounded cursor-pointer accent-[var(--vz-primary)] shrink-0"
                  />

                  {/* Icon with unread dot */}
                  <div className="relative shrink-0">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${style.bg}`}>
                      <Icon size={20} className={style.text} />
                    </div>
                    {!notif.isRead && (
                      <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-primary border-2 border-[var(--vz-card-bg)]" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm leading-snug ${notif.isRead ? 'font-semibold text-[var(--vz-heading)]' : 'font-bold text-[var(--vz-heading)]'}`}>
                      {notif.title}
                    </p>
                    <p className="text-sm text-[var(--vz-text-muted)] mt-0.5">
                      {notif.message || notif.body}
                    </p>
                  </div>

                  {/* Timestamp */}
                  <div className="text-right shrink-0 mr-2">
                    <p className="text-sm font-medium text-[var(--vz-heading)] tabular-nums">{time}</p>
                    <p className="text-xs text-[var(--vz-text-muted)] mt-0.5 tabular-nums">{date}</p>
                  </div>

                  {/* Delete */}
                  <button
                    onClick={(e) => handleDelete(e, notif._id)}
                    title="Delete notification"
                    className="shrink-0 w-9 h-9 rounded-lg border border-red-200 dark:border-red-900/40 flex items-center justify-center text-[var(--vz-danger)] hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {/* ── Pagination Footer ── */}
        {filteredNotifications.length > pageSize && (
          <div className="px-6 py-3 border-t border-[var(--vz-border)] bg-[var(--vz-card-bg)]">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              totalItems={filteredNotifications.length}
              pageSize={pageSize}
            />
          </div>
        )}
      </div>
    </div>
  )
}
