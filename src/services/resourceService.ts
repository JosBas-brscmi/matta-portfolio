import { apiFetch } from './apiClient'
import { getMyTraineeId } from './traineeService'

// ============================================================
// Step 17 · Mentor/management resources for trainees
// (training plans, schedules, materials)
// ============================================================

export const RESOURCE_BUCKET = 'trainee-resources'
export const MAX_RESOURCE_BYTES = 50 * 1024 * 1024 // 50 MB

export type ResourceCategory = 'training_plan' | 'schedule' | 'material' | 'other'

export const RESOURCE_CATEGORY_OPTIONS: { value: ResourceCategory; label: string }[] = [
  { value: 'training_plan', label: 'Training Plan 訓練計畫' },
  { value: 'schedule', label: 'Schedule / Timetable 課表' },
  { value: 'material', label: 'Learning Material 教材' },
  { value: 'other', label: 'Other 其他' },
]

export const RESOURCE_CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  RESOURCE_CATEGORY_OPTIONS.map((c) => [c.value, c.label]),
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
  zip: 'application/zip',
}

export const RESOURCE_ACCEPT_ATTR = Object.keys(ALLOWED_EXTENSIONS)
  .map((e) => `.${e}`)
  .join(',')

export interface TraineeResource {
  id: string
  trainee_id: string
  uploaded_by: string | null
  title: string
  category: string
  file_name: string
  file_type: string | null
  file_size_bytes: number | null
  storage_path: string
  created_at: string
  uploader_name?: string | null
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function validateResourceFile(file: File): string | null {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (!ALLOWED_EXTENSIONS[ext]) {
    return `"${file.name}" — file type .${ext} is not allowed. 不支援的檔案類型。`
  }
  if (file.size > MAX_RESOURCE_BYTES) {
    return `"${file.name}" is ${formatBytes(file.size)} — limit is 50 MB. 檔案超過 50 MB。`
  }
  if (file.size === 0) return `"${file.name}" is empty. 檔案是空的。`
  return null
}

export async function listTraineeResources(traineeId: string): Promise<{
  resources: TraineeResource[]
  error: { message: string } | null
}> {
  if (!traineeId) {
    return { resources: [], error: { message: 'Trainee ID is required.' } }
  }

  const { data, error } = await apiFetch<{ resources: TraineeResource[] } | TraineeResource[]>(
    `/list_trainee_resources.php?trainee_id=${encodeURIComponent(traineeId)}`,
  )

  if (error) {
    return { resources: [], error }
  }

  const resources = Array.isArray(data) ? data : data?.resources ?? []
  return { resources, error: null }
}

export async function listMyResources(): Promise<{
  resources: TraineeResource[]
  error: { message: string } | null
}> {
  const { trainee_id, error: idErr } = await getMyTraineeId()
  if (idErr) return { resources: [], error: idErr }
  return listTraineeResources(trainee_id)
}

export async function uploadResource(
  traineeId: string,
  title: string,
  category: ResourceCategory,
  file: File,
): Promise<{ error: { message: string } | null }> {
  const invalid = validateResourceFile(file)
  if (invalid) return { error: { message: invalid } }

  const formData = new FormData()
  formData.append('trainee_id', traineeId)
  formData.append('title', title.trim() || file.name)
  formData.append('category', category)
  formData.append('file', file)

  const { error } = await apiFetch('/upload_resource.php', {
    method: 'POST',
    body: formData,
  })

  return { error }
}

export async function deleteResource(
  r: TraineeResource,
): Promise<{ error: { message: string } | null }> {
  const { error } = await apiFetch('/delete_resource.php', {
    method: 'POST',
    body: JSON.stringify({ id: r.id, storage_path: r.storage_path }),
  })

  return { error }
}

export async function getResourceDownloadUrl(
  storagePath: string,
): Promise<{ url: string | null; error: { message: string } | null }> {
  if (!storagePath) {
    return { url: null, error: null }
  }

  const { data, error } = await apiFetch<{ url: string }>(
    `/get_resource_download_url.php?path=${encodeURIComponent(storagePath)}`,
  )

  if (error) {
    return { url: null, error }
  }

  const url = data && typeof data === 'object' && 'url' in data ? data.url ?? null : null
  return { url, error: null }
}
