import { apiFetch } from './apiClient'
import { getMyTraineeId } from './traineeService'

// ============================================================
// Step 10 · Assessments CRUD
// ============================================================

export type AssessmentType =
  | 'entrance_test'
  | 'course_quiz'
  | 'monthly_test'
  | 'midterm'
  | 'final'
  | 'department_eval'
  | 'other'

export const ASSESSMENT_TYPE_OPTIONS: { value: AssessmentType; label: string }[] = [
  { value: 'entrance_test', label: 'Entrance Test 入職測驗' },
  { value: 'course_quiz', label: 'Course Quiz 課程測驗' },
  { value: 'monthly_test', label: 'Monthly Test 月度測驗' },
  { value: 'midterm', label: 'Mid-term Assessment 期中評量' },
  { value: 'final', label: 'Final Assessment 期末評量' },
  { value: 'department_eval', label: 'Department Evaluation 部門評核' },
  { value: 'other', label: 'Other 其他' },
]

export const ASSESSMENT_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  ASSESSMENT_TYPE_OPTIONS.map((t) => [t.value, t.label]),
)

export interface Assessment {
  id: string
  trainee_id: string
  assessment_type: string | null
  title: string
  assessment_date: string
  score: number | null
  max_score: number
  assessor_id: string | null
  comments: string | null
  created_at: string
  assessor_name?: string | null
}

export interface AssessmentInput {
  assessment_type: AssessmentType
  title: string
  assessment_date: string
  score?: number | null
  max_score: number
  comments?: string | null
}

// ============================================================
// API Calls
// ============================================================

export async function listTraineeAssessments(traineeId: string): Promise<{
  assessments: Assessment[]
  error: { message: string } | null
}> {
  if (!traineeId) {
    return { assessments: [], error: { message: 'Trainee ID is required.' } }
  }

  const { data, error } = await apiFetch<{ assessments: Assessment[] } | Assessment[]>(
    `/list_assessments.php?trainee_id=${encodeURIComponent(traineeId)}`
  )

  if (error) {
    return { assessments: [], error }
  }

  const assessments = Array.isArray(data) ? data : data?.assessments ?? []
  return { assessments, error: null }
}

export async function listMyAssessments(): Promise<{
  assessments: Assessment[]
  error: { message: string } | null
}> {
  const { trainee_id, error: idErr } = await getMyTraineeId()
  if (idErr) return { assessments: [], error: idErr }
  return listTraineeAssessments(trainee_id)
}

export async function createAssessment(
  traineeId: string,
  input: AssessmentInput,
): Promise<{ assessment: Assessment | null; error: { message: string } | null }> {
  const { data, error } = await apiFetch<{ assessment: Assessment } | Assessment>(
    '/create_assessment.php',
    {
      method: 'POST',
      body: JSON.stringify({
        trainee_id: traineeId,
        assessment_type: input.assessment_type,
        title: input.title.trim(),
        assessment_date: input.assessment_date,
        score: input.score ?? null,
        max_score: input.max_score,
        comments: input.comments?.trim() || null,
      }),
    }
  )

  if (error) {
    return { assessment: null, error }
  }

  const assessment = (data && 'assessment' in data ? data.assessment : data) as Assessment
  return { assessment: assessment ?? null, error: null }
}

export async function updateAssessment(
  id: string,
  input: AssessmentInput,
): Promise<{ assessment: Assessment | null; error: { message: string } | null }> {
  const { data, error } = await apiFetch<{ assessment: Assessment } | Assessment>(
    '/update_assessment.php',
    {
      method: 'POST',
      body: JSON.stringify({
        id,
        assessment_type: input.assessment_type,
        title: input.title.trim(),
        assessment_date: input.assessment_date,
        score: input.score ?? null,
        max_score: input.max_score,
        comments: input.comments?.trim() || null,
      }),
    }
  )

  if (error) {
    return { assessment: null, error }
  }

  const assessment = (data && 'assessment' in data ? data.assessment : data) as Assessment
  return { assessment: assessment ?? null, error: null }
}

export async function deleteAssessment(
  id: string
): Promise<{ error: { message: string } | null }> {
  const { error } = await apiFetch('/delete_assessment.php', {
    method: 'POST',
    body: JSON.stringify({ id }),
  })

  return { error }
}

// ============================================================
// Summary (Dashboard)
// ============================================================

export interface AssessmentSummary {
  total: number
  scored: number
  averagePct: number | null
}

export function summarize(assessments: Assessment[]): AssessmentSummary {
  const scored = assessments.filter((a) => a.score != null && a.max_score > 0)
  const averagePct =
    scored.length === 0
      ? null
      : Math.round(
          (scored.reduce((sum, a) => sum + (Number(a.score) / Number(a.max_score)) * 100, 0) /
            scored.length) *
            10,
        ) / 10
  return { total: assessments.length, scored: scored.length, averagePct }
}

export async function getMyAssessmentSummary(): Promise<{
  summary: AssessmentSummary
  error: { message: string } | null
}> {
  const { assessments, error } = await listMyAssessments()
  return { summary: summarize(assessments), error }
}