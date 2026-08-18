import { useState, type FormEvent } from 'react'
import Modal from '../../components/Modal'
import { inviteTrainee, type InviteResult } from '../../services/traineeService'

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

// Default to a batch code that reflects the current year/month, e.g. MATTA-2026-01.
function defaultBatchCode(): string {
  const now = new Date()
  return `MATTA-${now.getFullYear()}-01`
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function InviteTraineeModal({ open, onClose, onSuccess }: Props) {
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [employeeId, setEmployeeId] = useState('')
  const [batchCode, setBatchCode] = useState(defaultBatchCode())
  const [onboardDate, setOnboardDate] = useState(todayISO())
  const [department, setDepartment] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successData, setSuccessData] = useState<InviteResult | null>(null)
  const [copied, setCopied] = useState(false)

  const reset = () => {
    setEmail('')
    setFullName('')
    setEmployeeId('')
    setBatchCode(defaultBatchCode())
    setOnboardDate(todayISO())
    setDepartment('')
    setSubmitting(false)
    setErrorMsg(null)
    setSuccessData(null)
    setCopied(false)
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)
    setSubmitting(true)

    const result = await inviteTrainee({
      email,
      full_name: fullName,
      employee_id: employeeId,
      batch_code: batchCode,
      onboard_date: onboardDate,
      department: department || undefined,
    })

    setSubmitting(false)

    if (!result.ok) {
      setErrorMsg(result.error)
      return
    }

    setSuccessData(result.result)
    onSuccess()
  }

  const handleCopyCredentials = async () => {
    if (!successData) return
    const signInUrl = window.location.origin + '/matta/login'
    const text = `MATTA Portfolio account\n\nEmail: ${successData.email}\nTemporary password: ${successData.temp_password}\n\nSign in at: ${signInUrl}`
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // ignore
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title={successData ? 'Trainee created' : 'Invite a new trainee'}>
      {successData ? (
        <div className="invite-success">
          <div className="invite-success-icon">✓</div>
          <p className="invite-success-text">
            <strong>{fullName}</strong> has been added to MATTA. Share the credentials
            below with them through a secure channel (in person, encrypted message, etc.).
            They can change the password after their first sign-in.
          </p>

          <div className="credential-box">
            <div className="credential-row">
              <span className="credential-label">Email</span>
              <code>{successData.email}</code>
            </div>
            <div className="credential-row">
              <span className="credential-label">Temporary password</span>
              <code>{successData.temp_password}</code>
            </div>
            <div className="credential-row">
              <span className="credential-label">Sign-in URL</span>
              <code>{window.location.origin + '/matta/login'}</code>
            </div>
          </div>

          <div className="invite-success-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleCopyCredentials}
            >
              {copied ? 'Copied!' : 'Copy credentials'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={handleClose}>
              Close
            </button>
          </div>

          <p className="invite-success-warning">
            ⚠ This password will not be shown again. Make sure to copy it now.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          <p className="modal-subtitle">
            We'll create an account immediately. Share the email and the generated
            temporary password with the trainee through a secure channel.
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
              />
            </label>

            <label className="auth-field full">
              <span className="auth-label">Work email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. j.delacruz@browave.com"
                disabled={submitting}
                required
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
                placeholder="MATTA-YYYY-NN"
                disabled={submitting}
                required
              />
            </label>

            <label className="auth-field">
              <span className="auth-label">Onboard date</span>
              <input
                type="date"
                value={onboardDate}
                onChange={(e) => setOnboardDate(e.target.value)}
                disabled={submitting}
                required
              />
            </label>

            <label className="auth-field">
              <span className="auth-label">Department (optional)</span>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="e.g. Operations, Quality, R&amp;D"
                disabled={submitting}
              />
            </label>
          </div>

          {errorMsg && (
            <div className="auth-error" role="alert">
              {errorMsg}
            </div>
          )}

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={handleClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Creating account…' : 'Create trainee account'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  )
}
