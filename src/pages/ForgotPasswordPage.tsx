import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { sendPasswordResetEmail } from '../services/authService'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)

    if (!email.trim()) {
      setErrorMsg('Please enter your registered email.')
      return
    }

    setSubmitting(true)
    const { error } = await sendPasswordResetEmail(email.trim().toLowerCase())
    setSubmitting(false)

    if (error) {
      setErrorMsg((error as any)?.message)
      return
    }

    // We show the neutral "check your inbox" state regardless.
    setSent(true)
  }

  return (
    <div className="auth-shell">
      <div className="auth-pane">
        <Link to="/" className="auth-brand">
          <div className="brand-mark">
            <img src=".\matta-logo.png" alt="MATTA" />
          </div>
          <div className="brand-text">
            <span className="brand-text-main">MATTA</span>
            <span className="brand-text-sub">Learning Portfolio</span>
          </div>
        </Link>

        {sent ? (
          <div className="auth-form">
            <div className="invite-success-icon">✉</div>
            <h1 className="auth-title">Check your email</h1>
            <p className="auth-subtitle">
              If <strong>{email}</strong> is a registered MATTA account, we sent a
              secure link there. Click it to choose a new password.
            </p>
            <p className="auth-hint-block">
              The link expires in <strong>1 hour</strong>. If it does not arrive
              within a few minutes, check your spam folder, or try again.
            </p>

            <Link to="/login" className="btn btn-primary btn-block">
              Back to sign in
            </Link>

            <p className="auth-footnote">
              Didn't get anything?{' '}
              <button
                type="button"
                className="auth-link auth-link-btn"
                onClick={() => {
                  setSent(false)
                  setErrorMsg(null)
                }}
              >
                Try a different email
              </button>
            </p>
          </div>
        ) : (
          <form className="auth-form" onSubmit={handleSubmit} noValidate>
            <h1 className="auth-title">Forgot your password?</h1>
            <p className="auth-subtitle">
              Enter the <strong>@browave.com</strong> email you registered with. We
              will send you a secure link to choose a new password.
            </p>

            <label className="auth-field">
              <span className="auth-label">Registered email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@browave.com"
                autoComplete="username"
                disabled={submitting}
                required
              />
            </label>

            {errorMsg && (
              <div className="auth-error" role="alert">
                {errorMsg}
              </div>
            )}

            <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
              {submitting ? 'Sending link…' : 'Send reset link'}
            </button>

            <p className="auth-footnote">
              Remembered it?{' '}
              <Link to="/login" className="auth-link">Back to sign in</Link>
            </p>
          </form>
        )}
      </div>

      <aside className="auth-aside">
        <blockquote className="auth-quote">
          <p>
            "The portfolio is more than a record — it's the story of who
            you are becoming as a leader at Browave."
          </p>
          <footer>— MATTA Program Charter</footer>
        </blockquote>
      </aside>
    </div>
  )
}
