import { useState } from 'react'
import { X, CreditCard, ChevronRight, Loader2, ShieldCheck, AlertCircle, Globe, QrCode } from 'lucide-react'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import { useGetActivePaymentMethodsQuery } from '../../features/billing/billingApi'

const METHOD_CONTENT = {
  'card:razorpay': {
    label: 'Razorpay credit/debit cards',
    description: 'Pay securely with an Indian credit or debit card via Razorpay.',
    icon: CreditCard,
  },
  'card:stripe': {
    label: 'Stripe credit/debit cards',
    description: 'Pay securely with a credit or debit card via Stripe.',
    icon: CreditCard,
  },
  'international_card:razorpay': {
    label: 'Razorpay international cards',
    description: 'Use an international credit or debit card via Razorpay.',
    icon: Globe,
  },
  'international_card:stripe': {
    label: 'Stripe international cards',
    description: 'Use an international credit or debit card via Stripe.',
    icon: Globe,
  },
  'google_pay_qr:razorpay': {
    label: 'Google Pay QR scan',
    description: 'Scan a QR code with Google Pay to complete your payment.',
    icon: QrCode,
  },
}

const getMethodKey = (method) => method.id || method._id || `${method.type}:${method.provider}`

export default function PaymentMethodSelectModal({ isOpen, onClose, onSelect, planName, amount, isYearly }) {
  const { data: methodsData, isLoading, isError } = useGetActivePaymentMethodsQuery(undefined, {
    skip: !isOpen,
  })
  const [selectedMethodKey, setSelectedMethodKey] = useState(null)
  const methodsPayload = methodsData?.data
  const methods = Array.isArray(methodsPayload) ? methodsPayload : (methodsPayload?.methods || [])
  const selectedMethod = methods.find((method) => getMethodKey(method) === selectedMethodKey)

  const handleClose = () => {
    setSelectedMethodKey(null)
    onClose()
  }

  const handleContinue = () => {
    if (!selectedMethod) return
    setSelectedMethodKey(null)
    onSelect(selectedMethod)
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="sm">
      <div className="p-1">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-[var(--vz-heading)] flex items-center gap-2">
            <CreditCard size={20} className="text-primary" />
            Select Payment Method
          </h3>
          <button onClick={handleClose} className="text-[var(--vz-text-muted)] hover:text-[var(--vz-heading)] transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="bg-[var(--vz-input-bg)] p-4 rounded-xl border border-[var(--vz-border)] mb-6">
          <p className="text-sm text-[var(--vz-text-muted)] mb-1">Upgrading to {planName} ({isYearly ? 'Yearly' : 'Monthly'})</p>
          <div className="flex items-end gap-1">
            <span className="text-2xl font-bold text-[var(--vz-heading)]">₹{amount.toLocaleString('en-IN')}</span>
            <span className="text-sm text-[var(--vz-text-muted)] mb-1">+ 18% GST</span>
          </div>
        </div>

        {isLoading ? (
          <div className="py-8 flex flex-col items-center justify-center text-[var(--vz-text-muted)]">
            <Loader2 size={24} className="animate-spin mb-2 text-primary" />
            <p className="text-sm">Loading payment methods...</p>
          </div>
        ) : isError || methods.length === 0 ? (
          <div className="py-6 px-4 bg-danger/10 border border-danger/20 rounded-xl text-center">
            <AlertCircle size={32} className="mx-auto text-danger mb-2" />
            <p className="text-[var(--vz-heading)] font-semibold mb-1">No Payment Methods Available</p>
            <p className="text-xs text-[var(--vz-text-muted)]">Ask your platform administrator to enable a payment method for your account.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {methods.map((method) => {
              const methodKey = getMethodKey(method)
              const content = METHOD_CONTENT[`${method.type}:${method.provider}`] || {
                label: method.displayName || method.type?.replaceAll('_', ' ') || 'Payment method',
                description: `Secure checkout via ${method.provider || 'your payment provider'}.`,
                icon: CreditCard,
              }
              const Icon = content.icon
              const isSelected = selectedMethodKey === methodKey

              return (
                <button
                  key={methodKey}
                  type="button"
                  onClick={() => setSelectedMethodKey(methodKey)}
                  className={`w-full flex items-center justify-between gap-3 p-4 rounded-xl text-left transition-all duration-200 border-2 bg-[var(--vz-card-bg)] ${
                    isSelected ? 'border-primary ring-4 ring-primary/10 shadow-md' : 'border-[var(--vz-border)] hover:border-primary/50'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${isSelected ? 'bg-primary text-white' : 'bg-primary/10 text-primary'}`}>
                      <Icon size={19} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-[var(--vz-heading)]">{content.label}</p>
                      <p className="text-xs text-[var(--vz-text-muted)] mt-0.5">{content.description}</p>
                    </div>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${isSelected ? 'border-primary' : 'border-[var(--vz-border)]'}`}>
                    {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                  </div>
                </button>
              )
            })}
          </div>
        )}

        <div className="mt-8 flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={handleContinue}
            disabled={!selectedMethod || isLoading || methods.length === 0}
            className="min-w-[140px]"
          >
            Continue to Pay <ChevronRight size={16} className="ml-1" />
          </Button>
        </div>

        <div className="mt-4 text-center">
          <p className="text-[10px] text-[var(--vz-text-muted)] flex items-center justify-center gap-1">
            <ShieldCheck size={12} /> SSL Secured • PCI Compliant
          </p>
        </div>
      </div>
    </Modal>
  )
}
