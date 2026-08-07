import { useState } from 'react'
import { useDispatch } from 'react-redux'
import { useNavigate, Link } from 'react-router-dom'
import { setCredentials } from '../../slices/authSlice'
import { useLoginMutation } from '../../features/auth/authApi'
import Input from '../../components/ui/Input'
import Button from '../../components/ui/Button'
import { Mail, Lock, Eye, EyeOff } from 'lucide-react'

export default function Login() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const [login, { isLoading }] = useLoginMutation()
  const [form, setForm] = useState({ email: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    try {
      const result = await login(form).unwrap()
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
      setError(err.data?.message || 'Login failed. Please try again.')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--vz-body-bg)] p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-primary mb-1">⚡ SparkCRM</h1>
          <p className="text-sm text-[var(--vz-text-muted)]">Multi-Tenant CRM Dashboard</p>
        </div>

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
