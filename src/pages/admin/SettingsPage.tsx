import { Navigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import Icon from '../../components/Icon'

export default function SettingsPage() {
  const { profile, loading } = useAuth()

  // Only owners can view this page. Anyone else gets bounced to /dashboard.
  // (RLS already prevents sensitive ops, this is just UI gating.)
  if (loading) return null
  if (profile?.role !== 'owner') {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <div className="dashboard-content">
      <div className="page-header">
        <div>
          <p className="page-eyebrow">Owner</p>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">
            Owner-only configuration: user roles, batch settings, and approval gates.
          </p>
        </div>
        <span className="role-badge role-owner role-badge-sm">★ Owner only</span>
      </div>

      <div className="empty-state">
        <div className="empty-state-icon">
          <Icon name="lock" size={28} />
        </div>
        <h2 className="empty-state-title">Settings module is reserved for the owner</h2>
        <p className="empty-state-desc">
          From here you will be able to promote an Operations Manager, define batch codes,
          configure the approval gates for sensitive actions, and review the audit log.
          <br />
          Operations Managers will not see this section in their sidebar.
        </p>
      </div>
    </div>
  )
}
