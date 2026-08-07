import { useEffect, useRef } from 'react'
import { Clock, Loader2, QrCode, ShieldCheck, X } from 'lucide-react'
import { useGetPaymentStatusQuery } from '../../features/billing/billingApi'
import { useToast } from './Toast'
import Modal from './Modal'
import Button from './Button'

export default function QrPaymentModal({ payment, onClose, onPaid }) {
  const toast = useToast()
  const paidHandledRef = useRef(false)
  const invoiceId = payment?.invoiceId
  const isOpen = Boolean(payment)
  const { currentData: statusData, isFetching } = useGetPaymentStatusQuery(invoiceId, {
    skip: !isOpen || !invoiceId,
    pollingInterval: 3000,
    skipPollingIfUnfocused: true,
  })
  const status = statusData?.data?.status || statusData?.status
  const isExpired = status === 'expired'

  useEffect(() => {
    if (isOpen) paidHandledRef.current = false
  }, [invoiceId, isOpen])

  useEffect(() => {
    if (status !== 'paid' || paidHandledRef.current) return

    paidHandledRef.current = true
    toast('Payment successful! Your plan has been upgraded.', 'success')
    onPaid()
  }, [onPaid, status, toast])

  const expiry = payment?.qrExpiresAt || payment?.expiry || payment?.expiresAt
  const formattedExpiry = expiry
    ? new Date(expiry).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
    : null

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm">
      <div className="p-1 text-center">
        <div className="flex items-center justify-between mb-5 text-left">
          <div>
            <h3 className="text-xl font-bold text-[var(--vz-heading)] flex items-center gap-2">
              <QrCode size={21} className="text-primary" /> Scan to Pay
            </h3>
            <p className="text-xs text-[var(--vz-text-muted)] mt-1">Open Google Pay and scan this QR code</p>
          </div>
          <button onClick={onClose} className="text-[var(--vz-text-muted)] hover:text-[var(--vz-heading)] transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="inline-flex p-3 bg-white rounded-xl border border-[var(--vz-border)] shadow-sm">
          <img src={payment?.qrImageUrl} alt="Google Pay payment QR code" className="w-56 h-56 object-contain" />
        </div>

        <p className="text-sm text-[var(--vz-text-muted)] mt-5">Amount to pay</p>
        <p className="text-3xl font-black text-[var(--vz-heading)] mt-1">
          {payment?.currency === 'USD' ? '$' : '₹'}{Number(payment?.amount || 0).toLocaleString('en-IN')}
        </p>

        {formattedExpiry && (
          <div className="mt-4 flex items-center justify-center gap-2 text-xs text-warning">
            <Clock size={14} /> QR expires {formattedExpiry}
          </div>
        )}

        <div className={`mt-5 p-3 rounded-lg border text-xs text-[var(--vz-text-muted)] ${isExpired ? 'bg-danger/5 border-danger/15' : 'bg-primary/5 border-primary/15'}`}>
          <div className="flex items-center justify-center gap-2 font-medium text-[var(--vz-heading)]">
            {isExpired
              ? <Clock size={14} className="text-danger" />
              : isFetching
                ? <Loader2 size={14} className="animate-spin text-primary" />
                : <ShieldCheck size={14} className="text-primary" />}
            {isExpired ? 'This QR code has expired' : 'Waiting for payment confirmation'}
          </div>
          <p className="mt-1">
            {isExpired
              ? 'Close this window and start payment again to generate a new QR code.'
              : 'This window updates automatically after your payment is received.'}
          </p>
        </div>

        <div className="mt-6">
          <Button variant="outline" className="w-full" onClick={onClose}>{isExpired ? 'Close' : 'Cancel Payment'}</Button>
        </div>
      </div>
    </Modal>
  )
}
