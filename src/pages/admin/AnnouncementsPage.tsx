//test comment for git push and pull
import { useEffect, useState, useCallback } from 'react'
import Icon from '../../components/Icon'
import { useRef, type ChangeEvent } from 'react'
import {
  listAllAnnouncements,
  createAnnouncement,
  deleteAnnouncement,
  validateAnnouncementFile,
  ANNOUNCEMENT_ACCEPT_ATTR,
  type Announcement,
} from '../../services/announcementService.ts'
import { listAllUsers, type ManagedUser } from '../../services/userService.ts'

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return iso
  }
}

export default function AnnouncementsPage() {
  const [items, setItems] = useState<Announcement[]>([])
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [loading, setLoading] = useState(true)

  // Compose form
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [toAll, setToAll] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [files, setFiles] = useState<File[]>([])
  const fileRef = useRef<HTMLInputElement>(null)
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const [aRes, uRes] = await Promise.all([listAllAnnouncements(), listAllUsers()])
    if (!aRes.error) setItems(aRes.announcements)
    if (!uRes.error) setUsers(uRes.users)
    setLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const toggleUser = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAllVisible = () => setSelected(new Set(users.map((u) => u.id)))
  const clearSelection = () => setSelected(new Set())

  const handleSubmit = async () => {
    setErrorMsg(null)
    setSuccessMsg(null)
    if (!title.trim()) { setErrorMsg('Please enter a subject. 請輸入公告主旨。'); return }
    if (!body.trim()) { setErrorMsg('Please enter the content. 請輸入公告內容。'); return }
    if (!toAll && selected.size === 0) {
      setErrorMsg('Please select at least one recipient, or choose "All users". 請至少選擇一位對象，或選「全部使用者」。')
      return
    }
    setSubmitting(true)
    const { error } = await createAnnouncement(title, body, toAll, Array.from(selected), files)
    setSubmitting(false)
    if (error) { setErrorMsg(error.message); return }
    setTitle(''); setBody(''); setToAll(true); setSelected(new Set()); setFiles([])
    if (fileRef.current) fileRef.current.value = ''
    setSuccessMsg('Announcement posted. 公告已發布。')
    refresh()
  }

  const onFilesChosen = (e: ChangeEvent<HTMLInputElement>) => {
    const chosen = Array.from(e.target.files ?? [])
    const problems: string[] = []
    const good: File[] = []
    for (const f of chosen) {
      const bad = validateAnnouncementFile(f)
      if (bad) problems.push(bad)
      else good.push(f)
    }
    setFiles((prev) => [...prev, ...good])
    setErrorMsg(problems.length > 0 ? problems.join(' ') : null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const removeFile = (i: number) => setFiles((prev) => prev.filter((_, idx) => idx !== i))

  const handleDelete = async (a: Announcement) => {
    if (!window.confirm(`Delete "${a.title}"? 確定刪除此公告？`)) return
    const { error } = await deleteAnnouncement(a.id)
    if (error) { alert(`Delete failed: ${error.message}`); return }
    refresh()
  }

  return (
    <div className="dashboard-content">
      <div className="page-header">
        <div>
          <p className="page-eyebrow">Admin 管理</p>
          <h1 className="page-title">Announcements 公告</h1>
          <p className="page-subtitle">
            Post news and notices to all users or selected people. Global
            announcements appear in everyone's "Latest" panel.
            發布消息給全部或指定使用者；全域公告會顯示在每個人的「最新公告」面板。
          </p>
        </div>
      </div>

      {/* Compose */}
      <div className="dashboard-card">
        <div className="dashboard-card-header">
          <h2>New announcement 新增公告</h2>
        </div>
        <div className="form-grid">
          <label className="auth-field full">
            <span className="auth-label">Subject 主旨</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Month 2 schedule released"
              disabled={submitting}
            />
          </label>
          <label className="auth-field full">
            <span className="auth-label">Content 內容</span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write the announcement details here…"
              rows={4}
              disabled={submitting}
            />
          </label>
        </div>

        {/* Attachments (view-only) */}
        <div className="auth-field full">
          <span className="auth-label">Attachments 附件 (PDF / images · view-only 僅供閱讀)</span>
          {files.length > 0 && (
            <ul className="file-list">
              {files.map((f, i) => (
                <li key={`${f.name}-${i}`} className="file-chip pending">
                  <Icon name="folder" size={14} />
                  <span className="file-chip-name">{f.name}</span>
                  <button
                    type="button"
                    className="file-chip-remove"
                    onClick={() => removeFile(i)}
                    disabled={submitting}
                    aria-label={`Remove ${f.name}`}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
          <label className={`file-drop ${submitting ? 'disabled' : ''}`}>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept={ANNOUNCEMENT_ACCEPT_ATTR}
              onChange={onFilesChosen}
              disabled={submitting}
            />
            <Icon name="plus" size={18} />
            <span>Attach PDF or images 附加 PDF 或圖片</span>
            <span className="field-hint">
              Readers can view inline but not download. 讀者只能在公告中檢視，無下載按鈕。 Max 20 MB each.
            </span>
          </label>
        </div>

        {/* Audience */}
        <div className="announce-audience">
          <label className="radio-option">
            <input type="radio" checked={toAll} onChange={() => setToAll(true)} disabled={submitting} />
            <span>All users 全部使用者</span>
          </label>
          <label className="radio-option">
            <input type="radio" checked={!toAll} onChange={() => setToAll(false)} disabled={submitting} />
            <span>Selected users 指定使用者</span>
          </label>
        </div>

        {!toAll && (
          <div className="announce-recipients">
            <div className="announce-recipients-tools">
              <button className="btn btn-ghost btn-sm" onClick={selectAllVisible} disabled={submitting}>
                Select all 全選 ({users.length})
              </button>
              <button className="btn btn-ghost btn-sm" onClick={clearSelection} disabled={submitting}>
                Clear 清除
              </button>
              <span className="muted">{selected.size} selected 已選</span>
            </div>
            <div className="announce-recipient-list">
              {users.map((u) => (
                <label key={u.id} className="announce-recipient">
                  <input
                    type="checkbox"
                    checked={selected.has(u.id)}
                    onChange={() => toggleUser(u.id)}
                    disabled={submitting}
                  />
                  <span className="announce-recipient-name">{u.full_name}</span>
                  <span className="announce-recipient-role">{u.role}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {errorMsg && <div className="auth-error" role="alert">{errorMsg}</div>}
        {successMsg && <div className="profile-success">{successMsg}</div>}

        <div className="modal-footer">
          <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Posting…' : 'Post announcement 發布公告'}
          </button>
        </div>
      </div>

      {/* History */}
      <div className="page-header" style={{ marginTop: '1.5rem' }}>
        <div>
          <h2 className="page-title" style={{ fontSize: '1.3rem' }}>History 發布紀錄</h2>
        </div>
      </div>

      {loading ? (
        <div className="empty-state"><p className="empty-state-desc">Loading…</p></div>
      ) : items.length === 0 ? (
        <div className="empty-state"><p className="empty-state-desc">No announcements yet. 尚無公告。</p></div>
      ) : (
        <div className="announce-history">
          {items.map((a) => (
            <div key={a.id} className="announce-history-item">
              <div className="announce-history-head">
                <span className={`pf-category ${a.is_global ? 'announce-global' : ''}`}>
                  {a.is_global ? 'All users 全部' : `Selected 指定 (${a.recipient_count ?? 0})`}
                </span>
                <span className="announce-history-date">{formatDateTime(a.created_at)}</span>
                <button
                  className="btn-icon btn-icon-danger"
                  onClick={() => handleDelete(a)}
                  aria-label="Delete"
                  title="Delete"
                >
                  ×
                </button>
              </div>
              <h3 className="announce-history-title">{a.title}</h3>
              <p className="announce-history-body">{a.body}</p>
              {a.author_name && (
                <p className="announce-history-author">— {a.author_name}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
