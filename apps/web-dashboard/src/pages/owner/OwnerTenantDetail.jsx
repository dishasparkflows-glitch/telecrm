import { useParams, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useGetOwnerTenantDetailQuery, useImpersonateTenantMutation, useUpdateTenantFeaturesMutation, useUpdateTenantPaymentMethodsMutation, useUpdateTenantCallingMutation } from '../../features/owner/ownerApi'
import { useToast } from '../../components/ui/Toast'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import KPICard from '../../components/ui/KPICard'
import { ArrowLeft, Users, Target, Phone, Calendar, LogIn, CreditCard, Globe, Edit, Save, X, MessageCircle, FileText, Zap, BarChart3, CheckSquare, QrCode, AlertTriangle } from 'lucide-react'

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

const STATUS_COLORS = {
  active: 'success', trial: 'info', suspended: 'danger',
  cancelled: 'warning', free: 'primary',
}

const PAYMENT_METHOD_OPTIONS = [
  { type: 'card', provider: 'razorpay', label: 'Razorpay credit/debit cards', description: 'Accept domestic card payments through Razorpay.', icon: CreditCard },
  { type: 'card', provider: 'stripe', label: 'Stripe credit/debit cards', description: 'Accept credit and debit card payments through Stripe.', icon: CreditCard },
  { type: 'international_card', provider: 'razorpay', label: 'Razorpay international cards', description: 'Accept international cards when the Razorpay account has international payments enabled.', icon: Globe },
  { type: 'international_card', provider: 'stripe', label: 'Stripe international cards', description: 'Accept international cards when the Stripe account supports the plan currency.', icon: Globe },
  { type: 'google_pay_qr', provider: 'razorpay', label: 'Google Pay QR scan', description: 'Let the tenant pay by scanning a Google Pay QR code.', icon: QrCode },
]

const paymentMethodKey = ({ type, provider }) => `${type}:${provider}`

