import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { getMyTrainingProgress, listTrainees, type TrainingProgress } from '../services/traineeService'
import {
  getMyPortfolioSummary,
  listReviewQueue,
  type PortfolioSummary,
} from '../services/portfolioService'
import { getMyAssessmentSummary, type AssessmentSummary } from '../services/assessmentService'
import Icon from '../components/Icon'

const ROLE_LABELS: Record<string, { label: string; description: string; color: string }> = {
  mt: {
    label: 'Management Associate Trainee',
    description: 'Track your training, upload portfolio items, and view your mentor feedback.',
    color: 'role-mt',
  },
  ma_center: {
    label: 'MA Center · Operations Manager',
    description: 'Manage trainees, courses, assessments, and the portfolio review queue.',
    color: 'role-ma-center',
  },
  mentor: {
    label: 'Mentor · Department Trainer',
    description: 'Review portfolio submissions and record weekly mentor feedback for your trainees.',
    color: 'role-mentor',
  },
  manager: {
    label: 'Department Manager',
    description: 'View your department\u2019s trainees and contribute manager-level reviews.',
    color: 'role-manager',
  },
  ma_board: {
    label: 'MA Board · Senior Management',
    description: 'Review final assessment summaries and graduation recommendations.',
    color: 'role-ma-board',
  },
  owner: {
    label: 'Owner · Super Administrator',
    description: 'Full control of the MATTA Portfolio system. You approve sensitive operations and authorize Operations Managers.',
    color: 'role-owner',
  },
}

function firstName(fullName: string | undefined): string {
  if (!fullName) return 'there'
  return fullName.split(/\s+/)[0]
}

