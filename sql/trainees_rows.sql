INSERT INTO "public"."trainees" ("id", "user_id", "employee_id", "batch_code", "onboard_date", "education", "department", "mentor_id", "training_status", "profile_completeness", "created_at", "updated_at") VALUES ('328b3986-dbff-442e-9818-b13683cbbb1e', '1cee78ef-012e-4fd4-91b4-bd394891255c', 'FSHC0015', 'MATTA-2026-07', '2026-07-06', 'M.A. in Political Science, NYSYU', 'GM Office', 'b527b9cd-8507-4f00-aeeb-c4d45ee659ab', 'phase2_department', 83, '2026-07-06 00:42:16.795223+00', '2026-07-29 08:42:45.164391+00'), ('aea42483-c1be-4d6e-a070-c3ac0a33df57', 'c3aa35fb-912b-4f4c-9507-ab7963431984', 'PS26Y413', 'MATTA-2026-001', '2026-07-13', 'BS Electronics Engineering, Pampanga State University', 'Product Technology', '43488f62-991d-455f-94ba-d758c84815fe', 'phase1_general', 100, '2026-07-13 08:11:51.528504+00', '2026-07-15 03:20:33.266229+00');
export async function signOut() {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/logout`, {
      method: 'POST',
      headers: getHeaders(),
      credentials: 'include',
    })

    accessToken = null

    if (!response.ok) {
      const result = await readResponse<ApiResponse>(response)

      return {
        error: {
          message: getErrorMessage(result, 'Failed to sign out.'),
        },
      }
    }

    return {
      error: null,
    }
  } catch (error) {
    accessToken = null

    return {
      error: {
        message:
          error instanceof Error
            ? error.message
            : 'Unable to connect to the server.',
      },
    }
  }
}

// ---------- Current user ----------

export async function getCurrentUser() {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      method: 'GET',
      headers: getHeaders(),
      credentials: 'include',
    })

    const result = await readResponse<ApiResponse>(response)

    if (!response.ok) {
      return {
        user: null,
        error: {
          message: getErrorMessage(
            result,
            'Unable to load the current user.',
          ),
        },
      }
    }

    return {
      user: normalizeUser(result.user),
      error: null,
    }
  } catch (error) {
    return {
      user: null,
      error: {
        message:
          error instanceof Error
            ? error.message
            : 'Unable to connect to the server.',
      },
    }
  }
}

// ---------- Create own trainee row ----------

export async function createOwnTraineeRow(
  payload: NewTraineePayload,
) {
  try {
    const response = await fetch(`${API_BASE_URL}/trainees`, {
      method: 'POST',
      headers: getHeaders(),
      credentials: 'include',
      body: JSON.stringify({
        employee_id: payload.employee_id.trim(),
        batch_code: payload.batch_code.trim(),
        education: payload.education?.trim() || null,
      }),
    })

    const result = await readResponse<ApiResponse>(response)

    if (!response.ok) {
      return {
        trainee: null,
        error: {
          message: getErrorMessage(
            result,
            'Could not save trainee details.',
          ),
        },
      }
    }

    return {
      trainee: result.trainee ?? result.data ?? result,
      error: null,
    }
  } catch (error) {
    console.error('Create trainee request failed:', error)

    return {
      trainee: null,
      error: {
        message:
          error instanceof Error
            ? error.message
            : 'Unable to connect to the server.',
      },
    }
  }
}

// ---------- Profile loader ----------

export async function loadUserProfile(userId: string) {
  try {
    const response = await fetch(`${API_BASE_URL}/users_profile?id=${encodeURIComponent(userId)}`, {
      method: 'GET',
      headers: getHeaders(),
      credentials: 'include',
    })
    const result = await readResponse<ApiResponse>(response)
    if (!response.ok) {
      return { profile: null, error: { message: getErrorMessage(result, 'Unable to load profile.') } }
    }
    return { profile: result.data ?? null, error: null }
  } catch (error) {
    return { profile: null, error: { message: error instanceof Error ? error.message : 'Network error' } }
  }
}

export async function sendPasswordResetEmail(email: string) {
  try {
    const response = await fetch(`${API_BASE_URL}/auth.php?action=forgot-password`, {
      method: 'POST',
      headers: getHeaders(),
      credentials: 'include',
      body: JSON.stringify({ email }),
    })
    const result = await readResponse<ApiResponse>(response)
    if (!response.ok) {
      return { error: { message: getErrorMessage(result, 'Unable to send password reset email.') } }
    }
    return { error: null }
  } catch (error) {
    return { error: { message: error instanceof Error ? error.message : 'Network error' } }
  }
}

export async function updateOwnPassword(password: string) {
  try {
    const response = await fetch(`${API_BASE_URL}/auth.php?action=update-password`, {
      method: 'POST',
      headers: getHeaders(),
      credentials: 'include',
      body: JSON.stringify({ password }),
    })
    const result = await readResponse<ApiResponse>(response)
    if (!response.ok) {
      return { error: { message: getErrorMessage(result, 'Unable to update password.') } }
    }
    return { error: null }
  } catch (error) {
    return { error: { message: error instanceof Error ? error.message : 'Network error' } }
  }
}
