import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForgotPasswordMutation } from '../../features/auth/authApi'
import Input from '../../components/ui/Input'
import Button from '../../components/ui/Button'
import { Mail, ArrowLeft } from 'lucide-react'

export default function ForgotPassword() {
  const [forgotPassword, { isLoading }] = useForgotPasswordMutation()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    try {
      await forgotPassword({ email }).unwrap()
      setSent(true)
    } catch (err) {
      setError(err.data?.message || 'Failed to send reset link.')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--vz-body-bg)] p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-primary mb-1">⚡ SparkCRM</h1>
        </div>

        <div className="bg-[var(--vz-card-bg)] border border-[var(--vz-border)] rounded-lg p-6" style={{ boxShadow: 'var(--vz-shadow)' }}>
          {sent ? (
            <div className="text-center py-4">
              <div className="w-14 h-14 mx-auto rounded-full bg-secondary/10 flex items-center justify-center mb-4">
                <Mail size={24} className="text-secondary" />
              </div>
              <h5 className="text-lg font-semibold text-[var(--vz-heading)] mb-2">Check your email</h5>
              <p className="text-sm text-[var(--vz-text-muted)]">
                We sent a password reset link to <strong className="text-[var(--vz-heading)]">{email}</strong>
              </p>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h5 className="text-lg font-semibold text-[var(--vz-heading)]">Forgot Password? 🔒</h5>
                <p className="text-sm text-[var(--vz-text-muted)] mt-1">Enter your email to receive a reset link.</p>
              </div>

              {error && <div className="mb-4 p-3 rounded-md bg-danger/10 text-danger text-sm">{error}</div>}

              <form onSubmit={handleSubmit} className="space-y-4">
                <Input label="Email" type="email" placeholder="Enter email address" icon={Mail}
                  value={email} onChange={(e) => setEmail(e.target.value)} />
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? 'Sending...' : 'Send Reset Link'}
                </Button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-sm text-[var(--vz-text-muted)] mt-6">
          <Link to="/login" className="text-primary font-medium hover:underline inline-flex items-center gap-1">
            <ArrowLeft size={14} /> Back to Sign In
          </Link>
        </p>
      </div>
    </div>
  )
}
