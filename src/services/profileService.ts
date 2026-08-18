import { apiClient as supabase } from './apiClient'

// ============================================================
// Step 12 · MT profile (photo + basic info)
// ============================================================

export const AVATAR_BUCKET = 'avatars'

export const MAX_AVATAR_BYTES = 5 * 1024 * 1024

const AVATAR_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
}

export interface MyProfile {
  id: string
  email: string
  full_name: string
  english_name: string | null
  role: string
  department: string | null
  status: string
  avatar_path: string | null
  phone: string | null
  bio: string | null

  trainee: {
    id: string
    employee_id: string
    batch_code: string
    onboard_date: string
    education: string | null
    training_status: string
    profile_completeness: number
  } | null
}

export interface ProfileInput {
  full_name: string
  phone?: string | null
  bio?: string | null
  education?: string | null
}

/*
 * Convert the stored avatar path into a browser-accessible URL.
 *
 * Stored database value:
 *
 *   storage/uploads/<user-id>/avatar_123.jpg
 *
 * Browser URL:
 *
 *   http://localhost/matta/storage/uploads/<user-id>/avatar_123.jpg
 */
export function avatarPublicUrl(
  avatarPath: string | null | undefined,
): string | null {
  if (!avatarPath) {
    return null
  }

  /*
   * Already an absolute URL.
   */
  if (
    avatarPath.startsWith('http://') ||
    avatarPath.startsWith('https://')
  ) {
    return avatarPath
  }

  /*
   * Clean leading slash.
   */
  const cleanPath = avatarPath.replace(/^\/+/, '')

  return `${window.location.origin}/matta/${cleanPath}`
}

// ============================================================
// Load profile
// ============================================================

export async function getMyProfile(): Promise<{
  profile: MyProfile | null
  error: { message: string } | null
}> {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      profile: null,
      error: {
        message: 'Not signed in',
      },
    }
  }

  const [profileRes, traineeRes] = await Promise.all([
    supabase
      .from('users_profile')
      .select(
        'id, email, full_name, english_name, role, department, status, avatar_path, phone, bio',
      )
      .eq('id', user.id)
      .single(),

    supabase
      .from('trainees')
      .select(
        'id, employee_id, batch_code, onboard_date, education, training_status, profile_completeness',
      )
      .eq('user_id', user.id)
      .maybeSingle(),
  ])

  if (profileRes.error || !profileRes.data) {
    return {
      profile: null,
      error:
        profileRes.error ?? {
          message: 'Profile not found',
        },
    }
  }

  return {
    profile: {
      ...profileRes.data,
      trainee: traineeRes.data ?? null,
    } as MyProfile,

    error: null,
  }
}

// ============================================================
// Completeness
// ============================================================

function computeCompleteness(p: {
  full_name?: string | null
  phone?: string | null
  bio?: string | null
  avatar_path?: string | null
  education?: string | null
  department?: string | null
}): number {
  const checks = [
    !!p.full_name?.trim(),
    !!p.phone?.trim(),
    !!p.bio?.trim(),
    !!p.avatar_path,
    !!p.education?.trim(),
    !!p.department?.trim(),
  ]

  return Math.round(
    (checks.filter(Boolean).length / checks.length) * 100,
  )
}

// ============================================================
// Update profile
// ============================================================

export async function updateMyProfile(
  current: MyProfile,
  input: ProfileInput,
): Promise<{
  error: { message: string } | null
}> {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      error: {
        message: 'Not signed in',
      },
    }
  }

  const { error: profileErr } = await supabase
    .from('users_profile')
    .update({
      full_name: input.full_name.trim(),
      phone: input.phone?.trim() || null,
      bio: input.bio?.trim() || null,
    })
    .eq('id', user.id)

  if (profileErr) {
    return {
      error: profileErr,
    }
  }

  if (current.trainee) {
    const completeness = computeCompleteness({
      full_name: input.full_name,
      phone: input.phone,
      bio: input.bio,
      avatar_path: current.avatar_path,
      education: input.education,
      department: current.department,
    })

    const { error: traineeErr } = await supabase
      .from('trainees')
      .update({
        education: input.education?.trim() || null,
        profile_completeness: completeness,
      })
      .eq('id', current.trainee.id)

    if (traineeErr) {
      return {
        error: traineeErr,
      }
    }
  }

  return {
    error: null,
  }
}

// ============================================================
// Upload avatar
// ============================================================

export async function uploadAvatar(
  file: File,
  current: MyProfile,
): Promise<{
  avatar_path: string | null
  error: { message: string } | null
}> {
  const ext =
    file.name
      .split('.')
      .pop()
      ?.toLowerCase() ?? ''

  /*
   * Validate extension.
   */
  if (!AVATAR_TYPES[ext]) {
    return {
      avatar_path: null,
      error: {
        message:
          'Photo must be a JPG, PNG, or WebP image. 照片格式須為 JPG / PNG / WebP。',
      },
    }
  }

  /*
   * Validate size.
   */
  if (file.size > MAX_AVATAR_BYTES) {
    return {
      avatar_path: null,
      error: {
        message:
          'Photo must be under 5 MB. 照片大小須小於 5 MB。',
      },
    }
  }

  if (file.size === 0) {
    return {
      avatar_path: null,
      error: {
        message: 'The selected photo is empty.',
      },
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      avatar_path: null,
      error: {
        message: 'Not signed in',
      },
    }
  }

  /*
   * Generate a unique storage path.
   */
  const path =
    `${user.id}/avatar_${Date.now()}.${ext}`

  try {
    /*
     * Upload physical file.
     */
    const { data: uploadData, error: uploadError } =
      await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(
          path,
          file,
          {
            contentType: AVATAR_TYPES[ext],
            upsert: false,
          },
        )

    if (uploadError) {
      return {
        avatar_path: null,
        error: uploadError,
      }
    }

    /*
     * Make sure PHP actually returned upload information.
     */
    const returnedPath =
      uploadData?.storage_path ?? path

    if (!returnedPath) {
      return {
        avatar_path: null,
        error: {
          message:
            'The server did not return a storage path.',
        },
      }
    }

    /*
     * Point users_profile at the newly uploaded file.
     */
    const { error: dbErr } = await supabase
      .from('users_profile')
      .update({
        avatar_path: returnedPath,
      })
      .eq('id', user.id)

    if (dbErr) {
      /*
       * The current local storage wrapper does not yet implement
       * physical file deletion, so simply report the database error.
       */
      return {
        avatar_path: null,
        error: dbErr,
      }
    }

    /*
     * The new path is now the active avatar.
     *
     * We intentionally don't delete current.avatar_path here because
     * your current local storage.remove() is only a compatibility
     * stub and doesn't physically remove files.
     */
    return {
      avatar_path: returnedPath,
      error: null,
    }
  } catch (error) {
    return {
      avatar_path: null,
      error: {
        message:
          error instanceof Error
            ? error.message
            : 'Unable to upload photo.',
      },
    }
  }
}