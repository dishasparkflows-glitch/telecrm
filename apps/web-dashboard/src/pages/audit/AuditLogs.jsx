import { useState } from 'react'
import * as XLSX from 'xlsx'
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
import { useListUsersQuery } from '../../features/users/userApi'

const PAGE_SIZE = 20

export default function AuditLogs() {
  const todayStr = new Date().toISOString().split('T')[0];
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState({
    module: 'all',
    action: [],
    userId: [],
    branchId: 'all',
    search: '',
    fromDate: todayStr,
    toDate: todayStr,
  })
  const [selectedDrawerEvent, setSelectedDrawerEvent] = useState(null)

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
    setPage(1)
  }

  const selectedUserId = (Array.isArray(filters.userId) && filters.userId.length > 0) ? filters.userId.join(',') : undefined
  const selectedBranchId = (filters.branchId && filters.branchId !== 'all') ? filters.branchId : (filters.branch && filters.branch !== 'all') ? filters.branch : undefined

  const { data, isLoading, isError, refetch } = useGetAuditLogsQuery({
    page,
    limit: PAGE_SIZE,
    module: filters.module !== 'all' ? filters.module : undefined,
    action: Array.isArray(filters.action) && filters.action.length > 0 ? filters.action.join(',') : undefined,
    userId: selectedUserId,
    branchId: selectedBranchId,
    search: filters.search || undefined,
    fromDate: filters.fromDate || undefined,
    toDate: filters.toDate || undefined,
  })

  const logs = data?.data || []
  const pagination = data?.pagination || { total: logs.length, page: 1, totalPages: 1 }

  const { data: userData } = useListUsersQuery()
  const usersList = userData?.data || userData || []

  const handleExport = () => {
    if (!logs || logs.length === 0) {
      alert('No data to export');
      return;
    }
    
    const formatChangesForExcel = (changes) => {
      if (!changes || !changes.length) return '';
      return changes.map(c => {
        const fieldName = c.field.split('.')
          .filter((_, i, arr) => arr.length === 1 || i > 0)
          .map(p => {
            const str = p.replace(/([A-Z])/g, ' $1').trim();
            return str.charAt(0).toUpperCase() + str.slice(1);
          })
          .join(' -> ');
        
        const oldVal = c.oldValue === null || c.oldValue === undefined ? 'null' : (typeof c.oldValue === 'object' ? JSON.stringify(c.oldValue) : c.oldValue);
        const newVal = c.newValue === null || c.newValue === undefined ? 'null' : (typeof c.newValue === 'object' ? JSON.stringify(c.newValue) : c.newValue);
        
        return `${fieldName}: ${oldVal} => ${newVal}`;
      }).join('\n');
    }
    
    const exportData = logs.flatMap(log => [
      {
        'Date & Time': new Date(log.meta?.createdAt || Date.now()).toLocaleString(),
        'User': log.userName || 'System',
        'Module': log.module,
        'Action': log.action,
        'Description': log.description || '',
        'IP Address': log.systemInfo?.ipAddress || '',
        'Changes': formatChangesForExcel(log.changes)
      },
      {} // Empty row for spacing
    ]);

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Audit Logs");
    XLSX.writeFile(workbook, `AuditLogs_${new Date().toISOString().slice(0,10)}.xlsx`);
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
            <AuditTable logs={logs} users={usersList} onViewChanges={(log) => setSelectedDrawerEvent(log)} />

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
