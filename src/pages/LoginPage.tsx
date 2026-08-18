import {
  useState,
  type FormEvent,
} from 'react'
import {
  Link,
  useNavigate,
} from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

function getErrorMessage(error: unknown): string | null {
  if (!error) {
    return null
  }

  if (typeof error === 'string') {
    return error
  }

  if (error instanceof Error) {
    return error.message
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return error.message
  }

  return 'Unable to sign in. Please try again.'
}

export default function LoginPage() {
  const navigate = useNavigate()
  const { signIn } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const handleSubmit = async (
    e: FormEvent<HTMLFormElement>,
  ) => {
    e.preventDefault()
    setErrorMsg(null)

    const cleanEmail = email.trim()
    const cleanPassword = password

    if (!cleanEmail || !cleanPassword) {
      setErrorMsg(
        'Please enter both email and password.',
      )
      return
    }

    setSubmitting(true)

    try {
      const result = await signIn(
        cleanEmail,
        cleanPassword,
      )

      console.log(
        '[LoginPage] sign-in result:',
        result,
      )

      const errorMessage = getErrorMessage(
        result?.error,
      )

      if (errorMessage) {
        if (
          errorMessage
            .toLowerCase()
            .includes('invalid') ||
          errorMessage
            .toLowerCase()
            .includes('credential') ||
          errorMessage
            .toLowerCase()
            .includes('password')
        ) {
          setErrorMsg(
            'That email or password does not match.',
          )
        } else {
          setErrorMsg(errorMessage)
        }

        return
      }

      /*
       * IMPORTANT:
       *
       * Do NOT navigate back to location.state.from.
       *
       * The previous page may have been an admin page from
       * another user's session.
       *
       * Every successful login starts from /dashboard.
       *
       * AdminShell / DashboardPage can then render the
       * appropriate UI based on the authenticated profile.
       */
      console.log(
        '[LoginPage] login successful; navigating to /dashboard',
      )

      navigate('/dashboard', {
        replace: true,
      })
    } catch (error) {
      console.error(
        '[LoginPage] unexpected login error:',
        error,
      )

      setErrorMsg(
        getErrorMessage(error) ??
          'Unable to sign in. Please try again.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-pane">
        <Link
          to="/"
          className="auth-brand"
        >
          <div className="brand-mark">
            <img
              src="./matta-logo.png"
              alt="MATTA"
            />
          </div>

          <div className="brand-text">
            <span className="brand-text-main">
              MATTA
            </span>

            <span className="brand-text-sub">
              Learning Portfolio
            </span>
          </div>
        </Link>

        <form
          className="auth-form"
          onSubmit={handleSubmit}
          noValidate
        >
          <h1 className="auth-title">
            Welcome back
          </h1>

          <p className="auth-subtitle">
            Sign in to continue your MATTA journey.
          </p>

          <label className="auth-field">
            <span className="auth-label">
              Work email
            </span>

            <input
              type="email"
              value={email}
              onChange={(e) =>
                setEmail(e.target.value)
              }
              placeholder="you@browave.com"
              autoComplete="username"
              disabled={submitting}
              required
            />
          </label>

          <label className="auth-field">
            <span className="auth-label auth-label-row">
              <span>Password</span>

              <Link
                to="/forgot-password"
                className="auth-label-link"
              >
                Forgot?
              </Link>
            </span>

            <input
              type="password"
              value={password}
              onChange={(e) =>
                setPassword(e.target.value)
              }
              placeholder="Enter your password"
              autoComplete="current-password"
              disabled={submitting}
              required
            />
          </label>

          {errorMsg && (
            <div
              className="auth-error"
              role="alert"
            >
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary btn-block"
            disabled={submitting}
          >
            {submitting
              ? 'Signing in…'
              : 'Sign in'}
          </button>

          <p className="auth-footnote">
            New to MATTA?{' '}

            <Link
              to="/signup"
              className="auth-link"
            >
              Create an account with your
              {' '}@browave.com email
            </Link>
          </p>
        </form>
      </div>

      <aside className="auth-aside">
        <blockquote className="auth-quote">
          <p>
            "The portfolio is more than a record —
            it's the story of who you are becoming
            as a leader at Browave."
          </p>

          <footer>
            — MATTA Program Charter
          </footer>
        </blockquote>
      </aside>
    </div>
  )
}