// Shared types for the MATTA Learning Portfolio System.
// We will expand these as we add features.

export type UserRole =
  | 'mt'              // MATTA Trainee
  | 'ma_center'       // MA Center (admin / operations manager)
  | 'mentor'          // Mentor / Department Trainer
  | 'manager'         // Department Manager
  | 'ma_board'        // MA Board / Senior Management
  | 'owner'           // System Owner (highest authority, gates sensitive ops)

export interface UserProfile {
  id: string
  email: string
  full_name: string
  english_name?: string
  role: UserRole
  department?: string
  status: 'active' | 'inactive'
  created_at: string
}

export interface Trainee {
  id: string
  user_id: string
  employee_id: string
  batch_code: string         // e.g. "MATTA-2026-01"
  onboard_date: string
  education?: string
  department?: string
  mentor_id?: string
  training_status:
    | 'onboarding'
    | 'phase1_general'
    | 'phase2_department'
    | 'final_assessment'
    | 'graduated'
    | 'transferred'
    | 'withdrawn'
  profile_completeness: number  // 0-100
}
