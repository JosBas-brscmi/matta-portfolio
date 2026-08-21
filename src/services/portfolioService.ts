
import {
  apiClient as supabase,
  apiFetch,
  getApiUrl,
} from './apiClient'

import {
  getMyTraineeId,
} from './traineeService'

// ============================================================
// Portfolio items + local file uploads
// ============================================================

export const PORTFOLIO_BUCKET =
  'portfolio-files'

export const MAX_FILE_SIZE_BYTES =
  100 * 1024 * 1024

export type PortfolioStatus =
  | 'pending'
  | 'approved'
  | 'returned'

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
  {
    value: 'reflection',
    label:
      'Weekly Reflection 週記反思',
  },
  {
    value: 'project',
    label:
      'Project / Assignment 專案作業',
  },
  {
    value: 'qcc_report',
    label:
      'QCC Report QCC報告',
  },
  {
    value: 'presentation',
    label:
      'Presentation 簡報',
  },
  {
    value: 'photo',
    label:
      'Photo / Evidence 照片佐證',
  },
  {
    value: 'certificate',
    label:
      'Certificate 證書',
  },
  {
    value: 'other',
    label:
      'Other 其他',
  },
]

export const CATEGORY_LABEL:
  Record<string, string> =
  Object.fromEntries(
    CATEGORY_OPTIONS.map(
      (category) => [
        category.value,
        category.label,
      ],
    ),
  )

// ============================================================
// Allowed upload types
// ============================================================

const ALLOWED_EXTENSIONS:
  Record<string, string> = {
    pdf: 'application/pdf',

    doc:
      'application/msword',

    docx:
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',

    xls:
      'application/vnd.ms-excel',

    xlsx:
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',

    ppt:
      'application/vnd.ms-powerpoint',

    pptx:
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',

    jpg: 'image/jpeg',

    jpeg: 'image/jpeg',

    png: 'image/png',

    mp4: 'video/mp4',

    mov: 'video/quicktime',

    zip: 'application/zip',
  }

export const ACCEPT_ATTR =
  Object.keys(
    ALLOWED_EXTENSIONS,
  )
    .map(
      (extension) =>
        `.${extension}`,
    )
    .join(',')

// ============================================================
// Interfaces
// ============================================================

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
  id,
  trainee_id,
  title,
  description,
  category,
  status,
  review_note,
  reviewed_at,
  submitted_at,
  created_at,
  updated_at,
  portfolio_files (
    id,
    portfolio_item_id,
    file_name,
    file_type,
    file_size_bytes,
    storage_path,
    uploaded_at
  )
