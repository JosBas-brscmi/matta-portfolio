import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  getTraineeById,
  getMyTraineeId,
  listTraineeTrainingRecords,
  getTraineeTrainingProgress,
  type TraineeFullDetail,
  type TrainingRecord,
  type TrainingProgress,
} from '../services/traineeService'
import {
  listTraineePortfolioItems,
  CATEGORY_LABEL,
  type PortfolioItem,
} from '../services/portfolioService'
import {
  listTraineeAssessments,
  summarize,
  ASSESSMENT_TYPE_LABEL,
  type Assessment,
} from '../services/assessmentService'
import { avatarPublicUrl } from '../services/profileService'
import {
  listTraineeReviews,
  REVIEW_TYPE_LABEL,
  type Review,
} from '../services/reviewService'
import { DEPARTMENT_LABEL } from '../constants/departments'

const STATUS_LABELS: Record<string, string> = {
  onboarding: 'Onboarding',
  phase1_general: 'Phase 1 · General Training',
  phase2_department: 'Phase 2 · Department Training',
  final_assessment: 'Final Assessment',
  graduated: 'Graduated',
  transferred: 'Transferred',
  withdrawn: 'Withdrawn',
}

function fmt(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return iso
  }
}

export default function ReportPage() {
  const { id: paramId } = useParams<{ id: string }>()
  const { profile } = useAuth()

  const [traineeId, setTraineeId] = useState<string | null>(paramId ?? null)
  const [trainee, setTrainee] = useState<TraineeFullDetail | null>(null)
  const [records, setRecords] = useState<TrainingRecord[]>([])
  const [progress, setProgress] = useState<TrainingProgress | null>(null)
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([])
  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // /my-report → resolve own trainee id
  useEffect(() => {
    if (paramId) {
      setTraineeId(paramId)
      return
    }
    getMyTraineeId().then(({ trainee_id, error }) => {
      if (error) setErrorMsg(error.message)
      else setTraineeId(trainee_id)
    })
  }, [paramId])

  useEffect(() => {
    if (!traineeId) return
    let cancelled = false
    setLoading(true)

    Promise.all([
      getTraineeById(traineeId),
      listTraineeTrainingRecords(traineeId),
      getTraineeTrainingProgress(traineeId),
      listTraineePortfolioItems(traineeId),
      listTraineeAssessments(traineeId),
      listTraineeReviews(traineeId),
    ]).then(([tRes, rRes, pRes, pfRes, aRes, rvRes]) => {
      if (cancelled) return
      if (tRes.error || !tRes.trainee) {
        setErrorMsg(tRes.error?.message ?? 'Trainee not found.')
      } else {
        setTrainee(tRes.trainee)
      }
      if (!rRes.error) setRecords(rRes.records)
      if (!pRes.error) setProgress(pRes.progress)
      if (!pfRes.error) setPortfolio(pfRes.items)
      if (!aRes.error) setAssessments(aRes.assessments)
      if (!rvRes.error) setReviews(rvRes.reviews)
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [traineeId])

  const backLink = paramId ? `/admin/trainees/${paramId}` : '/my-assessments'

  if (loading && !errorMsg) {
    return (
      <div className="report-shell">
        <p className="muted" style={{ padding: '3rem', textAlign: 'center' }}>
          Building report…
        </p>
      </div>
    )
  }

  if (errorMsg || !trainee) {
    return (
      <div className="report-shell">
        <div className="report-toolbar no-print">
          <Link to={backLink} className="btn btn-ghost">← Back</Link>
        </div>
        <div className="auth-error" role="alert" style={{ margin: '2rem' }}>
          {errorMsg ?? 'Trainee not found.'}
        </div>
      </div>
    )
  }

  const summary = summarize(assessments)
  const approvedPortfolio = portfolio.filter((p) => p.status === 'approved')
  const attendedRecords = records.filter((r) => r.attended)
  const generatedFor = trainee.users_profile?.full_name ?? 'Unknown'

  return (
    <div className="report-shell">
      {/* Toolbar — hidden when printing */}
      <div className="report-toolbar no-print">
        <Link to={backLink} className="btn btn-ghost">← Back</Link>
        <button className="btn btn-primary" onClick={() => window.print()}>
          Print / Save as PDF
        </button>
      </div>

      <div className="report-page">
        {/* ---- Cover page (page 1 when printed) ---- */}
        <section className="report-cover">
          <p className="report-brand">MATTA · Browave Management Associate Program</p>
          <h1 className="report-cover-title">Learning Portfolio Report</h1>

          {avatarPublicUrl(trainee.users_profile?.avatar_path) ? (
            <img
              src={avatarPublicUrl(trainee.users_profile?.avatar_path)!}
              alt={generatedFor}
              className="report-cover-photo"
            />
          ) : (
            <div className="report-cover-photo placeholder">No photo</div>
          )}

          <h2 className="report-cover-name">{generatedFor}</h2>
          {trainee.users_profile?.english_name && (
            <p className="report-cover-english">{trainee.users_profile.english_name}</p>
          )}

          <table className="report-cover-table">
            <tbody>
              <tr>
                <th>Employee ID</th>
                <td>{trainee.employee_id}</td>
              </tr>
              <tr>
                <th>Batch</th>
                <td>{trainee.batch_code}</td>
              </tr>
              <tr>
                <th>Department</th>
                <td>
                  {trainee.department
                    ? (DEPARTMENT_LABEL[trainee.department] ?? trainee.department)
                    : 'Not assigned'}
                </td>
              </tr>
              <tr>
                <th>Education</th>
                <td>{trainee.education ?? '—'}</td>
              </tr>
              <tr>
                <th>Mentor</th>
                <td>{trainee.mentor?.full_name ?? 'Not assigned'}</td>
              </tr>
              <tr>
                <th>Onboard date</th>
                <td>{fmt(trainee.onboard_date)}</td>
              </tr>
            </tbody>
          </table>

          {trainee.users_profile?.bio && (
            <p className="report-cover-bio">"{trainee.users_profile.bio}"</p>
          )}

          <p className="report-cover-footer">
            Generated{' '}
            {new Date().toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
            {profile && ` · by ${profile.full_name}`}
          </p>
        </section>

        {/* Header */}
        <header className="report-header">
          <div>
            <p className="report-brand">MATTA · Browave Management Associate Program</p>
            <h1 className="report-title">Learning Portfolio Report</h1>
          </div>
          <div className="report-meta">
            <p>Generated {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
            {profile && <p>By {profile.full_name}</p>}
          </div>
        </header>

        {/* 1 · Trainee profile */}
        <section className="report-section">
          <h2 className="report-section-title">1 · Trainee Profile</h2>
          <table className="report-table profile">
            <tbody>
              <tr>
                <th>Full name</th>
                <td>{generatedFor}</td>
                <th>Employee ID</th>
                <td>{trainee.employee_id}</td>
              </tr>
              <tr>
                <th>Batch</th>
                <td>{trainee.batch_code}</td>
                <th>Department</th>
                <td>{trainee.department ?? 'Not assigned'}</td>
              </tr>
              <tr>
                <th>Onboard date</th>
                <td>{fmt(trainee.onboard_date)}</td>
                <th>Training stage</th>
                <td>{STATUS_LABELS[trainee.training_status] ?? trainee.training_status}</td>
              </tr>
              <tr>
                <th>Education</th>
                <td>{trainee.education ?? '—'}</td>
                <th>Mentor</th>
                <td>{trainee.mentor?.full_name ?? 'Not assigned'}</td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* 2 · Training hours */}
        <section className="report-section">
          <h2 className="report-section-title">2 · Training Hours</h2>
          {progress && (
            <table className="report-table">
              <thead>
                <tr>
                  <th>Phase</th>
                  <th>Hours completed</th>
                  <th>Target</th>
                  <th>Completion</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Phase 1 · General Training</td>
                  <td>{progress.phase1_hours.toFixed(1)}</td>
                  <td>{progress.phase1_target}</td>
                  <td>{Math.min(100, Math.round((progress.phase1_hours / progress.phase1_target) * 100))}%</td>
                </tr>
                <tr>
                  <td>Phase 2 · Department Training</td>
                  <td>{progress.phase2_hours.toFixed(1)}</td>
                  <td>{progress.phase2_target}</td>
                  <td>{Math.min(100, Math.round((progress.phase2_hours / progress.phase2_target) * 100))}%</td>
                </tr>
              </tbody>
            </table>
          )}
          <p className="report-note">
            {attendedRecords.length} attended training entries recorded
            {records.length !== attendedRecords.length &&
              ` (${records.length - attendedRecords.length} missed)`}
            .
          </p>
        </section>

        {/* 3 · Training records */}
        <section className="report-section">
          <h2 className="report-section-title">3 · Training Records</h2>
          {records.length === 0 ? (
            <p className="report-note">No training records.</p>
          ) : (
            <table className="report-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Course / Activity</th>
                  <th>Phase</th>
                  <th>Hours</th>
                  <th>Score</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id} className={!r.attended ? 'report-row-missed' : ''}>
                    <td>{fmt(r.attendance_date)}</td>
                    <td>
                      {r.course?.course_name ?? 'Unnamed'}
                      {!r.attended && ' (missed)'}
                    </td>
                    <td>{r.course?.phase === 'phase1_general' ? 'Phase 1' : 'Phase 2'}</td>
                    <td>{Number(r.hours).toFixed(1)}</td>
                    <td>{r.test_score != null ? r.test_score : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* 4 · Portfolio */}
        <section className="report-section">
          <h2 className="report-section-title">4 · Portfolio Items</h2>
          {portfolio.length === 0 ? (
            <p className="report-note">No portfolio items submitted.</p>
          ) : (
            <>
              <p className="report-note">
                {portfolio.length} submitted · {approvedPortfolio.length} approved ·{' '}
                {portfolio.filter((p) => p.status === 'pending').length} pending ·{' '}
                {portfolio.filter((p) => p.status === 'returned').length} returned
              </p>
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Submitted</th>
                    <th>Title</th>
                    <th>Category</th>
                    <th>Files</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {portfolio.map((p) => (
                    <tr key={p.id}>
                      <td>{fmt(p.submitted_at)}</td>
                      <td>{p.title}</td>
                      <td>{CATEGORY_LABEL[p.category ?? ''] ?? p.category ?? '—'}</td>
                      <td>{p.portfolio_files.length}</td>
                      <td className={`report-status-${p.status}`}>
                        {p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </section>

        {/* 5 · Assessments */}
        <section className="report-section">
          <h2 className="report-section-title">5 · Assessments</h2>
          {assessments.length === 0 ? (
            <p className="report-note">No assessments recorded.</p>
          ) : (
            <>
              <p className="report-note">
                {summary.total} assessments · {summary.scored} scored
                {summary.averagePct != null && ` · average ${summary.averagePct}%`}
              </p>
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Assessment</th>
                    <th>Type</th>
                    <th>Score</th>
                    <th>Assessor</th>
                  </tr>
                </thead>
                <tbody>
                  {assessments.map((a) => (
                    <tr key={a.id}>
                      <td>{fmt(a.assessment_date)}</td>
                      <td>{a.title}</td>
                      <td>{ASSESSMENT_TYPE_LABEL[a.assessment_type ?? ''] ?? '—'}</td>
                      <td>
                        {a.score != null
                          ? `${Number(a.score)} / ${Number(a.max_score)}`
                          : 'Not scored'}
                      </td>
                      <td>{a.assessor_name ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </section>

        {/* 6 · Mentor & management feedback */}
        <section className="report-section">
          <h2 className="report-section-title">6 · Mentor &amp; Management Feedback</h2>
          {reviews.length === 0 ? (
            <p className="report-note">No feedback recorded.</p>
          ) : (
            <div className="report-feedback-list">
              {reviews.map((r) => (
                <div key={r.id} className="report-feedback">
                  <div className="report-feedback-head">
                    <span className="report-feedback-type">
                      {(REVIEW_TYPE_LABEL[r.review_type ?? ''] ?? r.review_type ?? 'Feedback').split(' ')[0]}
                      {r.review_period ? ` · ${r.review_period}` : ''}
                    </span>
                    <span className="report-feedback-meta">
                      {r.rating != null ? `${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)} · ` : ''}
                      {r.reviewer_name ?? '—'} · {fmt(r.reviewed_at)}
                    </span>
                  </div>
                  {r.strengths && (
                    <p className="report-feedback-block">{r.strengths}</p>
                  )}
                  {r.areas_for_improvement && (
                    <p className="report-feedback-block">
                      <strong>Areas to improve: </strong>
                      {r.areas_for_improvement}
                    </p>
                  )}
                  {r.recommendation && (
                    <p className="report-feedback-block">
                      <strong>Recommendation: </strong>
                      {r.recommendation}
                    </p>
                  )}
                  {r.mt_reply && (
                    <p className="report-feedback-reply">
                      <strong>{generatedFor} replied: </strong>
                      {r.mt_reply}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Signature block */}
        <footer className="report-signatures">
          <div className="report-signature">
            <div className="report-signature-line" />
            <p>Trainee</p>
          </div>
          <div className="report-signature">
            <div className="report-signature-line" />
            <p>Mentor</p>
          </div>
          <div className="report-signature">
            <div className="report-signature-line" />
            <p>MA Center</p>
          </div>
        </footer>

        <p className="report-footer-note">
          MATTA Learning Portfolio System · Browave Corporation · This report was
          generated automatically from the trainee's learning records.
        </p>
      </div>
    </div>
  )
}