export default function OwnerTenantDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()

  const { data, isLoading } = useGetOwnerTenantDetailQuery(id)
  const [impersonate, { isLoading: impersonating }] = useImpersonateTenantMutation()
  const [updateFeatures, { isLoading: updatingFeatures }] = useUpdateTenantFeaturesMutation()
  const [updatePaymentMethods, { isLoading: updatingPaymentMethods }] = useUpdateTenantPaymentMethodsMutation()
  const [updateCalling, { isLoading: updatingCalling }] = useUpdateTenantCallingMutation()

  const [isEditingModules, setIsEditingModules] = useState(false)
  const [selectedExtraModules, setSelectedExtraModules] = useState([])
  const [isEditingPaymentMethods, setIsEditingPaymentMethods] = useState(false)
  const [selectedPaymentMethods, setSelectedPaymentMethods] = useState([])
  const [isEditingCalling, setIsEditingCalling] = useState(false)
  const [callingConfig, setCallingConfig] = useState({ exotelVirtualNumber: '', callingEnabled: false })

  const d = data?.data || {}
  const tenant = d.tenant || {}
  const users = d.users || []
  const payments = d.payments || []
  const activePaymentMethodKeys = (tenant.paymentMethods || [])
    .filter(method => method.enabled !== false)
    .map(paymentMethodKey)

  const handleStartEditModules = () => {
    setSelectedExtraModules(tenant.extraModuleKeys || [])
    setIsEditingModules(true)
  }

  const handleSaveModules = async () => {
    try {
      await updateFeatures({ id, extraModuleKeys: selectedExtraModules }).unwrap()
      toast.success('Extra modules updated successfully')
      setIsEditingModules(false)
    } catch {
      toast.error('Failed to update extra modules')
    }
  }

  const toggleExtraModule = (key) => {
    setSelectedExtraModules(prev => 
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
  }

  const handleStartEditPaymentMethods = () => {
    setSelectedPaymentMethods(
      (tenant.paymentMethods || [])
        .filter(method => method.enabled !== false)
        .map(paymentMethodKey)
    )
    setIsEditingPaymentMethods(true)
  }

  const togglePaymentMethod = (method) => {
    const key = paymentMethodKey(method)
    setSelectedPaymentMethods(prev => prev.includes(key) ? prev.filter(item => item !== key) : [...prev, key])
  }

  const handleSavePaymentMethods = async () => {
    const methods = PAYMENT_METHOD_OPTIONS
      .filter(method => selectedPaymentMethods.includes(paymentMethodKey(method)))
      .map(({ type, provider }) => ({ type, provider, enabled: true }))

    try {
      await updatePaymentMethods({ id, methods }).unwrap()
      toast.success('Tenant payment methods updated successfully')
      setIsEditingPaymentMethods(false)
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to update tenant payment methods')
    }
  }

  const handleStartEditCalling = () => {
    setCallingConfig({
      exotelVirtualNumber: tenant.calling?.exotelVirtualNumber || '',
      callingEnabled: !!tenant.calling?.callingEnabled,
    })
    setIsEditingCalling(true)
  }

  const handleSaveCalling = async () => {
    try {
      await updateCalling({ id, ...callingConfig }).unwrap()
      toast.success('Tenant calling configuration updated')
      setIsEditingCalling(false)
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to update calling configuration')
    }
  }

  const handleImpersonate = async () => {
    try {
      const result = await impersonate(id).unwrap()
      const impToken = result.data.token
      const impTenant = result.data.tenant

      // Save current owner token AND user so we can restore later
      const ownerToken = localStorage.getItem('sparkcrm_token')
      const ownerUser = localStorage.getItem('sparkcrm_user')
      localStorage.setItem('sparkcrm_owner_token', ownerToken)
      // Guard: if ownerUser is null/undefined, save a minimal owner object
      localStorage.setItem('sparkcrm_owner_user', ownerUser && ownerUser !== 'null' ? ownerUser : JSON.stringify({ role: 'owner' }))
      localStorage.setItem('sparkcrm_impersonating', JSON.stringify(impTenant))

      // Set impersonation token — user=null so getMe fetches tenant modules on load
      localStorage.setItem('sparkcrm_token', impToken)
      localStorage.removeItem('sparkcrm_user')
      localStorage.removeItem('sparkcrm_permissions')
      localStorage.removeItem('sparkcrm_modules')
      localStorage.removeItem('sparkcrm_branches')
      // Set 'all' so impersonating superadmin sees ALL branches, not just Head Office
      localStorage.setItem('sparkcrm_active_branch', 'all')

      // Full page reload — clears all RTK Query cache, avoids 403 on owner APIs
      window.location.href = '/dashboard'
    } catch (err) {
      console.error('Impersonation error:', err)
    }
  }

  if (isLoading) {
    return <div className="flex items-center justify-center h-64 text-[var(--vz-text-muted)]">Loading...</div>
  }

  const companyName = tenant.company?.name;
  const email = tenant.company?.email;
  const slug = tenant.company?.slug;
  const status = tenant.status;
  const billingCycle = tenant.subscription?.billingCycle || 'None';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/owner/tenants')} className="p-2 rounded-lg hover:bg-[var(--vz-input-bg)] text-[var(--vz-text-muted)]">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h4 className="text-xl font-black text-[var(--vz-heading)]">{companyName}</h4>
            <p className="text-sm text-[var(--vz-text-muted)] mt-0.5">{email}</p>
          </div>
          <Badge color={STATUS_COLORS[status] || 'primary'}>{status}</Badge>
        </div>
        <Button onClick={handleImpersonate} disabled={impersonating}>
          <LogIn size={16} className="mr-2" />
          {impersonating ? 'Entering...' : 'Enter Tenant View'}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard title="Users" value={d.userCount || 0} icon={Users} iconColor="primary" />
        <KPICard title="Leads" value={d.leadCount || 0} icon={Target} iconColor="success" />
        <KPICard title="Calls" value={d.callCount || 0} icon={Phone} iconColor="info" />
        <KPICard title="Meetings" value={d.meetingCount || 0} icon={Calendar} iconColor="warning" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tenant Info */}
        <Card>
          <Card.Header><Card.Title>Tenant Details</Card.Title></Card.Header>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between py-2 border-b border-[var(--vz-border)]">
              <span className="text-[var(--vz-text-muted)]">Company</span>
              <span className="font-medium text-[var(--vz-heading)]">{companyName}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-[var(--vz-border)]">
              <span className="text-[var(--vz-text-muted)]">Slug</span>
              <span className="font-medium text-[var(--vz-heading)]">{slug}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-[var(--vz-border)]">
              <span className="text-[var(--vz-text-muted)]">Plan</span>
              <Badge color="soft-primary">{tenant.planId?.name || 'N/A'}</Badge>
            </div>
            <div className="flex justify-between py-2 border-b border-[var(--vz-border)]">
              <span className="text-[var(--vz-text-muted)]">Billing</span>
              <span className="font-medium text-[var(--vz-heading)]">{billingCycle}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-[var(--vz-text-muted)]">Created</span>
              <span className="font-medium text-[var(--vz-heading)]">{new Date(tenant.meta?.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        </Card>

        {/* Users */}
        <Card>
          <Card.Header><Card.Title>Users ({users.length})</Card.Title></Card.Header>
          {users.length === 0 ? (
            <p className="text-sm text-[var(--vz-text-muted)] py-4 text-center">No users</p>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {users.map((u) => (
                <div key={u._id} className="flex items-center justify-between py-2 px-1 border-b border-[var(--vz-border)] last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                      {u.name?.[0]?.toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[var(--vz-heading)]">{u.name}</p>
                      <p className="text-[11px] text-[var(--vz-text-muted)]">{u.email}</p>
                    </div>
                  </div>
                  <Badge color={u.isActive ? 'success' : 'danger'}>{u.role}</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Extra Modules Grant */}
      <Card>
        <Card.Header>
          <div className="flex items-center justify-between w-full">
            <Card.Title>Extra Module Grants</Card.Title>
            {!isEditingModules ? (
              <Button variant="ghost" size="sm" onClick={handleStartEditModules}>
                <Edit size={14} className="mr-2" /> Edit Grants
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setIsEditingModules(false)} disabled={updatingFeatures}>
                  <X size={14} className="mr-2" /> Cancel
                </Button>
                <Button size="sm" onClick={handleSaveModules} disabled={updatingFeatures}>
                  <Save size={14} className="mr-2" /> {updatingFeatures ? 'Saving...' : 'Save Grants'}
                </Button>
              </div>
            )}
          </div>
        </Card.Header>
        <div className="p-4 bg-[var(--vz-bg-body)] rounded-md border border-[var(--vz-border)] mb-4 mx-4 shadow-sm">
          <p className="text-sm text-[var(--vz-text-muted)] mb-4">
            Select additional modules to grant to this tenant, regardless of their current plan. Plan-included modules are automatically active.
          </p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {MODULE_OPTIONS.map(mod => {
              const Icon = mod.icon
              const isPlanModule = tenant.planId?.moduleKeys?.includes(mod.key)
              const isGranted = selectedExtraModules.includes(mod.key)
              
              // In view mode, show either plan-included (green/muted) or granted (primary)
              // In edit mode, plan-included are disabled & checked, grants are togglable
              
              let stateClasses = ''
              let showCheck = false
              
              if (isEditingModules) {
                if (isPlanModule) {
                  stateClasses = 'border-success/30 bg-success/5 opacity-60 cursor-not-allowed'
                  showCheck = true
                } else if (isGranted) {
                  stateClasses = 'border-primary bg-primary/10 ring-1 ring-primary/50 cursor-pointer'
                  showCheck = true
                } else {
                  stateClasses = 'border-[var(--vz-border)] bg-[var(--vz-bg-body)] hover:border-primary/50 cursor-pointer'
                }
              } else {
                if (isPlanModule) {
                  stateClasses = 'border-success/30 bg-success/5'
                  showCheck = true
                } else if (tenant.extraModuleKeys?.includes(mod.key)) {
                  stateClasses = 'border-primary bg-primary/10'
                  showCheck = true
                } else {
                  stateClasses = 'border-[var(--vz-border)] bg-[var(--vz-bg-body)] opacity-50'
                }
              }

              return (
                <div 
                  key={mod.key}
                  onClick={() => isEditingModules && !isPlanModule && toggleExtraModule(mod.key)}
                  className={`p-3 rounded-lg border transition-all duration-200 flex items-center justify-between group ${stateClasses}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-md ${showCheck ? (isPlanModule ? 'bg-success/20 text-success' : 'bg-primary/20 text-primary') : 'bg-[var(--vz-input-bg)] text-[var(--vz-text-muted)]'}`}>
                      <Icon size={16} />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-[var(--vz-heading)] leading-none">{mod.label}</h4>
                      {isPlanModule && <p className="text-[10px] text-success mt-1">Included in Plan</p>}
                      {showCheck && !isPlanModule && <p className="text-[10px] text-primary mt-1">Manually Granted</p>}
                    </div>
                  </div>
                  {isEditingModules && !isPlanModule && (
                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                      isGranted 
                        ? 'bg-primary border-primary text-white' 
                        : 'border-[var(--vz-border)] bg-[var(--vz-input-bg)]'
                    }`}>
                      {isGranted && <CheckSquare size={12} />}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </Card>


      {/* Tenant Payment Methods */}
      <Card>
        <Card.Header>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full">
            <div className="flex items-center gap-3">
              <Card.Title>Tenant Payment Methods</Card.Title>
              <Badge color={tenant.paymentMethodsConfigured ? 'success' : 'warning'}>
                {tenant.paymentMethodsConfigured ? 'Configured' : 'Not configured'}
              </Badge>
            </div>
            {!isEditingPaymentMethods ? (
              <Button variant="ghost" size="sm" onClick={handleStartEditPaymentMethods}>
                <Edit size={14} className="mr-2" /> Edit Methods
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setIsEditingPaymentMethods(false)} disabled={updatingPaymentMethods}>
                  <X size={14} className="mr-2" /> Cancel
                </Button>
                <Button size="sm" onClick={handleSavePaymentMethods} disabled={updatingPaymentMethods}>
                  <Save size={14} className="mr-2" /> {updatingPaymentMethods ? 'Saving...' : 'Save Methods'}
                </Button>
              </div>
            )}
          </div>
        </Card.Header>

        <div className="flex items-start gap-3 p-3 mb-4 rounded-lg bg-warning/10 border border-warning/20">
          <AlertTriangle size={18} className="text-warning shrink-0 mt-0.5" />
          <p className="text-sm text-[var(--vz-text)]">
            The matching global Razorpay or Stripe provider must also be active. International cards and Razorpay UPI QR must be enabled on the provider account before those methods can accept payments.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {PAYMENT_METHOD_OPTIONS.map(method => {
            const key = paymentMethodKey(method)
            const isEnabled = isEditingPaymentMethods
              ? selectedPaymentMethods.includes(key)
              : activePaymentMethodKeys.includes(key)
            const Icon = method.icon

            return (
              <button
                key={key}
                type="button"
                disabled={!isEditingPaymentMethods}
                onClick={() => togglePaymentMethod(method)}
                className={`p-4 rounded-lg border text-left transition-all flex items-start gap-3 ${
                  isEnabled
                    ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                    : 'border-[var(--vz-border)] bg-[var(--vz-bg-body)]'
                } ${isEditingPaymentMethods ? 'cursor-pointer hover:border-primary/60' : 'cursor-default'} ${!isEditingPaymentMethods && !isEnabled ? 'opacity-50' : ''}`}
              >
                <div className={`p-2 rounded-lg shrink-0 ${isEnabled ? 'bg-primary text-white' : 'bg-[var(--vz-input-bg)] text-[var(--vz-text-muted)]'}`}>
                  <Icon size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-semibold text-[var(--vz-heading)]">{method.label}</h4>
                    <div className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 ${isEnabled ? 'bg-primary border-primary text-white' : 'border-[var(--vz-border)] bg-[var(--vz-input-bg)]'}`}>
                      {isEnabled && <CheckSquare size={13} />}
                    </div>
                  </div>
                  <p className="text-xs text-[var(--vz-text-muted)] mt-1">{method.description}</p>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-primary mt-2">{method.provider}</p>
                </div>
              </button>
            )
          })}
        </div>
      </Card>

      {/* Calling Configuration */}
      <Card>
        <Card.Header>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full">
            <div className="flex items-center gap-3">
              <Card.Title>Calling Configuration</Card.Title>
              <Badge color={tenant.calling?.callingEnabled ? 'success' : 'warning'}>
                {tenant.calling?.callingEnabled ? 'Enabled' : 'Disabled'}
              </Badge>
            </div>
            {!isEditingCalling ? (
              <Button variant="ghost" size="sm" onClick={handleStartEditCalling}>
                <Edit size={14} className="mr-2" /> Edit Calling
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setIsEditingCalling(false)} disabled={updatingCalling}>
                  <X size={14} className="mr-2" /> Cancel
                </Button>
                <Button size="sm" onClick={handleSaveCalling} disabled={updatingCalling}>
                  <Save size={14} className="mr-2" /> {updatingCalling ? 'Saving...' : 'Save'}
                </Button>
              </div>
            )}
          </div>
        </Card.Header>
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--vz-heading)] mb-1">
              Exotel Virtual Number
            </label>
            <input
              type="text"
              disabled={!isEditingCalling}
              className="w-full sm:w-1/2 bg-[var(--vz-input-bg)] border border-[var(--vz-border)] rounded-md px-3 py-2 text-sm text-[var(--vz-text)] focus:ring-1 focus:ring-primary focus:border-primary disabled:opacity-50"
              placeholder="e.g. 08068XXXXXX"
              value={isEditingCalling ? callingConfig.exotelVirtualNumber : (tenant.calling?.exotelVirtualNumber || '')}
              onChange={(e) => setCallingConfig({ ...callingConfig, exotelVirtualNumber: e.target.value })}
            />
            <p className="text-xs text-[var(--vz-text-muted)] mt-1">
              The dedicated virtual number assigned to this tenant from Exotel.
            </p>
          </div>
          
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              disabled={!isEditingCalling}
              onClick={() => setCallingConfig({ ...callingConfig, callingEnabled: !callingConfig.callingEnabled })}
              className={`w-10 h-5 rounded-full relative transition-colors ${
                (isEditingCalling ? callingConfig.callingEnabled : tenant.calling?.callingEnabled)
                  ? 'bg-primary'
                  : 'bg-[var(--vz-border)]'
              } ${!isEditingCalling ? 'opacity-50 cursor-default' : 'cursor-pointer'}`}
            >
              <span 
                className={`absolute left-1 top-1 w-3 h-3 bg-white rounded-full transition-transform ${
                  (isEditingCalling ? callingConfig.callingEnabled : tenant.calling?.callingEnabled)
                    ? 'translate-x-5'
                    : 'translate-x-0'
                }`}
              />
            </button>
            <span className="text-sm text-[var(--vz-heading)]">Enable Calling for this Tenant</span>
          </div>
        </div>
      </Card>

      {/* Payment History */}
      <Card>
        <Card.Header><Card.Title>Payment History</Card.Title></Card.Header>
        {payments.length === 0 ? (
          <p className="text-sm text-[var(--vz-text-muted)] py-4 text-center">No payments</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--vz-table-header-bg)]">
                  {['Invoice', 'Plan', 'Amount', 'Status', 'Date'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-[var(--vz-text-muted)]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--vz-border)]">
                {payments.map((p) => (
                  <tr key={p._id}>
                    <td className="px-4 py-3 font-medium text-[var(--vz-heading)]">{p.invoiceNumber}</td>
                    <td className="px-4 py-3 text-[var(--vz-text)]">{p.planName}</td>
                    <td className="px-4 py-3 font-medium text-[var(--vz-heading)]">₹{p.amount?.toLocaleString()}</td>
                    <td className="px-4 py-3"><Badge color={p.status === 'completed' ? 'success' : 'warning'}>{p.status}</Badge></td>
                    <td className="px-4 py-3 text-[var(--vz-text-muted)] text-xs">{p.paidAt ? new Date(p.paidAt).toLocaleDateString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
