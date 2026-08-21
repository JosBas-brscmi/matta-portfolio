import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import Icon from '../../components/Icon'
import {
  getTraineeById,
  listTraineeTrainingRecords,
  getTraineeTrainingProgress,
  updateTraineeStatus,
  TRAINING_STATUS_OPTIONS,
  type TraineeFullDetail,
  type TrainingRecord,
  type TrainingProgress,
} from '../../services/traineeService'
import {
  listTraineePortfolioItems,
  getFileDownloadUrl,
  formatBytes,
  CATEGORY_LABEL,
  type PortfolioItem,
  type PortfolioFile,
} from '../../services/portfolioService'
import {
  listTraineeAssessments,
  ASSESSMENT_TYPE_LABEL,
  type Assessment,
} from '../../services/assessmentService'
import AssessmentModal from './AssessmentModal'
import {
  listTraineeReviews,
  deleteReview,
  REVIEW_TYPE_LABEL,
  type Review,
} from '../../services/reviewService'
import ReviewModal from './ReviewModal'
import { useAuth } from '../../contexts/AuthContext'

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  onboarding: { label: 'Onboarding 報到中', cls: 'status-onboarding' },
  phase1_general: { label: 'Phase 1 · General 通識', cls: 'status-phase1' },
  phase2_department: { label: 'Phase 2 · Department 部門', cls: 'status-phase2' },
  final_assessment: { label: 'Final assessment 期末評核', cls: 'status-final' },
  graduated: { label: 'Graduated 結業', cls: 'status-graduated' },
  transferred: { label: 'Transferred 轉調', cls: 'status-transferred' },
  withdrawn: { label: 'Withdrawn 退訓', cls: 'status-withdrawn' },
}

