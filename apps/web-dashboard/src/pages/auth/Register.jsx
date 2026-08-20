import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import { useRegisterTenantMutation, useSendOtpMutation, useVerifyOtpMutation } from '../../features/auth/authApi'
import { setCredentials } from '../../slices/authSlice'
import Input from '../../components/ui/Input'
import Button from '../../components/ui/Button'
import { Mail, Lock, User, Building2, Phone, Zap, Star, Crown, Shield, ArrowLeft, Loader2 } from 'lucide-react'

/**
 * Plan display metadata for the badge shown when a plan is pre-selected via URL param.
 * Mirrors the PLAN_META in Pricing.jsx.
 */
const PLAN_META = {
  free:         { icon: Zap,    label: 'Free Plan',         color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
  basic:        { icon: Star,   label: 'Basic Plan',        color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
  professional: { icon: Crown,  label: 'Professional Plan', color: '#6C47FF', bg: 'rgba(108,71,255,0.1)' },
  enterprise:   { icon: Shield, label: 'Enterprise Plan',   color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
}

export default function Register() {
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const [searchParams] = useSearchParams()
  const [register, { isLoading: isRegistering }] = useRegisterTenantMutation()
  const [sendOtp, { isLoading: isSendingOtp }] = useSendOtpMutation()
  const [verifyOtp, { isLoading: isVerifyingOtp }] = useVerifyOtpMutation()

  // Accept ?plan=professional (or ?planSlug=professional) from Pricing page CTA links
  const planSlug = searchParams.get('plan') || searchParams.get('planSlug') || ''
  const planMeta = planSlug ? PLAN_META[planSlug] : null

  const [form, setForm] = useState({
    companyName: '',
    name: '',
    email: '',
    phone: '',
    password: '',
  })
  const [error, setError] = useState('')

  const [otpStep, setOtpStep] = useState(false)
  const [emailOtp, setEmailOtp] = useState('')
  const [phoneOtp, setPhoneOtp] = useState('')
  const [timer, setTimer] = useState(60)

  useEffect(() => {
    if (!otpStep || timer <= 0) return
    const t = setTimeout(() => setTimer(s => s - 1), 1000)
    return () => clearTimeout(t)
  }, [timer, otpStep])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    try {
      await sendOtp({ email: form.email, phone: form.phone }).unwrap()
      setOtpStep(true)
      setTimer(60)
    } catch (err) {
      setError(err?.data?.message || 'Failed to send OTP. Please check your details.')
    }
  }

  const handleResendOtp = async () => {
    try {
      await sendOtp({ email: form.email, phone: form.phone }).unwrap()
      setTimer(60)
      setError('')
    } catch (err) {
      setError(err?.data?.message || 'Failed to resend OTP.')
    }
  }

  const handleVerifyAndRegister = async () => {
    setError('')
    if (!emailOtp || !phoneOtp) {
      setError('Please enter both OTP codes.')
      return
    }
    try {
      await verifyOtp({ email: form.email, phone: form.phone, emailOtp, phoneOtp }).unwrap()
      
      const payload = {
        company: {
          name: form.companyName,
          email: form.email,
          phone: form.phone,
        },
        user: {
          name: form.name,
          contact: {
            name: form.name,
            email: form.email,
            phone: form.phone,
            password: form.password,
          },
          password: form.password,
        }
      }
      if (planSlug) payload.planSlug = planSlug
      
      const refCode = searchParams.get('ref')
      if (refCode) payload.referralCode = refCode

      const result = await register(payload).unwrap()
      dispatch(setCredentials({
        user: result.data.user,
        token: result.data.tokens.accessToken,
        permissions: result.data.permissions || {},
        modules: result.data.modules || [],
        branches: result.data.branches || [],
        features: result.data.features || [],
        plan: result.data.plan || null,
        subscription: result.data.subscription || null,
      }))
      navigate('/dashboard')
    } catch (err) {
      setError(err?.data?.message || 'Registration failed. Please try again.')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--vz-body-bg)] p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-primary mb-1">⚡ SparkCRM</h1>
          <p className="text-sm text-[var(--vz-text-muted)]">Start your 30-day free trial</p>
        </div>

        <div className="bg-[var(--vz-card-bg)] border border-[var(--vz-border)] rounded-lg p-6" style={{ boxShadow: 'var(--vz-shadow)' }}>
          <div className="mb-6">
            <h5 className="text-lg font-semibold text-[var(--vz-heading)]">Create Account 🚀</h5>
            <p className="text-sm text-[var(--vz-text-muted)] mt-1">Get started with your free CRM account.</p>
          </div>

          {/* Plan badge — shown when user arrives from Pricing page with ?plan= param */}
          {planMeta && (() => {
            const Icon = planMeta.icon
            return (
              <div
                className="flex items-center gap-3 mb-4 p-3 rounded-lg border"
                style={{ background: planMeta.bg, borderColor: planMeta.color + '40' }}
              >
                <div className="shrink-0 w-8 h-8 rounded-md flex items-center justify-center" style={{ background: planMeta.bg }}>
                  <Icon size={16} style={{ color: planMeta.color }} />
                </div>
                <div>
                  <p className="text-xs font-semibold" style={{ color: planMeta.color }}>{planMeta.label}</p>
                  <p className="text-xs text-[var(--vz-text-muted)]">🎉 1 month free trial included</p>
                </div>
              </div>
            )
          })()}

          {error && <div className="mb-4 p-3 rounded-md bg-danger/10 text-danger text-sm">{error}</div>}

          {!otpStep ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input label="Company Name" placeholder="Enter company name" icon={Building2}
                value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} required />
              <Input label="Full Name" placeholder="Enter your name" icon={User}
                value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              <Input label="Email" type="email" placeholder="Enter email address" icon={Mail}
                value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              <Input label="Phone" type="tel" placeholder="+91 98765 43210" icon={Phone}
                value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/[^\d\+\-\(\)\s]/g, '') })} required />
              <Input label="Password" type="password" placeholder="Create password (min 8 chars)" icon={Lock}
                value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} />

              <div className="text-xs text-[var(--vz-text-muted)]">
                By registering you agree to our <a href="#" className="text-primary underline">Terms of Service</a>
              </div>

              <Button type="submit" className="w-full" disabled={isSendingOtp}>
                {isSendingOtp ? 'Sending OTP...' : 'Sign Up'}
              </Button>
            </form>
          ) : (
            <div className="space-y-4">
              <button 
                onClick={() => setOtpStep(false)} 
                className="text-sm text-primary flex items-center gap-1 hover:underline mb-2"
              >
                <ArrowLeft size={14} /> Back to details
              </button>
              
              <div className="p-3 bg-primary/10 rounded-lg text-sm text-[var(--vz-heading)] mb-4">
                Enter the 6-digit OTP sent to your email and phone.
                <div className="mt-1 text-xs text-[var(--vz-text-muted)]">(Dev mode: Use 123456)</div>
              </div>

              <Input label={`Email OTP (${form.email})`} placeholder="Enter 6-digit code" icon={Mail}
                value={emailOtp} onChange={(e) => setEmailOtp(e.target.value.replace(/\D/g, ''))} maxLength={6} required />
              
              <Input label={`Phone OTP (${form.phone})`} placeholder="Enter 6-digit code" icon={Phone}
                value={phoneOtp} onChange={(e) => setPhoneOtp(e.target.value.replace(/\D/g, ''))} maxLength={6} required />

              <Button onClick={handleVerifyAndRegister} className="w-full mt-2" disabled={isVerifyingOtp || isRegistering}>
                {isVerifyingOtp || isRegistering ? (
                  <span className="flex items-center justify-center gap-2"><Loader2 size={16} className="animate-spin" /> Verifying...</span>
                ) : 'Verify & Complete Registration'}
              </Button>
              
              <div className="text-center mt-3">
                {timer > 0 ? (
                  <p className="text-xs text-[var(--vz-text-muted)]">Resend OTP in {timer}s</p>
                ) : (
                  <button 
                    onClick={handleResendOtp} 
                    disabled={isSendingOtp}
                    className="text-xs text-primary font-medium hover:underline"
                  >
                    {isSendingOtp ? 'Sending...' : 'Resend OTP'}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-sm text-[var(--vz-text-muted)] mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-primary font-medium hover:underline">Sign In</Link>
        </p>

        <p className="text-center text-sm text-[var(--vz-text-muted)] mt-2">
          Want to see all plans?{' '}
          <Link to="/pricing" className="text-primary font-medium hover:underline">View Pricing</Link>
        </p>
      </div>
    </div>
  )
}
