import { useEffect, useState, useCallback } from 'react'
import Icon from '../../components/Icon'
import Modal from '../../components/Modal'
import {
  listReviewQueue,
  reviewPortfolioItem,
  getFileDownloadUrl,
  formatBytes,
  CATEGORY_LABEL,
  type ReviewQueueItem,
  type PortfolioFile,
  type PortfolioStatus,
} from '../../services/portfolioService'

type StatusFilter = 'pending' | 'approved' | 'returned' | 'all'

const STATUS_META: Record<PortfolioStatus, { label: string; cls: string }> = {
  pending: { label: 'Pending review 待審核', cls: 'pf-status-pending' },
  approved: { label: 'Approved 已核准', cls: 'pf-status-approved' },
  returned: { label: 'Returned 已退回', cls: 'pf-status-returned' },
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

interface DecisionState {
  item: ReviewQueueItem
  decision: 'approved' | 'returned'
}

export default function ReviewsPage() {
  const [items, setItems] = useState<ReviewQueueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [filter, setFilter] = useState<StatusFilter>('pending')
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  // Decision modal state
  const [decisionState, setDecisionState] = useState<DecisionState | null>(null)
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [modalError, setModalError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    const { items: list, error } = await listReviewQueue()
    if (error) setErrorMsg(error.message)
    else {
      setItems(list)
      setErrorMsg(null)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const handleDownload = async (file: PortfolioFile) => {
    setDownloadingId(file.id)
    const { url, error } = await getFileDownloadUrl(file.id)
    setDownloadingId(null)
    if (error || !url) {
      alert(`Could not open file: ${error?.message ?? 'unknown error'}`)
      return
    }
    window.open(url, '_blank', 'noopener')
  }

  const openDecision = (item: ReviewQueueItem, decision: 'approved' | 'returned') => {
    setDecisionState({ item, decision })
    setNote('')
    setModalError(null)
    setSubmitting(false)
  }

  const closeDecision = () => {
    if (submitting) return
    setDecisionState(null)
  }

  const confirmDecision = async () => {
    if (!decisionState) return
    if (decisionState.decision === 'returned' && !note.trim()) {
      setModalError('Please tell the trainee what to improve — feedback is required when returning an item.')
      return
    }
    setSubmitting(true)
    const { error } = await reviewPortfolioItem(
      decisionState.item.id,
      decisionState.decision,
      note,
    )
    setSubmitting(false)
    if (error) {
      setModalError(error.message)
      return
    }
    setDecisionState(null)
    refresh()
  }

  const counts = {
    pending: items.filter((i) => i.status === 'pending').length,
    approved: items.filter((i) => i.status === 'approved').length,
    returned: items.filter((i) => i.status === 'returned').length,
    all: items.length,
  }

  const filtered = filter === 'all' ? items : items.filter((i) => i.status === filter)

  return (
    <div className="dashboard-content">
      <div className="page-header">
        <div>
          <p className="page-eyebrow">Workspace 工作區</p>
          <h1 className="page-title">Portfolio reviews 學習檔案審核</h1>
          <p className="page-subtitle">
            Approve or return Learning Portfolio items submitted by trainees.
            Returned items go back to the trainee with your feedback.
          </p>
        </div>
      </div>

      <div className="filter-bar">
        <div className="filter-tabs">
          {(
            [
              ['pending', `Pending 待審 (${counts.pending})`],
              ['returned', `Returned 已退回 (${counts.returned})`],
              ['approved', `Approved 已核准 (${counts.approved})`],
              ['all', `All 全部 (${counts.all})`],
            ] as [StatusFilter, string][]
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
      </div>

      {errorMsg && (
        <div className="auth-error" role="alert">
          {errorMsg}
        </div>
      )}

      {loading ? (
        <div className="empty-state">
          <p className="empty-state-desc">Loading review queue…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <Icon name="check" size={28} />
          </div>
          <h2 className="empty-state-title">
            {filter === 'pending' ? 'Queue is clear 🎉' : 'Nothing here'}
          </h2>
          <p className="empty-state-desc">
            {filter === 'pending'
              ? 'No portfolio items are waiting for review right now.'
              : 'Switch to another tab to see items with a different status.'}
          </p>
        </div>
      ) : (
        <div className="portfolio-list">
          {filtered.map((item) => {
            const status = STATUS_META[item.status] ?? STATUS_META.pending
            const traineeName = item.trainee?.users_profile?.full_name ?? 'Unknown trainee'
            return (
              <div key={item.id} className={`portfolio-card ${item.status}`}>
                <div className="portfolio-card-top">
                  <div className="portfolio-card-heading">
                    <span className={`pf-status ${status.cls}`}>{status.label}</span>
                    {item.category && (
                      <span className="pf-category">
                        {CATEGORY_LABEL[item.category] ?? item.category}
                      </span>
                    )}
                  </div>
                  {item.status === 'pending' && (
                    <div className="review-actions">
                      <button
                        className="btn btn-approve"
                        onClick={() => openDecision(item, 'approved')}
                      >
                        <Icon name="check" size={16} /> Approve 核准
                      </button>
                      <button
                        className="btn btn-return"
                        onClick={() => openDecision(item, 'returned')}
                      >
                        Return 退回
                      </button>
                    </div>
                  )}
                </div>

                <h3 className="portfolio-card-title">{item.title}</h3>

                <div className="review-trainee-row">
                  <span className="review-trainee-name">{traineeName}</span>
                  {item.trainee && (
                    <>
                      <span className="meta-separator">·</span>
                      <span className="mono-small">{item.trainee.employee_id}</span>
                      <span className="meta-separator">·</span>
                      <span>{item.trainee.batch_code}</span>
                      {item.trainee.department && (
                        <>
                          <span className="meta-separator">·</span>
                          <span>{item.trainee.department}</span>
                        </>
                      )}
                    </>
                  )}
                </div>

                {item.description && (
                  <p className="portfolio-card-desc">{item.description}</p>
                )}

                {item.status !== 'pending' && item.review_note && (
                  <div className="review-note-box">
                    <span className="review-note-label">Reviewer feedback</span>
                    <p>{item.review_note}</p>
                  </div>
                )}

                {item.portfolio_files.length > 0 && (
                  <ul className="file-list">
                    {item.portfolio_files.map((f) => (
                      <li key={f.id} className="file-chip clickable">
                        <button
                          type="button"
                          className="file-chip-open"
                          onClick={() => handleDownload(f)}
                          disabled={downloadingId === f.id}
                          title={`Open ${f.file_name}`}
                        >
                          <Icon name="folder" size={14} />
                          <span className="file-chip-name">{f.file_name}</span>
                          <span className="file-chip-size">
                            {downloadingId === f.id ? 'Opening…' : formatBytes(f.file_size_bytes)}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="portfolio-card-meta">
                  <span>Submitted {formatDate(item.submitted_at)}</span>
                  {item.reviewed_at && (
                    <>
                      <span className="meta-separator">·</span>
                      <span>Reviewed {formatDate(item.reviewed_at)}</span>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Decision modal */}
      <Modal
        open={!!decisionState}
        onClose={closeDecision}
        title={
          decisionState?.decision === 'approved'
            ? 'Approve this item? 核准此項目'
            : 'Return for revision 退回修改'
        }
        size="md"
      >
        {decisionState && (
          <div>
            <p className="modal-subtitle">
              <strong>{decisionState.item.title}</strong>
              {' — '}
              {decisionState.item.trainee?.users_profile?.full_name ?? 'Unknown trainee'}
            </p>

            <label className="auth-field full">
              <span className="auth-label">
                {decisionState.decision === 'approved'
                  ? 'Feedback 回饋 (optional)'
                  : 'Feedback — what should the trainee improve? 回饋（必填）'}
              </span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={
                  decisionState.decision === 'approved'
                    ? 'e.g. Great reflection — clear takeaways and honest self-assessment.'
                    : 'e.g. Please add photos of the final output and expand section 2 with your own analysis.'
                }
                rows={4}
                disabled={submitting}
                autoFocus
              />
            </label>

            {modalError && (
              <div className="auth-error" role="alert">
                {modalError}
              </div>
            )}

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={closeDecision}
                disabled={submitting}
              >
                Cancel 取消
              </button>
              <button
                type="button"
                className={`btn ${decisionState.decision === 'approved' ? 'btn-approve' : 'btn-return'}`}
                onClick={confirmDecision}
                disabled={submitting}
              >
                {submitting
                  ? 'Saving…'
                  : decisionState.decision === 'approved'
                    ? 'Approve item 核准'
                    : 'Return to trainee 退回學員'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
