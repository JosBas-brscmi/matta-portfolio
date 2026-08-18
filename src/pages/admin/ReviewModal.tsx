import { useState, useEffect, type FormEvent } from 'react'
import Modal from '../../components/Modal'
import {
  createReview,
  updateReview,
  REVIEW_TYPE_OPTIONS,
  type Review,
  type ReviewType,
} from '../../services/reviewService'

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  traineeId: string
  traineeName: string
  viewerRole: string
  editingReview?: Review | null
}

function currentPeriod(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export default function ReviewModal({
  open,
  onClose,
  onSaved,
  traineeId,
  traineeName,
  viewerRole,
  editingReview,
}: Props) {
  const isEdit = !!editingReview
  const isBoard = viewerRole === 'ma_board'

  const [type, setType] = useState<ReviewType>('weekly_note')
  const [period, setPeriod] = useState(currentPeriod())
  const [rating, setRating] = useState<number | null>(null)
  const [strengths, setStrengths] = useState('')
  const [improvements, setImprovements] = useState('')
  const [recommendation, setRecommendation] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    if (editingReview) {
      setType((editingReview.review_type as ReviewType) ?? 'other')
      setPeriod(editingReview.review_period ?? '')
      setRating(editingReview.rating)
      setStrengths(editingReview.strengths ?? '')
      setImprovements(editingReview.areas_for_improvement ?? '')
      setRecommendation(editingReview.recommendation ?? '')
    } else {
      // MA Board members default to a light-weight encouragement note.
      setType(isBoard ? 'encouragement' : 'weekly_note')
      setPeriod(currentPeriod())
      setRating(null)
      setStrengths('')
      setImprovements('')
      setRecommendation('')
    }
    setErrorMsg(null)
    setSubmitting(false)
  }, [open, editingReview, isBoard])

  const handleClose = () => {
    if (submitting) return
    onClose()
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)

    if (!strengths.trim() && !improvements.trim() && !recommendation.trim()) {
      setErrorMsg(
        'Please write at least one comment before saving. 請至少填寫一項回饋內容。',
      )
      return
    }

    setSubmitting(true)
    const input = {
      review_type: type,
      review_period: period,
      rating,
      strengths,
      areas_for_improvement: improvements,
      recommendation,
    }
    const result = isEdit
      ? await updateReview(editingReview!.id, input)
      : await createReview(traineeId, input)
    setSubmitting(false)

    if (result.error) {
      setErrorMsg(result.error.message)
      return
    }
    onSaved()
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={
        isEdit
          ? 'Edit feedback 編輯回饋'
          : isBoard
            ? 'Leave an encouragement 留下鼓勵'
            : 'Write feedback 撰寫回饋'
      }
      size="lg"
    >
      <form onSubmit={handleSubmit} noValidate>
        <p className="modal-subtitle">
          {isBoard && !isEdit ? (
            <>
              A few words from senior management mean a lot to a trainee.
              Share what impressed you about <strong>{traineeName}</strong> —
              even one sentence makes a difference.
              <br />
              來自高階主管的短短一句話，對學員意義重大。
            </>
          ) : (
            <>
              Feedback for <strong>{traineeName}</strong>. The trainee will see
              everything you write here. 學員將看到您填寫的所有內容。
            </>
          )}
        </p>

        <div className="form-grid">
          <label className="auth-field">
            <span className="auth-label">Type 類型</span>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as ReviewType)}
              disabled={submitting}
            >
              {REVIEW_TYPE_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>

          <label className="auth-field">
            <span className="auth-label">Period 期間 (optional)</span>
            <input
              type="text"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              placeholder="e.g. 2026-07 or Week 27"
              disabled={submitting}
            />
          </label>

          {/* Rating */}
          <div className="auth-field full">
            <span className="auth-label">Overall rating 整體評分 (optional)</span>
            <div className="rating-row">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`rating-star ${rating != null && n <= rating ? 'on' : ''}`}
                  onClick={() => setRating(rating === n ? null : n)}
                  disabled={submitting}
                  aria-label={`${n} star`}
                >
                  ★
                </button>
              ))}
              {rating != null && (
                <button
                  type="button"
                  className="rating-clear"
                  onClick={() => setRating(null)}
                  disabled={submitting}
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <label className="auth-field full">
            <span className="auth-label">
              {isBoard ? 'What impressed you 令您印象深刻之處' : 'Strengths 優點'}
            </span>
            <textarea
              value={strengths}
              onChange={(e) => setStrengths(e.target.value)}
              placeholder={
                isBoard
                  ? 'e.g. I was impressed by your initiative on the QCC project — keep bringing that energy!'
                  : 'What did the trainee do well this period?'
              }
              rows={3}
              disabled={submitting}
            />
          </label>

          <label className="auth-field full">
            <span className="auth-label">Areas for improvement 待改進 (optional)</span>
            <textarea
              value={improvements}
              onChange={(e) => setImprovements(e.target.value)}
              placeholder="Concrete, constructive suggestions work best."
              rows={3}
              disabled={submitting}
            />
          </label>

          <label className="auth-field full">
            <span className="auth-label">Recommendation 建議 (optional)</span>
            <textarea
              value={recommendation}
              onChange={(e) => setRecommendation(e.target.value)}
              placeholder="Next steps, focus areas, or words of encouragement for the coming period."
              rows={2}
              disabled={submitting}
            />
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
            {submitting ? 'Saving…' : isEdit ? 'Save changes 儲存' : 'Send feedback 送出回饋'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