`

// ============================================================
// File validation
// ============================================================

export function validateFile(
  file: File,
): string | null {
  const extension =
    file.name
      .split('.')
      .pop()
      ?.toLowerCase() ?? ''

  if (
    !ALLOWED_EXTENSIONS[
      extension
    ]
  ) {
    return (
      `"${file.name}" — ` +
      `file type .${extension} is not allowed. ` +
      `Allowed: ${Object.keys(
        ALLOWED_EXTENSIONS,
      ).join(', ')}.`
    )
  }

  if (
    file.size >
    MAX_FILE_SIZE_BYTES
  ) {
    return (
      `"${file.name}" is ` +
      `${formatBytes(file.size)} — ` +
      `the limit is 100 MB per file.`
    )
  }

  if (file.size === 0) {
    return (
      `"${file.name}" is empty ` +
      `(0 bytes).`
    )
  }

  return null
}

export function formatBytes(
  bytes:
    | number
    | null
    | undefined,
): string {
  if (bytes == null) {
    return '—'
  }

  if (bytes < 1024) {
    return `${bytes} B`
  }

  if (
    bytes <
    1024 * 1024
  ) {
    return `${(
      bytes / 1024
    ).toFixed(1)} KB`
  }

  return `${(
    bytes /
    (1024 * 1024)
  ).toFixed(1)} MB`
}

function sanitizeFileName(
  name: string,
): string {
  const dot =
    name.lastIndexOf('.')

  const base = (
    dot > 0
      ? name.slice(0, dot)
      : name
  )
    .replace(
      /[^a-zA-Z0-9._-]+/g,
      '_',
    )
    .replace(
      /_{2,}/g,
      '_',
    )
    .slice(0, 80)

  const extension =
    dot > 0
      ? name
          .slice(dot + 1)
          .toLowerCase()
      : ''

  return extension
    ? `${base}.${extension}`
    : base
}

// ============================================================
// List
// ============================================================

export async function listMyPortfolioItems(): Promise<{
  items: PortfolioItem[]
  error: {
    message: string
  } | null
}> {
  const {
    trainee_id,
    error: idError,
  } =
    await getMyTraineeId()

  if (idError) {
    return {
      items: [],
      error: idError,
    }
  }

  return listTraineePortfolioItems(
    trainee_id,
  )
}

export async function listTraineePortfolioItems(
  traineeId: string,
): Promise<{
  items: PortfolioItem[]
  error: {
    message: string
  } | null
}> {
  if (!traineeId) {
    return {
      items: [],
      error: {
        message:
          'Trainee ID is required.',
      },
    }
  }

  const {
    data,
    error,
  } = await supabase
    .from('portfolio_items')
    .select(ITEM_SELECT)
    .eq(
      'trainee_id',
      traineeId,
    )
    .order(
      'submitted_at',
      {
        ascending: false,
      },
    )

  return {
    items:
      (data as PortfolioItem[] | null) ??
      [],
    error,
  }
}

// ============================================================
// Create
// ============================================================

export async function createMyPortfolioItem(
  input: PortfolioItemInput,
): Promise<{
  item: PortfolioItem | null
  error: {
    message: string
  } | null
}> {
  const {
    trainee_id,
    error: idError,
  } =
    await getMyTraineeId()

  if (idError) {
    return {
      item: null,
      error: idError,
    }
  }

  const {
    data,
    error,
  } = await supabase
    .from('portfolio_items')
    .insert({
      trainee_id,
      title:
        input.title.trim(),
      description:
        input.description?.trim() ||
        null,
      category:
        input.category,
      status: 'pending',
    })
    .select(ITEM_SELECT)
    .single()

  return {
    item:
      data as PortfolioItem | null,
    error,
  }
}

// ============================================================
// Update
// ============================================================

export async function updateMyPortfolioItem(
  id: string,
  input: PortfolioItemInput,
  resubmit: boolean,
): Promise<{
  item: PortfolioItem | null
  error: {
    message: string
  } | null
}> {
  if (!id) {
    return {
      item: null,
      error: {
        message:
          'Portfolio item ID is required.',
      },
    }
  }

  const patch: Record<
    string,
    unknown
  > = {
    title:
      input.title.trim(),

    description:
      input.description?.trim() ||
      null,

    category:
      input.category,
  }

  if (resubmit) {
    patch.status =
      'pending'

    patch.submitted_at =
      new Date().toISOString()

    patch.review_note =
      null

    patch.reviewed_at =
      null

    patch.reviewed_by =
      null
  }

  /*
   * IMPORTANT:
   *
   * apiClient now correctly supports:
   *
   * .update(...)
   * .eq(...)
   * .select(...)
   * .single()
   */
  const {
    data,
    error,
  } = await supabase
    .from('portfolio_items')
    .update(patch)
    .eq('id', id)
    .select(ITEM_SELECT)
    .single()

  return {
    item:
      data as PortfolioItem | null,
    error,
  }
}

// ============================================================
// Delete portfolio item
// ============================================================

export async function deleteMyPortfolioItem(
  item: PortfolioItem,
): Promise<{
  error: {
    message: string
  } | null
}> {
  /*
   * Try to remove physical files first.
   *
   * The local PHP upload endpoint must support DELETE for
   * physical storage deletion. If it does not, we still remove
   * the database row so the application does not get stuck.
   */
  const paths =
    item.portfolio_files
      .map(
        (file) =>
          file.storage_path,
      )
      .filter(Boolean)

  if (paths.length > 0) {
    await supabase.storage
      .from(PORTFOLIO_BUCKET)
      .remove(paths)
  }

  const {
    error,
  } = await supabase
    .from('portfolio_items')
    .delete()
    .eq('id', item.id)

  return {
    error,
  }
}

// ============================================================
// File upload
// ============================================================

export interface UploadOutcome {
  uploaded: PortfolioFile[]
  failed: {
    fileName: string
    message: string
  }[]
}

export async function uploadPortfolioFiles(
  traineeId: string,
  portfolioItemId: string,
  files: File[],
): Promise<UploadOutcome> {
  const outcome: UploadOutcome = {
    uploaded: [],
    failed: [],
  }

  if (!traineeId) {
    return {
      uploaded: [],
      failed: files.map(
        (file) => ({
          fileName:
            file.name,
          message:
            'Trainee ID is required.',
        }),
      ),
    }
  }

  if (!portfolioItemId) {
    return {
      uploaded: [],
      failed: files.map(
        (file) => ({
          fileName:
            file.name,
          message:
            'Portfolio item ID is required.',
        }),
      ),
    }
  }

  const {
    data: userData,
  } =
    await supabase.auth.getUser()

  const user =
    userData?.user ?? null

  for (const file of files) {
    const invalid =
      validateFile(file)

    if (invalid) {
      outcome.failed.push({
        fileName: file.name,
        message: invalid,
      })

      continue
    }

    const extension =
      file.name
        .split('.')
        .pop()
        ?.toLowerCase() ?? ''

    const storagePath =
      `${traineeId}/` +
      `${portfolioItemId}/` +
      `${Date.now()}_` +
      `${sanitizeFileName(
        file.name,
      )}`

    /*
     * Upload physical file through local PHP.
     */
    const {
      data: uploadData,
      error: uploadError,
    } =
      await supabase.storage
        .from(PORTFOLIO_BUCKET)
        .upload(
          storagePath,
          file,
          {
            contentType:
              ALLOWED_EXTENSIONS[
                extension
              ],
            upsert: false,
          },
        )

    if (uploadError) {
      outcome.failed.push({
        fileName: file.name,
        message:
          uploadError.message,
      })

      continue
    }

    /*
     * Store file metadata in PostgreSQL.
     *
     * The physical file and database row are deliberately
     * separate operations.
     */
    const {
      data: rowData,
      error: rowError,
    } =
      await supabase
        .from('portfolio_files')
        .insert({
          portfolio_item_id:
            portfolioItemId,

          file_name:
            file.name,

          file_type:
            ALLOWED_EXTENSIONS[
              extension
            ],

          file_size_bytes:
            file.size,

          storage_path:
            storagePath,

          uploaded_by:
            user?.id ?? null,
        })
        .select(
          `
          id,
          portfolio_item_id,
          file_name,
          file_type,
          file_size_bytes,
          storage_path,
          uploaded_at
        `,
        )
        .single()

    if (rowError || !rowData) {
      /*
       * Try to clean up the physical file.
       * Do not hide the original DB error.
       */
      await supabase.storage
        .from(PORTFOLIO_BUCKET)
        .remove([
          storagePath,
        ])

      outcome.failed.push({
        fileName: file.name,
        message:
          rowError?.message ??
          'Database insert failed.',
      })

      continue
    }

    outcome.uploaded.push(
      rowData as PortfolioFile,
    )

    /*
     * Prevent a very fast second upload from receiving
     * the exact same millisecond timestamp.
     */
    await new Promise(
      (resolve) =>
        setTimeout(
          resolve,
          2,
        ),
    )
  }

  return outcome
}

// ============================================================
// File download
// ============================================================

export async function getFileDownloadUrl(
  fileIdOrStoragePath: string,
): Promise<{
  url: string | null
  error: {
    message: string
  } | null
}> {
  if (!fileIdOrStoragePath) {
    return {
      url: null,
      error: {
        message:
          'File ID or storage path is required.',
      },
    }
  }

  /*
   * First try the PHP download endpoint using the file ID.
   *
   * This is preferred because PHP can enforce session/role
   * permissions before returning the file.
   */
  try {
    const response =
      await fetch(
        getApiUrl(
          `/download.php?id=${encodeURIComponent(
            fileIdOrStoragePath,
          )}`,
        ),
        {
          method: 'GET',
          credentials: 'include',
        },
      )

    const contentType =
      response.headers.get(
        'content-type',
      ) ?? ''

    /*
     * If PHP returned JSON, it probably returned a URL or
     * an error message.
     */
    if (
      contentType.includes(
        'application/json',
      )
    ) {
      const json =
        await response
          .json()
          .catch(
            () => null,
          )

      if (!response.ok) {
        return {
          url: null,
          error: {
            message:
              json?.error ??
              json?.message ??
              `Server returned ${response.status}`,
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
        return {
          url,
          error: null,
        }
      }

      return {
        url: null,
        error: {
          message:
            'Download endpoint returned no file URL.',
        },
      }
    }

    /*
     * If the endpoint returned the actual file or redirected
     * to it, response.url is the final URL.
     */
    if (response.ok) {
      return {
        url:
          response.url ||
          null,
        error: null,
      }
    }

    return {
      url: null,
      error: {
        message:
          `Server returned ${response.status}`,
      },
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

// ============================================================
// Delete individual portfolio file
// ============================================================

export async function deletePortfolioFile(
  file: PortfolioFile,
): Promise<{
  error: {
    message: string
  } | null
}> {
  /*
   * Attempt physical deletion.
   */
  const {
    error: storageError,
  } =
    await supabase.storage
      .from(PORTFOLIO_BUCKET)
      .remove([
        file.storage_path,
      ])

  /*
   * If the PHP storage endpoint explicitly reports an error,
   * stop here so we do not lose the DB reference while the
   * physical file remains.
   */
  if (storageError) {
    return {
      error: storageError,
    }
  }

  /*
   * Delete metadata row.
   */
  const {
    error,
  } = await supabase
    .from('portfolio_files')
    .delete()
    .eq('id', file.id)

  return {
    error,
  }
}

// ============================================================
// Review Queue
// ============================================================

export interface ReviewQueueItem
  extends PortfolioItem {
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
  error: {
    message: string
  } | null
}> {
  const {
    data,
    error,
  } =
    await apiFetch<{
      items: ReviewQueueItem[]
    }>('/list_review_queue.php')

  return {
    items:
      data?.items ?? [],
    error,
  }
}

// ============================================================
// Review portfolio item
// ============================================================

export async function reviewPortfolioItem(
  id: string,
  decision:
    | 'approved'
    | 'returned',
  note: string,
): Promise<{
  error: {
    message: string
  } | null
}> {
  if (!id) {
    return {
      error: {
        message:
          'Portfolio item ID is required.',
      },
    }
  }

  const {
    data: userData,
    error: userError,
  } =
    await supabase.auth.getUser()

  if (userError) {
    return {
      error: userError,
    }
  }

  const user =
    userData?.user ?? null

  if (!user) {
    return {
      error: {
        message:
          'Not signed in.',
      },
    }
  }

  const {
    error,
  } = await supabase
    .from('portfolio_items')
    .update({
      status:
        decision,

      review_note:
        note.trim() ||
        null,

      reviewed_by:
        user.id,

      reviewed_at:
        new Date().toISOString(),
    })
    .eq('id', id)

  return {
    error,
  }
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
  error: {
    message: string
  } | null
}> {
  const {
    items,
    error,
  } =
    await listMyPortfolioItems()

  const summary: PortfolioSummary = {
    total:
      items.length,

    pending:
      items.filter(
        (item) =>
          item.status ===
          'pending',
      ).length,

    approved:
      items.filter(
        (item) =>
          item.status ===
          'approved',
      ).length,

    returned:
      items.filter(
        (item) =>
          item.status ===
          'returned',
      ).length,
  }

  return {
    summary,
    error,
  }
}

