import { useState } from 'react'
import { useGetAuditLogsQuery } from '../../features/tenant/tenantApi'
import PageHeader from '../../components/layout/PageHeader'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import Pagination from '../../components/ui/Pagination'
import EmptyState from '../../components/ui/EmptyState'
import { Search, Shield } from 'lucide-react'

const PAGE_SIZE = 20

export default function AuditLogs() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')

  const { data, isLoading } = useGetAuditLogsQuery({ page, limit: PAGE_SIZE })
  const logs = data?.data || []
  const pagination = data?.pagination || {}

  const actionColors = { create: 'success', update: 'info', delete: 'danger', login: 'primary', export: 'warning' }

  return (
    <>
      <PageHeader title="Audit Logs" breadcrumbs={[{ label: 'CRM', path: '/dashboard' }, { label: 'Audit Logs' }]} />

      <Card noPadding>
        <div className="p-4 border-b border-[var(--vz-border)]">
          <div className="relative w-full sm:w-[280px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--vz-text-muted)]" />
            <input type="text" placeholder="Search activity..." value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-md border border-[var(--vz-input-border)] bg-[var(--vz-input-bg)]
                text-sm text-[var(--vz-heading)] placeholder:text-[var(--vz-text-muted)] outline-none focus:border-primary" />
          </div>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-[var(--vz-text-muted)]">Loading...</div>
        ) : logs.length === 0 ? (
          <EmptyState icon={Shield} title="No audit logs" description="Activity will be recorded here automatically" />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[var(--vz-table-header-bg)]">
                    {['User', 'Action', 'Resource', 'Details', 'IP Address', 'Date'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase text-[var(--vz-text-muted)] tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log._id} className="border-t border-[var(--vz-border)] hover:bg-[var(--vz-table-hover-bg)] transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary">
                            {log.userName?.[0] || 'S'}
                          </div>
                          <span className="text-[var(--vz-heading)] text-xs font-medium">{log.userName || 'System'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge color={actionColors[log.action] || 'primary'}>{log.action}</Badge>
                      </td>
                      <td className="px-4 py-3 text-[var(--vz-text)] capitalize">{log.resource}</td>
                      <td className="px-4 py-3 text-[var(--vz-text)] text-xs max-w-[200px] truncate">{log.details || '—'}</td>
                      <td className="px-4 py-3 text-[var(--vz-text-muted)] text-xs font-mono">{log.ipAddress || '—'}</td>
                      <td className="px-4 py-3 text-[var(--vz-text-muted)] text-xs">{new Date(log.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 pb-3">
              <Pagination currentPage={page} totalPages={pagination.totalPages || 1} totalItems={pagination.total} pageSize={PAGE_SIZE} onPageChange={setPage} />
            </div>
          </>
        )}
      </Card>
    </>
  )
}