function formatDate(iso: string): string {
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

export default function TraineeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { profile: viewerProfile } = useAuth()

  const [trainee, setTrainee] = useState<TraineeFullDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [trainingRecords, setTrainingRecords] = useState<TrainingRecord[]>([])
  const [trainingProgress, setTrainingProgress] = useState<TrainingProgress | null>(null)
  const [portfolioItems, setPortfolioItems] = useState<PortfolioItem[]>([])
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [assessmentModalOpen, setAssessmentModalOpen] = useState(false)
  const [editingAssessment, setEditingAssessment] = useState<Assessment | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])
  const [reviewModalOpen, setReviewModalOpen] = useState(false)
  const [editingReview, setEditingReview] = useState<Review | null>(null)
  const [savingStatus, setSavingStatus] = useState(false)

  const handleStatusChange = async (newStatus: string) => {
    if (!trainee) return
    setSavingStatus(true)
    const { error } = await updateTraineeStatus(trainee.id, newStatus)
    setSavingStatus(false)
    if (error) {
      alert(`Update failed: ${error.message}`)
      return
    }
    setTrainee({ ...trainee, training_status: newStatus })
  }

  const refreshAssessments = () => {
    if (!id) return
    listTraineeAssessments(id).then(({ assessments: list, error }) => {
      if (!error) setAssessments(list)
    })
  }

  const refreshReviews = () => {
    if (!id) return
    listTraineeReviews(id).then(({ reviews: list, error }) => {
      if (!error) setReviews(list)
    })
  }

  useEffect(() => {
    if (!id) return

    let cancelled = false

    const loadTraineeDetails = async () => {
      setLoading(true)
      setErrorMsg(null)

      try {
        const results = await Promise.allSettled([
          getTraineeById(id),
          listTraineeTrainingRecords(id),
          getTraineeTrainingProgress(id),
          listTraineePortfolioItems(id),
          listTraineeAssessments(id),
          listTraineeReviews(id),
        ])

        if (cancelled) return

        // ------------------------------------------------------------
        // Trainee profile
        // ------------------------------------------------------------

        const traineeResult = results[0]

        if (traineeResult.status === 'rejected') {
          setErrorMsg(
            traineeResult.reason?.message ??
              'Failed to load trainee profile.',
          )
        } else {
          const traineeRes = traineeResult.value

          if (traineeRes.error) {
            setErrorMsg(traineeRes.error.message)
          } else if (!traineeRes.trainee) {
            setErrorMsg(
              'Trainee not found — they may have been removed.',
            )
          } else {
            setTrainee(traineeRes.trainee)
          }
        }

        // ------------------------------------------------------------
        // Training records
        // ------------------------------------------------------------

        const recordsResult = results[1]

        if (recordsResult.status === 'fulfilled') {
          const recordsRes = recordsResult.value

          if (!recordsRes.error) {
            setTrainingRecords(recordsRes.records)
          } else {
            console.error(
              '[TraineeDetailPage] Training records error:',
              recordsRes.error,
            )
          }
        } else {
          console.error(
            '[TraineeDetailPage] Training records request failed:',
            recordsResult.reason,
          )
        }

        // ------------------------------------------------------------
        // Training progress
        // ------------------------------------------------------------

        const progressResult = results[2]

        if (progressResult.status === 'fulfilled') {
          const progressRes = progressResult.value

          if (!progressRes.error) {
            setTrainingProgress(progressRes.progress)
          } else {
            console.error(
              '[TraineeDetailPage] Training progress error:',
              progressRes.error,
            )
          }
        } else {
          console.error(
            '[TraineeDetailPage] Training progress request failed:',
            progressResult.reason,
          )
        }

        // ------------------------------------------------------------
        // Portfolio
        // ------------------------------------------------------------

        const portfolioResult = results[3]

        if (portfolioResult.status === 'fulfilled') {
          const portfolioRes = portfolioResult.value

          if (!portfolioRes.error) {
            setPortfolioItems(portfolioRes.items)
          } else {
            console.error(
              '[TraineeDetailPage] Portfolio error:',
              portfolioRes.error,
            )
          }
        } else {
          console.error(
            '[TraineeDetailPage] Portfolio request failed:',
            portfolioResult.reason,
          )
        }

        // ------------------------------------------------------------
        // Assessments
        // ------------------------------------------------------------

        const assessmentResult = results[4]

        if (assessmentResult.status === 'fulfilled') {
          const assessRes = assessmentResult.value

          if (!assessRes.error) {
            setAssessments(assessRes.assessments)
          } else {
            console.error(
              '[TraineeDetailPage] Assessments error:',
              assessRes.error,
            )
          }
        } else {
          console.error(
            '[TraineeDetailPage] Assessments request failed:',
            assessmentResult.reason,
          )
        }

        // ------------------------------------------------------------
        // Reviews
        // ------------------------------------------------------------

        const reviewResult = results[5]

        if (reviewResult.status === 'fulfilled') {
          const reviewRes = reviewResult.value

          if (!reviewRes.error) {
            setReviews(reviewRes.reviews)
          } else {
            console.error(
              '[TraineeDetailPage] Reviews error:',
              reviewRes.error,
            )
          }
        } else {
          console.error(
            '[TraineeDetailPage] Reviews request failed:',
            reviewResult.reason,
          )
        }
      } catch (error) {
        if (!cancelled) {
          console.error(
            '[TraineeDetailPage] Unexpected loading error:',
            error,
          )

          setErrorMsg(
            error instanceof Error
              ? error.message
              : 'Failed to load trainee details.',
          )
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadTraineeDetails()

    return () => {
      cancelled = true
    }
  }, [id])

  const handleDeleteReview = async (r: Review) => {
    if (!window.confirm('Delete this feedback entry? 確定刪除這則回饋？')) return
    const { error } = await deleteReview(r.id)
    if (error) {
      alert(`Delete failed: ${error.message}`)
      return
    }
    refreshReviews()
  }

  const handleDownload = async (file: PortfolioFile) => {
    setDownloadingId(file.id)
    const { url, error } = await getFileDownloadUrl(file.storage_path)
    setDownloadingId(null)
    if (error || !url) {
      alert(`Could not open file: ${error?.message ?? 'unknown error'}`)
      return
    }
    window.open(url, '_blank', 'noopener')
  }

  const canEdit =
    viewerProfile?.role === 'owner' || viewerProfile?.role === 'ma_center'

  if (loading) {
    return (
      <div className="dashboard-content">
        <div className="empty-state">
          <p className="empty-state-desc">Loading trainee details\u2026</p>
        </div>
      </div>
    )
  }

  if (errorMsg || !trainee) {
    return (
      <div className="dashboard-content">
        <Link to="/admin/trainees" className="back-link">
          <Icon name="arrowLeft" size={16} /> Back to trainees
        </Link>
        <div className="auth-error" role="alert">
          {errorMsg ?? 'Trainee not found.'}
        </div>
      </div>
    )
  }

  const status = STATUS_LABELS[trainee.training_status] ?? {
    label: trainee.training_status,
    cls: 'status-onboarding',
  }

  return (
    <div className="dashboard-content">
      <Link to="/admin/trainees" className="back-link">
        <Icon name="arrowLeft" size={16} /> Back to trainees 返回列表
      </Link>

      <div className="page-header detail-header">
        <div>
          <p className="page-eyebrow">Trainee profile 學員資料</p>
          <h1 className="page-title">
            {trainee.users_profile?.full_name ?? 'Unknown trainee'}
          </h1>
          <div className="detail-meta">
            <span className={`status-pill ${status.cls}`}>{status.label}</span>
            <span className="meta-separator">\u00B7</span>
            <span>{trainee.batch_code}</span>
            <span className="meta-separator">\u00B7</span>
            <span>
              <code className="mono-small">{trainee.employee_id}</code>
            </span>
            <span className="meta-separator">\u00B7</span>
            <span>Onboarded {formatDate(trainee.onboard_date)}</span>
          </div>
        </div>

        <div className="detail-header-actions">
          <Link to={`/admin/trainees/${trainee.id}/report`} className="btn btn-primary">
            <Icon name="book" size={16} /> Portfolio report 學習報告
          </Link>
          {canEdit && (
            <button className="btn btn-ghost" disabled title="Edit comes in a later step">
              <Icon name="edit" size={16} /> Edit profile
            </button>
          )}
        </div>
      </div>

      {/* Profile completeness */}
      <div className="completeness-wide">
        <div className="completeness-wide-header">
          <span>Profile completeness 資料完成度</span>
          <span className="muted">{trainee.profile_completeness}%</span>
        </div>
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${trainee.profile_completeness}%` }}
          />
        </div>
      </div>

      {/* Main info grid */}
      <section className="detail-grid">
        <div className="dashboard-card">
          <div className="dashboard-card-header">
            <h2>Personal details 個人資料</h2>
          </div>
          <dl className="dashboard-meta">
            <div>
              <dt>Email</dt>
              <dd>{trainee.users_profile?.email ?? '\u2014'}</dd>
            </div>
            <div>
              <dt>English name</dt>
              <dd>{trainee.users_profile?.english_name ?? '\u2014'}</dd>
            </div>
            <div>
              <dt>Education</dt>
              <dd>{trainee.education ?? 'Not provided'}</dd>
            </div>
            <div>
              <dt>Department</dt>
              <dd>{trainee.department ?? 'Not assigned'}</dd>
            </div>
          </dl>
        </div>

        <div className="dashboard-card">
          <div className="dashboard-card-header">
            <h2>Mentor &amp; status 導師與狀態</h2>
          </div>
          <dl className="dashboard-meta">
            <div>
              <dt>Assigned mentor</dt>
              <dd>
                {trainee.mentor ? (
                  <>
                    <div>{trainee.mentor.full_name}</div>
                    <div className="muted small">{trainee.mentor.email}</div>
                  </>
                ) : (
                  <span className="muted">Not assigned</span>
                )}
              </dd>
            </div>
            <div>
              <dt>Training stage 訓練階段</dt>
              <dd>
                {canEdit ? (
                  <select
                    className="users-select"
                    value={trainee.training_status}
                    onChange={(e) => handleStatusChange(e.target.value)}
                    disabled={savingStatus}
                  >
                    {TRAINING_STATUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className={`status-pill ${status.cls}`}>{status.label}</span>
                )}
              </dd>
            </div>
            <div>
              <dt>Account status</dt>
              <dd>
                <span
                  className={`status-pill status-${trainee.users_profile?.status ?? 'inactive'}`}
                >
                  {trainee.users_profile?.status ?? 'unknown'}
                </span>
              </dd>
            </div>
            <div>
              <dt>Joined MATTA</dt>
              <dd>{formatDate(trainee.created_at)}</dd>
            </div>
          </dl>
        </div>
      </section>

      {/* Future sections */}
      <section className="detail-sections">
        <div className="dashboard-card training-records-card">
          <div className="dashboard-card-header">
            <h2>Training records 訓練紀錄</h2>
            <span className="card-tag">{trainingRecords.length} entries</span>
          </div>
          {trainingProgress && (
            <div className="training-mini-progress">
              <div className="mini-progress-row">
                <span className="mini-progress-label">Phase 1</span>
                <span className="mini-progress-value">
                  {trainingProgress.phase1_hours.toFixed(1)} / {trainingProgress.phase1_target} hrs
                </span>
              </div>
              <div className="progress-bar mini">
                <div
                  className="progress-fill"
                  style={{
                    width: `${Math.min(100, (trainingProgress.phase1_hours / trainingProgress.phase1_target) * 100)}%`,
                  }}
                />
              </div>
              <div className="mini-progress-row">
                <span className="mini-progress-label">Phase 2</span>
                <span className="mini-progress-value">
                  {trainingProgress.phase2_hours.toFixed(1)} / {trainingProgress.phase2_target} hrs
                </span>
              </div>
              <div className="progress-bar mini">
                <div
                  className="progress-fill accent"
                  style={{
                    width: `${Math.min(100, (trainingProgress.phase2_hours / trainingProgress.phase2_target) * 100)}%`,
                  }}
                />
              </div>
            </div>
          )}
          {trainingRecords.length === 0 ? (
            <p className="dashboard-card-body muted">
              No training records yet. Records will appear here once the trainee
              starts logging their learning journey.
            </p>
          ) : (
            <div className="training-records-mini">
              {trainingRecords.slice(0, 5).map((r) => (
                <div key={r.id} className="training-record-mini">
                  <span className="training-record-mini-date">
                    {new Date(r.attendance_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                  <span className="training-record-mini-title">
                    {r.course?.course_name ?? 'Unnamed'}
                  </span>
                  <span className="training-record-mini-hours">
                    {Number(r.hours).toFixed(1)}h
                  </span>
                  {r.test_score != null && (
                    <span className="training-record-mini-score">{r.test_score}</span>
                  )}
                </div>
              ))}
              {trainingRecords.length > 5 && (
                <p className="training-records-more muted">
                  + {trainingRecords.length - 5} more entries
                </p>
              )}
            </div>
          )}
        </div>

        <div className="dashboard-card">
          <div className="dashboard-card-header">
            <h2>Portfolio items 學習檔案</h2>
            <span className="card-tag">{portfolioItems.length} items</span>
          </div>
          {portfolioItems.length === 0 ? (
            <p className="dashboard-card-body muted">
              No portfolio items yet. Uploaded reflections, projects,
              presentations, and QCC reports will appear here.
            </p>
          ) : (
            <div className="portfolio-mini-list">
              {portfolioItems.map((item) => (
                <div key={item.id} className="portfolio-mini">
                  <div className="portfolio-mini-head">
                    <span className={`pf-status pf-status-${item.status}`}>
                      {item.status === 'pending'
                        ? 'Pending'
                        : item.status === 'approved'
                          ? 'Approved'
                          : 'Returned'}
                    </span>
                    <span className="portfolio-mini-title">{item.title}</span>
                    {item.category && (
                      <span className="pf-category">
                        {CATEGORY_LABEL[item.category] ?? item.category}
                      </span>
                    )}
                  </div>
                  {item.portfolio_files.length > 0 && (
                    <ul className="file-list compact">
                      {item.portfolio_files.map((f) => (
                        <li key={f.id} className="file-chip clickable">
                          <button
                            type="button"
                            className="file-chip-open"
                            onClick={() => handleDownload(f)}
                            disabled={downloadingId === f.id}
                            title={`Open ${f.file_name}`}
                          >
                            <Icon name="folder" size={13} />
                            <span className="file-chip-name">{f.file_name}</span>
                            <span className="file-chip-size">
                              {downloadingId === f.id
                                ? 'Opening…'
                                : formatBytes(f.file_size_bytes)}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="dashboard-card">
          <div className="dashboard-card-header">
            <h2>Assessments 評量</h2>
            <div className="card-header-actions">
              <span className="card-tag">{assessments.length} recorded</span>
              <button
                className="btn-icon"
                onClick={() => {
                  setEditingAssessment(null)
                  setAssessmentModalOpen(true)
                }}
                aria-label="Record assessment"
                title="Record assessment"
              >
                <Icon name="plus" size={16} />
              </button>
            </div>
          </div>
          {assessments.length === 0 ? (
            <p className="dashboard-card-body muted">
              No assessments yet. Use + to record entrance tests, quizzes,
              mid-term and final assessments.
            </p>
          ) : (
            <div className="assessment-mini-list">
              {assessments.slice(0, 6).map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className="assessment-mini"
                  onClick={() => {
                    setEditingAssessment(a)
                    setAssessmentModalOpen(true)
                  }}
                  title="Click to edit"
                >
                  <span className="assessment-mini-date">
                    {new Date(a.assessment_date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                  <span className="assessment-mini-title">{a.title}</span>
                  <span className="pf-category">
                    {ASSESSMENT_TYPE_LABEL[a.assessment_type ?? ''] ?? '—'}
                  </span>
                  <span className="assessment-mini-score">
                    {a.score != null ? `${Number(a.score)}/${Number(a.max_score)}` : '—'}
                  </span>
                </button>
              ))}
              {assessments.length > 6 && (
                <p className="training-records-more muted">
                  + {assessments.length - 6} more
                </p>
              )}
            </div>
          )}
        </div>

        <div className="dashboard-card">
          <div className="dashboard-card-header">
            <h2>Mentor &amp; manager feedback 導師與主管回饋</h2>
            <div className="card-header-actions">
              <span className="card-tag">{reviews.length} entries</span>
              <button
                className="btn-icon"
                onClick={() => {
                  setEditingReview(null)
                  setReviewModalOpen(true)
                }}
                aria-label="Write feedback"
                title="Write feedback 撰寫回饋"
              >
                <Icon name="plus" size={16} />
              </button>
            </div>
          </div>
          {reviews.length === 0 ? (
            <p className="dashboard-card-body muted">
              No feedback yet. Use + to write weekly notes, monthly reviews, or
              a short encouragement — the trainee will see it right away.
            </p>
          ) : (
            <div className="review-feed">
              {reviews.slice(0, 5).map((r) => {
                const mine = r.reviewer_id === viewerProfile?.id
                return (
                  <div key={r.id} className="review-entry">
                    <div className="review-entry-head">
                      <span className="pf-category">
                        {REVIEW_TYPE_LABEL[r.review_type ?? ''] ?? r.review_type ?? 'Feedback'}
                      </span>
                      {r.review_period && (
                        <span className="review-entry-period">{r.review_period}</span>
                      )}
                      {r.rating != null && (
                        <span className="review-entry-stars">
                          {'★'.repeat(r.rating)}
                          {'☆'.repeat(5 - r.rating)}
                        </span>
                      )}
                      {mine && (
                        <span className="review-entry-actions">
                          <button
                            className="btn-icon"
                            onClick={() => {
                              setEditingReview(r)
                              setReviewModalOpen(true)
                            }}
                            aria-label="Edit"
                            title="Edit"
                          >
                            <Icon name="edit" size={14} />
                          </button>
                          <button
                            className="btn-icon btn-icon-danger"
                            onClick={() => handleDeleteReview(r)}
                            aria-label="Delete"
                            title="Delete"
                          >
                            ×
                          </button>
                        </span>
                      )}
                    </div>
                    {r.strengths && <p className="review-entry-text">{r.strengths}</p>}
                    {r.areas_for_improvement && (
                      <p className="review-entry-text improve">
                        <strong>Improve:</strong> {r.areas_for_improvement}
                      </p>
                    )}
                    {r.recommendation && (
                      <p className="review-entry-text">
                        <strong>Next:</strong> {r.recommendation}
                      </p>
                    )}
                    <p className="review-entry-byline">
                      — {r.reviewer_name ?? 'Unknown'} ·{' '}
                      {formatDate(r.reviewed_at)}
                    </p>
                    {r.mt_reply && (
                      <div className="mt-reply readonly">
                        <span className="mt-reply-label">
                          {trainee.users_profile?.full_name ?? 'Trainee'} replied 學員回覆
                        </span>
                        <p className="mt-reply-text">{r.mt_reply}</p>
                      </div>
                    )}
                  </div>
                )
              })}
              {reviews.length > 5 && (
                <p className="training-records-more muted">+ {reviews.length - 5} more</p>
              )}
            </div>
          )}
        </div>
      </section>

      <ReviewModal
        open={reviewModalOpen}
        onClose={() => setReviewModalOpen(false)}
        onSaved={refreshReviews}
        traineeId={trainee.id}
        traineeName={trainee.users_profile?.full_name ?? 'this trainee'}
        viewerRole={viewerProfile?.role ?? ''}
        editingReview={editingReview}
      />

      <AssessmentModal
        open={assessmentModalOpen}
        onClose={() => setAssessmentModalOpen(false)}
        onSaved={refreshAssessments}
        traineeId={trainee.id}
        traineeName={trainee.users_profile?.full_name ?? 'this trainee'}
        editingAssessment={editingAssessment}
      />
    </div>
  )
}
