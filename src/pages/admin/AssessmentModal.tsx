import { useState, useEffect, type FormEvent } from 'react'
import Modal from '../../components/Modal'
import {
  createAssessment,
  updateAssessment,
  ASSESSMENT_TYPE_OPTIONS,
  type Assessment,
  type AssessmentType,
} from '../../services/assessmentService'

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  traineeId: string
  traineeName: string
  editingAssessment?: Assessment | null
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function AssessmentModal({
  open,
  onClose,
  onSaved,
  traineeId,
  traineeName,
  editingAssessment,
}: Props) {
  const isEdit = !!editingAssessment

  const [type, setType] = useState<AssessmentType>('course_quiz')
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(todayISO())
  const [score, setScore] = useState('')
  const [maxScore, setMaxScore] = useState('100')
  const [comments, setComments] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    if (editingAssessment) {
      setType((editingAssessment.assessment_type as AssessmentType) ?? 'other')
      setTitle(editingAssessment.title)
      setDate(editingAssessment.assessment_date)
      setScore(editingAssessment.score != null ? String(editingAssessment.score) : '')
      setMaxScore(String(editingAssessment.max_score))
      setComments(editingAssessment.comments ?? '')
    } else {
      setType('course_quiz')
      setTitle('')
      setDate(todayISO())
      setScore('')
      setMaxScore('100')
      setComments('')
    }
    setErrorMsg(null)
    setSubmitting(false)
  }, [open, editingAssessment])

  const handleClose = () => {
    if (submitting) return
    onClose()
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)

    if (!title.trim()) {
      setErrorMsg('Please enter a title for this assessment.')
      return
    }
    const maxNum = parseFloat(maxScore)
    if (isNaN(maxNum) || maxNum <= 0) {
      setErrorMsg('Max score must be a positive number.')
      return
    }
    let scoreNum: number | null = null
    if (score.trim() !== '') {
      scoreNum = parseFloat(score)
      if (isNaN(scoreNum) || scoreNum < 0 || scoreNum > maxNum) {
        setErrorMsg(`Score must be between 0 and ${maxNum}.`)
        return
      }
    }

    setSubmitting(true)
    const input = {
      assessment_type: type,
      title,
      assessment_date: date,
      score: scoreNum,
      max_score: maxNum,
      comments,
    }
    const result = isEdit
      ? await updateAssessment(editingAssessment!.id, input)
      : await createAssessment(traineeId, input)
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
      title={isEdit ? 'Edit assessment 編輯評量' : 'Record assessment 記錄評量'}
      size="lg"
    >
      <form onSubmit={handleSubmit} noValidate>
        <p className="modal-subtitle">
          {isEdit ? 'Update this assessment for ' : 'Record a test or evaluation result for '}
          <strong>{traineeName}</strong>.
        </p>

        <div className="form-grid">
          <label className="auth-field">
            <span className="auth-label">Type 類型</span>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as AssessmentType)}
              disabled={submitting}
            >
              {ASSESSMENT_TYPE_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>

          <label className="auth-field">
            <span className="auth-label">Date 日期</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              disabled={submitting}
              required
            />
          </label>

          <label className="auth-field full">
            <span className="auth-label">Title 標題</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Month 2 Written Test — Quality Systems"
              disabled={submitting}
              required
              autoFocus={!isEdit}
            />
          </label>

          <label className="auth-field">
            <span className="auth-label">Score 分數 (leave blank if not scored yet)</span>
            <input
              type="number"
              value={score}
              onChange={(e) => setScore(e.target.value)}
              placeholder="e.g. 85"
              min="0"
              step="0.5"
              disabled={submitting}
            />
          </label>

          <label className="auth-field">
            <span className="auth-label">Max score 滿分</span>
            <input
              type="number"
              value={maxScore}
              onChange={(e) => setMaxScore(e.target.value)}
              min="1"
              step="1"
              disabled={submitting}
              required
            />
          </label>

          <label className="auth-field full">
            <span className="auth-label">Comments 評語 (optional)</span>
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Strengths, areas to improve, or context for this result."
              rows={3}
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
            {submitting ? 'Saving…' : isEdit ? 'Save changes 儲存' : 'Record assessment 記錄'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
