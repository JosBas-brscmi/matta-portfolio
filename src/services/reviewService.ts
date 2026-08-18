import { apiClient as supabase } from './apiClient'
import { getMyTraineeId } from './traineeService'

// ============================================================
// Step 13 · Mentor–MT feedback (reviews table)
// ============================================================

export type ReviewType =
  | 'weekly_note'
  | 'monthly_review'
  | 'encouragement'
  | 'manager_observation'
  | 'other'

export const REVIEW_TYPE_OPTIONS: { value: ReviewType; label: string }[] = [
  { value: 'weekly_note', label: 'Weekly Note 週記回饋' },
  { value: 'monthly_review', label: 'Monthly Review 月度回顧' },
  { value: 'encouragement', label: 'Encouragement 鼓勵留言' },
  { value: 'manager_observation', label: 'Manager Observation 主管觀察' },
  { value: 'other', label: 'Other 其他' },
]

export const REVIEW_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  REVIEW_TYPE_OPTIONS.map((t) => [t.value, t.label]),
)

export interface Review {
  id: string
  trainee_id: string
  reviewer_id: string
  review_type: string | null
  review_period: string | null
  rating: number | null
  strengths: string | null
  areas_for_improvement: string | null
  recommendation: string | null
  reviewed_at: string
  created_at: string
  mt_reply: string | null
  mt_reply_at: string | null
  // resolved client-side
  reviewer_name?: string | null
  reviewer_role?: string | null
}

export interface ReviewInput {
  review_type: ReviewType
  review_period?: string | null
  rating?: number | null
  strengths?: string | null
  areas_for_improvement?: string | null
  recommendation?: string | null
}

const REVIEW_SELECT = `
  id, trainee_id, reviewer_id, review_type, review_period, rating,
  strengths, areas_for_improvement, recommendation, reviewed_at, created_at,
  mt_reply, mt_reply_at
`

async function attachReviewerNames(rows: Review[]): Promise<Review[]> {
  const ids = Array.from(new Set(rows.map((r) => r.reviewer_id).filter(Boolean)))
  if (ids.length === 0) return rows

  const { data } = await supabase
    .from('users_profile')
    .select('id, full_name, role')
    .in('id', ids)

  const byId: Record<string, { full_name: string; role: string }> = {}
  for (const p of data ?? []) byId[p.id] = { full_name: p.full_name, role: p.role }

  return rows.map((r) => ({
    ...r,
    reviewer_name: byId[r.reviewer_id]?.full_name ?? null,
    reviewer_role: byId[r.reviewer_id]?.role ?? null,
  }))
}

export async function listTraineeReviews(traineeId: string): Promise<{
  reviews: Review[]
  error: { message: string } | null
}> {
  const { data, error } = await supabase
    .from('reviews')
    .select(REVIEW_SELECT)
    .eq('trainee_id', traineeId)
    .order('reviewed_at', { ascending: false })

  const rows = (data as Review[] | null) ?? []
  return { reviews: await attachReviewerNames(rows), error }
}

export async function listMyReviews(): Promise<{
  reviews: Review[]
  error: { message: string } | null
}> {
  const { trainee_id, error: idErr } = await getMyTraineeId()
  if (idErr) return { reviews: [], error: idErr }
  return listTraineeReviews(trainee_id)
}

export async function createReview(
  traineeId: string,
  input: ReviewInput,
): Promise<{ review: Review | null; error: { message: string } | null }> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { review: null, error: { message: 'Not signed in' } }

  const { data, error } = await supabase
    .from('reviews')
    .insert({
      trainee_id: traineeId,
      reviewer_id: user.id,
      review_type: input.review_type,
      review_period: input.review_period?.trim() || null,
      rating: input.rating ?? null,
      strengths: input.strengths?.trim() || null,
      areas_for_improvement: input.areas_for_improvement?.trim() || null,
      recommendation: input.recommendation?.trim() || null,
    })
    .select(REVIEW_SELECT)
    .single()

  return { review: data as Review | null, error }
}

export async function updateReview(
  id: string,
  input: ReviewInput,
): Promise<{ review: Review | null; error: { message: string } | null }> {
  const { data, error } = await supabase
    .from('reviews')
    .update({
      review_type: input.review_type,
      review_period: input.review_period?.trim() || null,
      rating: input.rating ?? null,
      strengths: input.strengths?.trim() || null,
      areas_for_improvement: input.areas_for_improvement?.trim() || null,
      recommendation: input.recommendation?.trim() || null,
    })
    .eq('id', id)
    .select(REVIEW_SELECT)
    .single()

  return { review: data as Review | null, error }
}

export async function deleteReview(id: string) {
  return supabase.from('reviews').delete().eq('id', id)
}

// -- MT replies to a feedback entry (once). Empty string clears it. --
export async function replyToReview(
  reviewId: string,
  reply: string,
): Promise<{ error: { message: string } | null }> {
  // rpc is not implemented in the local wrapper; call server endpoint instead
  const res = await fetch(window.location.origin + '/matta/api/reply-review.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ review_id: reviewId, reply }),
  })
  const json = await res.json()
  const error = json?.error ?? null
  return { error }
}
