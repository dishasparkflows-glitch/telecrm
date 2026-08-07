import { useState } from 'react'
import { useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { setCredentials } from '../../slices/authSlice'
import { useOwnerLoginMutation } from '../../features/owner/ownerApi'
import Input from '../../components/ui/Input'
import Button from '../../components/ui/Button'
import { Mail, Lock, Eye, EyeOff, Shield } from 'lucide-react'

export default function OwnerLogin() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const [ownerLogin, { isLoading }] = useOwnerLoginMutation()
  const [form, setForm] = useState({ email: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    try {
      const result = await ownerLogin(form).unwrap()
      dispatch(setCredentials({
        user: { ...result.data.user, role: 'owner' },
        token: result.data.tokens.accessToken,
        permissions: {},
        modules: [],
        branches: [],
      }))
      navigate('/owner')
    } catch (err) {
      setError(err.data?.message || 'Login failed. Please try again.')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--vz-body-bg)] p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
            <Shield size={32} className="text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-primary mb-1">⚡ SparkCRM</h1>
          <p className="text-sm text-[var(--vz-text-muted)]">System Owner Panel</p>
        </div>

        <div className="bg-[var(--vz-card-bg)] border border-[var(--vz-border)] rounded-lg p-6" style={{ boxShadow: 'var(--vz-shadow)' }}>
          <div className="mb-6">
            <h5 className="text-lg font-semibold text-[var(--vz-heading)]">Owner Login 👑</h5>
            <p className="text-sm text-[var(--vz-text-muted)] mt-1">Sign in to the system owner panel.</p>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-md bg-danger/10 text-danger text-sm">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email" type="email" placeholder="Enter owner email" icon={Mail}
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

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Signing in...' : 'Sign In as Owner'}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-[var(--vz-text-muted)] mt-8">
          © {new Date().getFullYear()} SparkCRM. System Owner Access Only.
        </p>
      </div>
    </div>
  )
}
