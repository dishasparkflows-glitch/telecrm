import { useState } from 'react'
import { useDispatch } from 'react-redux'
import { useNavigate, Link } from 'react-router-dom'
import { setCredentials } from '../../slices/authSlice'
import { useLoginMutation, useLogin2FAMutation } from '../../features/auth/authApi'
import Input from '../../components/ui/Input'
import Button from '../../components/ui/Button'
import { Mail, Lock, Eye, EyeOff } from 'lucide-react'

export default function Login() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const [login, { isLoading }] = useLoginMutation()
  const [login2FA, { isLoading: is2FALoading }] = useLogin2FAMutation()
  const [form, setForm] = useState({ email: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [requires2FA, setRequires2FA] = useState(false)
  const [tempToken, setTempToken] = useState('')
  const [twoFactorCode, setTwoFactorCode] = useState(['', '', '', '', '', ''])
  const [trustDevice, setTrustDevice] = useState(false)
  const [isUsingRecoveryCode, setIsUsingRecoveryCode] = useState(false)
  const [recoveryCode, setRecoveryCode] = useState('')

  const handleCodeChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const newCode = [...twoFactorCode];
    newCode[index] = value;
    setTwoFactorCode(newCode);

    if (value && index < 5) {
      document.getElementById(`code-input-${index + 1}`).focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !twoFactorCode[index] && index > 0) {
      document.getElementById(`code-input-${index - 1}`).focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text').slice(0, 6).replace(/\D/g, '');
    if (pasteData) {
      const newCode = [...twoFactorCode];
      for (let i = 0; i < pasteData.length; i++) {
        newCode[i] = pasteData[i] || '';
      }
      setTwoFactorCode(newCode);
      const focusIndex = Math.min(pasteData.length, 5);
      document.getElementById(`code-input-${focusIndex}`).focus();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    try {
      const result = await login(form).unwrap()
      if (result.data?.requires2FA) {
        setRequires2FA(true)
        setTempToken(result.data.tempToken)
        return
      }
      handleLoginSuccess(result.data)
    } catch (err) {
      setError(err.data?.message || 'Login failed. Please try again.')
    }
  }

  const handle2FASubmit = async (e) => {
    e.preventDefault()
    setError('')
    
    let payload = { tempToken, trustDevice }
    
    if (isUsingRecoveryCode) {
      if (recoveryCode.length !== 8) return
      payload.backupCode = recoveryCode
    } else {
      const token = twoFactorCode.join('')
      if (token.length !== 6) return
      payload.token = token
    }

    try {
      const result = await login2FA(payload).unwrap()
      handleLoginSuccess(result.data)
    } catch (err) {
      setError(err.data?.message || 'Invalid code. Please try again.')
    }
  }

  const handleLoginSuccess = (data) => {
    dispatch(setCredentials({
      user: data.user,
      token: data.tokens.accessToken,
      permissions: data.permissions || {},
      modules: data.modules || [],
      branches: data.branches || [],
      features: data.features || [],
      plan: data.plan || null,
      subscription: data.subscription || null,
    }))
    navigate('/dashboard')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--vz-body-bg)] p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-primary mb-1">⚡ SparkCRM</h1>
          <p className="text-sm text-[var(--vz-text-muted)]">Multi-Tenant CRM Dashboard</p>
        </div>

        {!requires2FA ? (
          <div className="bg-[var(--vz-card-bg)] border border-[var(--vz-border)] rounded-lg p-6" style={{ boxShadow: 'var(--vz-shadow)' }}>
            <div className="mb-6">
              <h5 className="text-lg font-semibold text-[var(--vz-heading)]">Welcome Back! 👋</h5>
              <p className="text-sm text-[var(--vz-text-muted)] mt-1">Sign in to continue to SparkCRM.</p>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-md bg-danger/10 text-danger text-sm">{error}</div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Email" type="email" placeholder="Enter email address" icon={Mail}
                value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
              <div className="relative">
                <Input
                  label="Password" type={showPassword ? 'text' : 'password'} placeholder="Enter password" icon={Lock}
                  value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-9 text-[var(--vz-text-muted)] hover:text-[var(--vz-heading)] transition-colors">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 text-[var(--vz-text)]">
                  <input type="checkbox" className="rounded border-[var(--vz-input-border)]" />
                  Remember me
                </label>
                <Link to="/forgot-password" className="text-primary hover:underline">Forgot password?</Link>
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>
          </div>
        ) : (
          <div className="bg-[var(--vz-card-bg)] border border-[var(--vz-border)] rounded-xl overflow-hidden shadow-lg">
            <div className="p-8 pb-6 text-center">
              <h2 className="text-2xl font-bold text-[var(--vz-heading)] mb-2">Two-Factor Authentication</h2>
              <p className="text-sm text-[var(--vz-text-muted)] mb-8">
                {isUsingRecoveryCode ? 'Enter one of your 8-character recovery codes' : 'Enter the code generated by your authenticator app'}
              </p>

              {error && (
                <div className="mb-4 p-3 rounded-md bg-danger/10 text-danger text-sm">{error}</div>
              )}

              <form onSubmit={handle2FASubmit}>
                {isUsingRecoveryCode ? (
                  <div className="mb-8">
                    <Input
                      type="text"
                      placeholder="e.g. a1b2c3d4"
                      value={recoveryCode}
                      onChange={(e) => setRecoveryCode(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8))}
                      className="text-center text-xl font-mono tracking-widest bg-[var(--vz-input-bg)] border-[var(--vz-input-border)]"
                      autoFocus
                    />
                  </div>
                ) : (
                  <div className="flex justify-center gap-3 mb-8" onPaste={handlePaste}>
                    {twoFactorCode.map((digit, index) => (
                      <input
                        key={index}
                        id={`code-input-${index}`}
                        type="text"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleCodeChange(index, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(index, e)}
                        autoFocus={index === 0}
                        className="w-12 h-14 text-center text-xl font-semibold border border-[var(--vz-input-border)] bg-[var(--vz-input-bg)] text-[var(--vz-text)] rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                      />
                    ))}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={is2FALoading || (isUsingRecoveryCode ? recoveryCode.length !== 8 : twoFactorCode.join('').length !== 6)}
                  className="w-full mb-4"
                >
                  {is2FALoading ? 'Verifying...' : 'Verify'}
                </Button>

                <div className="flex flex-col items-center gap-3">
                  <button 
                    type="button" 
                    onClick={() => setIsUsingRecoveryCode(!isUsingRecoveryCode)}
                    className="text-sm text-primary hover:underline transition-colors"
                  >
                    {isUsingRecoveryCode ? 'Use authenticator app instead' : 'Use a recovery code'}
                  </button>
                  <button 
                    type="button" 
                    onClick={() => {
                      setRequires2FA(false)
                      setTempToken('')
                      setTwoFactorCode(['', '', '', '', '', ''])
                      setRecoveryCode('')
                      setIsUsingRecoveryCode(false)
                    }}
                    className="text-xs text-[var(--vz-text-muted)] hover:text-[var(--vz-heading)] transition-colors"
                  >
                    Back to login
                  </button>
                </div>
              </form>
            </div>

            <div className="bg-[var(--vz-body-bg)] px-8 py-5 border-t border-[var(--vz-border)] flex items-center justify-center gap-2">
              <input 
                type="checkbox" 
                id="trust-device" 
                checked={trustDevice} 
                onChange={(e) => setTrustDevice(e.target.checked)} 
                className="rounded border-[var(--vz-input-border)] text-primary focus:ring-primary w-4 h-4 cursor-pointer"
              />
              <label htmlFor="trust-device" className="text-sm text-[var(--vz-text)] cursor-pointer select-none">
                Trust this device for 30 days
              </label>
            </div>
          </div>
        )}

        <p className="text-center text-sm text-[var(--vz-text-muted)] mt-6">
          Don&apos;t have an account?{' '}
          <Link to="/register" className="text-primary font-medium hover:underline">Sign Up</Link>
        </p>
        <p className="text-center text-xs text-[var(--vz-text-muted)] mt-8">
          © {new Date().getFullYear()} SparkCRM. All rights reserved.
        </p>
      </div>
    </div>
  )
}
