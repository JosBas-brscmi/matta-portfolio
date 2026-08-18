INSERT INTO "public"."trainee_resources" ("id", "trainee_id", "uploaded_by", "title", "category", "file_name", "file_type", "file_size_bytes", "storage_path", "created_at") VALUES ('c5dfed57-668c-46d4-bc4c-afc9b56ceaf5', 'aea42483-c1be-4d6e-a070-c3ac0a33df57', '43488f62-991d-455f-94ba-d758c84815fe', 'PT-MPL MPO Training Plan for Ishi Jemila Jimenez', 'training_plan', 'PT-MPL Training Plan - Ishi Jemila Jimenez.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 50297, 'aea42483-c1be-4d6e-a070-c3ac0a33df57/1785998313214_PT-MPL_Training_Plan_-_Ishi_Jemila_Jimenez.xlsx', '2026-08-06 06:36:47.055747+00');
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
