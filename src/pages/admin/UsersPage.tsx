import { useEffect, useState, useCallback } from 'react'
import Icon from '../../components/Icon'
import { useAuth } from '../../contexts/AuthContext'
import {
  listAllUsers,
  updateUserRole,
  updateUserDepartment,
  updateUserStatus,
  assignMentor,
  updateTraineeDepartment,
  ROLE_OPTIONS,
  type ManagedUser,
} from '../../services/userService'
import InviteStaffModal from './InviteStaffModal'
import { DEPARTMENTS } from '../../constants/departments'
import type { UserRole } from '../../types'

type RoleFilter = 'all' | UserRole

const ROLE_BADGE: Record<string, string> = {
  mt: 'role-mt',
  mentor: 'role-mentor',
  manager: 'role-manager',
  ma_center: 'role-ma-center',
  ma_board: 'role-ma-board',
  owner: 'role-owner',
}

export default function UsersPage() {
  const { user: me, profile: myProfile } = useAuth()
  const [inviteOpen, setInviteOpen] = useState(false)
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [filter, setFilter] = useState<RoleFilter>('all')
  const [search, setSearch] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)
  const [flashId, setFlashId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const { users: list, error } = await listAllUsers()
    if (error) setErrorMsg(error.message)
    else {
      setUsers(list)
      setErrorMsg(null)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const flash = (id: string) => {
    setFlashId(id)
    setTimeout(() => setFlashId(null), 1200)
  }

  const run = async (userId: string, fn: () => Promise<{ error: { message: string } | null }>) => {
    setSavingId(userId)
    const { error } = await fn()
    setSavingId(null)
    if (error) {
      alert(`Save failed: ${error.message}`)
      return
    }
    flash(userId)
    refresh()
  }

  const handleRoleChange = (u: ManagedUser, role: UserRole) => {
    if (
      !window.confirm(
        `Change ${u.full_name}'s role to "${ROLE_OPTIONS.find((r) => r.value === role)?.label}"?\n\nThis changes what they can see and do immediately.`,
      )
    ) {
      refresh() // reset the select
      return
    }
    run(u.id, () => updateUserRole(u.id, role))
  }

  const handleStatusToggle = (u: ManagedUser) => {
    const next = u.status === 'active' ? 'inactive' : 'active'
    if (
      next === 'inactive' &&
      !window.confirm(`Deactivate ${u.full_name}? They will keep their data but should no longer participate.`)
    ) {
      return
    }
    run(u.id, () => updateUserStatus(u.id, next))
  }

  const handleDepartmentChange = (u: ManagedUser, value: string) => {
    const clean = value.trim() || null
    if ((u.department ?? null) === clean) return
    run(u.id, async () => {
      const res = await updateUserDepartment(u.id, clean)
      if (!res.error && u.trainee) {
        // Keep the trainee record's department in sync for manager-scope RLS.
        await updateTraineeDepartment(u.trainee.id, clean)
      }
      return res
    })
  }

  const handleMentorChange = (u: ManagedUser, mentorUserId: string) => {
    if (!u.trainee) return
    run(u.id, () => assignMentor(u.trainee!.id, mentorUserId || null))
  }

  const mentors = users.filter((u) => u.role === 'mentor' && u.status === 'active')

  const filtered = users.filter((u) => {
    if (filter !== 'all' && u.role !== filter) return false
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      return (
        u.full_name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.trainee?.employee_id ?? '').toLowerCase().includes(q)
      )
    }
    return true
  })

  const roleCounts = (role: RoleFilter) =>
    role === 'all' ? users.length : users.filter((u) => u.role === role).length

  return (
    <div className="dashboard-content">
      <div className="page-header">
        <div>
          <p className="page-eyebrow">Admin 管理</p>
          <h1 className="page-title">User management 使用者管理</h1>
          <p className="page-subtitle">
            Assign roles, link trainees to mentors, and set departments. Changes
            take effect the next time the user loads a page.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setInviteOpen(true)}>
          <Icon name="plus" size={18} /> Create account 建立帳號
        </button>
      </div>

      {/* Filters */}
      <div className="filter-bar users-filter-bar">
        <div className="filter-tabs">
          {(
            [
              ['all', `All (${roleCounts('all')})`],
              ['mt', `MT (${roleCounts('mt')})`],
              ['mentor', `Mentors (${roleCounts('mentor')})`],
              ['manager', `Managers (${roleCounts('manager')})`],
              ['ma_board', `Board (${roleCounts('ma_board')})`],
              ['ma_center', `MA Center (${roleCounts('ma_center')})`],
            ] as [RoleFilter, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              className={`filter-tab ${filter === key ? 'active' : ''}`}
              onClick={() => setFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="users-search">
          <Icon name="search" size={16} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, employee ID…"
          />
        </div>
      </div>

      {errorMsg && (
        <div className="auth-error" role="alert">
          {errorMsg}
        </div>
      )}

      {loading ? (
        <div className="empty-state">
          <p className="empty-state-desc">Loading users…</p>
        </div>
      ) : (
        <div className="users-table-wrap">
          <table className="users-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Department</th>
                <th>Mentor (MT only)</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => {
                const isSelf = u.id === me?.id
                const busy = savingId === u.id
                return (
                  <tr key={u.id} className={flashId === u.id ? 'row-flash' : ''}>
                    <td>
                      <div className="users-cell-name">
                        <span className={`role-dot ${ROLE_BADGE[u.role] ?? ''}`} />
                        <div>
                          <div className="users-name">
                            {u.full_name}
                            {isSelf && <span className="users-you"> (you)</span>}
                          </div>
                          <div className="users-email">{u.email}</div>
                          {u.trainee && (
                            <div className="users-trainee-meta">
                              <code className="mono-small">{u.trainee.employee_id}</code>
                              {' · '}
                              {u.trainee.batch_code}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <select
                        className="users-select"
                        value={u.role}
                        onChange={(e) => handleRoleChange(u, e.target.value as UserRole)}
                        disabled={busy || isSelf}
                        title={isSelf ? 'You cannot change your own role' : 'Change role'}
                      >
                        {ROLE_OPTIONS.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        className="users-select users-select-dept"
                        value={u.department ?? ''}
                        onChange={(e) => handleDepartmentChange(u, e.target.value)}
                        disabled={busy}
                      >
                        <option value="">— No department 未指定 —</option>
                        {/* Keep a legacy value visible if it's not in the official list */}
                        {u.department && !DEPARTMENTS.some((d) => d.value === u.department) && (
                          <option value={u.department}>{u.department} (legacy)</option>
                        )}
                        {DEPARTMENTS.map((d) => (
                          <option key={d.value} value={d.value}>
                            {d.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      {u.trainee ? (
                        <select
                          className="users-select"
                          value={u.trainee.mentor_id ?? ''}
                          onChange={(e) => handleMentorChange(u, e.target.value)}
                          disabled={busy}
                        >
                          <option value="">— No mentor —</option>
                          {mentors.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.full_name}
                              {m.department ? ` (${m.department})` : ''}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td>
                      <button
                        className={`status-toggle ${u.status === 'active' ? 'on' : 'off'}`}
                        onClick={() => handleStatusToggle(u)}
                        disabled={busy || isSelf}
                        title={isSelf ? 'You cannot deactivate yourself' : 'Toggle status'}
                      >
                        {u.status === 'active' ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <p className="empty-state-desc" style={{ textAlign: 'center', padding: '2rem' }}>
              No users match this filter.
            </p>
          )}
        </div>
      )}

      <p className="users-footnote muted">
        New MTs register themselves at <strong>/signup</strong> with a
        @browave.com email and appear here automatically. For mentor, manager,
        board, and MA Center accounts: use <strong>Create account 建立帳號</strong>{' '}
        above, then send them the generated sign-in details.
      </p>

      <InviteStaffModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onCreated={refresh}
        viewerRole={myProfile?.role ?? ''}
      />
    </div>
  )
}
