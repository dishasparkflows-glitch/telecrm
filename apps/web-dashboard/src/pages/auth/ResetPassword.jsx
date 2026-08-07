import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Lock } from 'lucide-react'
import { useResetPasswordMutation } from '../../features/auth/authApi'
import Input from '../../components/ui/Input'
import Button from '../../components/ui/Button'

export default function ResetPassword() {
  const { token } = useParams()
  const [form, setForm] = useState({ password: '', confirmPassword: '' })
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [resetPassword, { isLoading }] = useResetPasswordMutation()

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    if (form.password.length < 8) return setError('Password must be at least 8 characters.')
    if (form.password !== form.confirmPassword) return setError('Passwords do not match.')
    try {
      await resetPassword({ token, newPassword: form.password }).unwrap()
      setMessage('Your password has been reset successfully.')
    } catch (requestError) {
      setError(requestError.data?.message || 'This reset link is invalid or expired.')
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-[var(--vz-body-bg)] p-4">
      <section className="w-full max-w-md bg-[var(--vz-card-bg)] border border-[var(--vz-border)] rounded-lg p-6" aria-labelledby="reset-title">
        <h1 id="reset-title" className="text-xl font-semibold text-[var(--vz-heading)]">Reset password</h1>
        <p className="text-sm text-[var(--vz-text-muted)] mt-1 mb-5">Choose a new password for your account.</p>
        {message ? (
          <div role="status" className="space-y-4">
            <p className="p-3 rounded-md bg-secondary/10 text-secondary">{message}</p>
            <Link className="text-primary font-medium hover:underline" to="/login">Return to sign in</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <p role="alert" className="p-3 rounded-md bg-danger/10 text-danger">{error}</p>}
            <Input label="New password" type="password" icon={Lock} autoComplete="new-password" required value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
            <Input label="Confirm password" type="password" icon={Lock} autoComplete="new-password" required value={form.confirmPassword} onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })} />
            <Button className="w-full" type="submit" disabled={isLoading}>{isLoading ? 'Resetting…' : 'Reset password'}</Button>
          </form>
        )}
      </section>
    </main>
  )
}
