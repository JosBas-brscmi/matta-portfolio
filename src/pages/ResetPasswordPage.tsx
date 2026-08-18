import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiClient as supabase } from '../services/apiClient'
import { updateOwnPassword } from '../services/authService'

// Reset flow:
// 1. User clicked the link in their email.
// 2. Supabase JS auto-parses the URL fragment (access_token, refresh_token,
//    type=recovery) and sets a recovery session.
// 3. onAuthStateChange fires with PASSWORD_RECOVERY event.
// 4. This page lets the user pick a new password, then calls updateUser.
export default function ResetPasswordPage() {
  const navigate = useNavigate()

  const [hasSession, setHasSession] = useState<boolean | null>(null)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  // Check if we arrived here with a valid recovery session
  useEffect(() => {
    let mounted = true

    // Give supabase-js a beat to parse the URL fragment and set the session.
    // We check twice: first immediately, then after 500ms in case parsing
    // is still in progress.
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (mounted) setHasSession(!!session)
    }

    check()
    const retryTimer = setTimeout(check, 500)

    return () => {
      mounted = false
      clearTimeout(retryTimer)
    }
  }, [])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)

    if (password.length < 8) {
      setErrorMsg('Password must be at least 8 characters.')
      return
    }
    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.')
      return
    }

    setSubmitting(true)
    const { error } = await updateOwnPassword(password)
    setSubmitting(false)

    if (error) {
      setErrorMsg((error as any)?.message)
      return
    }

    setDone(true)
    // Give user a moment to see the success message, then navigate
    setTimeout(() => navigate('/dashboard', { replace: true }), 1600)
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

        {done ? (
          <div className="auth-form">
            <div className="invite-success-icon">✓</div>
            <h1 className="auth-title">Password updated</h1>
            <p className="auth-subtitle">
              Your new password is now active. Redirecting you to your dashboard…
            </p>
          </div>
        ) : hasSession === false ? (
          <div className="auth-form">
            <h1 className="auth-title">Link expired or invalid</h1>
            <p className="auth-subtitle">
              This password reset link is no longer valid. Reset links expire after
              one hour and can only be used once.
            </p>
            <Link to="/forgot-password" className="btn btn-primary btn-block">
              Request a new link
            </Link>
            <p className="auth-footnote">
              <Link to="/login" className="auth-link">Back to sign in</Link>
            </p>
          </div>
        ) : hasSession === null ? (
          <div className="auth-form">
            <p className="auth-subtitle">Verifying your reset link…</p>
          </div>
        ) : (
          <form className="auth-form" onSubmit={handleSubmit} noValidate>
            <h1 className="auth-title">Choose a new password</h1>
            <p className="auth-subtitle">
              Pick something you'll remember. You use this to sign in every day.
            </p>

            <label className="auth-field">
              <span className="auth-label">New password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                disabled={submitting}
                required
                autoComplete="new-password"
                minLength={8}
                autoFocus
              />
            </label>

            <label className="auth-field">
              <span className="auth-label">Confirm new password</span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Type it again"
                disabled={submitting}
                required
                autoComplete="new-password"
                minLength={8}
              />
            </label>

            {errorMsg && (
              <div className="auth-error" role="alert">
                {errorMsg}
              </div>
            )}

            <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
              {submitting ? 'Updating…' : 'Set new password'}
            </button>
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
