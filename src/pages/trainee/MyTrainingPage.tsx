import { useEffect, useState, useCallback } from 'react'
import Icon from '../../components/Icon'
import TrainingRecordModal from './TrainingRecordModal'
import {
  listMyTrainingRecords,
  getMyTrainingProgress,
  deleteMyTrainingRecord,
  type TrainingRecord,
  type TrainingProgress,
} from '../../services/traineeService'

type PhaseFilter = 'all' | 'phase1_general' | 'phase2_department'

const PHASE_LABEL: Record<string, string> = {
  phase1_general: 'Phase 1',
  phase2_department: 'Phase 2',
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

function groupByMonth(records: TrainingRecord[]): { month: string; items: TrainingRecord[] }[] {
  const groups: Record<string, TrainingRecord[]> = {}
  for (const r of records) {
    const d = new Date(r.attendance_date)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    if (!groups[key]) groups[key] = []
    groups[key].push(r)
  }
  return Object.entries(groups)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([k, items]) => {
      const [y, m] = k.split('-')
      const label = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
      })
      return { month: label, items }
    })
}

export default function MyTrainingPage() {
  const [records, setRecords] = useState<TrainingRecord[]>([])
  const [progress, setProgress] = useState<TrainingProgress | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const [filter, setFilter] = useState<PhaseFilter>('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingRecord, setEditingRecord] = useState<TrainingRecord | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    const [recRes, progRes] = await Promise.all([
      listMyTrainingRecords(),
      getMyTrainingProgress(),
    ])
    if (recRes.error) setErrorMsg(recRes.error.message)
    else setRecords(recRes.records)
    if (!progRes.error) setProgress(progRes.progress)
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const handleEdit = (record: TrainingRecord) => {
    setEditingRecord(record)
    setModalOpen(true)
  }

  const handleAdd = () => {
    setEditingRecord(null)
    setModalOpen(true)
  }

  const handleDelete = async (record: TrainingRecord) => {
    const label = record.course?.course_name ?? 'this entry'
    const ok = window.confirm(
      `Delete "${label}" from ${formatDate(record.attendance_date)}?\n\nThis cannot be undone.`,
    )
    if (!ok) return
    const { error } = await deleteMyTrainingRecord(record.id)
    if (error) {
      alert(`Delete failed: ${error.message}`)
      return
    }
    refresh()
  }

  const filtered = filter === 'all' ? records : records.filter((r) => r.course?.phase === filter)
  const groups = groupByMonth(filtered)

  return (
    <div className="dashboard-content">
      <div className="page-header">
        <div>
          <p className="page-eyebrow">My MATTA Journey</p>
          <h1 className="page-title">My Training</h1>
          <p className="page-subtitle">
            Log every class, morning reading, and workshop. Your portfolio grows one entry at a time.
          </p>
        </div>
        <button className="btn btn-primary" onClick={handleAdd}>
          <Icon name="plus" size={18} /> Log entry
        </button>
      </div>

      {/* Progress summary */}
      {progress && (
        <section className="training-progress">
          <div className="training-progress-card">
            <div className="training-progress-header">
              <span className="training-progress-label">Phase 1 · General Training</span>
              <span className="training-progress-value">
                {progress.phase1_hours.toFixed(1)}
                <span className="muted"> / {progress.phase1_target} hrs</span>
              </span>
            </div>
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{
                  width: `${Math.min(100, (progress.phase1_hours / progress.phase1_target) * 100)}%`,
                }}
              />
            </div>
            <span className="training-progress-hint">
              {progress.phase1_hours >= progress.phase1_target
                ? '✓ Phase 1 target reached'
                : `${(progress.phase1_target - progress.phase1_hours).toFixed(1)} hrs to target`}
            </span>
          </div>

          <div className="training-progress-card">
            <div className="training-progress-header">
              <span className="training-progress-label">Phase 2 · Department Training</span>
              <span className="training-progress-value">
                {progress.phase2_hours.toFixed(1)}
                <span className="muted"> / {progress.phase2_target} hrs</span>
              </span>
            </div>
            <div className="progress-bar">
              <div
                className="progress-fill accent"
                style={{
                  width: `${Math.min(100, (progress.phase2_hours / progress.phase2_target) * 100)}%`,
                }}
              />
            </div>
            <span className="training-progress-hint">
              {progress.phase2_hours >= progress.phase2_target
                ? '✓ Phase 2 target reached'
                : `${(progress.phase2_target - progress.phase2_hours).toFixed(1)} hrs to target`}
            </span>
          </div>
        </section>
      )}

      {/* Filter bar */}
      <div className="filter-bar">
        <div className="filter-tabs">
          <button
            className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All ({records.length})
          </button>
          <button
            className={`filter-tab ${filter === 'phase1_general' ? 'active' : ''}`}
            onClick={() => setFilter('phase1_general')}
          >
            Phase 1 ({records.filter((r) => r.course?.phase === 'phase1_general').length})
          </button>
          <button
            className={`filter-tab ${filter === 'phase2_department' ? 'active' : ''}`}
            onClick={() => setFilter('phase2_department')}
          >
            Phase 2 ({records.filter((r) => r.course?.phase === 'phase2_department').length})
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="auth-error" role="alert">
          {errorMsg}
        </div>
      )}

      {loading ? (
        <div className="empty-state">
          <p className="empty-state-desc">Loading your training records…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <Icon name="book" size={28} />
          </div>
          <h2 className="empty-state-title">
            {records.length === 0 ? 'Start your learning diary' : 'No entries in this phase yet'}
          </h2>
          <p className="empty-state-desc">
            {records.length === 0
              ? "Log every morning reading, class, workshop, and self-study session. Each entry becomes part of your MATTA portfolio."
              : `Switch to another phase, or log your first ${
                  filter === 'phase1_general' ? 'Phase 1' : 'Phase 2'
                } entry.`}
          </p>
          <div className="empty-state-cta">
            <button className="btn btn-primary" onClick={handleAdd}>
              <Icon name="plus" size={18} /> Log entry
            </button>
          </div>
        </div>
      ) : (
        <div className="training-list">
          {groups.map((group) => (
            <div className="training-group" key={group.month}>
              <h3 className="training-group-title">{group.month}</h3>
              <div className="training-group-items">
                {group.items.map((r) => (
                  <div
                    key={r.id}
                    className={`training-record ${!r.attended ? 'missed' : ''}`}
                  >
                    <div className="training-record-main">
                      <div className="training-record-date">
                        <span className="training-record-day">
                          {new Date(r.attendance_date).getDate()}
                        </span>
                        <span className="training-record-weekday">
                          {new Date(r.attendance_date).toLocaleDateString('en-US', {
                            weekday: 'short',
                          })}
                        </span>
                      </div>
                      <div className="training-record-body">
                        <div className="training-record-title-row">
                          <span className="training-record-title">
                            {r.course?.course_name ?? 'Unnamed'}
                          </span>
                          {r.course?.phase && (
                            <span className="training-record-phase">
                              {PHASE_LABEL[r.course.phase]}
                            </span>
                          )}
                          {!r.attended && <span className="training-record-missed">Missed</span>}
                        </div>
                        <div className="training-record-meta">
                          {r.course?.instructor && <span>👤 {r.course.instructor}</span>}
                          <span>⏱ {Number(r.hours).toFixed(1)} hrs</span>
                          {r.test_score != null && (
                            <span className="training-record-score">📊 Score {r.test_score}</span>
                          )}
                        </div>
                        {r.reflection && (
                          <p className="training-record-reflection">{r.reflection}</p>
                        )}
                      </div>
                    </div>
                    <div className="training-record-actions">
                      <button
                        className="btn-icon"
                        onClick={() => handleEdit(r)}
                        aria-label="Edit"
                        title="Edit"
                      >
                        <Icon name="edit" size={16} />
                      </button>
                      <button
                        className="btn-icon btn-icon-danger"
                        onClick={() => handleDelete(r)}
                        aria-label="Delete"
                        title="Delete"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <TrainingRecordModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={refresh}
        editingRecord={editingRecord}
      />
    </div>
  )
}
