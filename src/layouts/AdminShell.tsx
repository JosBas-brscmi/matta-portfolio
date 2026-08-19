import { NavLink, Outlet, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import Icon from '../components/Icon'

export default function AdminShell() {
  const { profile, user, signOut } = useAuth()
  const role = profile?.role
  const isOwner = role === 'owner'
  const isAdmin = role === 'owner' || role === 'ma_center'
  const isMT = role === 'mt'

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link to="/dashboard" className="admin-brand">
          <div className="brand-mark">
            <img src="/matta-logo.png" alt="MATTA" />
          </div>
          <div className="brand-text">
            <span className="brand-text-main">MATTA</span>
            <span className="brand-text-sub">Learning Portfolio</span>
          </div>
        </Link>

        <nav className="admin-nav">
          {isMT ? (
            // ---- Trainee navigation ----
            <div className="admin-nav-section">
              <span className="admin-nav-label">My MATTA Journey</span>
              <NavLink to="/dashboard" end className="admin-nav-item">
                <Icon name="home" /> Overview
              </NavLink>
              <NavLink to="/my-training" className="admin-nav-item">
                <Icon name="book" /> My Training
              </NavLink>
              <NavLink to="/my-portfolio" className="admin-nav-item">
                <Icon name="folder" /> My Portfolio
              </NavLink>
              <NavLink to="/my-assessments" className="admin-nav-item">
                <Icon name="check" /> Assessments
              </NavLink>
              <NavLink to="/my-profile" className="admin-nav-item">
                <Icon name="settings" /> My Profile
              </NavLink>
            </div>
          ) : (
            // ---- Admin / Mentor / Manager / MA Board navigation ----
            <div className="admin-nav-section">
              <span className="admin-nav-label">Workspace 工作區</span>
              <NavLink to="/dashboard" end className="admin-nav-item">
                <Icon name="home" /> Overview 總覽
              </NavLink>
              <NavLink to="/admin/trainees" className="admin-nav-item">
                <Icon name="users" /> Trainees 學員
              </NavLink>
              <NavLink to="/admin/courses" className="admin-nav-item">
                <Icon name="book" /> Courses 課程
              </NavLink>
              <NavLink to="/admin/reviews" className="admin-nav-item">
                <Icon name="check" /> Reviews 審核
              </NavLink>
              <NavLink to="/account" className="admin-nav-item">
                <Icon name="lock" /> Account 帳號
              </NavLink>
            </div>
          )}

          {isAdmin && (
            <div className="admin-nav-section">
              <span className="admin-nav-label">Admin 系統管理</span>
              <NavLink to="/admin/users" className="admin-nav-item">
                <Icon name="users" /> Users 使用者
              </NavLink>
              {isOwner && (
                <NavLink to="/admin/settings" className="admin-nav-item">
                  <Icon name="settings" /> Settings 設定
                </NavLink>
              )}
            </div>
          )}
        </nav>

        <div className="admin-sidebar-footer">
          <span>© {new Date().getFullYear()} Browave</span>
          <span>v0.2</span>
        </div>
      </aside>

      <div className="admin-main">
        <header className="admin-header">
          <div className="admin-header-user">
            {isOwner && (
              <span className="role-badge role-owner role-badge-sm">★ Owner</span>
            )}
            <div className="user-info">
              <span className="user-name">{profile?.full_name ?? 'User'}</span>
              <span className="user-email">{user?.email}</span>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => signOut()}>
              Sign out 登出
            </button>
          </div>
        </header>

        <main className="admin-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