export default function DashboardPage() {
  const { user, profile } = useAuth()
  const roleInfo = profile ? ROLE_LABELS[profile.role] : null
  const isAdmin = profile?.role === 'owner' || profile?.role === 'ma_center'
  const isMT = profile?.role === 'mt'

  // Real progress data for MT
  const [progress, setProgress] = useState<TrainingProgress | null>(null)
  const [portfolio, setPortfolio] = useState<PortfolioSummary | null>(null)
  const [assessSummary, setAssessSummary] = useState<AssessmentSummary | null>(null)
  useEffect(() => {
    if (!isMT) return
    getMyTrainingProgress().then(({ progress: p }) => setProgress(p))
    getMyPortfolioSummary().then(({ summary }) => setPortfolio(summary))
    getMyAssessmentSummary().then(({ summary }) => setAssessSummary(summary))
  }, [isMT])

  // Real quickstats for admin (owner / ma_center)
  const [adminStats, setAdminStats] = useState<{
    trainees: number
    pendingReviews: number
  } | null>(null)
  useEffect(() => {
    if (!isAdmin) return
    Promise.all([listTrainees(), listReviewQueue()]).then(([tRes, qRes]) => {
      setAdminStats({
        trainees: tRes.trainees.length,
        pendingReviews: qRes.items.filter((i) => i.status === 'pending').length,
      })
    })
  }, [isAdmin])

  return (
    <div className="dashboard-content">
      <div className="page-header">
        <div>
          <p className="page-eyebrow">Overview</p>
          <h1 className="page-title">
            Welcome back, {firstName(profile?.full_name)}.
          </h1>
          {roleInfo && <p className="page-subtitle">{roleInfo.description}</p>}
        </div>
        {roleInfo && (
          <div className={`role-badge ${roleInfo.color}`}>{roleInfo.label}</div>
        )}
      </div>

      {/* Admin (owner / ma_center) gets system-wide quickstats */}
      {isAdmin && (
        <section className="quickstats-grid">
          <div className="quickstat">
            <span className="quickstat-label">Active trainees 在訓學員</span>
            <span className="quickstat-value">{adminStats ? adminStats.trainees : '…'}</span>
            <span className="quickstat-hint">
              {adminStats && adminStats.trainees === 0
                ? 'No trainees onboarded yet'
                : 'Across all batches'}
            </span>
          </div>
          <div className="quickstat">
            <span className="quickstat-label">Pending reviews 待審項目</span>
            <span className="quickstat-value">
              {adminStats ? adminStats.pendingReviews : '…'}
            </span>
            <span className="quickstat-hint">
              {adminStats && adminStats.pendingReviews > 0 ? (
                <Link to="/admin/reviews">Go to review queue →</Link>
              ) : (
                'Portfolio queue is empty'
              )}
            </span>
          </div>
          <div className="quickstat">
            <span className="quickstat-label">Active courses 開設課程</span>
            <span className="quickstat-value">0</span>
            <span className="quickstat-hint">Add your first course soon</span>
          </div>
          <div className="quickstat">
            <span className="quickstat-label">Upcoming assessments 近期評量</span>
            <span className="quickstat-value">0</span>
            <span className="quickstat-hint">Nothing scheduled</span>
          </div>
        </section>
      )}

      {/* MT gets their personal training progress bars */}
      {isMT && (
        <section className="progress-grid">
          <div className="progress-card">
            <div className="progress-card-header">
              <span className="progress-card-label">General Training</span>
              <span className="progress-card-value">
                {progress ? progress.phase1_hours.toFixed(1) : '0'}
                <span className="muted"> / {progress?.phase1_target ?? 80} hrs</span>
              </span>
            </div>
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{
                  width: progress
                    ? `${Math.min(100, (progress.phase1_hours / progress.phase1_target) * 100)}%`
                    : '0%',
                }}
              />
            </div>
            <span className="progress-card-hint">
              {!progress
                ? 'Loading…'
                : progress.phase1_hours === 0
                  ? 'Phase 1 courses not started'
                  : progress.phase1_hours >= progress.phase1_target
                    ? '✓ Target reached'
                    : `${(progress.phase1_target - progress.phase1_hours).toFixed(1)} hrs to target`}
            </span>
          </div>
          <div className="progress-card">
            <div className="progress-card-header">
              <span className="progress-card-label">Department Training</span>
              <span className="progress-card-value">
                {progress ? progress.phase2_hours.toFixed(1) : '0'}
                <span className="muted"> / {progress?.phase2_target ?? 880} hrs</span>
              </span>
            </div>
            <div className="progress-bar">
              <div
                className="progress-fill accent"
                style={{
                  width: progress
                    ? `${Math.min(100, (progress.phase2_hours / progress.phase2_target) * 100)}%`
                    : '0%',
                }}
              />
            </div>
            <span className="progress-card-hint">
              {!progress
                ? 'Loading…'
                : progress.phase2_hours === 0
                  ? 'Phase 2 not started yet'
                  : progress.phase2_hours >= progress.phase2_target
                    ? '✓ Target reached'
                    : `${(progress.phase2_target - progress.phase2_hours).toFixed(1)} hrs to target`}
            </span>
          </div>
          <div className="progress-card">
            <div className="progress-card-header">
              <span className="progress-card-label">Portfolio Items</span>
              <span className="progress-card-value">
                {portfolio ? portfolio.total : '0'}
                {portfolio && portfolio.total > 0 && (
                  <span className="muted"> · {portfolio.approved} approved</span>
                )}
              </span>
            </div>
            <div className="progress-bar">
              <div
                className="progress-fill warning"
                style={{
                  width:
                    portfolio && portfolio.total > 0
                      ? `${Math.round((portfolio.approved / portfolio.total) * 100)}%`
                      : '0%',
                }}
              />
            </div>
            <span className="progress-card-hint">
              {!portfolio
                ? 'Loading…'
                : portfolio.total === 0
                  ? 'Nothing submitted yet'
                  : portfolio.returned > 0
                    ? `${portfolio.returned} returned — needs your revision`
                    : portfolio.pending > 0
                      ? `${portfolio.pending} awaiting review`
                      : '✓ All items approved'}
            </span>
          </div>
          <div className="progress-card">
            <div className="progress-card-header">
              <span className="progress-card-label">Assessments</span>
              <span className="progress-card-value">
                {assessSummary ? assessSummary.total : '0'}
                {assessSummary && assessSummary.averagePct != null && (
                  <span className="muted"> · avg {assessSummary.averagePct}%</span>
                )}
              </span>
            </div>
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{
                  width:
                    assessSummary && assessSummary.averagePct != null
                      ? `${Math.min(100, assessSummary.averagePct)}%`
                      : '0%',
                }}
              />
            </div>
            <span className="progress-card-hint">
              {!assessSummary
                ? 'Loading…'
                : assessSummary.total === 0
                  ? 'No assessments recorded yet'
                  : `${assessSummary.scored} of ${assessSummary.total} scored`}
            </span>
          </div>
        </section>
      )}

      <section className="dashboard-grid">
        <div className="dashboard-card">
          <div className="dashboard-card-header">
            <h2>Your account 帳號資訊</h2>
          </div>
          <dl className="dashboard-meta">
            <div>
              <dt>Email</dt>
              <dd>{user?.email}</dd>
            </div>
            <div>
              <dt>Role</dt>
              <dd>{profile?.role ?? '\u2014'}</dd>
            </div>
            <div>
              <dt>Department</dt>
              <dd>{profile?.department ?? 'Not assigned'}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>
                <span className={`status-pill status-${profile?.status ?? 'inactive'}`}>
                  {profile?.status ?? 'unknown'}
                </span>
              </dd>
            </div>
          </dl>
        </div>

        <div className="dashboard-card">
          <div className="dashboard-card-header">
            <h2>Quick actions 快速操作</h2>
            <span className="card-tag">v0.2</span>
          </div>

          {isAdmin && (
            <div className="quick-actions">
              <Link to="/admin/trainees" className="quick-action">
                <span className="quick-action-icon"><Icon name="users" size={20} /></span>
                <div>
                  <p className="quick-action-title">Manage trainees 管理學員</p>
                  <p className="quick-action-desc">Invite, view, and onboard MTs.</p>
                </div>
              </Link>
              <Link to="/admin/courses" className="quick-action">
                <span className="quick-action-icon"><Icon name="book" size={20} /></span>
                <div>
                  <p className="quick-action-title">Course catalog 課程目錄</p>
                  <p className="quick-action-desc">Create training courses (coming soon).</p>
                </div>
              </Link>
              <Link to="/admin/reviews" className="quick-action">
                <span className="quick-action-icon"><Icon name="check" size={20} /></span>
                <div>
                  <p className="quick-action-title">Portfolio reviews 檔案審核</p>
                  <p className="quick-action-desc">Approve or return MT submissions.</p>
                </div>
              </Link>
            </div>
          )}

          {isMT && (
            <div className="quick-actions">
              <Link to="/my-training" className="quick-action">
                <span className="quick-action-icon"><Icon name="book" size={20} /></span>
                <div>
                  <p className="quick-action-title">View training records</p>
                  <p className="quick-action-desc">See your enrolled courses and grades.</p>
                </div>
              </Link>
              <Link to="/my-portfolio" className="quick-action">
                <span className="quick-action-icon"><Icon name="folder" size={20} /></span>
                <div>
                  <p className="quick-action-title">Upload portfolio</p>
                  <p className="quick-action-desc">Add reflections, projects, and reports.</p>
                </div>
              </Link>
              <Link to="/my-assessments" className="quick-action">
                <span className="quick-action-icon"><Icon name="check" size={20} /></span>
                <div>
                  <p className="quick-action-title">Read feedback</p>
                  <p className="quick-action-desc">Check assessment scores and mentor notes.</p>
                </div>
              </Link>
            </div>
          )}

          {!isAdmin && !isMT && (
            <ul className="dashboard-checklist">
              <li>View assigned trainees</li>
              <li>Record mentor / manager feedback</li>
              <li>Approve or return portfolio items</li>
            </ul>
          )}
        </div>
      </section>
    </div>
  )
}
