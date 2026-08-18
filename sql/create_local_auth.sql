-- Migration: create_local_auth.sql
-- Creates a simple local_auth table to store password hashes for local auth.
CREATE TABLE IF NOT EXISTS local_auth (
  user_id uuid PRIMARY KEY REFERENCES public.users_profile(id),
  password_hash text NOT NULL
);

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
