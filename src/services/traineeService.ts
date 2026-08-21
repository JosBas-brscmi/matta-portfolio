
import {
  apiFetch,
} from './apiClient'

// ============================================================
// Types & Interfaces
// ============================================================

export interface TraineeWithProfile {
  id: string
  employee_id: string
  batch_code: string
  onboard_date: string
  department: string | null
  training_status: string
  profile_completeness: number
  users_profile: {
    full_name: string
    email: string
  } | null
}

export interface TraineeFullDetail {
  id: string
  user_id: string
  employee_id: string
  batch_code: string
  onboard_date: string
  education: string | null
  department: string | null
  training_status: string
  profile_completeness: number
  mentor_id: string | null
  created_at: string
  users_profile: {
    full_name: string
    english_name: string | null
    email: string
    role: string
    status: string
    avatar_path: string | null
    phone: string | null
    bio: string | null
  } | null
  mentor: {
    full_name: string
    email: string
  } | null
}

export interface InvitePayload {
  email: string
  full_name: string
  employee_id: string
  batch_code: string
  onboard_date: string
  department?: string
}

export interface InviteResult {
  ok: true
  email: string
  temp_password: string
  trainee_id: string
  user_id: string
  message: string
}

export type CoursePhase =
  | 'phase1_general'
  | 'phase2_department'

export interface Course {
  id: string
  course_code: string | null
  course_name: string
  category: string | null
  phase: CoursePhase
  hours: number | null
  instructor: string | null
  applicable_departments: string[] | null
  is_active: boolean
}

export interface TrainingRecord {
  id: string
  trainee_id: string
  course_id: string
  attendance_date: string
  attended: boolean
  hours: number
  test_score: number | null
  reflection: string | null
  completion_status: string | null
  created_at: string
  updated_at: string
  course?: Pick<
    Course,
    | 'id'
    | 'course_code'
    | 'course_name'
    | 'category'
    | 'phase'
    | 'instructor'
  > | null
}

export interface TrainingRecordFormInput {
  attendance_date: string
  attended: boolean
  hours: number
  test_score?: number | null
  reflection?: string | null
  course_name: string
  course_phase: CoursePhase
  course_instructor?: string
  course_category?: string
}

export interface TrainingProgress {
  phase1_hours: number
  phase1_target: number
  phase2_hours: number
  phase2_target: number
}

// ============================================================
// Constants
// ============================================================

export const TRAINING_STATUS_OPTIONS: {
  value: string
  label: string
}[] = [
  {
    value: 'onboarding',
    label: 'Onboarding 報到中',
  },
  {
    value: 'phase1_general',
    label: 'Phase 1 · General 通識訓練',
  },
  {
    value: 'phase2_department',
    label: 'Phase 2 · Department 部門訓練',
  },
  {
    value: 'final_assessment',
    label: 'Final assessment 期末評核',
  },
  {
    value: 'graduated',
    label: 'Graduated 結業',
  },
  {
    value: 'transferred',
    label: 'Transferred 轉調',
  },
  {
    value: 'withdrawn',
    label: 'Withdrawn 退訓',
  },
]

export const PHASE1_TARGET_HOURS = 80
export const PHASE2_TARGET_HOURS = 880

// ============================================================
// Trainee API
// ============================================================

export async function listTrainees(): Promise<{
  trainees: TraineeWithProfile[]
  error: {
    message: string
  } | null
}> {
  const {
    data,
    error,
  } = await apiFetch<{
    trainees: TraineeWithProfile[]
  }>('/list_trainees.php')

  return {
    trainees:
      data?.trainees ?? [],
    error,
  }
}

export async function getTraineeById(
  id: string,
): Promise<{
  trainee: TraineeFullDetail | null
  error: {
    message: string
  } | null
}> {
  if (!id) {
    return {
      trainee: null,
      error: {
        message:
          'Trainee ID is required.',
      },
    }
  }

  const {
    data,
    error,
  } = await apiFetch<{
    trainee: TraineeFullDetail
  }>(
    `/get_trainee.php?id=${encodeURIComponent(
      id,
    )}`,
  )

  return {
    trainee:
      data?.trainee ?? null,
    error,
  }
}

export async function inviteTrainee(
  payload: InvitePayload,
): Promise<
  | {
      ok: true
      result: InviteResult
    }
  | {
      ok: false
      error: string
    }
> {
  const {
    data,
    error,
  } = await apiFetch<InviteResult>(
    '/invite_trainee.php',
    {
      method: 'POST',
      body: JSON.stringify(
        payload,
      ),
    },
  )

  if (error || !data) {
    return {
      ok: false,
      error:
        error?.message ??
        'Failed to invite trainee.',
    }
  }

  return {
    ok: true,
    result: data,
  }
}

export async function updateTraineeStatus(
  traineeId: string,
  status: string,
): Promise<{
  error: {
    message: string
  } | null
}> {
  if (!traineeId) {
    return {
      error: {
        message:
          'Trainee ID is required.',
      },
    }
  }

  if (!status) {
    return {
      error: {
        message:
          'Training status is required.',
      },
    }
  }

  const {
    error,
  } = await apiFetch(
    '/update_trainee_status.php',
    {
      method: 'POST',
      body: JSON.stringify({
        id: traineeId,
        status,
      }),
    },
  )

  return {
    error,
  }
}

// ============================================================
// Course API
// ============================================================

