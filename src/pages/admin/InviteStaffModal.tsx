import { useState, useEffect, type FormEvent } from 'react'
import Modal from '../../components/Modal'
import {
  inviteStaff,
  type StaffRole,
  type InviteStaffResult,
} from '../../services/userService'
import { DEPARTMENTS } from '../../constants/departments'

interface Props {
  open: boolean
  onClose: () => void
  onCreated: () => void
  viewerRole: string
}

const ROLE_CHOICES: { value: StaffRole; label: string; ownerOnly?: boolean }[] = [
  { value: 'mentor', label: 'Mentor · Trainer 導師' },
  { value: 'manager', label: 'Department Manager 部門主管' },
  { value: 'ma_board', label: 'MA Board · Senior Mgmt 高階主管' },
  { value: 'ma_center', label: 'MA Center 管理者', ownerOnly: true },
]

export default function InviteStaffModal({ open, onClose, onCreated, viewerRole }: Props) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<StaffRole>('mentor')
  const [department, setDepartment] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [result, setResult] = useState<InviteStaffResult | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!open) return
    setFullName('')
    setEmail('')
    setRole('mentor')
    setDepartment('')
    setErrorMsg(null)
    setResult(null)
    setCopied(false)
    setSubmitting(false)
  }, [open])

  const handleClose = () => {
    if (submitting) return
    onClose()
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)

    if (!fullName.trim()) {
      setErrorMsg('Please enter the full name. 請輸入姓名。')
      return
    }
    if (!/^[^\s@]+@browave\.com$/i.test(email.trim())) {
      setErrorMsg('Email must be a @browave.com address. 必須使用 @browave.com 信箱。')
      return
    }

    setSubmitting(true)
    const res = await inviteStaff({
      email: email.trim().toLowerCase(),
      full_name: fullName.trim(),
      role,
      department: department || undefined,
    })
    setSubmitting(false)

    if (!res.ok) {
      setErrorMsg(res.error)
      return
    }
    setResult(res.result)
    onCreated()
  }

  const credentialsMessage = result
    ? [
        'MATTA Learning Portfolio — your account 帳號資訊',
        '',
        `Sign-in page 登入頁: ${window.location.origin}/login`,
        `ID (email) 帳號: ${result.email}`,
        `Temporary password 臨時密碼: ${result.temp_password}`,
        '',
        'Please sign in and change your password right away',
        '(after login: Account → Change password).',
        '請登入後立即修改密碼（登入後：Account → Change password）。',
      ].join('\n')
    : ''

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(credentialsMessage)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setErrorMsg('Copy failed — please select and copy the text manually.')
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={result ? 'Account created 帳號已建立' : 'Create staff account 建立幹部帳號'}
      size="lg"
    >
      {result ? (
        <div>
          <p className="modal-subtitle">
            Send this message to the new user via a secure channel (e.g. in
            person, phone, or company chat). The password is shown{' '}
            <strong>only once</strong>.
            <br />
            請透過安全管道將以下訊息交給對方，密碼<strong>只顯示這一次</strong>。
          </p>

          <pre className="credentials-box">{credentialsMessage}</pre>

          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={handleClose}>
              Done 完成
            </button>
            <button type="button" className="btn btn-primary" onClick={handleCopy}>
              {copied ? '✓ Copied 已複製' : 'Copy message 複製訊息'}
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          <p className="modal-subtitle">
            Creates the account immediately with a system-generated password.
            立即建立帳號並產生隨機密碼，由你轉交給對方。
          </p>

          <div className="form-grid">
            <label className="auth-field">
              <span className="auth-label">Full name 姓名</span>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Chen Wei-Ming"
                disabled={submitting}
                required
                autoFocus
              />
            </label>

            <label className="auth-field">
              <span className="auth-label">Email 信箱 (@browave.com)</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@browave.com"
                disabled={submitting}
                required
              />
            </label>

            <label className="auth-field">
              <span className="auth-label">Role 角色</span>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as StaffRole)}
                disabled={submitting}
              >
                {ROLE_CHOICES.filter((r) => !r.ownerOnly || viewerRole === 'owner').map(
                  (r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ),
                )}
              </select>
            </label>

            <label className="auth-field">
              <span className="auth-label">Department 部門 (optional)</span>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                disabled={submitting}
              >
                <option value="">— Not set 未指定 —</option>
                {DEPARTMENTS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
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
              Cancel 取消
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Creating…' : 'Create account 建立帳號'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  )
}
