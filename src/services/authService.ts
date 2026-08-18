const APP_BASE_PATH = '/matta'
const API_BASE_URL =
  import.meta.env.VITE_API_URL ??
  `${window.location.protocol}//${window.location.hostname}${APP_BASE_PATH}/api`

let accessToken: string | null = null

const AUTH_EVENT_NAME = 'matta-auth-change'

export interface AuthUser {
  id: string
  email: string
  full_name?: string
  fullName?: string
  role?: string
  status?: string
}

export interface AuthSession {
  access_token?: string
  authenticated: boolean
  user?: AuthUser | null
}

export interface NewTraineePayload {
  employee_id: string
  batch_code: string
  user_id?: string
  education?: string
}

interface ApiError {
  message: string
  code?: string
}

interface ApiResponse<T = unknown> {
  data?: T
  message?: string
  error?: string | ApiError
  token?: string
  accessToken?: string
  user?: AuthUser
  session?: AuthSession | null
  trainee?: unknown
  profile?: unknown
}

function getHeaders(): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  }

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`
  }

  return headers
}

async function readResponse<T = ApiResponse>(
  response: Response,
): Promise<T> {
  const contentType = response.headers.get('content-type') ?? ''

  if (!contentType.includes('application/json')) {
    const text = await response.text()

    return {
      message: text || `Request failed with status ${response.status}`,
    } as T
  }

  return response.json() as Promise<T>
}

function getErrorMessage(
  result: ApiResponse | null,
  fallback: string,
): string {
  if (!result) {
    return fallback
  }

  if (typeof result.message === 'string' && result.message.trim()) {
    return result.message
  }

  if (typeof result.error === 'string' && result.error.trim()) {
    return result.error
  }

  if (
    result.error &&
    typeof result.error === 'object' &&
    'message' in result.error &&
    typeof result.error.message === 'string'
  ) {
    return result.error.message
  }

  return fallback
}

function getToken(result: ApiResponse): string | null {
  return result.token ?? result.accessToken ?? null
}

function normalizeUser(user: AuthUser | undefined | null): AuthUser | null {
  if (!user) {
    return null
  }

  return {
    ...user,
    full_name: user.full_name ?? user.fullName,
  }
}

/**
 * Notify AuthContext that the authentication state changed.
 *
 * The local PHP backend uses a PHP session cookie rather than Supabase's
 * browser auth state. This event keeps the existing AuthContext listener
 * synchronized with that local session.
 */
function dispatchAuthEvent(
  event: 'SIGNED_IN' | 'SIGNED_OUT',
  session: AuthSession | null = null,
) {
  window.dispatchEvent(
    new CustomEvent(AUTH_EVENT_NAME, {
      detail: {
        event,
        session,
      },
    }),
  )
}

// ---------- Sign up ----------

export async function signUpWithEmail(
  email: string,
  password: string,
  fullName: string,
) {
  try {
    const response = await fetch(`${API_BASE_URL}/auth.php?action=signup`, {
      method: 'POST',
      headers: getHeaders(),
      credentials: 'include',
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        password,
        full_name: fullName.trim(),
        role: 'mt',
      }),
    })

    const result = await readResponse<ApiResponse>(response)
    const payload: any = result.data ?? result

    if (!response.ok) {
      return {
        data: {
          user: null,
          session: null,
        },
        error: {
          message: getErrorMessage(
            result,
            'Failed to create account.',
          ),
        },
      }
    }

    const token = getToken(payload)

    if (token && token !== 'local') {
      accessToken = token
    }

    const user = normalizeUser(
      payload.user ?? payload.session?.user,
    )

    const session: AuthSession = payload.session ?? {
      authenticated: true,
      user,
    }

    const normalizedSession: AuthSession = {
      ...session,
      authenticated: true,
      user: user ?? session.user ?? null,
    }

    dispatchAuthEvent('SIGNED_IN', normalizedSession)

    return {
      data: {
        user,
        session: normalizedSession,
      },
      error: null,
    }
  } catch (error) {
    console.error('Signup request failed:', error)

    return {
      data: {
        user: null,
        session: null,
      },
      error: {
        message:
          error instanceof Error
            ? error.message
            : 'Unable to connect to the server.',
      },
    }
  }
}

// ---------- Sign in / out ----------

export async function signInWithEmail(
  email: string,
  password: string,
) {
  try {
    const response = await fetch(
      `${API_BASE_URL}/auth.php?action=signin`,
      {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include',
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
        }),
      },
    )

    const result = await readResponse<ApiResponse>(response)
    const payload: any = result.data ?? result

    console.log('[authService] signin response:', payload)

    if (!response.ok) {
      return {
        data: null,
        error: {
          message: getErrorMessage(
            result,
            'Invalid email or password.',
          ),
        },
      }
    }

    const user = normalizeUser(
      payload.user ?? payload.session?.user,
    )

    const token = getToken(payload)

    if (token && token !== 'local') {
      accessToken = token
    }

    const session: AuthSession = payload.session ?? {
      authenticated: true,
      user,
    }

    const normalizedSession: AuthSession = {
      ...session,
      authenticated: true,
      user: user ?? session.user ?? null,
    }

    /*
     * IMPORTANT:
     * AuthContext listens for this event. Without this event, login can
     * succeed in PHP while AuthContext.user remains null.
     */
    dispatchAuthEvent('SIGNED_IN', normalizedSession)

    return {
      data: {
        user,
        session: normalizedSession,
      },
      error: null,
    }
  } catch (error) {
    console.error('Login request failed:', error)

    return {
      data: null,
      error: {
        message:
          error instanceof Error
            ? error.message
            : 'Unable to connect to the server.',
      },
    }
  }
}

export async function signOut() {
  try {
    const response = await fetch(
      `${API_BASE_URL}/auth.php?action=signout`,
      {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include',
      },
    )

    accessToken = null

    if (!response.ok) {
      const result = await readResponse<ApiResponse>(response)

      return {
        error: {
          message: getErrorMessage(result, 'Failed to sign out.'),
        },
      }
    }

    dispatchAuthEvent('SIGNED_OUT', null)

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
    const response = await fetch(
      `${API_BASE_URL}/auth.php?action=getSession`,
      {
        method: 'GET',
        headers: getHeaders(),
        credentials: 'include',
      },
    )

    const result = await readResponse<ApiResponse>(response)
    const payload: any = result.data ?? result

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

    const user = normalizeUser(
      payload.user ?? payload.session?.user,
    )

    return {
      user,
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
    const bodyPayload: any = {
      employee_id: payload.employee_id.trim(),
      batch_code: payload.batch_code.trim(),
      education: payload.education?.trim() || null,
    }

    if (payload.user_id) {
      bodyPayload.user_id = payload.user_id
    }

    const response = await fetch(
      `${API_BASE_URL}/rest.php?table=trainees`,
      {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include',
        body: JSON.stringify(bodyPayload),
      },
    )

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
    const response = await fetch(
      `${API_BASE_URL}/rest.php?table=users_profile&eq_id=${encodeURIComponent(userId)}`,
      {
        method: 'GET',
        headers: getHeaders(),
        credentials: 'include',
      },
    )

    const result = await readResponse<ApiResponse>(response)

    if (!response.ok) {
      return {
        profile: null,
        error: {
          message: getErrorMessage(
            result,
            'Unable to load profile.',
          ),
        },
      }
    }

    const rows = Array.isArray(result.data) ? result.data : []

    return {
      profile: rows[0] ?? null,
      error: null,
    }
  } catch (error) {
    return {
      profile: null,
      error: {
        message:
          error instanceof Error
            ? error.message
            : 'Network error',
      },
    }
  }
}

export async function sendPasswordResetEmail(email: string) {
  try {
    const response = await fetch(
      `${API_BASE_URL}/auth.php?action=forgot-password`,
      {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include',
        body: JSON.stringify({ email }),
      },
    )

    const result = await readResponse<ApiResponse>(response)

    if (!response.ok) {
      return {
        error: {
          message: getErrorMessage(
            result,
            'Unable to send password reset email.',
          ),
        },
      }
    }

    return { error: null }
  } catch (error) {
    return {
      error: {
        message:
          error instanceof Error
            ? error.message
            : 'Network error',
      },
    }
  }
}

export async function updateOwnPassword(password: string) {
  try {
    const response = await fetch(
      `${API_BASE_URL}/auth.php?action=update-password`,
      {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include',
        body: JSON.stringify({ password }),
      },
    )

    const result = await readResponse<ApiResponse>(response)

    if (!response.ok) {
      return {
        error: {
          message: getErrorMessage(
            result,
            'Unable to update password.',
          ),
        },
      }
    }

    return { error: null }
  } catch (error) {
    return {
      error: {
        message:
          error instanceof Error
            ? error.message
            : 'Network error',
      },
    }
  }
}