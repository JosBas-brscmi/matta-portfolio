import { useState, useEffect, useRef, type FormEvent, type ChangeEvent } from 'react'
import Modal from '../../components/Modal'
import Icon from '../../components/Icon'
import {
  createMyPortfolioItem,
  updateMyPortfolioItem,
  uploadPortfolioFiles,
  deletePortfolioFile,
  validateFile,
  formatBytes,
  CATEGORY_OPTIONS,
  ACCEPT_ATTR,
  type PortfolioItem,
  type PortfolioFile,
  type PortfolioCategory,
} from '../../services/portfolioService'

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  editingItem?: PortfolioItem | null
}

export default function PortfolioItemModal({ open, onClose, onSaved, editingItem }: Props) {
  const isEdit = !!editingItem
  const isResubmit = editingItem?.status === 'returned'

  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<PortfolioCategory>('reflection')
  const [description, setDescription] = useState('')
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [existingFiles, setExistingFiles] = useState<PortfolioFile[]>([])

  const [submitting, setSubmitting] = useState(false)
  const [progressMsg, setProgressMsg] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    if (editingItem) {
      setTitle(editingItem.title)
      setCategory((editingItem.category as PortfolioCategory) ?? 'other')
      setDescription(editingItem.description ?? '')
      setExistingFiles(editingItem.portfolio_files)
    } else {
      setTitle('')
      setCategory('reflection')
      setDescription('')
      setExistingFiles([])
    }
    setPendingFiles([])
    setErrorMsg(null)
    setProgressMsg(null)
    setSubmitting(false)
  }, [open, editingItem])

  const handleClose = () => {
    if (submitting) return
    onClose()
  }

  const handleFilesChosen = (e: ChangeEvent<HTMLInputElement>) => {
    const chosen = Array.from(e.target.files ?? [])
    if (chosen.length === 0) return

    const problems: string[] = []
    const good: File[] = []
    for (const f of chosen) {
      const bad = validateFile(f)
      if (bad) problems.push(bad)
      else good.push(f)
    }
    setPendingFiles((prev) => [...prev, ...good])
    setErrorMsg(problems.length > 0 ? problems.join(' ') : null)
    // Allow re-selecting the same file after removal.
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removePendingFile = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleDeleteExisting = async (file: PortfolioFile) => {
    const ok = window.confirm(`Remove "${file.file_name}" from this portfolio item?`)
    if (!ok) return
    const { error } = await deletePortfolioFile(file)
    if (error) {
      setErrorMsg(`Could not remove file: ${error.message}`)
      return
    }
    setExistingFiles((prev) => prev.filter((f) => f.id !== file.id))
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)

    if (!title.trim()) {
      setErrorMsg('Please give this portfolio item a title.')
      return
    }
    if (!isEdit && pendingFiles.length === 0) {
      setErrorMsg('Please attach at least one file.')
      return
    }

    setSubmitting(true)
    const input = { title, description, category }

    // 1) Create or update the item row.
    setProgressMsg(isEdit ? 'Saving changes…' : 'Creating portfolio item…')
    const result = isEdit
      ? await updateMyPortfolioItem(editingItem!.id, input, isResubmit)
      : await createMyPortfolioItem(input)

    if (result.error || !result.item) {
      setSubmitting(false)
      setProgressMsg(null)
      setErrorMsg(result.error?.message ?? 'Save failed.')
      return
    }

    // 2) Upload any newly attached files.
    if (pendingFiles.length > 0) {
      setProgressMsg(
        `Uploading ${pendingFiles.length} file${pendingFiles.length > 1 ? 's' : ''}… this may take a moment for large files.`,
      )
      const outcome = await uploadPortfolioFiles(
        result.item.trainee_id,
        result.item.id,
        pendingFiles,
      )

      if (outcome.failed.length > 0) {
        setSubmitting(false)
        setProgressMsg(null)
        setErrorMsg(
          `${outcome.uploaded.length} of ${pendingFiles.length} file(s) uploaded. Failed: ` +
            outcome.failed.map((f) => `${f.fileName} (${f.message})`).join('; '),
        )
        onSaved() // refresh list so the user sees what did make it
        return
      }
    }

    setSubmitting(false)
    setProgressMsg(null)
    onSaved()
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={
        isResubmit
          ? 'Revise & resubmit'
          : isEdit
            ? 'Edit portfolio item'
            : 'Add portfolio item'
      }
      size="lg"
    >
      <form onSubmit={handleSubmit} noValidate>
        <p className="modal-subtitle">
          {isResubmit
            ? 'Update your work based on the feedback below, then resubmit for review.'
            : isEdit
              ? 'Update the details or attach more files.'
              : 'Upload a reflection, project, QCC report, photo, or presentation. The MA Center will review it.'}
        </p>

        {isResubmit && editingItem?.review_note && (
          <div className="review-note-box">
            <span className="review-note-label">Reviewer feedback</span>
            <p>{editingItem.review_note}</p>
          </div>
        )}

        <div className="form-grid">
          <label className="auth-field full">
            <span className="auth-label">Title</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Week 3 Reflection — Production Line Observation"
              disabled={submitting}
              required
              autoFocus={!isEdit}
            />
          </label>

          <label className="auth-field">
            <span className="auth-label">Category</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as PortfolioCategory)}
              disabled={submitting}
            >
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>

          <label className="auth-field full">
            <span className="auth-label">Description (optional)</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Briefly describe this work — what it is, what you learned, or anything the reviewer should know."
              rows={3}
              disabled={submitting}
            />
          </label>

          {/* ---- Files ---- */}
          <div className="auth-field full">
            <span className="auth-label">Files</span>

            {existingFiles.length > 0 && (
              <ul className="file-list">
                {existingFiles.map((f) => (
                  <li key={f.id} className="file-chip">
                    <Icon name="folder" size={14} />
                    <span className="file-chip-name">{f.file_name}</span>
                    <span className="file-chip-size">{formatBytes(f.file_size_bytes)}</span>
                    <button
                      type="button"
                      className="file-chip-remove"
                      onClick={() => handleDeleteExisting(f)}
                      disabled={submitting}
                      aria-label={`Remove ${f.file_name}`}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {pendingFiles.length > 0 && (
              <ul className="file-list">
                {pendingFiles.map((f, i) => (
                  <li key={`${f.name}-${i}`} className="file-chip pending">
                    <Icon name="plus" size={14} />
                    <span className="file-chip-name">{f.name}</span>
                    <span className="file-chip-size">{formatBytes(f.size)}</span>
                    <button
                      type="button"
                      className="file-chip-remove"
                      onClick={() => removePendingFile(i)}
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
                ref={fileInputRef}
                type="file"
                multiple
                accept={ACCEPT_ATTR}
                onChange={handleFilesChosen}
                disabled={submitting}
              />
              <Icon name="plus" size={18} />
              <span>
                <strong>Choose files</strong> — PDF, Word, Excel, PowerPoint, images, video, or ZIP
              </span>
              <span className="field-hint">Up to 100 MB per file. You can select several at once.</span>
            </label>
          </div>
        </div>

        {progressMsg && <div className="upload-progress">{progressMsg}</div>}

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
            {submitting
              ? 'Saving…'
              : isResubmit
                ? 'Resubmit for review'
                : isEdit
                  ? 'Save changes'
                  : 'Submit for review'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
