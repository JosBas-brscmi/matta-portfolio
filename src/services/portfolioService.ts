import { apiClient as supabase } from './apiClient'
import { getMyTraineeId } from './traineeService'

// ============================================================
// Step 8 · Portfolio items + file uploads (Supabase Storage)
// ============================================================

export const PORTFOLIO_BUCKET = 'portfolio-files'
export const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024 // 100 MB (matches bucket limit)

export type PortfolioStatus = 'pending' | 'approved' | 'returned'

export type PortfolioCategory =
  | 'reflection'
  | 'project'
  | 'qcc_report'
  | 'presentation'
  | 'photo'
  | 'certificate'
  | 'other'

export const CATEGORY_OPTIONS: { value: PortfolioCategory; label: string }[] = [
  { value: 'reflection', label: 'Weekly Reflection 週記反思' },
  { value: 'project', label: 'Project / Assignment 專案作業' },
  { value: 'qcc_report', label: 'QCC Report QCC報告' },
  { value: 'presentation', label: 'Presentation 簡報' },
  { value: 'photo', label: 'Photo / Evidence 照片佐證' },
  { value: 'certificate', label: 'Certificate 證書' },
  { value: 'other', label: 'Other 其他' },
]

export const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  CATEGORY_OPTIONS.map((c) => [c.value, c.label]),
)

// Allowed upload types — keep in sync with bucket allowed_mime_types (v0.6).
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
  .map((ext) => `.${ext}`)
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

const ITEM_SELECT = `
  id, trainee_id, title, description, category, status,
  review_note, reviewed_at, submitted_at, created_at, updated_at,
  portfolio_files ( id, portfolio_item_id, file_name, file_type,
                    file_size_bytes, storage_path, uploaded_at )
`

// ---------- Client-side file validation ----------

