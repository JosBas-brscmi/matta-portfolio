import { useEffect, useState, useRef, type FormEvent, type ChangeEvent } from 'react'
import Icon from '../../components/Icon'
import {
  getMyProfile,
  updateMyProfile,
  uploadAvatar,
  avatarPublicUrl,
  type MyProfile,
} from '../../services/profileService'
import { DEPARTMENT_LABEL } from '../../constants/departments'
import ChangePasswordCard from '../../components/ChangePasswordCard'

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

export default function MyProfilePage() {
  const [profile, setProfile] = useState<MyProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Form state
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [bio, setBio] = useState('')
  const [education, setEducation] = useState('')

  const [saving, setSaving] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const load = async () => {
    const { profile: p, error } = await getMyProfile()
    if (error || !p) {
      setErrorMsg(error?.message ?? 'Could not load your profile.')
    } else {
      setProfile(p)
      setFullName(p.full_name)
      setPhone(p.phone ?? '')
      setBio(p.bio ?? '')
      setEducation(p.trainee?.education ?? '')
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const handlePhotoChosen = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !profile) return
    setErrorMsg(null)
    setSuccessMsg(null)
    setUploadingPhoto(true)
    const { error } = await uploadAvatar(file, profile)
    setUploadingPhoto(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (error) {
      setErrorMsg(error.message)
      return
    }
    setSuccessMsg('Photo updated. 照片已更新。')
    load()
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!profile) return
    setErrorMsg(null)
    setSuccessMsg(null)

    if (!fullName.trim()) {
      setErrorMsg('Please enter your full name. 請輸入姓名。')
      return
    }

    setSaving(true)
    const { error } = await updateMyProfile(profile, {
      full_name: fullName,
      phone,
      bio,
      education,
    })
    setSaving(false)

    if (error) {
      setErrorMsg(error.message)
      return
    }
    setSuccessMsg('Profile saved. 已儲存。')
    load()
  }

  if (loading) {
    return (
      <div className="dashboard-content">
        <div className="empty-state">
          <p className="empty-state-desc">Loading your profile…</p>
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="dashboard-content">
        <div className="auth-error" role="alert">
          {errorMsg ?? 'Could not load your profile.'}
        </div>
      </div>
    )
  }

  const avatarUrl = avatarPublicUrl(profile.avatar_path)

  return (
    <div className="dashboard-content">
      <div className="page-header">
        <div>
          <p className="page-eyebrow">My MATTA Journey</p>
          <h1 className="page-title">My Profile</h1>
          <p className="page-subtitle">
            Your basic information and photo. This becomes the cover page of
            your Learning Portfolio Report.
          </p>
        </div>
      </div>

      {profile.trainee && (
        <div className="completeness-wide">
          <div className="completeness-wide-header">
            <span>Profile completeness 完成度</span>
            <span className="muted">{profile.trainee.profile_completeness}%</span>
          </div>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${profile.trainee.profile_completeness}%` }}
            />
          </div>
        </div>
      )}

      <div className="profile-layout">
        {/* ---- Photo card ---- */}
        <div className="dashboard-card profile-photo-card">
          <div className="dashboard-card-header">
            <h2>Photo 照片</h2>
          </div>
          <div className="profile-photo-body">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Profile" className="profile-avatar" />
            ) : (
              <div className="profile-avatar placeholder">
                <Icon name="users" size={40} />
              </div>
            )}
            <label className={`btn btn-ghost btn-block ${uploadingPhoto ? 'disabled' : ''}`}>
              <input
                ref={fileInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.webp"
                onChange={handlePhotoChosen}
                disabled={uploadingPhoto}
                style={{ display: 'none' }}
              />
              {uploadingPhoto ? 'Uploading… 上傳中…' : avatarUrl ? 'Change photo 更換照片' : 'Upload photo 上傳照片'}
            </label>
            <p className="field-hint" style={{ textAlign: 'center' }}>
              JPG / PNG / WebP, max 5 MB.
              <br />
              A clear, front-facing photo works best.
            </p>
          </div>
        </div>

        {/* ---- Details form ---- */}
        <form className="dashboard-card profile-form-card" onSubmit={handleSubmit} noValidate>
          <div className="dashboard-card-header">
            <h2>Basic information 基本資料</h2>
          </div>

          <div className="form-grid">
            <label className="auth-field">
              <span className="auth-label">Full name 姓名</span>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={saving}
                required
              />
            </label>

            <label className="auth-field">
              <span className="auth-label">Phone 電話 (optional)</span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. +63 917 123 4567"
                disabled={saving}
              />
            </label>

            <label className="auth-field">
              <span className="auth-label">Education 學歷 (optional)</span>
              <input
                type="text"
                value={education}
                onChange={(e) => setEducation(e.target.value)}
                placeholder="e.g. BS Industrial Engineering, UP Diliman"
                disabled={saving || !profile.trainee}
              />
            </label>

            <label className="auth-field full">
              <span className="auth-label">About me 自我介紹 (optional)</span>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="A short introduction: your background, strengths, and what you hope to achieve in the MATTA program."
                rows={4}
                disabled={saving}
              />
            </label>
          </div>

          {/* Read-only, managed by MA Center */}
          <div className="profile-readonly">
            <h3 className="profile-readonly-title">Managed by MA Center 由 MA Center 管理</h3>
            <dl className="dashboard-meta">
              <div>
                <dt>Email</dt>
                <dd>{profile.email}</dd>
              </div>
              <div>
                <dt>Department 部門</dt>
                <dd>
                  {profile.department
                    ? (DEPARTMENT_LABEL[profile.department] ?? profile.department)
                    : 'Not assigned'}
                </dd>
              </div>
              {profile.trainee && (
                <>
                  <div>
                    <dt>Employee ID 工號</dt>
                    <dd><code className="mono-small">{profile.trainee.employee_id}</code></dd>
                  </div>
                  <div>
                    <dt>Batch 批次</dt>
                    <dd>{profile.trainee.batch_code}</dd>
                  </div>
                  <div>
                    <dt>Onboard date 到職日</dt>
                    <dd>{formatDate(profile.trainee.onboard_date)}</dd>
                  </div>
                </>
              )}
            </dl>
          </div>

          {errorMsg && (
            <div className="auth-error" role="alert">
              {errorMsg}
            </div>
          )}
          {successMsg && <div className="profile-success">{successMsg}</div>}

          <div className="modal-footer">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving… 儲存中…' : 'Save profile 儲存'}
            </button>
          </div>
        </form>
      </div>

      <div style={{ marginTop: '1.25rem' }}>
        <ChangePasswordCard />
      </div>
    </div>
  )
}
