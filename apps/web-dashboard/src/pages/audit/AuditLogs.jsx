import { useState } from 'react'
import { useGetAuditLogsQuery } from '../../features/tenant/tenantApi'
import PageHeader from '../../components/layout/PageHeader'
import Card from '../../components/ui/Card'
import Pagination from '../../components/ui/Pagination'
import EmptyState from '../../components/ui/EmptyState'
import { Shield, RefreshCw } from 'lucide-react'
import Button from '../../components/ui/Button'
import AuditFilters from '../../components/audit/AuditFilters'
import AuditTable from '../../components/audit/AuditTable'
import AuditChangeDrawer from '../../components/audit/AuditChangeDrawer'

const PAGE_SIZE = 20

export default function AuditLogs() {
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState({
    module: 'all',
    action: 'all',
    userId: 'all',
    branchId: 'all',
    search: '',
  })
  const [selectedDrawerEvent, setSelectedDrawerEvent] = useState(null)

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
    setPage(1)
  }

  const selectedUserId = (filters.userId && filters.userId !== 'all') ? filters.userId : (filters.user && filters.user !== 'all') ? filters.user : undefined
  const selectedBranchId = (filters.branchId && filters.branchId !== 'all') ? filters.branchId : (filters.branch && filters.branch !== 'all') ? filters.branch : undefined

  const { data, isLoading, isError, refetch } = useGetAuditLogsQuery({
    page,
    limit: PAGE_SIZE,
    module: filters.module !== 'all' ? filters.module : undefined,
    action: filters.action !== 'all' ? filters.action : undefined,
    userId: selectedUserId,
    branchId: selectedBranchId,
    search: filters.search || undefined,
  })

  const logs = data?.data || []
  const pagination = data?.pagination || { total: logs.length, page: 1, totalPages: 1 }

  const handleExport = () => {
    const queryParams = new URLSearchParams()
    if (filters.module !== 'all') queryParams.append('module', filters.module)
    if (filters.action !== 'all') queryParams.append('action', filters.action)
    if (selectedUserId) queryParams.append('userId', selectedUserId)
    if (selectedBranchId) queryParams.append('branchId', selectedBranchId)
    if (filters.search) queryParams.append('search', filters.search)
    window.open(`/api/audit/export?${queryParams.toString()}`, '_blank')
  }

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <PageHeader
        title="Audit Logs"
        subtitle="Track all changes made to records in the system"
        breadcrumbs={[{ label: 'CRM', path: '/dashboard' }, { label: 'Audit Logs' }]}
      />

      {/* Main Card */}
      <Card noPadding>
        {/* Top Filters Header */}
        <div className="p-4 border-b border-[var(--vz-border)] space-y-3">
          <AuditFilters
            filters={filters}
            onFilterChange={handleFilterChange}
            onExport={handleExport}
          />

          <div className="flex items-center justify-between text-xs text-[var(--vz-text-muted)] pt-1">
            <div>
              Showing <span className="font-semibold text-[var(--vz-heading)]">{logs.length > 0 ? (page - 1) * PAGE_SIZE + 1 : 0}</span> to{' '}
              <span className="font-semibold text-[var(--vz-heading)]">{Math.min(page * PAGE_SIZE, pagination.total || logs.length)}</span> of{' '}
              <span className="font-semibold text-[var(--vz-heading)]">{pagination.total || logs.length}</span> entries
            </div>

            <button
              type="button"
              onClick={() => refetch()}
              className="flex items-center gap-1 hover:text-primary transition-colors cursor-pointer"
            >
              <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Loading / Error / Empty / Content State */}
        {isLoading ? (
          <div className="p-8 text-center text-[var(--vz-text-muted)] space-y-3">
            <div className="inline-block w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <div className="text-xs">Loading audit activity logs...</div>
          </div>
        ) : isError ? (
          <div className="p-8 text-center space-y-3">
            <div className="text-sm font-semibold text-rose-600">Unable to load audit logs</div>
            <div className="text-xs text-[var(--vz-text-muted)]">Please check your connection and try again.</div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => refetch()}
            >
              Retry
            </Button>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center">
            <EmptyState
              icon={Shield}
              title="No audit activity recorded"
              description="Activity will be recorded automatically when users create, update or delete records."
            />
          </div>
        ) : (
          <>
            <AuditTable logs={logs} onViewChanges={(log) => setSelectedDrawerEvent(log)} />

            <div className="px-4 py-3 border-t border-[var(--vz-border)]">
              <Pagination
                currentPage={page}
                totalPages={pagination.totalPages || 1}
                totalItems={pagination.total || logs.length}
                pageSize={PAGE_SIZE}
                onPageChange={setPage}
              />
            </div>
          </>
        )}
      </Card>

      {/* Change Details Drawer */}
      <AuditChangeDrawer
        isOpen={Boolean(selectedDrawerEvent)}
        onClose={() => setSelectedDrawerEvent(null)}
        event={selectedDrawerEvent}
      />
    </div>
  )
}
