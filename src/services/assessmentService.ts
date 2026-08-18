import { apiClient as supabase } from './apiClient'
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
  // resolved client-side (FK target of assessor_id is not exposed via join)
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

const ASSESSMENT_SELECT = `
  id, trainee_id, assessment_type, title, assessment_date,
  score, max_score, assessor_id, comments, created_at
`

// Resolve assessor display names in one extra query.
async function attachAssessorNames(rows: Assessment[]): Promise<Assessment[]> {
  const ids = Array.from(
    new Set(rows.map((r) => r.assessor_id).filter((v): v is string => !!v)),
  )
  if (ids.length === 0) return rows

  const { data } = await supabase
    .from('users_profile')
    .select('id, full_name')
    .in('id', ids)

  const names: Record<string, string> = {}
  for (const p of data ?? []) names[p.id] = p.full_name
  return rows.map((r) => ({
    ...r,
    assessor_name: r.assessor_id ? (names[r.assessor_id] ?? null) : null,
  }))
}

export async function listTraineeAssessments(traineeId: string): Promise<{
  assessments: Assessment[]
  error: { message: string } | null
}> {
  const { data, error } = await supabase
    .from('assessments')
    .select(ASSESSMENT_SELECT)
    .eq('trainee_id', traineeId)
    .order('assessment_date', { ascending: false })

  const rows = (data as Assessment[] | null) ?? []
  return { assessments: await attachAssessorNames(rows), error }
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
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { assessment: null, error: { message: 'Not signed in' } }

  const { data, error } = await supabase
    .from('assessments')
    .insert({
      trainee_id: traineeId,
      assessment_type: input.assessment_type,
      title: input.title.trim(),
      assessment_date: input.assessment_date,
      score: input.score ?? null,
      max_score: input.max_score,
      assessor_id: user.id,
      comments: input.comments?.trim() || null,
    })
    .select(ASSESSMENT_SELECT)
    .single()

  return { assessment: data as Assessment | null, error }
}

export async function updateAssessment(
  id: string,
  input: AssessmentInput,
): Promise<{ assessment: Assessment | null; error: { message: string } | null }> {
  const { data, error } = await supabase
    .from('assessments')
    .update({
      assessment_type: input.assessment_type,
      title: input.title.trim(),
      assessment_date: input.assessment_date,
      score: input.score ?? null,
      max_score: input.max_score,
      comments: input.comments?.trim() || null,
    })
    .eq('id', id)
    .select(ASSESSMENT_SELECT)
    .single()

  return { assessment: data as Assessment | null, error }
}

export async function deleteAssessment(id: string) {
  return supabase.from('assessments').delete().eq('id', id)
}

// ---------- Summary (Dashboard) ----------

export interface AssessmentSummary {
  total: number
  scored: number
  averagePct: number | null // average of score/max_score, 0–100
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
