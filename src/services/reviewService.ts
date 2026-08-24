import { apiFetch } from './apiClient'
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

// ============================================================
// API Calls
// ============================================================

export async function listTraineeReviews(traineeId: string): Promise<{
  reviews: Review[]
  error: { message: string } | null
}> {
  if (!traineeId) {
    return { reviews: [], error: { message: 'Trainee ID is required.' } }
  }

  const { data, error } = await apiFetch<{ reviews: Review[] } | Review[]>(
    `/list_reviews.php?trainee_id=${encodeURIComponent(traineeId)}`
  )

  if (error) {
    return { reviews: [], error }
  }

  const reviews = Array.isArray(data) ? data : data?.reviews ?? []
  return { reviews, error: null }
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
  const { data, error } = await apiFetch<{ review: Review } | Review>(
    '/create_review.php',
    {
      method: 'POST',
      body: JSON.stringify({
        trainee_id: traineeId,
        review_type: input.review_type,
        review_period: input.review_period?.trim() || null,
        rating: input.rating ?? null,
        strengths: input.strengths?.trim() || null,
        areas_for_improvement: input.areas_for_improvement?.trim() || null,
        recommendation: input.recommendation?.trim() || null,
      }),
    }
  )

  if (error) {
    return { review: null, error }
  }

  const review = (data && 'review' in data ? data.review : data) as Review
  return { review: review ?? null, error: null }
}

export async function updateReview(
  id: string,
  input: ReviewInput,
): Promise<{ review: Review | null; error: { message: string } | null }> {
  const { data, error } = await apiFetch<{ review: Review } | Review>(
    '/update_review.php',
    {
      method: 'POST',
      body: JSON.stringify({
        id,
        review_type: input.review_type,
        review_period: input.review_period?.trim() || null,
        rating: input.rating ?? null,
        strengths: input.strengths?.trim() || null,
        areas_for_improvement: input.areas_for_improvement?.trim() || null,
        recommendation: input.recommendation?.trim() || null,
      }),
    }
  )

  if (error) {
    return { review: null, error }
  }

  const review = (data && 'review' in data ? data.review : data) as Review
  return { review: review ?? null, error: null }
}

export async function deleteReview(
  id: string
): Promise<{ error: { message: string } | null }> {
  const { error } = await apiFetch('/delete_review.php', {
    method: 'POST',
    body: JSON.stringify({ id }),
  })

  return { error }
}

export async function replyToReview(
  reviewId: string,
  reply: string,
): Promise<{ error: { message: string } | null }> {
  const { error } = await apiFetch('/reply_review.php', {
    method: 'POST',
    body: JSON.stringify({
      review_id: reviewId,
      reply: reply.trim() || null,
    }),
  })

  return { error }
}