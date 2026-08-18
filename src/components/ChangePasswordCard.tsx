import { useState, type FormEvent } from 'react'
import { updateOwnPassword } from '../services/authService'

export default function ChangePasswordCard() {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)
    setSuccessMsg(null)

    if (newPassword.length < 8) {
      setErrorMsg('Password must be at least 8 characters. 密碼至少 8 個字元。')
      return
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('Passwords do not match. 兩次輸入的密碼不一致。')
      return
    }

    setSubmitting(true)
    const { error } = await updateOwnPassword(newPassword)
    setSubmitting(false)

    if (error) {
        setErrorMsg((error as any)?.message)
      return
    }
    setNewPassword('')
    setConfirmPassword('')
    setSuccessMsg('Password changed. 密碼已更新。')
  }

  return (
    <form className="dashboard-card" onSubmit={handleSubmit} noValidate>
      <div className="dashboard-card-header">
        <h2>Change password 修改密碼</h2>
      </div>

      <div className="form-grid">
        <label className="auth-field">
          <span className="auth-label">New password 新密碼</span>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="At least 8 characters"
            disabled={submitting}
            required
            minLength={8}
            autoComplete="new-password"
          />
        </label>

        <label className="auth-field">
          <span className="auth-label">Confirm new password 確認新密碼</span>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Type it again"
            disabled={submitting}
            required
            minLength={8}
            autoComplete="new-password"
          />
        </label>
      </div>

      {errorMsg && (
        <div className="auth-error" role="alert">
          {errorMsg}
        </div>
      )}
      {successMsg && <div className="profile-success">{successMsg}</div>}

      <div className="modal-footer">
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? 'Saving…' : 'Update password 更新密碼'}
        </button>
      </div>
    </form>
  )
}
