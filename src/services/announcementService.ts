import { apiFetch } from './apiClient'

// ============================================================
// Step 18 · MA Center announcements
// ============================================================

export const ANNOUNCEMENT_BUCKET = 'announcement-files'
export const MAX_ANNOUNCEMENT_FILE_BYTES = 20 * 1024 * 1024 // 20 MB

const ANN_FILE_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
}

export const ANNOUNCEMENT_ACCEPT_ATTR = '.pdf,.jpg,.jpeg,.png,.webp'

export interface Announcement {
  id: string
  author_id: string | null
  title: string
  body: string
  is_global: boolean
  created_at: string
  author_name?: string | null
  recipient_count?: number
}

export interface AnnouncementFile {
  id: string
  announcement_id: string
  file_name: string
  file_type: string | null
  file_size_bytes: number | null
  storage_path: string
}

export function validateAnnouncementFile(file: File): string | null {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (!ANN_FILE_TYPES[ext]) {
    return `"${file.name}" — only PDF and images (JPG/PNG/WebP) are allowed. 只允許 PDF 與圖片。`
  }
  if (file.size > MAX_ANNOUNCEMENT_FILE_BYTES) {
    return `"${file.name}" exceeds 20 MB. 檔案超過 20 MB。`
  }
  return null
}

export async function listAnnouncementFiles(
  announcementId: string,
): Promise<{ files: AnnouncementFile[]; error: { message: string } | null }> {
  if (!announcementId) {
    return { files: [], error: null }
  }

  const { data, error } = await apiFetch<{ files: AnnouncementFile[] } | AnnouncementFile[]>(
    `/list_announcement_files.php?announcement_id=${encodeURIComponent(announcementId)}`,
  )

  if (error) {
    return { files: [], error }
  }

  const files = Array.isArray(data) ? data : data?.files ?? []
  return { files, error: null }
}

export async function getInlineUrl(
  storagePath: string,
): Promise<{ url: string | null; error: { message: string } | null }> {
  if (!storagePath) {
    return { url: null, error: null }
  }

  const { data, error } = await apiFetch<{ url: string }>(
    `/get_announcement_file_url.php?path=${encodeURIComponent(storagePath)}`,
  )

  if (error) {
    return { url: null, error }
  }

  const url = data && typeof data === 'object' && 'url' in data ? data.url ?? null : null
  return { url, error: null }
}

export async function listMyAnnouncements(): Promise<{
  announcements: Announcement[]
  error: { message: string } | null
}> {
  const { data, error } = await apiFetch<{ announcements: Announcement[] } | Announcement[]>(
    '/list_my_announcements.php',
  )

  if (error) {
    return { announcements: [], error }
  }

  const announcements = Array.isArray(data) ? data : data?.announcements ?? []
  return { announcements, error: null }
}

export async function listAllAnnouncements(): Promise<{
  announcements: Announcement[]
  error: { message: string } | null
}> {
  const { data, error } = await apiFetch<{ announcements: Announcement[] } | Announcement[]>(
    '/list_all_announcements.php',
  )

  if (error) {
    return { announcements: [], error }
  }

  const announcements = Array.isArray(data) ? data : data?.announcements ?? []
  return { announcements, error: null }
}

export async function createAnnouncement(
  title: string,
  body: string,
  isGlobal: boolean,
  recipientIds: string[],
  files: File[] = [],
): Promise<{ error: { message: string } | null }> {
  if (!title.trim() || !body.trim()) {
    return { error: { message: 'Title and body are required.' } }
  }

  const formData = new FormData()
  formData.append('title', title.trim())
  formData.append('body', body.trim())
  formData.append('is_global', String(isGlobal))
  formData.append('recipient_ids', JSON.stringify(recipientIds))
  files.forEach((file, index) => {
    formData.append(`files[${index}]`, file)
  })

  const { error } = await apiFetch('/create_announcement.php', {
    method: 'POST',
    body: formData,
  })

  return { error }
}

export async function deleteAnnouncement(id: string): Promise<{ error: { message: string } | null }> {
  const { error } = await apiFetch('/delete_announcement.php', {
    method: 'POST',
    body: JSON.stringify({ id }),
  })

  return { error }
}
