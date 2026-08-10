import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useGetRecordAuditHistoryQuery } from '../../features/tenant/tenantApi'
import * as XLSX from 'xlsx'
import { useListUsersQuery } from '../../features/users/userApi'
import Card from '../../components/ui/Card'
import Tabs from '../../components/ui/Tabs'
import EmptyState from '../../components/ui/EmptyState'
import { Shield, Clock, Table as TableIcon, Layers, Users, Download, Calendar } from 'lucide-react'
import Button from '../../components/ui/Button'
import Select from '../../components/ui/Select'
import AuditRecordHeader from '../../components/audit/AuditRecordHeader'
import AuditTimeline from '../../components/audit/AuditTimeline'
import AuditTable from '../../components/audit/AuditTable'
import AuditChangeDrawer from '../../components/audit/AuditChangeDrawer'

const ACTION_OPTIONS = [
  { value: 'CREATE', label: 'Create' },
  { value: 'UPDATE', label: 'Update' },
  { value: 'DELETE', label: 'Delete' },
]

export default function RecordAuditHistory() {
  const { recordId } = useParams()
  const [activeTab, setActiveTab] = useState('timeline')
  const [selectedDrawerEvent, setSelectedDrawerEvent] = useState(null)

  const [filters, setFilters] = useState({
    action: [],
    userId: [],
  })

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  const selectedUserId = (Array.isArray(filters.userId) && filters.userId.length > 0) ? filters.userId.join(',') : undefined

  const { data, isLoading, isError, refetch } = useGetRecordAuditHistoryQuery(
    {
      recordId,
      action: Array.isArray(filters.action) && filters.action.length > 0 ? filters.action.join(',') : undefined,
      userId: selectedUserId,
    },
    { skip: !recordId }
  )

  const historyEvents = data?.data?.history || []
  const recordSummary = data?.data?.record || {
    recordId: recordId || 'Record',
    recordType: 'Record',
    status: 'Active',
    branchName: 'Head Office',
    ownerName: 'System User',
    phone: '—',
    email: '—',
    createdAt: new Date(),
    createdBy: { userId: null },
    lastUpdated: new Date(),
    totalChanges: historyEvents.length,
  }

  const tabsConfig = [
    { key: 'timeline', label: 'Timeline View', icon: Clock },
    { key: 'table', label: 'Table View', icon: TableIcon },
  ]

  const { data: userData } = useListUsersQuery()
  const usersList = userData?.data || userData || []

  const handleExport = () => {
    if (!historyEvents || historyEvents.length === 0) {
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

    const exportData = historyEvents.flatMap(log => [
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
    XLSX.utils.book_append_sheet(workbook, worksheet, "Record Audit Logs");
    XLSX.writeFile(workbook, `Record_${recordId}_AuditLogs.xlsx`);
  }

  let userOptions = []
  if (Array.isArray(usersList) && usersList.length > 0) {
    usersList.forEach((u) => {
      const label = u.name || u.userName || (u.email ? u.email.split('@')[0] : 'User')
      userOptions.push({
        value: u._id || u.id || u.userId || label,
        label,
      })
    })
  }

  return (
    <div className="space-y-4">
      {/* Top Record Header Banner */}
      <AuditRecordHeader 
        record={recordSummary} 
        users={usersList} 
        onViewFullInfo={() => setSelectedDrawerEvent({
          action: 'VIEW',
          isSnapshot: true,
          recordType: recordSummary.recordType,
          createdAt: new Date(),
          details: { updateddata: data?.data?.recordRaw || recordSummary },
          description: 'Current record state'
        })}
      />

      {/* Main Content */}
      <div className="w-full space-y-4">
        <Card noPadding>
            {/* Tabs & Toolbar Header */}
            <div className="p-3 border-b border-[var(--vz-border)] flex flex-wrap items-center justify-between gap-3">
              <Tabs
                tabs={tabsConfig}
                activeTab={activeTab}
                onChange={setActiveTab}
                className="border-b-0"
              />

              <div className="flex flex-wrap items-center gap-2">
                <Select
                  options={ACTION_OPTIONS}
                  value={filters.action || []}
                  onChange={(val) => handleFilterChange('action', val)}
                  placeholder="All Actions"
                  className="text-xs min-w-[120px]"
                  multiple={true}
                />

                <Select
                  options={userOptions}
                  value={filters.userId || filters.user || []}
                  onChange={(val) => {
                    handleFilterChange('userId', val)
                    handleFilterChange('user', val)
                  }}
                  placeholder="All Users"
                  className="text-xs min-w-[120px]"
                  multiple={true}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExport}
                  className="px-2.5 py-1.5 text-xs"
                >
                  <Download size={13} />
                  <span>Export Record Logs</span>
                </Button>
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
                      users={usersList}
                      onViewChanges={(event) => setSelectedDrawerEvent(event)}
                    />
                  )}

                  {activeTab === 'table' && (
                    <AuditTable
                      logs={historyEvents}
                      users={usersList}
                      onViewChanges={(event) => setSelectedDrawerEvent(event)}
                    />
                  )}
                </>
              )}
            </div>
          </Card>
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
