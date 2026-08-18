import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { signUpWithEmail, createOwnTraineeRow } from '../services/authService'

const BROWAVE_EMAIL_REGEX = /^[^\s@]+@browave\.com$/i

function defaultBatchCode(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `MATTA-${year}-${month}`
}

export default function SignUpPage() {
  const navigate = useNavigate()

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [employeeId, setEmployeeId] = useState('')
  const [batchCode, setBatchCode] = useState(defaultBatchCode())
  const [education, setEducation] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)

    // ---- Client-side validation ----
    if (!fullName.trim()) {
      setErrorMsg('Please enter your full name.')
      return
    }
    if (!BROWAVE_EMAIL_REGEX.test(email.trim())) {
      setErrorMsg('Please use your @browave.com email address.')
      return
    }
    if (!employeeId.trim()) {
      setErrorMsg('Please enter your employee ID.')
      return
    }
    if (!batchCode.trim()) {
      setErrorMsg('Please enter your batch code (e.g. MATTA-2026-06).')
      return
    }
    if (password.length < 8) {
      setErrorMsg('Password must be at least 8 characters.')
      return
    }
    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.')
      return
    }

    setSubmitting(true)

    // ---- Step 1: create the auth user ----
    const cleanEmail = email.trim().toLowerCase()
    const { data: signUpData, error: signUpError } = await signUpWithEmail(
      cleanEmail,
      password,
      fullName.trim(),
    )

    if (signUpError || !signUpData.user) {
      setSubmitting(false)
      setErrorMsg(signUpError?.message ?? 'Failed to create account.')
      return
    }

    // If no session, email confirmation is still required in Supabase
    if (!signUpData.session) {
      setSubmitting(false)
      setErrorMsg(
        'Account created. Please check your email to confirm your address, then sign in. (If you do not receive an email, contact the MA Center.)',
      )
      return
    }

    // ---- Step 2: create the trainees row ----
    const { error: traineeError } = await createOwnTraineeRow({
      user_id: signUpData.user.id,
      employee_id: employeeId.trim(),
      batch_code: batchCode.trim(),
      education: education.trim() || undefined,
    })

    if (traineeError) {
      setSubmitting(false)
      // Common case: duplicate employee_id
      if (traineeError.message.toLowerCase().includes('duplicate')) {
        setErrorMsg(
          'This employee ID is already registered. If you previously created an account, please sign in instead.',
        )
      } else {
        setErrorMsg(
          `Account created, but we could not save your trainee details: ${traineeError.message}. Please contact the MA Center to finish setup.`,
        )
      }
      return
    }

    setSubmitting(false)
    navigate('/dashboard', { replace: true })
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

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <h1 className="auth-title">Start your MATTA journey</h1>
          <p className="auth-subtitle">
            Use your <strong>@browave.com</strong> email to create your account.
            You will own and maintain your learning portfolio for the next six months.
          </p>

          <div className="form-grid">
            <label className="auth-field full">
              <span className="auth-label">Full name</span>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Juan Dela Cruz"
                disabled={submitting}
                required
                autoComplete="name"
              />
            </label>

            <label className="auth-field full">
              <span className="auth-label">Work email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@browave.com"
                disabled={submitting}
                required
                autoComplete="email"
              />
            </label>

            <label className="auth-field">
              <span className="auth-label">Employee ID</span>
              <input
                type="text"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                placeholder="e.g. EMP-0042"
                disabled={submitting}
                required
              />
            </label>

            <label className="auth-field">
              <span className="auth-label">Batch code</span>
              <input
                type="text"
                value={batchCode}
                onChange={(e) => setBatchCode(e.target.value)}
                placeholder="MATTA-YYYY-MM"
                disabled={submitting}
                required
              />
            </label>

            <label className="auth-field full">
              <span className="auth-label">Education (optional)</span>
              <input
                type="text"
                value={education}
                onChange={(e) => setEducation(e.target.value)}
                placeholder="e.g. BS Industrial Engineering, UP Diliman"
                disabled={submitting}
              />
            </label>

            <label className="auth-field">
              <span className="auth-label">Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                disabled={submitting}
                required
                autoComplete="new-password"
                minLength={8}
              />
            </label>

            <label className="auth-field">
              <span className="auth-label">Confirm password</span>
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
          </div>

          {errorMsg && (
            <div className="auth-error" role="alert">
              {errorMsg}
            </div>
          )}

          <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
            {submitting ? 'Creating your account…' : 'Create my account'}
          </button>

          <p className="auth-footnote">
            Already have an account?{' '}
            <Link to="/login" className="auth-link">Sign in instead</Link>
          </p>
        </form>
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
