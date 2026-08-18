import { useState, useEffect, type FormEvent } from 'react'
import Modal from '../../components/Modal'
import {
  createMyTrainingRecord,
  updateMyTrainingRecord,
  type CoursePhase,
  type TrainingRecord,
} from '../../services/traineeService'

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  editingRecord?: TrainingRecord | null
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function TrainingRecordModal({ open, onClose, onSaved, editingRecord }: Props) {
  const isEdit = !!editingRecord

  // Form state
  const [courseName, setCourseName] = useState('')
  const [coursePhase, setCoursePhase] = useState<CoursePhase>('phase1_general')
  const [instructor, setInstructor] = useState('')
  const [category, setCategory] = useState('')
  const [attendanceDate, setAttendanceDate] = useState(todayISO())
  const [hours, setHours] = useState('1.0')
  const [attended, setAttended] = useState(true)
  const [testScore, setTestScore] = useState('')
  const [reflection, setReflection] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Pre-fill form when editing
  useEffect(() => {
    if (!open) return
    if (editingRecord && editingRecord.course) {
      setCourseName(editingRecord.course.course_name)
      setCoursePhase(editingRecord.course.phase)
      setInstructor(editingRecord.course.instructor ?? '')
      setCategory(editingRecord.course.category ?? '')
      setAttendanceDate(editingRecord.attendance_date)
      setHours(String(editingRecord.hours))
      setAttended(editingRecord.attended)
      setTestScore(editingRecord.test_score != null ? String(editingRecord.test_score) : '')
      setReflection(editingRecord.reflection ?? '')
    } else {
      // Reset for a fresh entry
      setCourseName('')
      setCoursePhase('phase1_general')
      setInstructor('')
      setCategory('')
      setAttendanceDate(todayISO())
      setHours('1.0')
      setAttended(true)
      setTestScore('')
      setReflection('')
    }
    setErrorMsg(null)
    setSubmitting(false)
  }, [open, editingRecord])

  const handleClose = () => {
    if (submitting) return
    onClose()
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)

    // Validation
    if (!courseName.trim()) {
      setErrorMsg('Please enter a course or activity name.')
      return
    }
    const hoursNum = parseFloat(hours)
    if (isNaN(hoursNum) || hoursNum < 0 || hoursNum > 24) {
      setErrorMsg('Hours must be a number between 0 and 24.')
      return
    }
    let scoreNum: number | null = null
    if (testScore.trim() !== '') {
      scoreNum = parseInt(testScore, 10)
      if (isNaN(scoreNum) || scoreNum < 0 || scoreNum > 100) {
        setErrorMsg('Test score must be a whole number between 0 and 100.')
        return
      }
    }

    setSubmitting(true)

    const payload = {
      attendance_date: attendanceDate,
      attended,
      hours: hoursNum,
      test_score: scoreNum,
      reflection: reflection.trim() || null,
      course_name: courseName.trim(),
      course_phase: coursePhase,
      course_instructor: instructor.trim() || undefined,
      course_category: category.trim() || undefined,
    }

    const result = isEdit
      ? await updateMyTrainingRecord(editingRecord!.id, payload)
      : await createMyTrainingRecord(payload)

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
      title={isEdit ? 'Edit training entry' : 'Log a training entry'}
      size="lg"
    >
      <form onSubmit={handleSubmit} noValidate>
        <p className="modal-subtitle">
          {isEdit
            ? 'Update this training record.'
            : 'Record what you learned today — a class, morning reading, workshop, or self-study session.'}
        </p>

        <div className="form-grid">
          {/* ---- Row 1: date + hours + attended ---- */}
          <label className="auth-field">
            <span className="auth-label">Date</span>
            <input
              type="date"
              value={attendanceDate}
              onChange={(e) => setAttendanceDate(e.target.value)}
              disabled={submitting}
              required
            />
          </label>

          <label className="auth-field">
            <span className="auth-label">Hours</span>
            <input
              type="number"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              placeholder="e.g. 2.0"
              step="0.25"
              min="0"
              max="24"
              disabled={submitting}
              required
            />
          </label>

          {/* ---- Row 2: course name (full width) ---- */}
          <label className="auth-field full">
            <span className="auth-label">Course / activity name</span>
            <input
              type="text"
              value={courseName}
              onChange={(e) => setCourseName(e.target.value)}
              placeholder="e.g. Morning Reading — Good to Great Ch.3"
              disabled={submitting}
              required
              autoFocus={!isEdit}
            />
            <span className="field-hint">
              Type freely. If a matching course already exists, we'll link it. Otherwise
              we'll add it to the course catalog for you.
            </span>
          </label>

          {/* ---- Row 3: phase + category ---- */}
          <label className="auth-field">
            <span className="auth-label">Phase</span>
            <select
              value={coursePhase}
              onChange={(e) => setCoursePhase(e.target.value as CoursePhase)}
              disabled={submitting}
            >
              <option value="phase1_general">Phase 1 · General Training</option>
              <option value="phase2_department">Phase 2 · Department Training</option>
            </select>
          </label>

          <label className="auth-field">
            <span className="auth-label">Category (optional)</span>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Morning Reading, SOP, Safety"
              disabled={submitting}
            />
          </label>

          {/* ---- Row 4: instructor + attended ---- */}
          <label className="auth-field">
            <span className="auth-label">Instructor (optional)</span>
            <input
              type="text"
              value={instructor}
              onChange={(e) => setInstructor(e.target.value)}
              placeholder="e.g. Rosalinda Manalo"
              disabled={submitting}
            />
          </label>

          <label className="auth-field">
            <span className="auth-label">Attended?</span>
            <div className="radio-row">
              <label className="radio-option">
                <input
                  type="radio"
                  checked={attended === true}
                  onChange={() => setAttended(true)}
                  disabled={submitting}
                />
                <span>Yes, attended</span>
              </label>
              <label className="radio-option">
                <input
                  type="radio"
                  checked={attended === false}
                  onChange={() => setAttended(false)}
                  disabled={submitting}
                />
                <span>No, missed</span>
              </label>
            </div>
          </label>

          {/* ---- Row 5: test score ---- */}
          <label className="auth-field full">
            <span className="auth-label">Test / quiz score (optional, 0–100)</span>
            <input
              type="number"
              value={testScore}
              onChange={(e) => setTestScore(e.target.value)}
              placeholder="Leave blank if no test"
              min="0"
              max="100"
              step="1"
              disabled={submitting}
            />
          </label>

          {/* ---- Row 6: reflection (full width, textarea) ---- */}
          <label className="auth-field full">
            <span className="auth-label">Reflection / notes</span>
            <textarea
              value={reflection}
              onChange={(e) => setReflection(e.target.value)}
              placeholder="What did you learn? What questions came up? Anything to remember for next time?"
              rows={4}
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
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Saving…' : isEdit ? 'Save changes' : 'Log entry'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
