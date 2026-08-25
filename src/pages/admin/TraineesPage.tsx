import { useEffect, useState, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../../components/Icon'
import { listTrainees, type TraineeWithProfile } from '../../services/traineeService'
import InviteTraineeModal from './InviteTraineeModal'

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  onboarding: { label: 'Onboarding 報到中', cls: 'status-onboarding' },
  phase1_general: { label: 'Phase 1 · General 通識', cls: 'status-phase1' },
  phase2_department: { label: 'Phase 2 · Department 部門', cls: 'status-phase2' },
  final_assessment: { label: 'Final assessment 期末評核', cls: 'status-final' },
  graduated: { label: 'Graduated 結業', cls: 'status-graduated' },
  transferred: { label: 'Transferred 轉調', cls: 'status-transferred' },
  withdrawn: { label: 'Withdrawn 退訓', cls: 'status-withdrawn' },
}

export default function TraineesPage() {
  const [trainees, setTrainees] = useState<TraineeWithProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [recentlyInvited, setRecentlyInvited] = useState<string | null>(null)

  const [searchQuery, setSearchQuery] = useState('')
  const [batchFilter, setBatchFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    const { trainees: data, error } = await listTrainees()
    if (error) {
      setErrorMsg(error.message)
    } else {
      setErrorMsg(null)
      setTrainees(data)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const handleInviteSuccess = () => {
    setRecentlyInvited(new Date().toISOString())
    refresh()
  }

  // Derive filter dropdown options from the trainees we actually have.
  const batchOptions = useMemo(
    () => Array.from(new Set(trainees.map((t) => t.batch_code).filter(Boolean))).sort(),
    [trainees],
  )
  const departmentOptions = useMemo(
    () => Array.from(new Set(trainees.map((t) => t.department).filter((d): d is string => !!d))).sort(),
    [trainees],
  )

  const filteredTrainees = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()

    return trainees.filter((t) => {
      if (batchFilter && t.batch_code !== batchFilter) return false
      if (statusFilter && t.training_status !== statusFilter) return false
      if (departmentFilter && t.department !== departmentFilter) return false

      if (q) {
        const haystack = [
          t.users_profile?.full_name ?? '',
          t.users_profile?.email ?? '',
          t.employee_id ?? '',
        ]
          .join(' ')
          .toLowerCase()
        if (!haystack.includes(q)) return false
      }

      return true
    })
  }, [trainees, searchQuery, batchFilter, statusFilter, departmentFilter])

  return (
    <div className="dashboard-content">
      <div className="page-header">
        <div>
          <p className="page-eyebrow">Workspace 工作區</p>
          <h1 className="page-title">Trainees 學員</h1>
          <p className="page-subtitle">
            All Management Associate Trainees enrolled in MATTA, across batches and departments.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setModalOpen(true)}>
          <Icon name="plus" size={18} /> Invite trainee 邀請學員
        </button>
      </div>

      {recentlyInvited && (
        <div className="success-banner" role="status">
          <span>✓ Trainee account created. They appear in the list below.</span>
          <button
            className="success-banner-close"
            onClick={() => setRecentlyInvited(null)}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="auth-error" role="alert">
          {errorMsg}
        </div>
      )}

      <div className="filter-bar">
        <div className="filter-search">
          <Icon name="search" size={16} />
          <input
            type="search"
            placeholder="Search by name, email, or employee ID…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <select value={batchFilter} onChange={(e) => setBatchFilter(e.target.value)}>
          <option value="">All batches</option>
          {batchOptions.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          {Object.entries(STATUS_LABELS).map(([value, meta]) => (
            <option key={value} value={value}>
              {meta.label}
            </option>
          ))}
        </select>
        <select value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)}>
          <option value="">All departments</option>
          {departmentOptions.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="empty-state">
          <p className="empty-state-desc">Loading trainees…</p>
        </div>
      ) : trainees.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <Icon name="graduation" size={28} />
          </div>
          <h2 className="empty-state-title">No trainees yet</h2>
          <p className="empty-state-desc">
            Click <strong>Invite trainee</strong> to create your first MT account. They'll
            appear here with their batch, training status, and profile completeness.
          </p>
          <div className="empty-state-cta">
            <button className="btn btn-primary" onClick={() => setModalOpen(true)}>
              <Icon name="plus" size={18} /> Invite first trainee
            </button>
          </div>
        </div>
      ) : filteredTrainees.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <Icon name="search" size={28} />
          </div>
          <h2 className="empty-state-title">No matches</h2>
          <p className="empty-state-desc">
            No trainees match your current search or filters. Try adjusting them.
          </p>
        </div>
      ) : (
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Employee ID</th>
                <th>Batch</th>
                <th>Department</th>
                <th>Status</th>
                <th>Profile</th>
              </tr>
            </thead>
            <tbody>
              {filteredTrainees.map((t) => {
                const status = STATUS_LABELS[t.training_status] ?? {
                  label: t.training_status,
                  cls: 'status-onboarding',
                }
                return (
                  <tr key={t.id}>
                    <td>
                      <Link to={`/admin/trainees/${t.id}`} className="trainee-name">
                        <span className="trainee-name-full">
                          {t.users_profile?.full_name ?? 'Unknown'}
                        </span>
                        <span className="trainee-name-email">
                          {t.users_profile?.email ?? '\u2014'}
                        </span>
                      </Link>
                    </td>
                    <td>
                      <code className="mono-small">{t.employee_id}</code>
                    </td>
                    <td>{t.batch_code}</td>
                    <td>{t.department ?? '\u2014'}</td>
                    <td>
                      <span className={`status-pill ${status.cls}`}>{status.label}</span>
                    </td>
                    <td>
                      <div className="completeness">
                        <div className="completeness-bar">
                          <div
                            className="completeness-fill"
                            style={{ width: `${t.profile_completeness}%` }}
                          />
                        </div>
                        <span className="completeness-text">
                          {t.profile_completeness}%
                        </span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <InviteTraineeModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={handleInviteSuccess}
      />
    </div>
  )
}