export function validateFile(file: File): string | null {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (!ALLOWED_EXTENSIONS[ext]) {
    return `"${file.name}" — file type .${ext} is not allowed. Allowed: ${Object.keys(ALLOWED_EXTENSIONS).join(', ')}.`
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return `"${file.name}" is ${formatBytes(file.size)} — the limit is 100 MB per file.`
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

function sanitizeFileName(name: string): string {
  const dot = name.lastIndexOf('.')
  const base = (dot > 0 ? name.slice(0, dot) : name)
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/_{2,}/g, '_')
    .slice(0, 80)
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase() : ''
  return ext ? `${base}.${ext}` : base
}

// ---------- List ----------

export async function listMyPortfolioItems(): Promise<{
  items: PortfolioItem[]
  error: { message: string } | null
}> {
  const { trainee_id, error: idErr } = await getMyTraineeId()
  if (idErr) return { items: [], error: idErr }
  return listTraineePortfolioItems(trainee_id)
}

export async function listTraineePortfolioItems(traineeId: string): Promise<{
  items: PortfolioItem[]
  error: { message: string } | null
}> {
  const { data, error } = await supabase
    .from('portfolio_items')
    .select(ITEM_SELECT)
    .eq('trainee_id', traineeId)
    .order('submitted_at', { ascending: false })

  return { items: (data as unknown as PortfolioItem[] | null) ?? [], error }
}

// ---------- Create / update / delete items ----------

export async function createMyPortfolioItem(
  input: PortfolioItemInput,
): Promise<{ item: PortfolioItem | null; error: { message: string } | null }> {
  const { trainee_id, error: idErr } = await getMyTraineeId()
  if (idErr) return { item: null, error: idErr }

  const { data, error } = await supabase
    .from('portfolio_items')
    .insert({
      trainee_id,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      category: input.category,
      status: 'pending',
    })
    .select(ITEM_SELECT)
    .single()

  return { item: data as unknown as PortfolioItem | null, error }
}

// Editing a returned item resubmits it (status → pending) so the
// MA Center sees it back in the review queue.
export async function updateMyPortfolioItem(
  id: string,
  input: PortfolioItemInput,
  resubmit: boolean,
): Promise<{ item: PortfolioItem | null; error: { message: string } | null }> {
  const patch: Record<string, unknown> = {
    title: input.title.trim(),
    description: input.description?.trim() || null,
    category: input.category,
  }
  if (resubmit) {
    patch.status = 'pending'
    patch.submitted_at = new Date().toISOString()
    patch.review_note = null
    patch.reviewed_at = null
    patch.reviewed_by = null
  }

  const { data, error } = await supabase
    .from('portfolio_items')
    .update(patch)
    .eq('id', id)
    .select(ITEM_SELECT)
    .single()

  return { item: data as unknown as PortfolioItem | null, error }
}

// Delete an item: remove its storage objects first, then the row
// (portfolio_files rows cascade via FK).
export async function deleteMyPortfolioItem(
  item: PortfolioItem,
): Promise<{ error: { message: string } | null }> {
  const paths = item.portfolio_files.map((f) => f.storage_path)
  if (paths.length > 0) {
    const { error: rmErr } = await supabase.storage.from(PORTFOLIO_BUCKET).remove(paths)
    if (rmErr) return { error: rmErr }
  }
  const { error } = await supabase.from('portfolio_items').delete().eq('id', item.id)
  return { error }
}

// ---------- File upload / download / delete ----------

export interface UploadOutcome {
  uploaded: PortfolioFile[]
  failed: { fileName: string; message: string }[]
}

export async function uploadPortfolioFiles(
  traineeId: string,
  portfolioItemId: string,
  files: File[],
): Promise<UploadOutcome> {
  const outcome: UploadOutcome = { uploaded: [], failed: [] }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  for (const file of files) {
    const invalid = validateFile(file)
    if (invalid) {
      outcome.failed.push({ fileName: file.name, message: invalid })
      continue
    }

    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    const storagePath = `${traineeId}/${portfolioItemId}/${Date.now()}_${sanitizeFileName(file.name)}`

    const { error: upErr } = await supabase.storage
      .from(PORTFOLIO_BUCKET)
      .upload(storagePath, file, {
        contentType: ALLOWED_EXTENSIONS[ext],
        upsert: false,
      })

    if (upErr) {
      outcome.failed.push({ fileName: file.name, message: upErr.message })
      continue
    }

    const { data, error: rowErr } = await supabase
      .from('portfolio_files')
      .insert({
        portfolio_item_id: portfolioItemId,
        file_name: file.name,
        file_type: ALLOWED_EXTENSIONS[ext],
        file_size_bytes: file.size,
        storage_path: storagePath,
        uploaded_by: user?.id ?? null,
      })
      .select('id, portfolio_item_id, file_name, file_type, file_size_bytes, storage_path, uploaded_at')
      .single()

    if (rowErr || !data) {
      // Roll back the orphaned storage object so DB and bucket stay in sync.
      await supabase.storage.from(PORTFOLIO_BUCKET).remove([storagePath])
      outcome.failed.push({ fileName: file.name, message: rowErr?.message ?? 'DB insert failed' })
      continue
    }

    outcome.uploaded.push(data as PortfolioFile)
  }

  return outcome
}

// Signed URL valid for 1 hour — RLS on storage.objects decides who may sign.
export async function getFileDownloadUrl(
  fileIdOrStoragePath: string,
): Promise<{
  url: string | null
  error: { message: string } | null
}> {
  /*
   * ReviewsPage passes file.storage_path here.
   *
   * We therefore need a way to find the portfolio_files row.
   *
   * The local API download endpoint accepts the file ID, so the
   * preferred approach is to pass the file ID instead.
   *
   * This function is kept compatible with the existing interface
   * for now by treating the argument as a file ID when possible.
   */
  try {
    const response = await fetch(
      `${window.location.origin}/matta/api/download.php?id=${encodeURIComponent(fileIdOrStoragePath)}`,
      {
        method: 'GET',
        credentials: 'include',
      },
    )

    if (!response.ok) {
      const json = await response.json().catch(() => null)

      return {
        url: null,
        error: {
          message:
            json?.error ??
            `Server returned ${response.status}`,
        },
      }
    }

    /*
     * We don't download the file into JavaScript.
     * Return the URL so ReviewsPage can use window.open().
     */
    return {
      url: response.url,
      error: null,
    }

  } catch (error) {
    return {
      url: null,
      error: {
        message:
          error instanceof Error
            ? error.message
            : 'Unable to open file.',
      },
    }
  }
}

export async function deletePortfolioFile(
  file: PortfolioFile,
): Promise<{ error: { message: string } | null }> {
  const { error: rmErr } = await supabase.storage
    .from(PORTFOLIO_BUCKET)
    .remove([file.storage_path])
  if (rmErr) return { error: rmErr }

  const { error } = await supabase.from('portfolio_files').delete().eq('id', file.id)
  return { error }
}

// ---------- Step 9 · Review queue (MA Center / mentor / manager / owner) ----------

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

const QUEUE_SELECT = `
  id, trainee_id, title, description, category, status,
  review_note, reviewed_at, submitted_at, created_at, updated_at,
  portfolio_files ( id, portfolio_item_id, file_name, file_type,
                    file_size_bytes, storage_path, uploaded_at ),
  trainee:trainee_id ( id, employee_id, batch_code, department,
                       users_profile:user_id ( full_name, email ) )
`

// RLS decides scope automatically: MA Center / owner / board see all,
// mentors see their own trainees, managers see their department.
export async function listReviewQueue(): Promise<{
  items: ReviewQueueItem[]
  error: { message: string } | null
}> {
  try {
    const response = await fetch(
      `${window.location.origin}/matta/api/list_review_queue.php`,
      {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )

    const json = await response.json().catch(() => null)

    if (!response.ok) {
      return {
        items: [],
        error: {
          message:
            json?.error ??
            `Server returned ${response.status}`,
        },
      }
    }

    return {
      items: Array.isArray(json?.items)
        ? (json.items as ReviewQueueItem[])
        : [],
      error: null,
    }
  } catch (error) {
    return {
      items: [],
      error: {
        message:
          error instanceof Error
            ? error.message
            : 'Unable to load review queue.',
      },
    }
  }
}

export async function reviewPortfolioItem(
  id: string,
  decision: 'approved' | 'returned',
  note: string,
): Promise<{ error: { message: string } | null }> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: { message: 'Not signed in' } }

  const { error } = await supabase
    .from('portfolio_items')
    .update({
      status: decision,
      review_note: note.trim() || null,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', id)

  return { error }
}

// ---------- Dashboard summary ----------

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
    pending: items.filter((i) => i.status === 'pending').length,
    approved: items.filter((i) => i.status === 'approved').length,
    returned: items.filter((i) => i.status === 'returned').length,
  }
  return { summary, error }
}
