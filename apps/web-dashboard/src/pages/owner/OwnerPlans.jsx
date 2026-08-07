import { useState } from 'react'
import { useGetOwnerPlansQuery, useCreatePlanMutation, useUpdatePlanMutation, useDeletePlanMutation } from '../../features/owner/ownerApi'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import { useToast } from '../../components/ui/Toast'
import { Plus, Edit, Trash2, X, Package, DollarSign, Users, Phone, MessageCircle, FileText, Calendar, Zap, BarChart3, CheckSquare } from 'lucide-react'

/**
 * Module options with labels, icons, and mapped feature slugs.
 * This drives the module selector in the plan creation form.
 */
const MODULE_OPTIONS = [
  { key: 'leads', label: 'Leads', icon: Users, feature: 'lead_management' },
  { key: 'calls', label: 'Calls', icon: Phone, feature: 'calling_basic' },
  { key: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, feature: 'whatsapp_session' },
  { key: 'forms', label: 'Smart Forms', icon: FileText, feature: 'smart_forms' },
  { key: 'meetings', label: 'Meetings', icon: Calendar, feature: 'meeting_scheduler' },
  { key: 'automations', label: 'Automations', icon: Zap, feature: 'automation_basic' },
  { key: 'analytics', label: 'Analytics', icon: BarChart3, feature: 'analytics_basic' },
  { key: 'tasks', label: 'Tasks', icon: CheckSquare, feature: 'task_management' },
]

