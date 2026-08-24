// Lightweight local API client for the MATTA portfolio app.
//
// This client talks to the local PHP API and PostgreSQL.
// It does NOT use Supabase.

export interface ApiError {
  message: string
}

export interface ApiResult<T = any> {
  data: T | null
  error: ApiError | null
}

function getDefaultApiBaseUrl(): string {
  if (typeof window === 'undefined') {
    return '/api'
  }

  const pathname = window.location.pathname

  if (
    pathname === '/matta' ||
    pathname.startsWith('/matta/')
  ) {
    return '/matta/api'
  }

  return '/api'
}

export const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  getDefaultApiBaseUrl()

const NORMALIZED_API_BASE_URL =
  String(API_BASE_URL).replace(/\/+$/, '')

function resolveApiUrl(path: string): string {
  const cleanPath = String(path).replace(/^\/+/, '')

  return `${NORMALIZED_API_BASE_URL}/${cleanPath}`
}

export function getApiUrl(path: string): string {
  return resolveApiUrl(path)
}

// -----------------------------------------------------------------------------
// Generic API request
// -----------------------------------------------------------------------------

export async function apiFetch<T = any>(
  path: string,
  options: RequestInit = {},
): Promise<ApiResult<T>> {
  const headers = new Headers(options.headers)

  if (options.body instanceof FormData) {
    // Force header removal so the browser auto-generates the multipart boundary
    headers.delete('Content-Type')
  } else if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json')
  }

  const requestOptions: RequestInit = {
    credentials: 'include',
    ...options,
    headers,
  }

  const url = resolveApiUrl(path)

  let response: Response

  try {
    response = await fetch(url, requestOptions)
  } catch (error) {
    return {
      data: null,
      error: {
        message:
          error instanceof Error
            ? error.message
            : 'Unable to connect to the PHP server.',
      },
    }
  }

  const text = await response.text()

  let json: any = null

  if (text.trim()) {
    try {
      json = JSON.parse(text)
    } catch {
      json = null
    }
  }

  if (!response.ok) {
    return {
      data: null,
      error: {
        message:
          json?.error ??
          json?.message ??
          `Server returned ${response.status}`,
      },
    }
  }

  if (json?.ok === false || json?.error) {
    return {
      data: null,
      error: {
        message:
          typeof json.error === 'string'
            ? json.error
            : json.error?.message ??
              json.message ??
              'API request failed.',
      },
    }
  }

  return {
    data: (json?.data ?? json) as T,
    error: null,
  }
}

// -----------------------------------------------------------------------------
// Authentication
// -----------------------------------------------------------------------------

const authEventName = 'matta-auth-change'

function dispatchAuthEvent(
  event: string,
  session: any = null,
): void {
  if (typeof window === 'undefined') return

  window.dispatchEvent(
    new CustomEvent(authEventName, {
      detail: {
        event,
        session,
      },
    }),
  )
}

// -----------------------------------------------------------------------------
// Supabase-style table client
// -----------------------------------------------------------------------------

type Operation =
  | { type: 'select' }
  | { type: 'insert'; payload: any }
  | { type: 'update'; payload: any }
  | { type: 'delete' }

