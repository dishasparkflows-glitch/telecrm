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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rules.map((rule) => (
              <Card key={rule._id} className="hover:border-primary/30 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-warning/10 flex items-center justify-center">
                      <Zap size={16} className="text-warning" />
                    </div>
                    <div>
                      <h5 className="text-sm font-semibold text-[var(--vz-heading)]">{rule.name}</h5>
                      <p className="text-xs text-[var(--vz-text-muted)]">
                        Trigger: {triggerLabels[rule.trigger?.event?.replace(/\./g, '_')] || rule.trigger?.event || rule.triggerEvent || 'Unknown'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleToggle(rule._id)}
                    className={`relative w-10 h-5 rounded-full transition-colors ${rule.isActive ? 'bg-secondary' : 'bg-[var(--vz-input-border)]'}`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${rule.isActive ? 'left-5' : 'left-0.5'}`} />
                  </button>
                </div>

                <div className="flex items-center gap-3 text-xs text-[var(--vz-text-muted)] mb-3">
                  <span>{rule.trigger?.conditions?.length || 0} conditions</span>
                  <span>·</span>
                  <span>{rule.actions?.length || 0} actions</span>
                  <span>·</span>
                  <span>{rule.executionCount || 0} executions</span>
                </div>

                <div className="flex items-center gap-2 pt-3 border-t border-[var(--vz-border)]">
                  <Button variant="ghost" size="sm" onClick={() => navigate(`/automations/builder/${rule._id}`)}>
                    <Pencil size={12} /> Edit
                  </Button>
                  <Button variant="ghost" size="sm" className="text-danger" onClick={() => setDeleteConfirm(rule._id)}>
                    <Trash2 size={12} /> Delete
                  </Button>
                </div>
              </Card>
            ))}
          </div>
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
                    {['Rule', 'Trigger', 'Status', 'Actions', 'Date'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase text-[var(--vz-text-muted)] tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log._id} className="border-t border-[var(--vz-border)] hover:bg-[var(--vz-table-hover-bg)]">
                      <td className="px-4 py-3 font-medium text-[var(--vz-heading)]">{log.ruleName}</td>
                      <td className="px-4 py-3 text-[var(--vz-text)]">{triggerLabels[log.triggerEvent?.replace(/\./g, '_')] || log.triggerEvent || '—'}</td>
                      <td className="px-4 py-3"><Badge color={log.status === 'success' ? 'success' : 'danger'}>{log.status}</Badge></td>
                      <td className="px-4 py-3 text-[var(--vz-text)]">{Array.isArray(log.actionsExecuted) ? log.actionsExecuted.length : (log.actionsExecuted || 0)}</td>
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
