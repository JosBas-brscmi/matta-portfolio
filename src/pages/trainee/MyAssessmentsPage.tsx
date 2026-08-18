import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../../components/Icon'
import {
  listMyAssessments,
  summarize,
  ASSESSMENT_TYPE_LABEL,
  type Assessment,
} from '../../services/assessmentService'
import {
  listMyReviews,
  REVIEW_TYPE_LABEL,
  type Review,
} from '../../services/reviewService'
import ReviewReplyBox from '../../components/ReviewReplyBox'

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

function scorePct(a: Assessment): number | null {
  if (a.score == null || !a.max_score) return null
  return Math.round((Number(a.score) / Number(a.max_score)) * 100)
}

function scoreClass(pct: number | null): string {
  if (pct == null) return ''
  if (pct >= 80) return 'score-good'
  if (pct >= 60) return 'score-ok'
  return 'score-low'
}

export default function MyAssessmentsPage() {
  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const refreshReviews = () => {
    listMyReviews().then((rRes) => {
      if (!rRes.error) setReviews(rRes.reviews)
    })
  }

  useEffect(() => {
    Promise.all([listMyAssessments(), listMyReviews()]).then(([aRes, rRes]) => {
      if (aRes.error) setErrorMsg(aRes.error.message)
      else setAssessments(aRes.assessments)
      if (!rRes.error) setReviews(rRes.reviews)
      setLoading(false)
    })
  }, [])

  const summary = summarize(assessments)

  return (
    <div className="dashboard-content">
      <div className="page-header">
        <div>
          <p className="page-eyebrow">My MATTA Journey</p>
          <h1 className="page-title">Assessments &amp; Feedback</h1>
          <p className="page-subtitle">
            Test scores, mid-term and final assessments from each stage of your
            MATTA program.
          </p>
        </div>
        <Link to="/my-report" className="btn btn-ghost">
          <Icon name="book" size={18} /> View my report
        </Link>
      </div>

      {/* Summary strip */}
      {assessments.length > 0 && (
        <section className="assessment-summary">
          <div className="quickstat">
            <span className="quickstat-label">Assessments recorded</span>
            <span className="quickstat-value">{summary.total}</span>
          </div>
          <div className="quickstat">
            <span className="quickstat-label">Scored</span>
            <span className="quickstat-value">{summary.scored}</span>
          </div>
          <div className="quickstat">
            <span className="quickstat-label">Average</span>
            <span className="quickstat-value">
              {summary.averagePct != null ? `${summary.averagePct}%` : '—'}
            </span>
          </div>
        </section>
      )}

      {errorMsg && (
        <div className="auth-error" role="alert">
          {errorMsg}
        </div>
      )}

      {loading ? (
        <div className="empty-state">
          <p className="empty-state-desc">Loading your assessments…</p>
        </div>
      ) : assessments.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <Icon name="check" size={28} />
          </div>
          <h2 className="empty-state-title">No assessments recorded yet</h2>
          <p className="empty-state-desc">
            As you progress through MATTA, your assessment scores will appear
            here. The MA Center and your mentor record entrance tests, course
            quizzes, mid-term and final assessments.
          </p>
        </div>
      ) : (
        <div className="assessment-list">
          {assessments.map((a) => {
            const pct = scorePct(a)
            return (
              <div key={a.id} className="assessment-card">
                <div className="assessment-card-main">
                  <div className="assessment-card-head">
                    <span className="pf-category">
                      {ASSESSMENT_TYPE_LABEL[a.assessment_type ?? ''] ?? a.assessment_type ?? 'Assessment'}
                    </span>
                    <span className="assessment-date">{formatDate(a.assessment_date)}</span>
                  </div>
                  <h3 className="assessment-title">{a.title}</h3>
                  {a.assessor_name && (
                    <p className="assessment-assessor">Assessed by {a.assessor_name}</p>
                  )}
                  {a.comments && <p className="assessment-comments">{a.comments}</p>}
                </div>
                <div className={`assessment-score ${scoreClass(pct)}`}>
                  {a.score != null ? (
                    <>
                      <span className="assessment-score-value">{Number(a.score)}</span>
                      <span className="assessment-score-max">/ {Number(a.max_score)}</span>
                      {pct != null && <span className="assessment-score-pct">{pct}%</span>}
                    </>
                  ) : (
                    <span className="assessment-score-pending">Not scored</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ---- Feedback from mentors & management ---- */}
      <div className="page-header" style={{ marginTop: '2rem' }}>
        <div>
          <h2 className="page-title" style={{ fontSize: '1.4rem' }}>
            Feedback from your mentors 導師回饋
          </h2>
          <p className="page-subtitle">
            Notes, reviews, and encouragement from your mentor, managers, and
            senior management.
          </p>
        </div>
      </div>

      {!loading && reviews.length === 0 ? (
        <div className="empty-state">
          <p className="empty-state-desc">
            No feedback yet. Your mentor's weekly notes and management's
            encouragement will appear here.
          </p>
        </div>
      ) : (
        <div className="review-feed standalone">
          {reviews.map((r) => (
            <div key={r.id} className="review-entry card">
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
                — {r.reviewer_name ?? 'Unknown'} · {formatDate(r.reviewed_at)}
              </p>
              <ReviewReplyBox review={r} onSaved={refreshReviews} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
