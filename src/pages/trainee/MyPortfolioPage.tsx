import { useEffect, useState, useCallback } from 'react'
import Icon from '../../components/Icon'
import PortfolioItemModal from './PortfolioItemModal'
import {
  listMyPortfolioItems,
  deleteMyPortfolioItem,
  getFileDownloadUrl,
  formatBytes,
  CATEGORY_LABEL,
  type PortfolioItem,
  type PortfolioFile,
  type PortfolioStatus,
} from '../../services/portfolioService'

type StatusFilter = 'all' | PortfolioStatus

const STATUS_META: Record<PortfolioStatus, { label: string; cls: string }> = {
  pending: { label: 'Pending review', cls: 'pf-status-pending' },
  approved: { label: 'Approved', cls: 'pf-status-approved' },
  returned: { label: 'Returned', cls: 'pf-status-returned' },
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

export default function MyPortfolioPage() {
  const [items, setItems] = useState<PortfolioItem[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const [filter, setFilter] = useState<StatusFilter>('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<PortfolioItem | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    const { items: list, error } = await listMyPortfolioItems()
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

  const handleAdd = () => {
    setEditingItem(null)
    setModalOpen(true)
  }

  const handleEdit = (item: PortfolioItem) => {
    setEditingItem(item)
    setModalOpen(true)
  }

  const handleDelete = async (item: PortfolioItem) => {
    const ok = window.confirm(
      `Delete "${item.title}" and its ${item.portfolio_files.length} file(s)?\n\nThis cannot be undone.`,
    )
    if (!ok) return
    const { error } = await deleteMyPortfolioItem(item)
    if (error) {
      alert(`Delete failed: ${error.message}`)
      return
    }
    refresh()
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

  const counts = {
    all: items.length,
    pending: items.filter((i) => i.status === 'pending').length,
    approved: items.filter((i) => i.status === 'approved').length,
    returned: items.filter((i) => i.status === 'returned').length,
  }

  const filtered = filter === 'all' ? items : items.filter((i) => i.status === filter)

  return (
    <div className="dashboard-content">
      <div className="page-header">
        <div>
          <p className="page-eyebrow">My MATTA Journey</p>
          <h1 className="page-title">My Portfolio</h1>
          <p className="page-subtitle">
            Reflections, projects, QCC reports, photos, and presentations you have
            submitted as part of your learning journey.
          </p>
        </div>
        <button className="btn btn-primary" onClick={handleAdd}>
          <Icon name="plus" size={18} /> Add item
        </button>
      </div>

      {/* Status filter */}
      <div className="filter-bar">
        <div className="filter-tabs">
          {(
            [
              ['all', `All (${counts.all})`],
              ['pending', `Pending (${counts.pending})`],
              ['approved', `Approved (${counts.approved})`],
              ['returned', `Returned (${counts.returned})`],
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
          <p className="empty-state-desc">Loading your portfolio…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <Icon name="folder" size={28} />
          </div>
          <h2 className="empty-state-title">
            {items.length === 0 ? 'Your portfolio is empty' : 'Nothing with this status'}
          </h2>
          <p className="empty-state-desc">
            {items.length === 0
              ? 'Upload assignments, weekly reflections, QCC project reports, photos of your work, and presentation slides. The MA Center will review each submission and provide feedback.'
              : 'Switch to another tab, or add a new item.'}
          </p>
          <div className="empty-state-cta">
            <button className="btn btn-primary" onClick={handleAdd}>
              <Icon name="plus" size={18} /> Add item
            </button>
          </div>
        </div>
      ) : (
        <div className="portfolio-list">
          {filtered.map((item) => {
            const status = STATUS_META[item.status] ?? STATUS_META.pending
            const editable = item.status === 'pending' || item.status === 'returned'
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
                  <div className="portfolio-card-actions">
                    {editable && (
                      <button
                        className="btn-icon"
                        onClick={() => handleEdit(item)}
                        aria-label="Edit"
                        title={item.status === 'returned' ? 'Revise & resubmit' : 'Edit'}
                      >
                        <Icon name="edit" size={16} />
                      </button>
                    )}
                    {editable && (
                      <button
                        className="btn-icon btn-icon-danger"
                        onClick={() => handleDelete(item)}
                        aria-label="Delete"
                        title="Delete"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>

                <h3 className="portfolio-card-title">{item.title}</h3>
                {item.description && (
                  <p className="portfolio-card-desc">{item.description}</p>
                )}

                {item.status === 'returned' && item.review_note && (
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

      <PortfolioItemModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={refresh}
        editingItem={editingItem}
      />
    </div>
  )
}
