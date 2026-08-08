import { useState } from 'react'
import { useGetCallLogsQuery, useGetCallStatsQuery, useUpdateDispositionMutation } from '../../features/calls/callApi'
import PageHeader from '../../components/layout/PageHeader'
import Card from '../../components/ui/Card'
import KPICard from '../../components/ui/KPICard'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import Select from '../../components/ui/Select'

import Pagination from '../../components/ui/Pagination'
import EmptyState from '../../components/ui/EmptyState'
import { useToast } from '../../components/ui/Toast'
import { Phone, Clock, PhoneIncoming, PhoneMissed, Search } from 'lucide-react'

const statusColors = { completed: 'success', missed: 'danger', busy: 'warning', 'no-answer': 'info', failed: 'danger' }
const PAGE_SIZE = 15

export default function CallLogs() {
  const toast = useToast()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [showDisp, setShowDisp] = useState(null)
  const [disposition, setDisposition] = useState('')

  const { data: logsData, isLoading } = useGetCallLogsQuery({ page, limit: PAGE_SIZE })
  const { data: statsData } = useGetCallStatsQuery()
  const [updateDisposition] = useUpdateDispositionMutation()

  const logs = logsData?.data || []
  const pagination = logsData?.pagination || {}
  const stats = statsData?.data || {}

  const handleDisposition = async () => {
    try {
      await updateDisposition({ id: showDisp, disposition }).unwrap()
      toast('Disposition updated', 'success')
      setShowDisp(null)
      setDisposition('')
    } catch { toast('Failed to update', 'error') }
  }

  return (
    <>
      <PageHeader title="Call Logs" breadcrumbs={[{ label: 'CRM', path: '/dashboard' }, { label: 'Calls' }]} />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KPICard title="Total Calls" value={stats.totalCalls || 0} icon={Phone} iconColor="primary" />
        <KPICard title="Connected" value={stats.connected || 0} icon={PhoneIncoming} iconColor="success" />
        <KPICard title="Missed" value={stats.missed || 0} icon={PhoneMissed} iconColor="danger" />
        <KPICard title="Avg Duration" value={stats.avgDuration || '0s'} icon={Clock} iconColor="info" />
      </div>

      {/* Table */}
      <Card noPadding>
        <div className="p-4 border-b border-[var(--vz-border)]">
          <div className="relative w-full sm:w-[280px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--vz-text-muted)]" />
            <input type="text" placeholder="Search calls..." value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-md border border-[var(--vz-input-border)] bg-[var(--vz-input-bg)]
                text-sm text-[var(--vz-heading)] placeholder:text-[var(--vz-text-muted)] outline-none focus:border-primary" />
          </div>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-[var(--vz-text-muted)]">Loading...</div>
        ) : logs.length === 0 ? (
          <EmptyState icon={Phone} title="No call logs" description="Call logs will appear here once calls are initiated" />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm whitespace-nowrap">
                <thead>
                  <tr className="bg-[var(--vz-table-header-bg)]">
                    {['Lead', 'Phone', 'Agent', 'Duration', 'Status', 'Disposition', 'Date', 'Actions'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase text-[var(--vz-text-muted)] tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log._id} className="border-t border-[var(--vz-border)] hover:bg-[var(--vz-table-hover-bg)] transition-colors">
                      <td className="px-4 py-3 font-medium text-[var(--vz-heading)]">{log.leadName || 'Unknown'}</td>
                      <td className="px-4 py-3 text-[var(--vz-text)]">{log.phone}</td>
                      <td className="px-4 py-3 text-[var(--vz-text)]">{log.agentName || '—'}</td>
                      <td className="px-4 py-3 text-[var(--vz-text)]">{log.duration || '—'}</td>
                      <td className="px-4 py-3">
                        <Badge color={statusColors[log.status] || 'primary'}>{log.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-[var(--vz-text)] capitalize">{log.disposition || '—'}</td>
                      <td className="px-4 py-3 text-[var(--vz-text)] text-xs">{new Date(log.createdAt).toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <Button variant="ghost" size="sm" onClick={() => { setShowDisp(log._id); setDisposition(log.disposition || '') }}>
                          Edit
                        </Button>
                      </td>
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

      {/* Disposition Modal */}
      <Modal isOpen={!!showDisp} onClose={() => setShowDisp(null)} title="Update Disposition" size="sm">
        <Select
          value={disposition}
          onChange={(val) => setDisposition(val)}
          options={[
            { value: '', label: 'Select disposition' },
            ...['interested', 'not_interested', 'callback', 'converted', 'wrong_number', 'voicemail'].map((d) => ({
              value: d,
              label: d.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
            }))
          ]}
        />
        <Modal.Footer>
          <Button variant="ghost" size="sm" onClick={() => setShowDisp(null)}>Cancel</Button>
          <Button size="sm" onClick={handleDisposition}>Save</Button>
        </Modal.Footer>
      </Modal>
    </>
  )
}
