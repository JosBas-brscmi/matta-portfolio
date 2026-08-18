import { apiClient as supabase } from './apiClient'
import type { UserRole } from '../types'

// ============================================================
// Step 11 · User management (Owner / MA Center)
// RLS already allows is_admin() to update users_profile & trainees.
// ============================================================

export const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'mt', label: 'MT · Trainee' },
  { value: 'mentor', label: 'Mentor · Trainer' },
  { value: 'manager', label: 'Department Manager' },
  { value: 'ma_center', label: 'MA Center' },
  { value: 'ma_board', label: 'MA Board · Senior Mgmt' },
  { value: 'owner', label: 'Owner' },
]

export interface ManagedUser {
  id: string
  email: string
  full_name: string
  english_name: string | null
  role: string
  department: string | null
  status: string
  created_at: string
  // present when the user has a trainee record
  trainee?: {
    id: string
    employee_id: string
    batch_code: string
    mentor_id: string | null
  } | null
}

export async function listAllUsers(): Promise<{
  users: ManagedUser[]
  error: { message: string } | null
}> {
  const [profileRes, traineeRes] = await Promise.all([
    supabase
      .from('users_profile')
      .select('id, email, full_name, english_name, role, department, status, created_at')
      .order('created_at', { ascending: true }),
    supabase.from('trainees').select('id, user_id, employee_id, batch_code, mentor_id'),
  ])

  if (profileRes.error) return { users: [], error: profileRes.error }

  const traineeByUser: Record<string, ManagedUser['trainee']> = {}
  for (const t of traineeRes.data ?? []) {
    traineeByUser[t.user_id] = {
      id: t.id,
      employee_id: t.employee_id,
      batch_code: t.batch_code,
      mentor_id: t.mentor_id,
    }
  }

  const users: ManagedUser[] = (profileRes.data ?? []).map((p: any) => ({
    ...p,
    trainee: traineeByUser[p.id] ?? null,
  }))

  return { users, error: null }
}

export async function updateUserRole(userId: string, role: UserRole) {
  const { error } = await supabase
    .from('users_profile')
    .update({ role })
    .eq('id', userId)
  return { error }
}

export async function updateUserDepartment(userId: string, department: string | null) {
  const { error } = await supabase
    .from('users_profile')
    .update({ department: department?.trim() || null })
    .eq('id', userId)
  return { error }
}

export async function updateUserStatus(userId: string, status: 'active' | 'inactive') {
  const { error } = await supabase
    .from('users_profile')
    .update({ status })
    .eq('id', userId)
  return { error }
}

// Assign (or clear) a mentor for a trainee. Also mirrors the
// trainee's department when the mentor has one and the trainee doesn't.
export async function assignMentor(traineeId: string, mentorUserId: string | null) {
  const { error } = await supabase
    .from('trainees')
    .update({ mentor_id: mentorUserId })
    .eq('id', traineeId)
  return { error }
}

export async function updateTraineeDepartment(traineeId: string, department: string | null) {
  const { error } = await supabase
    .from('trainees')
    .update({ department: department?.trim() || null })
    .eq('id', traineeId)
  return { error }
}

// ---------- Step 15 · Create staff accounts (via Netlify Function) ----------

export type StaffRole = 'mentor' | 'manager' | 'ma_board' | 'ma_center'

export interface InviteStaffPayload {
  email: string
  full_name: string
  role: StaffRole
  department?: string
}

export interface InviteStaffResult {
  ok: true
  email: string
  temp_password: string
  user_id: string
  message: string
}

export async function inviteStaff(payload: InviteStaffPayload): Promise<
  { ok: true; result: InviteStaffResult } | { ok: false; error: string }
> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) return { ok: false, error: 'You must be signed in.' }

    try {
    const response = await fetch('/api/invite_staff.php', {
      credentials: 'include',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const body = await response.json().catch(() => null)
    if (!response.ok || !body?.ok) {
      return { ok: false, error: body?.error ?? `Server returned ${response.status}` }
    }
    return { ok: true, result: body as InviteStaffResult }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Network error' }
  }
}
