import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGetRulesQuery, useToggleRuleMutation, useDeleteRuleMutation, useGetAutomationLogsQuery } from '../../features/automations/automationApi'
import Pagination from '../../components/ui/Pagination'
import PageHeader from '../../components/layout/PageHeader'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Tabs from '../../components/ui/Tabs'
import EmptyState from '../../components/ui/EmptyState'
import ConfirmModal from '../../components/ui/ConfirmModal'
import { useToast } from '../../components/ui/Toast'
import { Zap, Plus, Activity, Trash2, Pencil } from 'lucide-react'

const triggerLabels = {
  lead_created: 'Lead Created', lead_stage_changed: 'Stage Changed', lead_score_changed: 'Score Changed',
  form_submitted: 'Form Submitted', call_completed: 'Call Completed', whatsapp_received: 'WhatsApp Received',
}

export default function Automations() {
  const toast = useToast()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('rules')
  const [rulesPage, setRulesPage] = useState(1)
  const [logsPage] = useState(1)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const PAGE_SIZE = 25

  const { data: rulesData, isLoading } = useGetRulesQuery({ page: rulesPage, limit: PAGE_SIZE })
  const { data: logsData } = useGetAutomationLogsQuery({ page: logsPage, limit: PAGE_SIZE })
  const [toggleRule] = useToggleRuleMutation()
  const [deleteRule, { isLoading: isDeleting }] = useDeleteRuleMutation()

  const rules = rulesData?.data || []
  const rulesPagination = rulesData?.pagination || {}
  const logs = logsData?.data || []
  const logsPagination = logsData?.pagination || {}

  const handleToggle = async (id) => {
    try { await toggleRule(id).unwrap() } catch { toast('Failed to toggle', 'error') }
  }

  const handleDelete = async () => {
    if (!deleteConfirm) return
    try { 
      await deleteRule(deleteConfirm).unwrap(); 
      toast('Rule deleted', 'success') 
      setDeleteConfirm(null)
    } catch { toast('Failed to delete', 'error') }
  }

  const tabs = [
    { key: 'rules', label: 'Rules', icon: Zap, count: rulesPagination.total || rules.length },
    { key: 'logs', label: 'Execution Logs', icon: Activity, count: logsPagination.total || logs.length },
  ]

  return (
    <>
      <PageHeader title="Automations" breadcrumbs={[{ label: 'CRM', path: '/dashboard' }, { label: 'Automations' }]} />

      <div className="flex items-center justify-between mb-4">
        <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
        {activeTab === 'rules' && (
          <Button size="sm" onClick={() => navigate('/automations/builder')}><Plus size={14} /> Create Rule</Button>
        )}
      </div>

      {activeTab === 'rules' && (
        isLoading ? (
          <div className="text-center py-12 text-[var(--vz-text-muted)]">Loading...</div>
        ) : rules.length === 0 ? (
          <Card>
            <EmptyState icon={Zap} title="No automation rules" description="Create rules to automate lead management tasks"
              action={<Button size="sm" onClick={() => navigate('/automations/builder')}><Plus size={14} /> Create Rule</Button>} />
          </Card>
        ) : (
          <Card noPadding>
            <div className="overflow-x-auto">
              <table className="w-full text-sm whitespace-nowrap">
                <thead>
                  <tr className="bg-[var(--vz-table-header-bg)]">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[var(--vz-text-muted)] tracking-wide">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[var(--vz-text-muted)] tracking-wide">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[var(--vz-text-muted)] tracking-wide">Trigger</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[var(--vz-text-muted)] tracking-wide">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[var(--vz-text-muted)] tracking-wide">Performance</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-[var(--vz-text-muted)] tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.map((rule) => (
                    <tr key={rule._id} className="border-t border-[var(--vz-border)] hover:bg-[var(--vz-table-hover-bg)]">
                      <td className="px-4 py-3 font-medium text-[var(--vz-heading)]">{rule.name}</td>
                      <td className="px-4 py-3 text-[var(--vz-text-muted)] capitalize">{rule.type || 'workflow'}</td>
                      <td className="px-4 py-3 text-[var(--vz-text-muted)]">
                        {triggerLabels[rule.trigger?.event?.replace(/\./g, '_')] || rule.trigger?.event || rule.triggerEvent || 'Unknown'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleToggle(rule._id)}
                            className={`relative w-10 h-5 rounded-full transition-colors ${rule.status === 'active' ? 'bg-secondary' : 'bg-[var(--vz-input-border)]'}`}
                          >
                            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${rule.status === 'active' ? 'left-5' : 'left-0.5'}`} />
                          </button>
                          <Badge color={rule.status === 'active' ? 'success' : rule.status === 'draft' ? 'warning' : 'secondary'}>{rule.status}</Badge>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[var(--vz-text-muted)] text-xs">
                         {rule.stats?.totalRuns || 0} runs · {rule.stats?.successRate || 0}% success
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => navigate(`/automations/builder/${rule._id}`)}>
                            <Pencil size={12} /> Edit
                          </Button>
                          <Button variant="ghost" size="sm" className="text-danger" onClick={() => setDeleteConfirm(rule._id)}>
                            <Trash2 size={12} /> Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )
      )}

      {activeTab === 'rules' && rulesPagination.totalPages > 1 && (
        <Pagination currentPage={rulesPage} totalPages={rulesPagination.totalPages || 1} totalItems={rulesPagination.total} pageSize={PAGE_SIZE} onPageChange={setRulesPage} />
      )}

      {activeTab === 'logs' && (
        <Card noPadding>
          {logs.length === 0 ? (
            <EmptyState icon={Activity} title="No execution logs" description="Logs will appear here as rules are triggered" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm whitespace-nowrap">
                <thead>
                  <tr className="bg-[var(--vz-table-header-bg)]">
                    {['Rule', 'Trigger', 'Status', 'Nodes Executed', 'Date'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase text-[var(--vz-text-muted)] tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log._id} className="border-t border-[var(--vz-border)] hover:bg-[var(--vz-table-hover-bg)]">
                      <td className="px-4 py-3 font-medium text-[var(--vz-heading)]">{log.ruleName}</td>
                      <td className="px-4 py-3 text-[var(--vz-text)]">{triggerLabels[log.triggerEvent?.replace(/\./g, '_')] || log.triggerEvent || '—'}</td>
                      <td className="px-4 py-3"><Badge color={['completed', 'success'].includes(log.status) ? 'success' : log.status === 'exited' ? 'secondary' : log.status === 'running' ? 'warning' : 'danger'}>{log.status}</Badge></td>
                      <td className="px-4 py-3 text-[var(--vz-text)]">{Array.isArray(log.nodeExecutions) ? log.nodeExecutions.length : (log.actionsExecuted?.length || 0)}</td>
                      <td className="px-4 py-3 text-[var(--vz-text-muted)] text-xs">{new Date(log.meta?.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!deleteConfirm}
        title="Delete Rule?"
        message="Are you sure you want to delete this rule?"
        confirmText="Delete"
        variant="danger"
        loading={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm(null)}
      />
    </>
  )
}
