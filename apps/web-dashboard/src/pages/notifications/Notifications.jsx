import { useGetNotificationsQuery, useMarkAsReadMutation, useMarkAllReadMutation, useDeleteNotificationMutation } from '../../features/notifications/notificationApi'
import PageHeader from '../../components/layout/PageHeader'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import EmptyState from '../../components/ui/EmptyState'
import { useToast } from '../../components/ui/Toast'
import { Bell, CheckCheck, Users, Phone, FileText, Zap, CreditCard, MessageSquare, Trash2 } from 'lucide-react'

const typeIcons = {
  lead: Users, call: Phone, form: FileText, automation: Zap,
  billing: CreditCard, whatsapp: MessageSquare, default: Bell,
}

const typeColors = {
  lead: 'primary', call: 'info', form: 'warning', automation: 'success',
  billing: 'danger', whatsapp: 'success',
}

export default function Notifications() {
  const toast = useToast()
  const { data, isLoading } = useGetNotificationsQuery({ limit: 50 })
  const [markAsRead] = useMarkAsReadMutation()
  const [markAllRead] = useMarkAllReadMutation()
  const [deleteNotification] = useDeleteNotificationMutation()

  const notifications = data?.data || []
  const unreadCount = notifications.filter((n) => !n.read).length

  const handleMarkRead = async (id) => {
    try { await markAsRead({ notificationId: id }).unwrap() } catch { /* Keep the notification visible when the update fails. */ }
  }

  const handleDelete = async (e, id) => {
    e.stopPropagation()
    try {
      await deleteNotification(id).unwrap()
      toast('Notification deleted', 'success')
    } catch { toast('Failed to delete', 'error') }
  }

  const handleMarkAll = async () => {
    try { await markAllRead().unwrap(); toast('All marked as read', 'success') } catch { /* The query cache preserves the current unread state. */ }
  }

  return (
    <>
      <PageHeader title="Notifications" breadcrumbs={[{ label: 'CRM', path: '/dashboard' }, { label: 'Notifications' }]} />

      <Card>
        <Card.Header>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Card.Title>All Notifications</Card.Title>
              {unreadCount > 0 && <Badge color="danger">{unreadCount} new</Badge>}
            </div>
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" onClick={handleMarkAll}>
                <CheckCheck size={14} /> Mark all read
              </Button>
            )}
          </div>
        </Card.Header>

        {isLoading ? (
          <div className="p-8 text-center text-[var(--vz-text-muted)]">Loading...</div>
        ) : notifications.length === 0 ? (
          <EmptyState icon={Bell} title="No notifications" description="You're all caught up! Notifications will appear here." />
        ) : (
          <div className="space-y-0">
            {notifications.map((notif) => {
              const Icon = typeIcons[notif.type] || typeIcons.default
              const color = typeColors[notif.type] || 'primary'
              return (
                <div
                  key={notif._id}
                  onClick={() => !notif.read && handleMarkRead(notif._id)}
                  className={`flex items-start gap-3 p-3 border-b border-[var(--vz-border)] last:border-0 cursor-pointer transition-colors group
                    ${notif.read ? 'opacity-60' : 'hover:bg-[var(--vz-input-bg)]'}`}
                >
                  <div className={`w-9 h-9 rounded-full bg-${color}/10 flex items-center justify-center shrink-0`}
                    style={{ backgroundColor: `var(--color-${color}, #405189)20` }}>
                    <Icon size={16} className={`text-${color}`} style={{ color: `var(--color-${color}, #405189)` }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${notif.read ? 'text-[var(--vz-text)]' : 'text-[var(--vz-heading)] font-medium'}`}>
                      {notif.title || notif.message}
                    </p>
                    {notif.body && <p className="text-xs text-[var(--vz-text-muted)] mt-0.5">{notif.body}</p>}
                    <p className="text-[10px] text-[var(--vz-text-muted)] mt-1">{new Date(notif.meta?.createdAt).toLocaleString()}</p>
                  </div>
                  {!notif.read && (
                    <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-2" />
                  )}
                  <button onClick={(e) => handleDelete(e, notif._id)} className="p-1.5 rounded hover:bg-danger/10 text-[var(--vz-text-muted)] hover:text-danger opacity-0 group-hover:opacity-100 transition-all" title="Delete">
                    <Trash2 size={14} />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </>
  )
}
