import {
  apiFetch,
  getApiUrl,
} from './apiClient'

import {
  getMyTraineeId,
} from './traineeService'

// ============================================================
// Portfolio items + local file uploads
// ============================================================

export const PORTFOLIO_BUCKET = 'portfolio-files'
export const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024

export type PortfolioStatus = 'pending' | 'approved' | 'returned'

export type PortfolioCategory =
  | 'reflection'
  | 'project'
  | 'qcc_report'
  | 'presentation'
  | 'photo'
  | 'certificate'
  | 'other'

export const CATEGORY_OPTIONS: {
  value: PortfolioCategory
  label: string
}[] = [
  { value: 'reflection', label: 'Weekly Reflection 週記反思' },
  { value: 'project', label: 'Project / Assignment 專案作業' },
  { value: 'qcc_report', label: 'QCC Report QCC報告' },
  { value: 'presentation', label: 'Presentation 簡報' },
  { value: 'photo', label: 'Photo / Evidence 照片佐證' },
  { value: 'certificate', label: 'Certificate 證書' },
  { value: 'other', label: 'Other 其他' },
]

export const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  CATEGORY_OPTIONS.map((category) => [category.value, category.label])
)

const ALLOWED_EXTENSIONS: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  zip: 'application/zip',
}

export const ACCEPT_ATTR = Object.keys(ALLOWED_EXTENSIONS)
  .map((extension) => `.${extension}`)
  .join(',')

export interface PortfolioFile {
  id: string
  portfolio_item_id: string
  file_name: string
  file_type: string | null
  file_size_bytes: number | null
  storage_path: string
  uploaded_at: string
}

export interface PortfolioItem {
  id: string
  trainee_id: string
  title: string
  description: string | null
  category: string | null
  status: PortfolioStatus
  review_note: string | null
  reviewed_at: string | null
  submitted_at: string
  created_at: string
  updated_at: string
  portfolio_files: PortfolioFile[]
}

export interface PortfolioItemInput {
  title: string
  description?: string | null
  category: PortfolioCategory
}

