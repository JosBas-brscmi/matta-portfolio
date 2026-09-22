import { useEffect, useState, useRef, type ChangeEvent } from 'react'
import Icon from './Icon'
import {
  listTraineeResources,
  listMyResources,
  uploadResource,
  deleteResource,
  getResourceDownloadUrl,
  formatBytes,
  validateResourceFile,
  RESOURCE_CATEGORY_OPTIONS,
  RESOURCE_CATEGORY_LABEL,
  RESOURCE_ACCEPT_ATTR,
  type TraineeResource,
  type ResourceCategory,
} from '../services/resourceService.ts'

interface Props {
  // Admin/mentor view passes traineeId + canUpload; MT view passes neither.
  traineeId?: string
  canUpload?: boolean
  currentUserId?: string
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return iso
  }
}

export default function ResourcesCard({ traineeId, canUpload, currentUserId }: Props) {
  const [resources, setResources] = useState<TraineeResource[]>([])
  const [loading, setLoading] = useState(true)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  // Upload form state (admin/mentor only)
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<ResourceCategory>('training_plan')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const refresh = () => {
    const p = traineeId ? listTraineeResources(traineeId) : listMyResources()
    p.then(({ resources: list, error }) => {
      if (!error) setResources(list)
      setLoading(false)
    })
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [traineeId])

  const onFileChosen = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null
    if (f) {
      const bad = validateResourceFile(f)
      if (bad) {
        setErrorMsg(bad)
        setFile(null)
        if (fileRef.current) fileRef.current.value = ''
        return
      }
    }
    setErrorMsg(null)
    setFile(f)
    if (!title && f) setTitle(f.name.replace(/\.[^.]+$/, ''))
  }

  const handleUpload = async () => {
    if (!traineeId || !file) {
      setErrorMsg('Please choose a file. 請選擇檔案。')
      return
    }
    setUploading(true)
    const { error } = await uploadResource(traineeId, title, category, file)
    setUploading(false)
    if (error) {
      setErrorMsg(error.message)
      return
    }
    setShowForm(false)
    setTitle('')
    setCategory('training_plan')
    setFile(null)
    if (fileRef.current) fileRef.current.value = ''
    refresh()
  }

  const handleDownload = async (r: TraineeResource) => {
    setDownloadingId(r.id)
    const { url, error } = await getResourceDownloadUrl(r.storage_path)
    setDownloadingId(null)
    if (error || !url) {
      alert(`Could not open file: ${error?.message ?? 'unknown error'}`)
      return
    }
    window.open(url, '_blank', 'noopener')
  }

  const handleDelete = async (r: TraineeResource) => {
    if (!window.confirm(`Delete "${r.title}"? 確定刪除？`)) return
    const { error } = await deleteResource(r)
    if (error) {
      alert(`Delete failed: ${error.message}`)
      return
    }
    refresh()
  }

  return (
    <div className="dashboard-card">
      <div className="dashboard-card-header">
        <h2>Training plans &amp; schedules 訓練計畫與課表</h2>
        {canUpload && (
          <button
            className="btn-icon"
            onClick={() => setShowForm((v) => !v)}
            aria-label="Upload resource"
            title="Upload 上傳"
          >
            <Icon name="plus" size={16} />
          </button>
        )}
      </div>

      {canUpload && showForm && (
        <div className="resource-upload">
          <div className="form-grid">
            <label className="auth-field">
              <span className="auth-label">Title 標題</span>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Month 2 Training Plan"
                disabled={uploading}
              />
            </label>
            <label className="auth-field">
              <span className="auth-label">Category 類別</span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ResourceCategory)}
                disabled={uploading}
              >
                {RESOURCE_CATEGORY_OPTIONS.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </label>
          </div>
          <label className={`file-drop ${uploading ? 'disabled' : ''}`}>
            <input
              ref={fileRef}
              type="file"
              accept={RESOURCE_ACCEPT_ATTR}
              onChange={onFileChosen}
              disabled={uploading}
            />
            <Icon name="plus" size={18} />
            <span>{file ? file.name : 'Choose a file 選擇檔案'}</span>
            <span className="field-hint">PDF, Word, Excel, PowerPoint, images, ZIP. Max 50 MB.</span>
          </label>
          {errorMsg && <div className="auth-error" role="alert">{errorMsg}</div>}
          <div className="modal-footer">
            <button className="btn btn-ghost btn-sm" onClick={() => { setShowForm(false); setErrorMsg(null) }} disabled={uploading}>
              Cancel 取消
            </button>
            <button className="btn btn-primary btn-sm" onClick={handleUpload} disabled={uploading || !file}>
              {uploading ? 'Uploading…' : 'Upload 上傳'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="dashboard-card-body muted">Loading…</p>
      ) : resources.length === 0 ? (
        <p className="dashboard-card-body muted">
          {canUpload
            ? 'No files yet. Use + to share a training plan or schedule with this trainee. 尚無檔案，點 + 上傳訓練計畫或課表。'
            : 'No training plans or schedules shared with you yet. 目前尚無導師分享的訓練計畫或課表。'}
        </p>
      ) : (
        <ul className="resource-list">
          {resources.map((r) => (
            <li key={r.id} className="resource-item">
              <div className="resource-item-main">
                <button
                  type="button"
                  className="resource-open"
                  onClick={() => handleDownload(r)}
                  disabled={downloadingId === r.id}
                  title={`Open ${r.file_name}`}
                >
                  <Icon name="folder" size={16} />
                  <span className="resource-title">{r.title}</span>
                </button>
                <div className="resource-meta">
                  <span className="pf-category">
                    {RESOURCE_CATEGORY_LABEL[r.category] ?? r.category}
                  </span>
                  <span>{formatBytes(r.file_size_bytes)}</span>
                  <span>·</span>
                  <span>{formatDate(r.created_at)}</span>
                  {r.uploader_name && <span>· {r.uploader_name}</span>}
                </div>
              </div>
              {canUpload && (r.uploaded_by === currentUserId) && (
                <button
                  className="btn-icon btn-icon-danger"
                  onClick={() => handleDelete(r)}
                  aria-label="Delete"
                  title="Delete"
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
