import { useState } from 'react'
import { useGetRulesQuery, useCreateRuleMutation, useUpdateRuleMutation, useToggleRuleMutation, useDeleteRuleMutation, useGetAutomationLogsQuery } from '../../features/automations/automationApi'
import Pagination from '../../components/ui/Pagination'
import PageHeader from '../../components/layout/PageHeader'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import Input from '../../components/ui/Input'
import Tabs from '../../components/ui/Tabs'
import Select from '../../components/ui/Select'
import EmptyState from '../../components/ui/EmptyState'
import { useToast } from '../../components/ui/Toast'
import { Zap, Plus, Activity, Trash2, Pencil } from 'lucide-react'

const triggerLabels = {
  lead_created: 'Lead Created', lead_stage_changed: 'Stage Changed', lead_score_changed: 'Score Changed',
  form_submitted: 'Form Submitted', call_completed: 'Call Completed', whatsapp_received: 'WhatsApp Received',
}

export default function Automations() {
  const toast = useToast()
  const [activeTab, setActiveTab] = useState('rules')
  const [showCreate, setShowCreate] = useState(false)
  const [newRule, setNewRule] = useState({ name: '', triggerEvent: 'lead_created', conditions: [], actions: [] })
  const [showEdit, setShowEdit] = useState(false)
  const [editRuleForm, setEditRuleForm] = useState(null)
  const [rulesPage, setRulesPage] = useState(1)
  const [logsPage] = useState(1)
  const PAGE_SIZE = 25

  const { data: rulesData, isLoading } = useGetRulesQuery({ page: rulesPage, limit: PAGE_SIZE })
  const { data: logsData } = useGetAutomationLogsQuery({ page: logsPage, limit: PAGE_SIZE })
  const [createRule, { isLoading: creating }] = useCreateRuleMutation()
  const [updateRule, { isLoading: updating }] = useUpdateRuleMutation()
  const [toggleRule] = useToggleRuleMutation()
  const [deleteRule] = useDeleteRuleMutation()

  const rules = rulesData?.data || []
  const rulesPagination = rulesData?.pagination || {}
  const logs = logsData?.data || []
  const logsPagination = logsData?.pagination || {}

  const handleCreate = async () => {
    try {
      // Transform flat form into nested backend structure
      const payload = {
        name: newRule.name,
        trigger: {
          event: newRule.triggerEvent?.replace(/_/g, '.') || 'lead.created',
          conditions: newRule.conditions || [],
        },
        actions: newRule.actions || [],
      }
      await createRule(payload).unwrap()
      toast('Automation rule created', 'success')
      setShowCreate(false)
      setNewRule({ name: '', triggerEvent: 'lead_created', conditions: [], actions: [] })
    } catch { toast('Failed to create rule', 'error') }
  }

  const handleToggle = async (id) => {
    try { await toggleRule(id).unwrap() } catch { toast('Failed to toggle', 'error') }
  }

  const handleEditOpen = (rule) => {
    setEditRuleForm({
      id: rule._id,
      name: rule.name,
      description: rule.description || '',
      triggerEvent: rule.trigger?.event?.replace(/\./g, '_') || rule.triggerEvent || 'lead_created',
      conditions: rule.trigger?.conditions || [],
      actions: rule.actions || [],
    })
    setShowEdit(true)
  }

  const handleUpdate = async () => {
    try {
      const payload = {
        id: editRuleForm.id,
        name: editRuleForm.name,
        description: editRuleForm.description,
        trigger: {
          event: editRuleForm.triggerEvent?.replace(/_/g, '.') || 'lead.created',
          conditions: (editRuleForm.conditions || []).map((condition) => ({
            field: condition.field,
            operator: condition.operator,
            value: condition.value,
          })),
        },
        actions: (editRuleForm.actions || []).map((action) => ({
          type: action.type,
          config: action.config || {},
          delay: action.delay || 0,
        })),
      }
      await updateRule(payload).unwrap()
      toast('Automation rule updated', 'success')
      setShowEdit(false)
    } catch { toast('Failed to update rule', 'error') }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this rule?')) return
    try { await deleteRule(id).unwrap(); toast('Rule deleted', 'success') } catch { toast('Failed to delete', 'error') }
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
          <Button size="sm" onClick={() => setShowCreate(true)}><Plus size={14} /> Create Rule</Button>
        )}
      </div>

      {activeTab === 'rules' && (
        isLoading ? (
          <div className="text-center py-12 text-[var(--vz-text-muted)]">Loading...</div>
        ) : rules.length === 0 ? (
          <Card>
            <EmptyState icon={Zap} title="No automation rules" description="Create rules to automate lead management tasks"
              action={<Button size="sm" onClick={() => setShowCreate(true)}><Plus size={14} /> Create Rule</Button>} />
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
                  <Button variant="ghost" size="sm" onClick={() => handleEditOpen(rule)}>
                    <Pencil size={12} /> Edit
                  </Button>
                  <Button variant="ghost" size="sm" className="text-danger" onClick={() => handleDelete(rule._id)}>
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
                      <td className="px-4 py-3 text-[var(--vz-text-muted)] text-xs">{new Date(log.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Create Rule Modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create Automation Rule" size="md">
        <div className="space-y-3">
          <Input label="Rule Name" placeholder="e.g. Auto-assign hot leads" value={newRule.name} onChange={(e) => setNewRule({ ...newRule, name: e.target.value })} />
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-[var(--vz-heading)]">Trigger Event</label>
            <Select
              value={newRule.triggerEvent}
              onChange={(val) => setNewRule({ ...newRule, triggerEvent: val })}
              options={Object.entries(triggerLabels).map(([k, v]) => ({ value: k, label: v }))}
            />
          </div>
        </div>
        <Modal.Footer>
          <Button variant="ghost" size="sm" onClick={() => setShowCreate(false)}>Cancel</Button>
          <Button size="sm" onClick={handleCreate} disabled={creating || !newRule.name}>{creating ? 'Creating...' : 'Create'}</Button>
        </Modal.Footer>
      </Modal>

      {/* Edit Rule Modal */}
      <Modal isOpen={showEdit} onClose={() => setShowEdit(false)} title="Edit Automation Rule" size="md">
        {editRuleForm && (
          <div className="space-y-3">
            <Input label="Rule Name" value={editRuleForm.name} onChange={(e) => setEditRuleForm({ ...editRuleForm, name: e.target.value })} />
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-[var(--vz-heading)]">Trigger Event</label>
              <Select
                value={editRuleForm.triggerEvent}
                onChange={(val) => setEditRuleForm({ ...editRuleForm, triggerEvent: val })}
                options={Object.entries(triggerLabels).map(([k, v]) => ({ value: k, label: v }))}
              />
            </div>
            <Modal.Footer>
              <Button variant="ghost" size="sm" onClick={() => setShowEdit(false)}>Cancel</Button>
              <Button size="sm" onClick={handleUpdate} disabled={updating || !editRuleForm.name}>{updating ? 'Updating...' : 'Save Changes'}</Button>
            </Modal.Footer>
          </div>
        )}
      </Modal>
    </>
  )
}
