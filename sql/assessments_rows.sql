INSERT INTO "public"."assessments" ("id", "trainee_id", "assessment_type", "title", "assessment_date", "score", "max_score", "assessor_id", "comments", "created_at", "updated_at") VALUES ('18cdd0bd-af13-4f8d-a7ba-cce08583b710', 'aea42483-c1be-4d6e-a070-c3ac0a33df57', 'course_quiz', 'MPO Wear Parts Assembly Station Assessment and Examination', '2026-08-06', '100.00', '100.00', '43488f62-991d-455f-94ba-d758c84815fe', null, '2026-08-06 01:50:03.244578+00', '2026-08-06 01:50:03.244578+00'), ('9f5bccac-8d97-4fbe-9f35-2e665383642e', 'aea42483-c1be-4d6e-a070-c3ac0a33df57', 'course_quiz', 'MPO Front-End Station and Wire Cutting Assessment and Examination', '2026-07-30', '100.00', '100.00', '43488f62-991d-455f-94ba-d758c84815fe', null, '2026-08-04 01:15:41.740415+00', '2026-08-04 01:15:41.740415+00'), ('c2ec9e87-017a-4e10-8897-96f80fb95c1d', 'aea42483-c1be-4d6e-a070-c3ac0a33df57', 'course_quiz', 'MPO Ribbonization Station Assessment and Examination', '2026-08-06', '100.00', '100.00', '43488f62-991d-455f-94ba-d758c84815fe', 'Great job finishing your training on this station. You had a hard time with fiber ribbon overlapping at first, but you did not give up. You worked hard to fix the issue and got much better at it. Keep up the good work as you move forward.', '2026-08-06 06:31:36.301347+00', '2026-08-06 06:31:36.301347+00');
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
