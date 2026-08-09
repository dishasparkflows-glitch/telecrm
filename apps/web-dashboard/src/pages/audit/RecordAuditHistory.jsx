import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useGetRecordAuditHistoryQuery } from '../../features/tenant/tenantApi'
import Card from '../../components/ui/Card'
import Tabs from '../../components/ui/Tabs'
import EmptyState from '../../components/ui/EmptyState'
import { Shield, Clock, Table as TableIcon, Layers, Users, Download, Calendar } from 'lucide-react'
import Button from '../../components/ui/Button'
import AuditRecordHeader from '../../components/audit/AuditRecordHeader'
import AuditTimeline from '../../components/audit/AuditTimeline'
import AuditTable from '../../components/audit/AuditTable'
import AuditFieldHistory from '../../components/audit/AuditFieldHistory'
import AuditUserView from '../../components/audit/AuditUserView'
import AuditRecordInfo from '../../components/audit/AuditRecordInfo'
import AuditChangeDrawer from '../../components/audit/AuditChangeDrawer'

export default function RecordAuditHistory() {
  const { recordId } = useParams()
  const [activeTab, setActiveTab] = useState('timeline')
  const [selectedDrawerEvent, setSelectedDrawerEvent] = useState(null)

  const [filters, setFilters] = useState({
    action: 'all',
    userId: 'all',
  })

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  const selectedUserId = (filters.userId && filters.userId !== 'all') ? filters.userId : (filters.user && filters.user !== 'all') ? filters.user : undefined

  const { data, isLoading, isError, refetch } = useGetRecordAuditHistoryQuery(
    {
      recordId,
      action: filters.action !== 'all' ? filters.action : undefined,
      userId: selectedUserId,
    },
    { skip: !recordId }
  )

  const historyEvents = data?.data?.history || []
  const recordSummary = data?.data?.record || {
    recordId: recordId || 'Record',
    recordName: 'Record Details',
    recordType: 'Record',
    status: 'Active',
    branchName: 'Head Office',
    ownerName: 'System User',
    phone: '—',
    email: '—',
    createdAt: new Date(),
    createdBy: { userName: 'System', userRole: 'Admin' },
    lastUpdated: new Date(),
    totalChanges: historyEvents.length,
  }

  const tabsConfig = [
    { key: 'timeline', label: 'Timeline View', icon: Clock },
    { key: 'table', label: 'Table View', icon: TableIcon },
    { key: 'fieldChanges', label: 'Field Changes', icon: Layers },
    { key: 'userView', label: 'User View', icon: Users },
  ]

  const handleExport = () => {
    if (!recordId) return
    window.open(`/api/audit/export?recordId=${encodeURIComponent(recordId)}`, '_blank')
  }

  return (
    <div className="space-y-4">
      {/* Top Record Header Banner */}
      <AuditRecordHeader record={recordSummary} />

      {/* Main Container Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left 2 Columns: Tabs & Main Content */}
        <div className="lg:col-span-2 space-y-4">
          <Card noPadding>
            {/* Tabs & Toolbar Header */}
            <div className="p-3 border-b border-[var(--vz-border)] flex flex-wrap items-center justify-between gap-3">
              <Tabs
                tabs={tabsConfig}
                activeTab={activeTab}
                onChange={setActiveTab}
                className="border-b-0"
              />

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExport}
                  className="px-2.5 py-1.5 text-xs"
                >
                  <Download size={13} />
                  <span>Export Record Logs</span>
                </Button>

                <div className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border border-[var(--vz-border)] bg-[var(--vz-input-bg)] text-[var(--vz-heading)]">
                  <Calendar size={13} className="text-[var(--vz-text-muted)]" />
                  <span>All Time</span>
                </div>
              </div>
            </div>

            {/* Tab Body View */}
            <div className="p-4">
              {isLoading ? (
                <div className="p-8 text-center text-[var(--vz-text-muted)] space-y-2">
                  <div className="inline-block w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <div className="text-xs">Loading record history timeline...</div>
                </div>
              ) : isError ? (
                <div className="p-8 text-center space-y-3">
                  <div className="text-sm font-semibold text-rose-600">Failed to load record audit history</div>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => refetch()}
                  >
                    Retry
                  </Button>
                </div>
              ) : historyEvents.length === 0 ? (
                <div className="p-8 text-center">
                  <EmptyState
                    icon={Shield}
                    title="No audit history found for this record"
                    description="No changes have been recorded for this record yet."
                  />
                </div>
              ) : (
                <>
                  {activeTab === 'timeline' && (
                    <AuditTimeline
                      events={historyEvents}
                      onViewChanges={(event) => setSelectedDrawerEvent(event)}
                    />
                  )}

                  {activeTab === 'table' && (
                    <AuditTable
                      logs={historyEvents}
                      onViewChanges={(event) => setSelectedDrawerEvent(event)}
                    />
                  )}

                  {activeTab === 'fieldChanges' && (
                    <AuditFieldHistory history={historyEvents} />
                  )}

                  {activeTab === 'userView' && (
                    <AuditUserView
                      history={historyEvents}
                      onSelectUser={(userId) => {
                        handleFilterChange('userId', userId)
                        setActiveTab('timeline')
                      }}
                    />
                  )}
                </>
              )}
            </div>
          </Card>
        </div>

        {/* Right 1 Column: Record Information & Quick Filters */}
        <div className="space-y-4">
          <AuditRecordInfo
            record={recordSummary}
            filters={filters}
            onFilterChange={handleFilterChange}
          />
        </div>
      </div>

      {/* Change Details Drawer */}
      <AuditChangeDrawer
        isOpen={Boolean(selectedDrawerEvent)}
        onClose={() => setSelectedDrawerEvent(null)}
        event={selectedDrawerEvent}
      />
    </div>
  )
}