export default function OwnerPlans() {
  const toast = useToast()
  const { data, isLoading } = useGetOwnerPlansQuery()
  const [createPlan] = useCreatePlanMutation()
  const [updatePlan] = useUpdatePlanMutation()
  const [deletePlan] = useDeletePlanMutation()

  const [showForm, setShowForm] = useState(false)
  const [editingPlan, setEditingPlan] = useState(null)
  const [form, setForm] = useState({
    name: '', slug: '', description: '', price: 0, yearlyPrice: 0,
    features: [], moduleKeys: [], limits: { maxUsers: 1, maxLeadsPerMonth: 100 },
    isActive: true, sortOrder: 0,
  })
  const [featureInput, setFeatureInput] = useState('')

  const plans = data?.data || []

  const resetForm = () => {
    setForm({
      name: '', slug: '', description: '', price: 0, yearlyPrice: 0,
      features: [], moduleKeys: [], limits: { maxUsers: 1, maxLeadsPerMonth: 100 },
      isActive: true, sortOrder: 0,
    })
    setFeatureInput('')
    setEditingPlan(null)
    setShowForm(false)
  }

  const openEdit = (plan) => {
    setEditingPlan(plan._id)
    setForm({
      name: plan.name, slug: plan.slug, description: plan.description || '',
      price: plan.price, yearlyPrice: plan.yearlyPrice || 0,
      features: plan.features || [], moduleKeys: plan.moduleKeys || [],
      limits: plan.limits || { maxUsers: 1, maxLeadsPerMonth: 100 },
      isActive: plan.isActive, sortOrder: plan.sortOrder || 0,
    })
    setShowForm(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      if (editingPlan) {
        await updatePlan({ id: editingPlan, ...form }).unwrap()
        toast.success('Plan updated')
      } else {
        await createPlan(form).unwrap()
        toast.success('Plan created')
      }
      resetForm()
    } catch (err) {
      toast.error(err.data?.message || 'Failed to save plan')
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this plan?')) return
    try {
      await deletePlan(id).unwrap()
      toast.success('Plan deleted')
    } catch (err) {
      toast.error(err.data?.message || 'Failed to delete plan')
    }
  }

  /**
   * Toggle a module key in the plan form.
   * Auto-syncs the features array: adds/removes the mapped feature slug.
   */
  const toggleModule = (mod) => {
    setForm(f => {
      const isSelected = f.moduleKeys.includes(mod.key)
      const newModuleKeys = isSelected
        ? f.moduleKeys.filter(m => m !== mod.key)
        : [...f.moduleKeys, mod.key]

      // Auto-sync features: add/remove mapped feature
      let newFeatures = [...f.features]
      if (isSelected && mod.feature) {
        newFeatures = newFeatures.filter(feat => feat !== mod.feature)
      } else if (!isSelected && mod.feature && !newFeatures.includes(mod.feature)) {
        newFeatures.push(mod.feature)
      }

      return { ...f, moduleKeys: newModuleKeys, features: newFeatures }
    })
  }

  const addFeature = () => {
    if (featureInput.trim()) {
      setForm(f => ({ ...f, features: [...f.features, featureInput.trim()] }))
      setFeatureInput('')
    }
  }

  const removeFeature = (idx) => {
    setForm(f => ({ ...f, features: f.features.filter((_, i) => i !== idx) }))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-xl font-black text-[var(--vz-heading)]">Plans</h4>
          <p className="text-sm text-[var(--vz-text-muted)] mt-1">Manage subscription plans and features</p>
        </div>
        <Button onClick={() => { resetForm(); setShowForm(true) }}>
          <Plus size={16} className="mr-2" /> New Plan
        </Button>
      </div>

      {/* Plan Form Modal */}
      {showForm && (
        <Card>
          <Card.Header className="flex items-center justify-between">
            <Card.Title>{editingPlan ? 'Edit Plan' : 'New Plan'}</Card.Title>
            <button onClick={resetForm} className="text-[var(--vz-text-muted)] hover:text-[var(--vz-heading)]"><X size={18} /></button>
          </Card.Header>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Plan Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              <Input label="Slug" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} required
                placeholder="e.g. basic, enterprise" />
              <Input label="Monthly Price (₹)" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} />
              <Input label="Yearly Price (₹)" type="number" value={form.yearlyPrice} onChange={(e) => setForm({ ...form, yearlyPrice: Number(e.target.value) })} />
              <Input label="Max Users" type="number" value={form.limits.maxUsers}
                onChange={(e) => setForm({ ...form, limits: { ...form.limits, maxUsers: Number(e.target.value) } })} />
              <Input label="Max Leads/Month" type="number" value={form.limits.maxLeadsPerMonth}
                onChange={(e) => setForm({ ...form, limits: { ...form.limits, maxLeadsPerMonth: Number(e.target.value) } })} />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--vz-heading)] mb-2">Included Modules</label>
              <div className="flex flex-wrap gap-2">
                {MODULE_OPTIONS.map((mod) => {
                  const Icon = mod.icon
                  const isSelected = form.moduleKeys.includes(mod.key)
                  return (
                    <button key={mod.key} type="button" onClick={() => toggleModule(mod)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                        isSelected
                          ? 'bg-primary text-white border-primary shadow-sm'
                          : 'bg-[var(--vz-input-bg)] text-[var(--vz-text)] border-[var(--vz-border)] hover:border-primary'
                      }`}
                    >
                      <Icon size={14} />
                      {mod.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--vz-heading)] mb-2">Feature Highlights</label>
              <div className="flex gap-2 mb-2">
                <input value={featureInput} onChange={(e) => setFeatureInput(e.target.value)}
                  placeholder="e.g. Unlimited Leads" onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addFeature())}
                  className="flex-1 px-3 py-2 text-sm rounded-lg border border-[var(--vz-input-border)] bg-[var(--vz-input-bg)] text-[var(--vz-heading)] outline-none"
                />
                <Button type="button" size="sm" onClick={addFeature}>Add</Button>
              </div>
              <div className="flex flex-wrap gap-1">
                {form.features.map((f, i) => (
                  <span key={i} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-primary/10 text-primary text-xs">
                    {f} <button type="button" onClick={() => removeFeature(i)}><X size={12} /></button>
                  </span>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-[var(--vz-text)]">
                <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
                Active
              </label>
            </div>

            <div className="flex gap-3">
              <Button type="submit">{editingPlan ? 'Update Plan' : 'Create Plan'}</Button>
              <Button type="button" variant="ghost" onClick={resetForm}>Cancel</Button>
            </div>
          </form>
        </Card>
      )}

      {/* Plans Grid */}
      {isLoading ? (
        <div className="text-center py-8 text-[var(--vz-text-muted)]">Loading plans...</div>
      ) : plans.length === 0 ? (
        <Card>
          <div className="text-center py-12 text-[var(--vz-text-muted)]">
            <Package size={40} className="mx-auto mb-3 opacity-20" />
            <p>No plans created yet</p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <Card key={plan._id} className="relative">
              {!plan.isActive && (
                <div className="absolute top-3 right-3"><Badge color="danger">Inactive</Badge></div>
              )}
              <div className="space-y-4">
                <div>
                  <h5 className="text-lg font-bold text-[var(--vz-heading)]">{plan.name}</h5>
                  <p className="text-xs text-[var(--vz-text-muted)]">{plan.slug}</p>
                </div>

                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-black text-primary">₹{plan.price?.toLocaleString()}</span>
                  <span className="text-sm text-[var(--vz-text-muted)]">/mo</span>
                </div>
                {plan.yearlyPrice > 0 && (
                  <p className="text-xs text-[var(--vz-text-muted)]">₹{plan.yearlyPrice?.toLocaleString()}/year</p>
                )}

                <div className="space-y-1">
                  <p className="text-xs font-semibold text-[var(--vz-text-muted)] uppercase">Modules</p>
                  <div className="flex flex-wrap gap-1">
                    {(plan.moduleKeys || []).map((m) => (
                      <Badge key={m} color="soft-primary">{m}</Badge>
                    ))}
                    {(!plan.moduleKeys || plan.moduleKeys.length === 0) && (
                      <span className="text-xs text-[var(--vz-text-muted)]">No modules configured</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs text-[var(--vz-text-muted)]">
                  <span className="flex items-center gap-1"><Users size={12} /> {plan.limits?.maxUsers || 0} users</span>
                  <span className="flex items-center gap-1"><DollarSign size={12} /> {plan.limits?.maxLeadsPerMonth || 0} leads/mo</span>
                </div>

                <div className="flex gap-2 pt-2 border-t border-[var(--vz-border)]">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(plan)}>
                    <Edit size={14} className="mr-1" /> Edit
                  </Button>
                  <Button size="sm" variant="ghost" className="text-danger" onClick={() => handleDelete(plan._id)}>
                    <Trash2 size={14} className="mr-1" /> Delete
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
