import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import { useGetAllPlansQuery } from '../features/tenant/tenantApi'
import { useRegisterTenantMutation, useSendOtpMutation, useVerifyOtpMutation } from '../features/auth/authApi'
import { setCredentials } from '../slices/authSlice'
import {
  Zap, Star, Crown, Shield, ArrowRight, ArrowLeft, Check, X,
  Building2, User, Mail, Phone, Lock, Loader2, ShieldCheck,
  Users, BarChart3, MessageCircle, HardDrive, Eye, EyeOff
} from 'lucide-react'
import './pricing.css'

/* ─── Plan metadata ─── */
const PLAN_META = {
  free:         { icon: Zap,    color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
  basic:        { icon: Star,   color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
  professional: { icon: Crown,  color: '#6C47FF', bg: 'rgba(108,71,255,0.1)' },
  enterprise:   { icon: Shield, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
}

const LIMIT_ICONS = { maxUsers: Users, maxLeadsPerMonth: BarChart3, maxCallsPerDay: Phone, maxWhatsAppPerDay: MessageCircle, maxStorage: HardDrive }
const LIMIT_LABELS = { maxUsers: 'Users', maxLeadsPerMonth: 'Leads/mo', maxCallsPerDay: 'Calls/day', maxWhatsAppPerDay: 'WhatsApp/day', maxStorage: 'Storage' }

const FALLBACK_PLANS = [
  { name: 'Free', slug: 'free', price: 0, yearlyPrice: 0, features: ['Lead Management', 'Basic CRM', 'Email Support'], limits: { maxUsers: 1, maxLeadsPerMonth: 100, maxStorage: 0.5 }},
  { name: 'Basic', slug: 'basic', price: 999, yearlyPrice: 9990, features: ['All Free features', 'Automations', 'WhatsApp', 'Analytics'], limits: { maxUsers: 5, maxLeadsPerMonth: 2000, maxCallsPerDay: 100, maxWhatsAppPerDay: 200, maxStorage: 2 }},
  { name: 'Professional', slug: 'professional', price: 1999, yearlyPrice: 19990, features: ['All Basic features', 'Advanced Reports', 'Priority Support', 'API Access'], limits: { maxUsers: 15, maxLeadsPerMonth: 10000, maxCallsPerDay: 500, maxWhatsAppPerDay: 1000, maxStorage: 10 }},
  { name: 'Enterprise', slug: 'enterprise', price: 4999, yearlyPrice: 49990, features: ['All Pro features', 'Unlimited Everything', 'Dedicated Support', 'Custom Integrations'], limits: { maxUsers: -1, maxLeadsPerMonth: -1, maxCallsPerDay: -1, maxWhatsAppPerDay: -1, maxStorage: -1 }},
]

function formatLimit(key, val) {
  if (val === -1 || val === null || val === undefined) return `Unlimited ${LIMIT_LABELS[key] || key}`
  if (key === 'maxStorage') return `${val} GB Storage`
  return `${val.toLocaleString('en-IN')} ${LIMIT_LABELS[key] || key}`
}

/* ─── Plan Card ─── */
function PlanCard({ plan, isYearly, isPopular, onSelect }) {
  const meta = PLAN_META[plan.slug] || PLAN_META.basic
  const Icon = meta.icon
  const price = plan.price === 0 ? 0 : isYearly ? Math.round((plan.yearlyPrice || plan.price * 10) / 12) : plan.price
  const yearlySave = plan.price > 0 ? (plan.price * 12) - (plan.yearlyPrice || plan.price * 10) : 0

  return (
    <div className={`plan-card ${isPopular ? 'popular' : ''}`}>
      {isPopular && <div className="popular-badge">Most Popular</div>}
      <div className="plan-icon" style={{ background: meta.bg }}><Icon size={26} style={{ color: meta.color }} /></div>
      <h3 className="plan-name">{plan.name}</h3>
      <p className="plan-desc">{plan.slug === 'free' ? 'Basic CRM features for individuals' : plan.slug === 'basic' ? 'Essential CRM for small teams' : plan.slug === 'professional' ? 'Advanced CRM for growing teams' : 'Unlimited CRM for large organizations'}</p>
      <div className="plan-price">
        {price === 0 ? <span className="price-amount">Free</span> : (
          <><span className="price-currency">₹</span><span className="price-amount">{price.toLocaleString('en-IN')}</span><span className="price-period">/mo</span></>
        )}
      </div>
      {isYearly && yearlySave > 0 && <div className="price-savings">Save ₹{yearlySave.toLocaleString('en-IN')}/year</div>}
      <div className="plan-trial-badge">🎉 1 Month Free Trial</div>
      <button className="plan-select-btn" style={{ background: meta.color }} onClick={() => onSelect(plan)}>Start Free Trial <ArrowRight size={16} /></button>
      <div className="plan-limits">
        {Object.entries(plan.limits || {}).filter(([k]) => LIMIT_ICONS[k]).map(([k, v]) => {
          const LIcon = LIMIT_ICONS[k]
          return <div key={k} className="limit-item"><LIcon size={14} /> {formatLimit(k, v)}</div>
        })}
      </div>
      <div className="plan-features">
        <div className="features-title">Features</div>
        {(plan.features || []).slice(0, 5).map((f, i) => (
          <div key={i} className="feature-check"><Check size={14} style={{ color: meta.color }} /> {typeof f === 'string' ? f : f.name}</div>
        ))}
        {(plan.features || []).length > 5 && <div className="features-more">+{plan.features.length - 5} more</div>}
      </div>
    </div>
  )
}

/* ─── OTP Verification Step ─── */
function OtpVerification({ email, phone, onVerified, onBack }) {
  const [emailOtp, setEmailOtp] = useState('')
  const [phoneOtp, setPhoneOtp] = useState('')
  const [error, setError] = useState('')
  const [timer, setTimer] = useState(60)
  const [verifyOtp, { isLoading: verifying }] = useVerifyOtpMutation()
  const [sendOtp, { isLoading: resending }] = useSendOtpMutation()
  const emailRef = useRef()

  useEffect(() => { emailRef.current?.focus() }, [])
  useEffect(() => {
    if (timer <= 0) return
    const t = setTimeout(() => setTimer(s => s - 1), 1000)
    return () => clearTimeout(t)
  }, [timer])

  const handleVerify = async () => {
    if (!emailOtp || !phoneOtp) { setError('Please enter both OTP codes.'); return }
    try {
      await verifyOtp({ email, phone, emailOtp, phoneOtp }).unwrap()
      onVerified()
    } catch (err) {
      setError(err?.data?.message || 'Verification failed. Please try again.')
    }
  }

  const handleResend = async () => {
    try {
      await sendOtp({ email, phone }).unwrap()
      setTimer(60)
      setError('')
    } catch (err) {
      setError(err?.data?.message || 'Failed to resend OTP.')
    }
  }

  return (
    <div className="registration-overlay">
      <div className="registration-panel">
        <button className="reg-close" onClick={onBack}><X size={18} /></button>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(108,71,255,0.1)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <ShieldCheck size={28} style={{ color: '#6C47FF' }} />
          </div>
          <h2 className="reg-title">Verify Your Identity</h2>
          <p className="reg-subtitle">Enter the 6-digit OTP sent to your email and phone</p>
        </div>
        {error && <div className="reg-error">{error}</div>}
        <div className="reg-form">
          <div className="reg-field">
            <label><Mail size={14} /> Email OTP <span style={{ color: '#9ca3af', fontWeight: 400 }}>({email})</span></label>
            <input ref={emailRef} type="text" maxLength={6} value={emailOtp} onChange={e => setEmailOtp(e.target.value.replace(/\D/g, ''))} placeholder="Enter 6-digit code" inputMode="numeric" />
          </div>
          <div className="reg-field">
            <label><Phone size={14} /> Phone OTP <span style={{ color: '#9ca3af', fontWeight: 400 }}>({phone})</span></label>
            <input type="text" maxLength={6} value={phoneOtp} onChange={e => setPhoneOtp(e.target.value.replace(/\D/g, ''))} placeholder="Enter 6-digit code" inputMode="numeric" />
          </div>
          <div className="reg-payment-skip">
            <ShieldCheck size={18} />
            <div>
              <strong>Development Mode</strong>
              <span>Use OTP: <strong style={{ color: '#6C47FF' }}>123456</strong> for both fields</span>
            </div>
          </div>
          <button className="reg-submit" style={{ background: '#6C47FF' }} onClick={handleVerify} disabled={verifying}>
            {verifying ? <><Loader2 size={18} className="spin" /> Verifying...</> : <>Verify & Continue <ArrowRight size={16} /></>}
          </button>
          <p style={{ textAlign: 'center', fontSize: '0.85rem', color: '#6b7280', margin: 0 }}>
            {timer > 0 ? `Resend OTP in ${timer}s` : (
              <button onClick={handleResend} disabled={resending} style={{ background: 'none', border: 'none', color: '#6C47FF', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit' }}>
                {resending ? 'Sending...' : 'Resend OTP'}
              </button>
            )}
          </p>
        </div>
      </div>
    </div>
  )
}

/* ─── Registration Form ─── */
function RegistrationForm({ selectedPlan, onBack, onOtpRequired }) {
  const meta = PLAN_META[selectedPlan?.slug] || PLAN_META.basic
  const Icon = meta.icon
  const [form, setForm] = useState({ companyName: '', name: '', email: '', phone: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [sendOtp, { isLoading }] = useSendOtpMutation()

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!form.companyName || !form.name || !form.email || !form.phone || !form.password) {
      setError('All fields are required'); return
    }
    if (form.password.length < 8) { setError('Password must be at least 8 characters'); return }
    try {
      await sendOtp({ email: form.email, phone: form.phone }).unwrap()
      onOtpRequired(form)
    } catch (err) {
      setError(err?.data?.message || 'Failed to send OTP. Please check your details.')
    }
  }

  return (
    <div className="registration-overlay">
      <div className="registration-panel">
        <button className="reg-close" onClick={onBack}><X size={18} /></button>
        <div className="reg-plan-summary">
          <div className="reg-plan-icon" style={{ background: meta.bg }}><Icon size={22} style={{ color: meta.color }} /></div>
          <div>
            <div className="reg-plan-name">{selectedPlan.name} Plan</div>
            <div className="reg-plan-trial">🎉 1 Month Free Trial — No payment required</div>
          </div>
        </div>
        <h2 className="reg-title">Create Your Account</h2>
        <p className="reg-subtitle">Start your free trial in 30 seconds</p>
        {error && <div className="reg-error">{error}</div>}
        <form className="reg-form" onSubmit={handleSubmit}>
          <div className="reg-field">
            <label><Building2 size={14} /> Company Name *</label>
            <input name="companyName" value={form.companyName} onChange={handleChange} placeholder="Your company name" required />
          </div>
          <div className="reg-field">
            <label><User size={14} /> Full Name *</label>
            <input name="name" value={form.name} onChange={handleChange} placeholder="Your full name" required />
          </div>
          <div className="reg-field">
            <label><Mail size={14} /> Email Address *</label>
            <input name="email" type="email" value={form.email} onChange={handleChange} placeholder="you@company.com" required />
          </div>
          <div className="reg-field">
            <label><Phone size={14} /> Mobile Number *</label>
            <input name="phone" value={form.phone} onChange={handleChange} placeholder="+91 98765 43210" required />
          </div>
          <div className="reg-field">
            <label><Lock size={14} /> Password *</label>
            <div style={{ position: 'relative' }}>
              <input name="password" type={showPassword ? 'text' : 'password'} value={form.password} onChange={handleChange} placeholder="Min. 8 characters" required minLength={8} style={{ paddingRight: '40px' }} />
              <button 
                type="button" 
                onClick={() => setShowPassword(!showPassword)}
                style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                tabIndex="-1"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div className="reg-payment-skip">
            <ShieldCheck size={18} />
            <div>
              <strong>No payment required</strong>
              <span>Enjoy full {selectedPlan.name} features free for 1 month. You can upgrade anytime from Settings.</span>
            </div>
          </div>
          <button type="submit" className="reg-submit" style={{ background: meta.color }} disabled={isLoading}>
            {isLoading ? <><Loader2 size={18} className="spin" /> Sending OTP...</> : <>Continue to Verify <ArrowRight size={16} /></>}
          </button>
          <p className="reg-terms">By signing up you agree to our <a href="#">Terms of Service</a> and <a href="#">Privacy Policy</a></p>
        </form>
      </div>
    </div>
  )
}

/* ─── Success Message ─── */
function SuccessMessage() {
  return (
    <div className="success-overlay">
      <div className="success-panel">
        <div className="success-icon">🎉</div>
        <h2>Account Created!</h2>
        <p>Setting up your dashboard...</p>
        <div className="success-loader" />
      </div>
    </div>
  )
}

/* ─── Main Pricing Page ─── */
export default function Pricing() {
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const { data: plansResponse } = useGetAllPlansQuery()
  const [register] = useRegisterTenantMutation()

  const [isYearly, setIsYearly] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState(null)
  const [formData, setFormData] = useState(null)
  const [otpStep, setOtpStep] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  const plans = (plansResponse?.data || FALLBACK_PLANS).filter(p => !p.isTrial)

  const handleOtpRequired = (data) => {
    setFormData(data)
    setOtpStep(true)
  }

  const handleOtpVerified = async () => {
    setOtpStep(false)
    setShowSuccess(true)
    try {
      const payload = {
        company: {
          name: formData.companyName,
          email: formData.email,
          phone: formData.phone,
        },
        user: {
          name: formData.name,
          contact: {
            name: formData.name,
            email: formData.email,
            phone: formData.phone,
            password: formData.password,
          },
          password: formData.password,
        },
        companyName: formData.companyName,
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        password: formData.password,
        planSlug: selectedPlan?.slug || 'free',
      }
      const result = await register(payload).unwrap()
      if (result?.data) {
        dispatch(setCredentials({
          user: result.data.user,
          token: result.data.tokens.accessToken,
          permissions: result.data.permissions,
          modules: result.data.modules,
          branches: result.data.branches,
          features: result.data.features || [],
          plan: result.data.plan || null,
          subscription: result.data.subscription || null,
        }))
        setTimeout(() => navigate('/dashboard', { replace: true }), 2000)
      }
    } catch {
      setShowSuccess(false)
    }
  }

  return (
    <div className="pricing-page">
      {/* Nav */}
      <nav className="pricing-nav">
        <div className="pricing-container nav-row">
          <Link to="/" className="pricing-logo">⚡ SparkCRM</Link>
          <Link to="/" className="pricing-back-link"><ArrowLeft size={14} /> Back to Home</Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="pricing-hero">
        <div className="pricing-container">
          <div className="pricing-badge">🚀 All plans include 1-month free trial</div>
          <h1>Choose the perfect plan for your team</h1>
          <p>Start free, upgrade when you're ready. No credit card required.</p>
          <div className="billing-toggle">
            <span className={!isYearly ? 'active' : ''}>Monthly</span>
            <button className="toggle-switch" onClick={() => setIsYearly(!isYearly)}>
              <span className={`toggle-knob ${isYearly ? 'yearly' : ''}`} />
            </button>
            <span className={isYearly ? 'active' : ''}>Yearly <span className="save-tag">Save 17%</span></span>
          </div>
        </div>
      </section>

      {/* Plans */}
      <section className="plans-section">
        <div className="pricing-container">
          <div className="plans-grid">
            {plans.map((plan) => (
              <PlanCard key={plan.slug || plan._id} plan={plan} isYearly={isYearly} isPopular={plan.slug === 'professional'} onSelect={setSelectedPlan} />
            ))}
          </div>
        </div>
      </section>

      {/* Guarantee */}
      <section className="pricing-guarantee">
        <div className="pricing-container">
          <div className="guarantee-inner">
            <ShieldCheck size={40} />
            <div>
              <h3>30-Day Money-Back Guarantee</h3>
              <p>Try SparkCRM risk-free. If you're not satisfied, get a full refund within 30 days. No questions asked.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Registration overlay */}
      {selectedPlan && !otpStep && !showSuccess && (
        <RegistrationForm selectedPlan={selectedPlan} onBack={() => setSelectedPlan(null)} onOtpRequired={handleOtpRequired} />
      )}

      {/* OTP Verification */}
      {otpStep && formData && (
        <OtpVerification email={formData.email} phone={formData.phone} onVerified={handleOtpVerified} onBack={() => setOtpStep(false)} />
      )}

      {/* Success */}
      {showSuccess && <SuccessMessage />}
    </div>
  )
}
