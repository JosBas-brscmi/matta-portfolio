import { useAuth } from '../contexts/AuthContext'
import ChangePasswordCard from '../components/ChangePasswordCard'
import { DEPARTMENT_LABEL } from '../constants/departments'

export default function AccountPage() {
  const { user, profile } = useAuth()

  return (
    <div className="dashboard-content">
      <div className="page-header">
        <div>
          <p className="page-eyebrow">Account 帳號</p>
          <h1 className="page-title">My account 我的帳號</h1>
          <p className="page-subtitle">
            Your sign-in details and password.
          </p>
        </div>
      </div>

      <div className="detail-grid">
        <div className="dashboard-card">
          <div className="dashboard-card-header">
            <h2>Account details 帳號資訊</h2>
          </div>
          <dl className="dashboard-meta">
            <div>
              <dt>Name 姓名</dt>
              <dd>{profile?.full_name ?? '—'}</dd>
            </div>
            <div>
              <dt>Email 信箱</dt>
              <dd>{user?.email ?? '—'}</dd>
            </div>
            <div>
              <dt>Role 角色</dt>
              <dd>{profile?.role ?? '—'}</dd>
            </div>
            <div>
              <dt>Department 部門</dt>
              <dd>
                {profile?.department
                  ? (DEPARTMENT_LABEL[profile.department] ?? profile.department)
                  : 'Not assigned 未指定'}
              </dd>
            </div>
          </dl>
        </div>

        <ChangePasswordCard />
      </div>
    </div>
  )
}