export function validateFile(file: File): string | null {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''

  if (!ALLOWED_EXTENSIONS[extension]) {
    return (
      `"${file.name}" — file type .${extension} is not allowed. ` +
      `Allowed: ${Object.keys(ALLOWED_EXTENSIONS).join(', ')}.`
    )
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return (
      `"${file.name}" is ${formatBytes(file.size)} — the limit is 100 MB per file.`
    )
  }

  if (file.size === 0) {
    return `"${file.name}" is empty (0 bytes).`
  }

  return null
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ============================================================
// List
// ============================================================

export async function listMyPortfolioItems(): Promise<{
  items: PortfolioItem[]
  error: { message: string } | null
}> {
  const { trainee_id, error: idError } = await getMyTraineeId()

  if (idError) {
    return { items: [], error: idError }
  }

  return listTraineePortfolioItems(trainee_id)
}

export async function listTraineePortfolioItems(traineeId: string): Promise<{
  items: PortfolioItem[]
  error: { message: string } | null
}> {
  if (!traineeId) {
    return { items: [], error: { message: 'Trainee ID is required.' } }
  }

  const { data, error } = await apiFetch<{ items: PortfolioItem[] } | PortfolioItem[]>(
    `/list_portfolio_items.php?trainee_id=${encodeURIComponent(traineeId)}`
  )

  if (error) {
    return { items: [], error }
  }

  const items = Array.isArray(data) ? data : data?.items ?? []
  return { items, error: null }
}

// ============================================================
// Create
// ============================================================

export async function createMyPortfolioItem(input: PortfolioItemInput): Promise<{
  item: PortfolioItem | null
  error: { message: string } | null
}> {
  const { trainee_id, error: idError } = await getMyTraineeId()

  if (idError) {
    return { item: null, error: idError }
  }

  const { data, error } = await apiFetch<{ item: PortfolioItem } | PortfolioItem>(
    '/create_portfolio_item.php',
    {
      method: 'POST',
      body: JSON.stringify({
        trainee_id,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        category: input.category,
      }),
    }
  )

  if (error) {
    return { item: null, error }
  }

  const item = (data && typeof data === 'object' && 'item' in data ? data.item : data) as PortfolioItem
  return { item: item ?? null, error: null }
}

// ============================================================
// Update
// ============================================================

export async function updateMyPortfolioItem(
  id: string,
  input: PortfolioItemInput,
  resubmit: boolean
): Promise<{
  item: PortfolioItem | null
  error: { message: string } | null
}> {
  if (!id) {
    return { item: null, error: { message: 'Portfolio item ID is required.' } }
  }

  const { data, error } = await apiFetch<{ item: PortfolioItem } | PortfolioItem>(
    '/update_portfolio_item.php',
    {
      method: 'POST',
      body: JSON.stringify({
        id,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        category: input.category,
        resubmit,
      }),
    }
  )

  if (error) {
    return { item: null, error }
  }

  const item = (data && typeof data === 'object' && 'item' in data ? data.item : data) as PortfolioItem
  return { item: item ?? null, error: null }
}

// ============================================================
// Delete portfolio item
// ============================================================

export async function deleteMyPortfolioItem(item: PortfolioItem): Promise<{
  error: { message: string } | null
}> {
  const { error } = await apiFetch('/delete_portfolio_item.php', {
    method: 'POST',
    body: JSON.stringify({ id: item.id }),
  })

  return { error }
}

// ============================================================
// File upload
// ============================================================

export interface UploadOutcome {
  uploaded: PortfolioFile[]
  failed: { fileName: string; message: string }[]
}

export async function uploadPortfolioFiles(
  traineeId: string,
  portfolioItemId: string,
  files: File[]
): Promise<UploadOutcome> {
  const outcome: UploadOutcome = { uploaded: [], failed: [] }

  if (!traineeId) {
    return {
      uploaded: [],
      failed: files.map((f) => ({ fileName: f.name, message: 'Trainee ID is required.' })),
    }
  }

  if (!portfolioItemId) {
    return {
      uploaded: [],
      failed: files.map((f) => ({ fileName: f.name, message: 'Portfolio item ID is required.' })),
    }
  }

  for (const file of files) {
    const invalid = validateFile(file)
    if (invalid) {
      outcome.failed.push({ fileName: file.name, message: invalid })
      continue
    }

    const formData = new FormData()
    formData.append('trainee_id', traineeId)
    formData.append('portfolio_item_id', portfolioItemId)
    formData.append('file', file)

    // Pass IDs in query string AND body so PHP finds them in $_GET, $_POST, or $_REQUEST
    const endpoint = `/upload_portfolio_file.php?portfolio_item_id=${encodeURIComponent(portfolioItemId)}&trainee_id=${encodeURIComponent(traineeId)}`

    const { data, error } = await apiFetch<{ file?: PortfolioFile; data?: PortfolioFile } | PortfolioFile>(
      endpoint,
      {
        method: 'POST',
        body: formData,
      }
    )

    if (error) {
      outcome.failed.push({
        fileName: file.name,
        message: error.message || 'Upload failed.',
      })
      continue
    }

    const uploadedFile = (
      data && typeof data === 'object'
        ? ('file' in data ? data.file : 'data' in data ? data.data : data)
        : null
    ) as PortfolioFile | null

    if (uploadedFile) {
      outcome.uploaded.push(uploadedFile)
    } else {
      outcome.failed.push({
        fileName: file.name,
        message: 'Invalid file response from server.',
      })
    }
  }

  return outcome
}

// ============================================================
// File download
// ============================================================

export async function getFileDownloadUrl(
  fileIdOrStoragePath: string
): Promise<{
  url: string | null
  error: { message: string } | null
}> {
  if (!fileIdOrStoragePath) {
    return {
      url: null,
      error: { message: 'File ID or storage path is required.' },
    }
  }

  try {
    const response = await fetch(
      getApiUrl(`/download.php?id=${encodeURIComponent(fileIdOrStoragePath)}`),
      { method: 'GET', credentials: 'include' }
    )

    const contentType = response.headers.get('content-type') ?? ''

    if (contentType.includes('application/json')) {
      const json = await response.json().catch(() => null)

      if (!response.ok) {
        return {
          url: null,
          error: {
            message: json?.error ?? json?.message ?? `Server returned ${response.status}`,
          },
        }
      }

      const url =
        json?.url ??
        json?.download_url ??
        json?.data?.url ??
        json?.data?.download_url ??
        null

      if (url) {
        return { url, error: null }
      }

      return {
        url: null,
        error: { message: 'Download endpoint returned no file URL.' },
      }
    }

    if (response.ok) {
      return { url: response.url || null, error: null }
    }

    return {
      url: null,
      error: { message: `Server returned ${response.status}` },
    }
  } catch (error) {
    return {
      url: null,
      error: {
        message: error instanceof Error ? error.message : 'Unable to open file.',
      },
    }
  }
}

// ============================================================
// Delete individual portfolio file
// ============================================================

export async function deletePortfolioFile(file: PortfolioFile): Promise<{
  error: { message: string } | null
}> {
  const { error } = await apiFetch('/delete_portfolio_file.php', {
    method: 'POST',
    body: JSON.stringify({ id: file.id, storage_path: file.storage_path }),
  })

  return { error }
}

// ============================================================
// Review Queue
// ============================================================

export interface ReviewQueueItem extends PortfolioItem {
  trainee: {
    id: string
    employee_id: string
    batch_code: string
    department: string | null
    users_profile: {
      full_name: string
      email: string
    } | null
  } | null
}

export async function listReviewQueue(): Promise<{
  items: ReviewQueueItem[]
  error: { message: string } | null
}> {
  const { data, error } = await apiFetch<{ items: ReviewQueueItem[] } | ReviewQueueItem[]>('/list_review_queue.php')
  
  if (error) {
    return { items: [], error }
  }

  const items = Array.isArray(data) ? data : data?.items ?? []
  return { items, error: null }
}

// ============================================================
// Review portfolio item
// ============================================================

export async function reviewPortfolioItem(
  id: string,
  decision: 'approved' | 'returned',
  note: string
): Promise<{
  error: { message: string } | null
}> {
  if (!id) {
    return { error: { message: 'Portfolio item ID is required.' } }
  }

  const { error } = await apiFetch('/review_portfolio_item.php', {
    method: 'POST',
    body: JSON.stringify({
      id,
      decision,
      review_note: note.trim() || null,
    }),
  })

  return { error }
}

// ============================================================
// Dashboard summary
// ============================================================

export interface PortfolioSummary {
  total: number
  pending: number
  approved: number
  returned: number
}

export async function getMyPortfolioSummary(): Promise<{
  summary: PortfolioSummary
  error: { message: string } | null
}> {
  const { items, error } = await listMyPortfolioItems()

  const summary: PortfolioSummary = {
    total: items.length,
    pending: items.filter((item) => item.status === 'pending').length,
    approved: items.filter((item) => item.status === 'approved').length,
    returned: items.filter((item) => item.status === 'returned').length,
  }

  return { summary, error }
}