import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useGetBillingDetailsQuery, useGetPaymentHistoryQuery, useGetAllPlansQuery, useUpgradePlanMutation } from '../../features/tenant/tenantApi'
import { useCreateSubscriptionMutation, useVerifyPaymentMutation, useGetInvoicesQuery } from '../../features/billing/billingApi'
import { setCredentials } from '../../slices/authSlice'
import { useToast } from '../../components/ui/Toast'
import PageHeader from '../../components/layout/PageHeader'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Tabs from '../../components/ui/Tabs'
import EmptyState from '../../components/ui/EmptyState'
import ConfirmModal from '../../components/ui/ConfirmModal'
import PaymentMethodSelectModal from '../../components/ui/PaymentMethodSelectModal'
import QrPaymentModal from '../../components/ui/QrPaymentModal'
import { Crown, FileText, Check, AlertTriangle, Zap, Clock, ArrowUpRight, Shield, Star, Building2, Mail, Phone, Calendar, Download, Receipt } from 'lucide-react'

export default function Billing() {
  const dispatch = useDispatch()
  const toast = useToast()
  const authState = useSelector((s) => s.auth)
  const [activeTab, setActiveTab] = useState('plan')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedPlanDetails, setSelectedPlanDetails] = useState(null)
  const [qrPayment, setQrPayment] = useState(null)
  const [confirmModal, setConfirmModal] = useState({ open: false, plan: null })

  const { data: billingData } = useGetBillingDetailsQuery()
  const { data: historyData } = useGetPaymentHistoryQuery()
  const { data: plansData } = useGetAllPlansQuery()
  const [upgradePlan, { isLoading: upgrading }] = useUpgradePlanMutation()
  const [createSubscription, { isLoading: paying }] = useCreateSubscriptionMutation()
  const [verifyPayment] = useVerifyPaymentMutation()
  const { data: invoicesData } = useGetInvoicesQuery()

  const billing = billingData?.data || {}
  const tenantInfo = billing.tenant || {}
  const currentPlan = billing.plan || {}
  const billingInfo = billing.billing || {}
  const payments = historyData?.data?.payments || []
  const plans = (plansData?.data || []).filter(p => !p.isTrial)
  const invoices = invoicesData?.data || []

  const daysRemaining = billingInfo.daysRemaining ?? 0
  const totalDays = billingInfo.isOnTrial ? 30 : 30
  const progress = Math.max(0, Math.min(100, ((totalDays - daysRemaining) / totalDays) * 100))

  const tabs = [
    { key: 'plan', label: 'Current Plan', icon: Crown },
    { key: 'plans', label: 'All Plans', icon: Star },
    { key: 'invoices', label: 'Invoices', icon: Receipt },
    { key: 'history', label: 'Payment History', icon: FileText },
  ]

  // ---------- Helpers ----------
  const isDowngrade = (newPlan) => {
    const currentPrice = currentPlan?.price ?? 0
    return (newPlan?.price ?? 0) < currentPrice
  }

  const updateLocalPlanState = (planData) => {
    // Update Redux + localStorage so sidebar & other components reflect instantly
    dispatch(setCredentials({
      user: authState.user,
      token: authState.token,
      permissions: authState.permissions,
      modules: authState.modules,
      branches: authState.branches,
      features: authState.features,
      plan: planData,
      subscription: authState.subscription,
    }))
  }

  // ---------- Plan Change (free / direct) ----------
  const handlePlanChangeConfirm = async () => {
    const plan = confirmModal.plan
    if (!plan) return
    setConfirmModal({ open: false, plan: null })

    try {
      const result = await upgradePlan({ planId: plan._id, billingCycle: 'monthly' }).unwrap()
      const newPlan = result?.data?.plan
      if (newPlan) updateLocalPlanState(newPlan)
      toast(`Plan changed to ${plan.name} successfully!`, 'success')
    } catch (err) {
      toast(err?.data?.message || 'Failed to update plan', 'error')
    }
  }

  // ---------- Plan selection handler ----------
  const handleUpgradeClick = (plan) => {
    if (plan.price === 0 || isDowngrade(plan)) {
      // Free plan or downgrade → show confirmation modal
      setConfirmModal({ open: true, plan })
    } else {
      // Paid upgrade → show payment method selection
      setSelectedPlanDetails(plan)
      setIsModalOpen(true)
    }
  }

  const handlePaymentSelect = async (method) => {
    setIsModalOpen(false)
    if (!selectedPlanDetails) return

    try {
      const res = await createSubscription({
        planSlug: selectedPlanDetails.slug,
        billingCycle: 'monthly',
        provider: method.provider,
        paymentMethod: method.type,
      }).unwrap()

      const payload = res.data

      if (method.type === 'google_pay_qr') {
        setQrPayment(payload)
      } else if (method.provider === 'razorpay') {
        const options = {
          key: payload.razorpayKeyId,
          amount: payload.amount,
          currency: payload.currency,
          name: "SparkCRM",
          description: "Plan Subscription",
          order_id: payload.orderId,
          handler: async function (response) {
            try {
              const verifyRes = await verifyPayment({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature
              }).unwrap()
              const newPlan = verifyRes?.data?.plan
              if (newPlan) updateLocalPlanState(newPlan)
              toast('Payment successful! Your plan has been upgraded.', 'success')
              setTimeout(() => {
                window.location.reload()
              }, 1500)
            } catch (verifyErr) {
              toast(verifyErr?.data?.message || 'Payment captured but verification failed. Please contact support.', 'error')
            }
          },
          prefill: {
            name: tenantInfo.companyName,
            email: tenantInfo.email,
            contact: tenantInfo.phone
          },
          theme: { color: "#6C47FF" },
          config: {
            display: {
              blocks: {
                cards: {
                  name: method.type === 'international_card' ? 'Pay by international card' : 'Pay by card',
                  instruments: [{ method: 'card' }]
                }
              },
              sequence: ['block.cards'],
              preferences: { show_default_blocks: false }
            }
          }
        }
        
        const rzp = new window.Razorpay(options)
        rzp.on('payment.failed', function (response){
          toast(`Payment failed: ${response.error.description}`, 'error')
        })
        rzp.open()

      } else if (method.provider === 'stripe') {
        window.location.assign(payload.sessionUrl)
      }

    } catch (err) {
      toast(err?.data?.message || 'Failed to initiate payment session', 'error')
    }
  }

  const handleQrPaymentPaid = () => {
    setQrPayment(null)
    setTimeout(() => {
      window.location.reload()
    }, 1500)
  }

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'

  return (
    <>
      <PageHeader title="Billing & Plans" breadcrumbs={[{ label: 'CRM', path: '/dashboard' }, { label: 'Billing' }]} />

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} className="mb-4" />

      {activeTab === 'plan' && (
        <div className="space-y-4">
          {/* Trial / Plan Banner */}
          {billingInfo.isOnTrial && (
            <div className="relative overflow-hidden rounded-xl border border-warning/30 bg-gradient-to-r from-amber-500/5 to-orange-500/5 p-5">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-warning/10 flex items-center justify-center shrink-0">
                  <Clock size={24} className="text-warning" />
                </div>
                <div className="flex-1">
                  <h4 className="text-base font-semibold text-[var(--vz-heading)]">Free Trial Active</h4>
                  <p className="text-sm text-[var(--vz-text-muted)] mt-0.5">
                    <strong className="text-warning">{daysRemaining} days</strong> remaining in your 30-day free trial
                  </p>
                  <div className="w-full max-w-xs h-2 rounded-full bg-[var(--vz-input-bg)] mt-2 overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-500" style={{ width: `${progress}%` }} />
                  </div>
                  {billingInfo.expiresAt && (
                    <p className="text-xs text-[var(--vz-text-muted)] mt-1">Expires: {formatDate(billingInfo.expiresAt)}</p>
                  )}
                </div>
                <Button variant="primary" size="sm" className="shrink-0" onClick={() => setActiveTab('plans')}>
                  <ArrowUpRight size={14} className="mr-1" /> Upgrade Now
                </Button>
              </div>
            </div>
          )}

          {!billingInfo.isOnTrial && daysRemaining > 0 && daysRemaining <= 7 && (
            <div className="relative overflow-hidden rounded-xl border border-danger/30 bg-gradient-to-r from-red-500/5 to-orange-500/5 p-5">
              <div className="flex items-center gap-3">
                <AlertTriangle size={24} className="text-danger shrink-0" />
                <div className="flex-1">
                  <h4 className="text-base font-semibold text-[var(--vz-heading)]">Plan Expiring Soon</h4>
                  <p className="text-sm text-[var(--vz-text-muted)]">Your plan expires in <strong className="text-danger">{daysRemaining} days</strong>. Renew to avoid downgrade.</p>
                </div>
                <Button variant="danger" size="sm">Renew Now</Button>
              </div>
            </div>
          )}

          {/* Current Plan + Tenant Details */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2">
              <Card.Header>
                <Card.Title>Current Plan</Card.Title>
              </Card.Header>
              <div className="flex flex-col sm:flex-row items-start gap-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary to-indigo-600 flex items-center justify-center shrink-0">
                  <Crown size={28} className="text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-[var(--vz-heading)]">{currentPlan.name || 'Free Trial'}</h3>
                  <p className="text-3xl font-bold text-primary mt-1">
                    ₹{(currentPlan.price || 0).toLocaleString('en-IN')}
                    <span className="text-sm text-[var(--vz-text-muted)] font-normal">/{billingInfo.billingCycle === 'yearly' ? 'year' : 'month'}</span>
                  </p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <Badge color="success">Active</Badge>
                    {billingInfo.isOnTrial && <Badge color="warning">Trial</Badge>}
                    {billingInfo.billingCycle && <Badge color="info">{billingInfo.billingCycle}</Badge>}
                  </div>

                  {/* Plan Limits */}
                  {currentPlan.limits && (
                    <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                      {Object.entries(currentPlan.limits).filter(([k]) => ['maxUsers', 'maxLeadsPerMonth', 'maxCallsPerDay', 'maxWhatsAppPerDay', 'maxStorage'].includes(k)).map(([k, v]) => (
                        <div key={k} className="flex items-center gap-2 text-[var(--vz-text)]">
                          <Check size={14} className="text-secondary shrink-0" />
                          {v === -1 ? 'Unlimited' : v} {k.replace('max', '').replace(/([A-Z])/g, ' $1').trim()}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Features */}
                  {currentPlan.features && currentPlan.features.length > 0 && (
                    <div className="mt-4 space-y-1">
                      {currentPlan.features.slice(0, 6).map((f, i) => (
                        <p key={i} className="flex items-center gap-2 text-sm text-[var(--vz-text)]">
                          <Check size={14} className="text-secondary shrink-0" />
                          {typeof f === 'string' ? f : f?.name || JSON.stringify(f)}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </Card>

            {/* Tenant Details */}
            <div className="space-y-4">
              <Card>
                <Card.Header><Card.Title>Account Details</Card.Title></Card.Header>
                <div className="space-y-3">
                  {[
                    { icon: Building2, label: 'Company', value: tenantInfo.companyName },
                    { icon: Mail, label: 'Email', value: tenantInfo.email },
                    { icon: Phone, label: 'Phone', value: tenantInfo.phone || 'N/A' },
                    { icon: Calendar, label: 'Registered', value: formatDate(tenantInfo.meta?.createdAt) },
                    { icon: Shield, label: 'Status', value: tenantInfo.status, isBadge: true },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <item.icon size={14} className="text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] text-[var(--vz-text-muted)] uppercase tracking-wide">{item.label}</p>
                        {item.isBadge
                          ? <Badge color={item.value === 'active' ? 'success' : item.value === 'trial' ? 'warning' : 'info'} className="mt-0.5">{item.value || 'N/A'}</Badge>
                          : <p className="text-sm font-medium text-[var(--vz-heading)] truncate">{item.value || 'N/A'}</p>
                        }
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Quick Actions */}
              <Card className="!p-3">
                <Button variant="soft-primary" size="sm" className="w-full mb-2" onClick={() => setActiveTab('plans')}>
                  <ArrowUpRight size={14} className="mr-1" /> Upgrade Plan
                </Button>
                <Button variant="soft-secondary" size="sm" className="w-full" onClick={() => setActiveTab('history')}>
                  <FileText size={14} className="mr-1" /> View Invoices
                </Button>
              </Card>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'plans' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const isPopular = plan.slug === 'professional'
            const isCurrent = currentPlan.slug === plan.slug

            return (
              <div key={plan.slug || plan._id}
                className={`relative bg-[var(--vz-card-bg)] border rounded-xl overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${
                  isPopular ? 'border-primary ring-2 ring-primary/20' : 'border-[var(--vz-border)]'
                }`} style={{ boxShadow: 'var(--vz-shadow)' }}>

                {isPopular && (
                  <div className="bg-gradient-to-r from-primary to-indigo-600 text-white text-center py-1.5 text-xs font-bold uppercase tracking-wider">
                    Most Popular
                  </div>
                )}

                <div className="p-6 text-center">
                  <div className={`w-14 h-14 rounded-xl mx-auto mb-4 flex items-center justify-center ${
                    isPopular ? 'bg-gradient-to-br from-primary to-indigo-600' : 'bg-primary/10'
                  }`}>
                    {plan.slug === 'free' && <Zap size={24} className={isPopular ? 'text-white' : 'text-primary'} />}
                    {plan.slug === 'basic' && <Star size={24} className={isPopular ? 'text-white' : 'text-primary'} />}
                    {plan.slug === 'professional' && <Crown size={24} className="text-white" />}
                    {plan.slug === 'enterprise' && <Shield size={24} className={isPopular ? 'text-white' : 'text-primary'} />}
                    {!['free', 'basic', 'professional', 'enterprise'].includes(plan.slug) && <Star size={24} className="text-primary" />}
                  </div>
                  <h4 className="text-lg font-bold text-[var(--vz-heading)]">{plan.name}</h4>
                  <p className="text-3xl font-bold text-primary mt-2">
                    ₹{(plan.price || 0).toLocaleString('en-IN')}
                    <span className="text-sm text-[var(--vz-text-muted)] font-normal">/mo</span>
                  </p>
                </div>

                <div className="px-6 pb-6">
                  {/* Limits */}
                  {plan.limits && (
                    <div className="space-y-1.5 mb-4 pb-4 border-b border-[var(--vz-border)]">
                      {Object.entries(plan.limits).filter(([k]) => ['maxUsers', 'maxLeadsPerMonth', 'maxCallsPerDay', 'maxStorage'].includes(k)).map(([k, v]) => (
                        <p key={k} className="flex items-center gap-2 text-sm text-[var(--vz-text)]">
                          <Check size={14} className="text-secondary shrink-0" />
                          {v === -1 ? 'Unlimited' : v} {k.replace('max', '').replace(/([A-Z])/g, ' $1').trim()}
                        </p>
                      ))}
                    </div>
                  )}

                  {/* Features */}
                  <div className="space-y-2.5 mb-6">
                    {(plan.features || []).slice(0, 5).map((f, i) => {
                      const featureName = typeof f === 'string' ? f : f?.name || f?.label || JSON.stringify(f)
                      return (
                        <p key={i} className="flex items-center gap-2 text-sm text-[var(--vz-text)]">
                          <Check size={16} className="text-secondary shrink-0" />
                          {featureName}
                        </p>
                      )
                    })}
                  </div>
                  <Button className="w-full" variant={isPopular ? 'primary' : 'soft-primary'} size="sm"
                    disabled={isCurrent || upgrading || paying}
                    onClick={() => !isCurrent && handleUpgradeClick(plan)}>
                    {isCurrent ? 'Current Plan' : upgrading || paying ? 'Processing...' : 'Choose Plan'}
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {activeTab === 'invoices' && (
        <Card>
          <Card.Header>
            <Card.Title>Invoices</Card.Title>
          </Card.Header>
          {invoices.length === 0 ? (
            <EmptyState icon={Receipt} title="No invoices yet" description="Invoices will be generated and available for download after each successful payment." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[var(--vz-text-muted)] border-b border-[var(--vz-border)]">
                    <th className="py-3 px-4 font-medium">Invoice #</th>
                    <th className="py-3 px-4 font-medium">Date</th>
                    <th className="py-3 px-4 font-medium">Description</th>
                    <th className="py-3 px-4 font-medium">Amount</th>
                    <th className="py-3 px-4 font-medium">Status</th>
                    <th className="py-3 px-4 font-medium">Payment</th>
                    <th className="py-3 px-4 font-medium text-right">Invoice PDF</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv._id} className="border-b border-[var(--vz-border)] hover:bg-[var(--vz-input-bg)] transition-colors">
                      <td className="py-3 px-4">
                        <code className="text-xs bg-[var(--vz-input-bg)] px-2 py-1 rounded font-mono">{inv.invoiceNumber}</code>
                      </td>
                      <td className="py-3 px-4 text-[var(--vz-text)]">{formatDate(inv.paidAt || inv.meta?.createdAt)}</td>
                      <td className="py-3 px-4 text-[var(--vz-heading)] font-medium">{inv.description || inv.type}</td>
                      <td className="py-3 px-4 font-bold text-[var(--vz-heading)]">
                        <span className="text-xs text-[var(--vz-text-muted)] mr-0.5">{inv.currency}</span>
                        {inv.total?.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-4">
                        <Badge color={inv.status === 'paid' ? 'success' : inv.status === 'pending' ? 'warning' : 'danger'}>
                          {inv.status?.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-[var(--vz-text-muted)] capitalize text-xs">
                        {inv.paymentMethod || '—'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {inv.pdfUrl ? (
                          <a href={inv.pdfUrl} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                            <Download size={14} /> Download
                          </a>
                        ) : (
                          <span className="text-xs text-[var(--vz-text-muted)] italic">Generating...</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {activeTab === 'history' && (
        <Card>
          <Card.Header>
            <Card.Title>Payment History</Card.Title>
          </Card.Header>
          {payments.length === 0 ? (
            <EmptyState icon={FileText} title="No payment history" description="Your payment history will appear here after you make your first payment." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[var(--vz-text-muted)] border-b border-[var(--vz-border)]">
                    <th className="py-3 px-4 font-medium">Date</th>
                    <th className="py-3 px-4 font-medium">Invoice</th>
                    <th className="py-3 px-4 font-medium">Plan</th>
                    <th className="py-3 px-4 font-medium">Amount</th>
                    <th className="py-3 px-4 font-medium">Status</th>
                    <th className="py-3 px-4 font-medium">Period</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p._id} className="border-b border-[var(--vz-border)] hover:bg-[var(--vz-input-bg)]">
                      <td className="py-3 px-4 text-[var(--vz-text)]">{formatDate(p.paidAt || p.meta?.createdAt)}</td>
                      <td className="py-3 px-4"><code className="text-xs bg-[var(--vz-input-bg)] px-2 py-0.5 rounded">{p.invoiceNumber}</code></td>
                      <td className="py-3 px-4 font-medium text-[var(--vz-heading)]">{p.planName}</td>
                      <td className="py-3 px-4 font-bold text-[var(--vz-heading)]">
                        {p.amount === 0 ? <span className="text-secondary">Free</span> : `₹${p.amount.toLocaleString('en-IN')}`}
                      </td>
                      <td className="py-3 px-4">
                        <Badge color={p.status === 'completed' ? 'success' : p.status === 'trial' ? 'warning' : p.status === 'failed' ? 'danger' : 'info'}>
                          {p.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-[var(--vz-text-muted)] text-xs">
                        {formatDate(p.periodStart)} — {formatDate(p.periodEnd)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Payment Selection Modal */}
      {selectedPlanDetails && (
        <PaymentMethodSelectModal 
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSelect={handlePaymentSelect}
          planName={selectedPlanDetails.name}
          amount={selectedPlanDetails.price}
          isYearly={false}
        />
      )}

      <QrPaymentModal
        payment={qrPayment}
        onClose={() => setQrPayment(null)}
        onPaid={handleQrPaymentPaid}
      />

      {/* Plan Change Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmModal.open}
        title={confirmModal.plan && isDowngrade(confirmModal.plan) ? 'Downgrade Plan?' : 'Change Plan?'}
        message={
          confirmModal.plan && isDowngrade(confirmModal.plan)
            ? `Are you sure you want to downgrade to ${confirmModal.plan?.name}? You may lose access to advanced features included in your current plan.`
            : `Switch to the ${confirmModal.plan?.name} plan? ${confirmModal.plan?.price === 0 ? 'This is a free plan with limited features.' : ''}`
        }
        confirmText={confirmModal.plan && isDowngrade(confirmModal.plan) ? 'Downgrade' : 'Switch Plan'}
        variant={confirmModal.plan && isDowngrade(confirmModal.plan) ? 'danger' : 'primary'}
        loading={upgrading}
        onConfirm={handlePlanChangeConfirm}
        onCancel={() => setConfirmModal({ open: false, plan: null })}
      />
    </>
  )
}
