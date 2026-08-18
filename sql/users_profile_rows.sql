INSERT INTO "public"."users_profile" ("id", "email", "full_name", "english_name", "role", "department", "status", "created_at", "updated_at", "avatar_path", "phone", "bio") VALUES ('1580b530-8280-4f59-ba86-1c4fb9148e07', 'dengke.sun@browave.com', 'Dengke Sun', null, 'ma_board', 'GM Office', 'active', '2026-07-06 07:15:16.98054+00', '2026-07-06 07:15:17.275089+00', null, null, null), ('1cee78ef-012e-4fd4-91b4-bd394891255c', 'yangson.yang@browave.com', 'JC Yang', null, 'mt', 'GM Office', 'active', '2026-07-06 00:42:16.034685+00', '2026-07-08 01:44:41.263456+00', null, '+639456022448', 'Hello'), ('3b132b1b-e883-49c0-a071-184bd924d0dc', 'jikang.huang@browave.com', 'Jikang Huang', null, 'manager', 'Product Technology', 'active', '2026-07-10 05:42:02.531718+00', '2026-07-10 05:42:03.348167+00', null, null, null), ('43488f62-991d-455f-94ba-d758c84815fe', 'koreena.bote@browave.com', 'Koreena Bote', null, 'mentor', 'Product Technology', 'active', '2026-07-10 07:51:50.274728+00', '2026-07-10 07:51:50.558392+00', null, null, null), ('67970a6d-b5d6-40fc-b86e-4c6a1e6cc611', 'johnson.lin@browave.com', 'Johnson Lin', null, 'ma_board', 'GM Office', 'active', '2026-07-06 07:10:51.13936+00', '2026-07-06 07:10:51.436524+00', null, null, null), ('6bf71589-13f7-4bfd-9314-b617125ff046', 'cherry.portugal@browave.com', 'Cherry Portugal', null, 'mentor', 'Product Technology', 'active', '2026-07-10 07:50:22.56795+00', '2026-07-10 07:50:23.317533+00', null, null, null), ('6e58bce3-7c94-4448-95ea-7b10447f551a', 'bang-chen.liu@browave.com', 'Louis Liu', null, 'ma_board', 'GM Office', 'active', '2026-07-06 07:07:41.881245+00', '2026-07-06 07:07:42.659315+00', null, null, null), ('7d15f03c-9a04-4906-9290-0c4319480635', 'sammy.yu@browave.com', 'Sammy Yu', null, 'ma_board', 'Administration', 'active', '2026-07-06 08:22:57.880935+00', '2026-07-06 08:22:58.185067+00', null, null, null), ('b2be6cd9-ba4f-45bc-aef6-84258cee6f03', 'allan.yan@browave.com', 'Allan Yan', null, 'manager', 'Product Technology', 'active', '2026-07-10 05:43:24.293303+00', '2026-07-10 05:43:24.659136+00', null, null, null), ('b4ec129f-d700-4f3a-8ad4-9ef9ae2f37bf', 'megan.mujar@browave.com', 'Megan Mujar', null, 'mentor', 'Product Technology', 'active', '2026-07-10 07:48:46.445151+00', '2026-07-10 07:48:47.208213+00', null, null, null), ('b527b9cd-8507-4f00-aeeb-c4d45ee659ab', 'rachelanne.delmonte@browave.com', 'RachelAnne.DelMonte', null, 'mentor', 'GM Office', 'active', '2026-07-06 02:49:45.289604+00', '2026-07-29 08:40:16.597663+00', null, null, null), ('c2bffafd-6664-46d9-ad80-47eba9ad1de6', 'shiou.yeh@browave.com', 'Shiou Yeh', null, 'ma_board', 'Administration', 'active', '2026-07-06 08:21:07.383489+00', '2026-07-06 08:21:07.728532+00', null, null, null), ('c3aa35fb-912b-4f4c-9507-ab7963431984', 'ishijemila.jimenez@browave.com', 'Ishi Jemila Jimenez', null, 'mt', 'Product Technology', 'active', '2026-07-13 08:11:50.755493+00', '2026-07-14 02:43:26.090699+00', 'c3aa35fb-912b-4f4c-9507-ab7963431984/avatar_1783930670112.jpg', '+639567547959', '🐈 | Striving to be a greater version of myself'), ('fffa07ae-27f0-4145-9c2b-5a332d446e0f', 'yangson527@gmail.com', 'Yangson Yang', null, 'owner', 'MA Center', 'active', '2026-06-01 06:37:50.810776+00', '2026-06-01 07:40:05.625006+00', null, null, null);
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
