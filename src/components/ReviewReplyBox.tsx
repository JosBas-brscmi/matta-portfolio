import { useState } from 'react'
import { replyToReview, type Review } from '../services/reviewService'

const EMOJIS = ['🙏', '👍', '❤️', '😊', '💪', '🎯', '🌟', '📚', '✅', '🔥']

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

interface Props {
  review: Review
  onSaved: () => void
}

export default function ReviewReplyBox({ review, onSaved }: Props) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(review.mt_reply ?? '')
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const hasReply = !!review.mt_reply

  const insertEmoji = (e: string) => setText((t) => t + e)

  const handleSave = async () => {
    setErrorMsg(null)
    if (!text.trim()) {
      setErrorMsg('Please write a reply or add an emoji. 請輸入文字或表情。')
      return
    }
    setSaving(true)
    const { error } = await replyToReview(review.id, text)
    setSaving(false)
    if (error) {
      setErrorMsg(error.message)
      return
    }
    setEditing(false)
    onSaved()
  }

  // ---- Already replied, not editing: show the reply ----
  if (hasReply && !editing) {
    return (
      <div className="mt-reply">
        <div className="mt-reply-head">
          <span className="mt-reply-label">Your reply 你的回覆</span>
          <button className="mt-reply-edit" onClick={() => { setText(review.mt_reply ?? ''); setEditing(true) }}>
            Edit 編輯
          </button>
        </div>
        <p className="mt-reply-text">{review.mt_reply}</p>
        {review.mt_reply_at && (
          <span className="mt-reply-date">{formatDate(review.mt_reply_at)}</span>
        )}
      </div>
    )
  }

  // ---- Not replied yet, not editing: show a prompt button ----
  if (!editing) {
    return (
      <button className="mt-reply-cta" onClick={() => setEditing(true)}>
        💬 Reply 回覆
      </button>
    )
  }

  // ---- Editing ----
  return (
    <div className="mt-reply-editor">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Say thank you, ask a question, or just react… 說聲謝謝、提問，或給個表情⋯"
        rows={2}
        disabled={saving}
        autoFocus
      />
      <div className="emoji-row">
        {EMOJIS.map((e) => (
          <button
            key={e}
            type="button"
            className="emoji-btn"
            onClick={() => insertEmoji(e)}
            disabled={saving}
            aria-label={`Add ${e}`}
          >
            {e}
          </button>
        ))}
      </div>
      {errorMsg && <div className="auth-error" role="alert">{errorMsg}</div>}
      <div className="mt-reply-actions">
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => { setEditing(false); setText(review.mt_reply ?? ''); setErrorMsg(null) }}
          disabled={saving}
        >
          Cancel 取消
        </button>
        <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Send reply 送出回覆'}
        </button>
      </div>
    </div>
  )
}