export async function findOrCreateCourse(
  name: string,
  phase: CoursePhase,
  instructor?: string,
  category?: string,
): Promise<{
  course_id: string
  created: boolean
  error: {
    message: string
  } | null
}> {
  const cleanName =
    name.trim()

  if (!cleanName) {
    return {
      course_id: '',
      created: false,
      error: {
        message:
          'Course name is required.',
      },
    }
  }

  const {
    data,
    error,
  } = await apiFetch<{
    course_id: string
    created: boolean
  }>(
    '/find_or_create_course.php',
    {
      method: 'POST',
      body: JSON.stringify({
        course_name:
          cleanName,
        phase,
        instructor:
          instructor?.trim() ||
          null,
        category:
          category?.trim() ||
          null,
      }),
    },
  )

  if (error || !data) {
    return {
      course_id: '',
      created: false,
      error:
        error ?? {
          message:
            'Failed to find or create course.',
        },
    }
  }

  return {
    course_id:
      data.course_id,
    created:
      data.created,
    error: null,
  }
}

// ============================================================
// Current user's trainee record
// ============================================================

export async function getMyTraineeId(): Promise<{
  trainee_id: string
  error: {
    message: string
  } | null
}> {
  const {
    data,
    error,
  } = await apiFetch<{
    trainee_id: string
  }>('/get_my_trainee_id.php')

  if (error || !data?.trainee_id) {
    return {
      trainee_id: '',
      error:
        error ?? {
          message:
            'No trainee record exists for the current user.',
        },
    }
  }

  return {
    trainee_id:
      data.trainee_id,
    error: null,
  }
}

// ============================================================
// Training Records
// ============================================================

export async function listMyTrainingRecords(): Promise<{
  records: TrainingRecord[]
  error: {
    message: string
  } | null
}> {
  const {
    data,
    error,
  } = await apiFetch<{
    records: TrainingRecord[]
  }>(
    '/list_my_training_records.php',
  )

  return {
    records:
      data?.records ?? [],
    error,
  }
}

export async function listTraineeTrainingRecords(
  traineeId: string,
): Promise<{
  records: TrainingRecord[]
  error: {
    message: string
  } | null
}> {
  if (!traineeId) {
    return {
      records: [],
      error: {
        message:
          'Trainee ID is required.',
      },
    }
  }

  const {
    data,
    error,
  } = await apiFetch<{
    records: TrainingRecord[]
  }>(
    `/list_trainee_training_records.php?trainee_id=${encodeURIComponent(
      traineeId,
    )}`,
  )

  return {
    records:
      data?.records ?? [],
    error,
  }
}

export async function createMyTrainingRecord(
  input: TrainingRecordFormInput,
): Promise<{
  record: TrainingRecord | null
  error: {
    message: string
  } | null
}> {
  const {
    data,
    error,
  } = await apiFetch<{
    record: TrainingRecord
  }>(
    '/create_training_record.php',
    {
      method: 'POST',
      body: JSON.stringify(
        input,
      ),
    },
  )

  return {
    record:
      data?.record ?? null,
    error,
  }
}

export async function updateMyTrainingRecord(
  id: string,
  input: TrainingRecordFormInput,
): Promise<{
  record: TrainingRecord | null
  error: {
    message: string
  } | null
}> {
  if (!id) {
    return {
      record: null,
      error: {
        message:
          'Training record ID is required.',
      },
    }
  }

  const {
    data,
    error,
  } = await apiFetch<{
    record: TrainingRecord
  }>(
    '/update_training_record.php',
    {
      method: 'POST',
      body: JSON.stringify({
        id,
        ...input,
      }),
    },
  )

  return {
    record:
      data?.record ?? null,
    error,
  }
}

export async function deleteMyTrainingRecord(
  id: string,
): Promise<{
  error: {
    message: string
  } | null
}> {
  if (!id) {
    return {
      error: {
        message:
          'Training record ID is required.',
      },
    }
  }

  const {
    error,
  } = await apiFetch(
    '/delete_training_record.php',
    {
      method: 'POST',
      body: JSON.stringify({
        id,
      }),
    },
  )

  return {
    error,
  }
}

// ============================================================
// Progress Calculations
// ============================================================

export async function getMyTrainingProgress(): Promise<{
  progress: TrainingProgress
  error: {
    message: string
  } | null
}> {
  const {
    records,
    error,
  } =
    await listMyTrainingRecords()

  const progress: TrainingProgress = {
    phase1_hours: 0,
    phase1_target:
      PHASE1_TARGET_HOURS,
    phase2_hours: 0,
    phase2_target:
      PHASE2_TARGET_HOURS,
  }

  if (error) {
    return {
      progress,
      error,
    }
  }

  for (const record of records) {
    if (!record.attended) {
      continue
    }

    const phase =
      record.course?.phase

    if (
      phase ===
      'phase1_general'
    ) {
      progress.phase1_hours +=
        Number(record.hours) || 0
    } else if (
      phase ===
      'phase2_department'
    ) {
      progress.phase2_hours +=
        Number(record.hours) || 0
    }
  }

  return {
    progress,
    error: null,
  }
}

export async function getTraineeTrainingProgress(
  traineeId: string,
): Promise<{
  progress: TrainingProgress
  error: {
    message: string
  } | null
}> {
  const {
    records,
    error,
  } =
    await listTraineeTrainingRecords(
      traineeId,
    )

  const progress: TrainingProgress = {
    phase1_hours: 0,
    phase1_target:
      PHASE1_TARGET_HOURS,
    phase2_hours: 0,
    phase2_target:
      PHASE2_TARGET_HOURS,
  }

  if (error) {
    return {
      progress,
      error,
    }
  }

  for (const record of records) {
    if (!record.attended) {
      continue
    }

    const phase =
      record.course?.phase

    if (
      phase ===
      'phase1_general'
    ) {
      progress.phase1_hours +=
        Number(record.hours) || 0
    } else if (
      phase ===
      'phase2_department'
    ) {
      progress.phase2_hours +=
        Number(record.hours) || 0
    }
  }

  return {
    progress,
    error: null,
  }
}