function createTableClient(table: string): any {
  const filters: Record<string, any> = {}
  const inFilters: Record<string, any[]> = {}

  let orderValue: string | undefined
  let selectStr = '*'

  let operation: Operation = { type: 'select' }
  let returning = false

  const executeSelect = async (): Promise<ApiResult<any>> => {
    const params = new URLSearchParams()

    params.set('table', table)
    params.set('select', selectStr)

    Object.entries(filters).forEach(([key, value]) => {
      params.set(key, String(value))
    })

    Object.entries(inFilters).forEach(([column, values]) => {
      params.set(`in_${column}`, JSON.stringify(values))
    })

    if (orderValue) {
      params.set('order', orderValue)
    }

    return apiFetch(`/rest.php?${params.toString()}`)
  }

  const executeInsert = async (payload: any): Promise<ApiResult<any>> => {
    return apiFetch(`/rest.php?table=${encodeURIComponent(table)}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  }

  const executeUpdate = async (payload: any): Promise<ApiResult<any>> => {
    const id = filters['eq_id']

    if (!id) {
      return {
        data: null,
        error: { message: 'Missing id for update. Use .eq("id", id).' },
      }
    }

    return apiFetch(
      `/rest.php?table=${encodeURIComponent(table)}&id=${encodeURIComponent(id)}`,
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      }
    )
  }

  const executeDelete = async (): Promise<ApiResult<any>> => {
    const id = filters['eq_id']

    if (!id) {
      return {
        data: null,
        error: { message: 'Missing id for delete. Use .eq("id", id).' },
      }
    }

    return apiFetch(
      `/rest.php?table=${encodeURIComponent(table)}&id=${encodeURIComponent(id)}`,
      { method: 'DELETE' }
    )
  }

  const execute = async (): Promise<ApiResult<any>> => {
    switch (operation.type) {
      case 'select':
        return executeSelect()
      case 'insert':
        return executeInsert(operation.payload)
      case 'update':
        return executeUpdate(operation.payload)
      case 'delete':
        return executeDelete()
      default:
        return {
          data: null,
          error: { message: 'Unknown API operation.' },
        }
    }
  }

  const firstRow = (data: any): any => {
    if (Array.isArray(data)) {
      return data[0] ?? null
    }
    return data ?? null
  }

  const api: any = {
    select: (value = '*') => {
      selectStr = value
      if (operation.type === 'select') {
        operation = { type: 'select' }
      } else {
        returning = true
      }
      return api
    },

    eq: (column: string, value: any) => {
      filters[`eq_${column}`] = value
      return api
    },

    in: (column: string, values: any[]) => {
      if (!Array.isArray(values)) {
        throw new Error(`.in('${column}', values) requires an array.`)
      }
      inFilters[column] = values
      return api
    },

    order: (
      column: string,
      options?: { ascending?: boolean; nullsFirst?: boolean; referencedTable?: string }
    ) => {
      const ascending = options?.ascending !== false
      orderValue = ascending ? `${column}.asc` : `${column}.desc`
      return api
    },

    limit: (count: number) => {
      filters['_limit'] = count
      return api
    },

    insert: (payload: any) => {
      operation = { type: 'insert', payload }
      returning = false
      return api
    },

    update: (payload: any) => {
      operation = { type: 'update', payload }
      returning = false
      return api
    },

    delete: () => {
      operation = { type: 'delete' }
      returning = false
      return api
    },

    single: async () => {
      const result = await execute()
      return { data: firstRow(result.data), error: result.error }
    },

    maybeSingle: async () => {
      const result = await execute()
      return { data: firstRow(result.data), error: result.error }
    },

    execute: async () => execute(),
  }

  api.then = (resolve: any, reject: any) => {
    execute().then(resolve).catch(reject)
  }

  return api
}

// -----------------------------------------------------------------------------
// Local storage / file API
// -----------------------------------------------------------------------------

function createStorageClient(bucket: string): any {
  return {
    upload: async (
      path: string,
      file: File | Blob,
      options?: { contentType?: string; upsert?: boolean }
    ): Promise<ApiResult<any>> => {
      try {
        const formData = new FormData()

        formData.append(
          'file',
          file,
          file instanceof File ? file.name : path.split('/').pop() ?? 'upload'
        )
        formData.append('storage_path', path)
        formData.append('bucket', bucket)

        if (options?.contentType) {
          formData.append('content_type', options.contentType)
        }

        if (options?.upsert !== undefined) {
          formData.append('upsert', options.upsert ? '1' : '0')
        }

        const response = await fetch(resolveApiUrl('/upload.php'), {
          method: 'POST',
          credentials: 'include',
          body: formData,
        })

        const text = await response.text()
        let json: any = null

        try {
          json = text ? JSON.parse(text) : null
        } catch {
          json = null
        }

        if (!response.ok || json?.error) {
          return {
            data: null,
            error: {
              message:
                json?.error?.message ??
                json?.error ??
                json?.message ??
                `Upload failed: ${response.status}`,
            },
          }
        }

        return { data: json?.data ?? json, error: null }
      } catch (error) {
        return {
          data: null,
          error: {
            message:
              error instanceof Error ? error.message : 'Upload failed.',
          },
        }
      }
    },

    getPublicUrl: (storagePath: string | null | undefined) => {
      if (!storagePath) {
        return { data: { publicUrl: null } }
      }

      if (
        storagePath.startsWith('http://') ||
        storagePath.startsWith('https://')
      ) {
        return { data: { publicUrl: storagePath } }
      }

      const cleanPath = storagePath.replace(/^\/+/, '')
      const appPrefix = NORMALIZED_API_BASE_URL.endsWith('/api')
        ? NORMALIZED_API_BASE_URL.slice(0, -4)
        : ''

      const publicUrl = `${appPrefix}/storage/uploads/${cleanPath}`

      return { data: { publicUrl } }
    },

    createSignedUrl: async (storagePath: string, _expiresIn: number) => {
      if (
        storagePath.startsWith('http://') ||
        storagePath.startsWith('https://')
      ) {
        return { data: { signedUrl: storagePath }, error: null }
      }

      const cleanPath = storagePath.replace(/^\/+/, '')
      const appPrefix = NORMALIZED_API_BASE_URL.endsWith('/api')
        ? NORMALIZED_API_BASE_URL.slice(0, -4)
        : ''

      const signedUrl = `${appPrefix}/storage/uploads/${cleanPath}`

      return { data: { signedUrl }, error: null }
    },

    remove: async (paths: string[]): Promise<{ error: ApiError | null }> => {
      if (!paths.length) {
        return { error: null }
      }

      try {
        const result = await apiFetch('/upload.php', {
          method: 'DELETE',
          body: JSON.stringify({ bucket, paths }),
        })

        return { error: result.error }
      } catch (error) {
        return {
          error: {
            message:
              error instanceof Error
                ? error.message
                : 'Unable to delete storage files.',
          },
        }
      }
    },
  }
}

// -----------------------------------------------------------------------------
// Main client
// -----------------------------------------------------------------------------

const _apiClient = {
  auth: {
    async signInWithPassword({ email, password }: { email: string; password: string }) {
      const result = await apiFetch<any>('/auth.php?action=signin', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })

      if (result.error) return { data: null, error: result.error }

      const data = result.data ?? { user: null, session: null }
      dispatchAuthEvent('SIGNED_IN', data)

      return { data, error: null }
    },

    async signOut() {
      const result = await apiFetch('/auth.php?action=signout', { method: 'POST' })
      if (!result.error) dispatchAuthEvent('SIGNED_OUT', null)
      return { error: result.error }
    },

    async signUp({
      email,
      password,
      options,
    }: {
      email: string
      password: string
      options?: { data?: { full_name?: string; [key: string]: any } }
    }) {
      const body: any = { email, password }
      if (options?.data) Object.assign(body, options.data)

      const result = await apiFetch<any>('/auth.php?action=signup', {
        method: 'POST',
        body: JSON.stringify(body),
      })

      if (result.error) return { data: null, error: result.error }

      const data = result.data ?? { user: null, session: null }
      dispatchAuthEvent('SIGNED_IN', data)

      return { data, error: null }
    },

    async getUser() {
      const result = await apiFetch<any>('/auth.php?action=getUser')
      if (result.error) {
        return { data: { user: null }, error: result.error }
      }
      const user = result.data?.user ?? result.data?.session?.user ?? null
      return { data: { user }, error: null }
    },

    async getSession() {
      const result = await apiFetch<any>('/auth.php?action=getSession')
      if (result.error) {
        return { data: { session: null }, error: result.error }
      }
      return { data: { session: result.data?.session ?? null }, error: null }
    },

    onAuthStateChange(callback: (event: string, session: any) => void) {
      const handler = (event: Event) => {
        const detail = (event as CustomEvent).detail ?? {}
        callback(detail.event, detail.session ?? null)
      }

      window.addEventListener(authEventName, handler)

      return {
        data: {
          subscription: {
            unsubscribe: () => {
              window.removeEventListener(authEventName, handler)
            },
          },
        },
      }
    },

    async resetPasswordForEmail(email: string, options?: any) {
      const result = await apiFetch('/auth.php?action=resetPassword', {
        method: 'POST',
        body: JSON.stringify({
          email,
          redirectTo: options?.redirectTo ?? null,
        }),
      })
      return { error: result.error }
    },

    async updateUser(payload: any) {
      const result = await apiFetch('/auth.php?action=updateUser', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      return { data: result.data, error: result.error }
    },
  },

  from(table: string) {
    return createTableClient(table)
  },

  storage: {
    from(bucket: string) {
      return createStorageClient(bucket)
    },
  },
}

export const apiClient: any = _apiClient