// Lightweight local API client for the MATTA portfolio app.
// This client talks to the local PHP API and does not use Supabase.

type FetchResult = {
  data?: any
  error?: {
    message?: string
  }
}

// -----------------------------------------------------------------------------
// API base URL
// -----------------------------------------------------------------------------

export const API_BASE_URL =
  import.meta.env.VITE_API_URL ??
  'http://localhost/matta/api'

const NORMALIZED_API_BASE_URL =
  API_BASE_URL.replace(/\/+$/, '')

function resolveApiUrl(path: string): string {
  const cleanPath = path.replace(/^\/+/, '')
  return `${NORMALIZED_API_BASE_URL}/${cleanPath}`
}

// -----------------------------------------------------------------------------
// Generic API request
// -----------------------------------------------------------------------------

async function apiFetch(
  path: string,
  opts: RequestInit = {},
): Promise<any> {
  const merged: RequestInit = {
    credentials: 'include',
    ...opts,
  }

  const url = resolveApiUrl(path)

  let response: Response

  try {
    response = await fetch(url, merged)
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? error.message
        : 'Unable to connect to the PHP server.',
    )
  }

  const json = await response.json().catch(() => null)

  if (!response.ok || json?.error) {
    throw new Error(
      json?.error ??
        json?.message ??
        `Server returned ${response.status}`,
    )
  }

  return json ?? null
}

const authEventName = 'matta-auth-change'

const _apiClient = {
  // ===========================================================================
  // Authentication
  // ===========================================================================

  auth: {
    async signInWithPassword({
      email,
      password,
    }: {
      email: string
      password: string
    }) {
      try {
        const json = await apiFetch(
          '/auth.php?action=signin',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email,
              password,
            }),
          },
        )

        const data =
          json?.data ?? {
            user: null,
            session: null,
          }

        window.dispatchEvent(
          new CustomEvent(authEventName, {
            detail: {
              event: 'SIGNED_IN',
              session: data,
            },
          }),
        )

        return {
          data,
          error: null,
        }
      } catch (e: any) {
        return {
          data: null,
          error: {
            message:
              e instanceof Error
                ? e.message
                : 'Unable to sign in.',
          },
        }
      }
    },

    async signOut() {
      try {
        await apiFetch(
          '/auth.php?action=signout',
          {
            method: 'POST',
          },
        )

        window.dispatchEvent(
          new CustomEvent(authEventName, {
            detail: {
              event: 'SIGNED_OUT',
            },
          }),
        )

        return {
          error: null,
        }
      } catch (e: any) {
        return {
          error: {
            message:
              e instanceof Error
                ? e.message
                : 'Unable to sign out.',
          },
        }
      }
    },

    async signUp({
      email,
      password,
      options,
    }: any) {
      try {
        const body: any = {
          email,
          password,
        }

        if (options?.data?.full_name) {
          body.full_name =
            options.data.full_name
        }

        const json = await apiFetch(
          '/auth.php?action=signup',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
          },
        )

        const data =
          json?.data ?? {
            user: null,
            session: null,
          }

        window.dispatchEvent(
          new CustomEvent(authEventName, {
            detail: {
              event: 'SIGNED_IN',
              session: data,
            },
          }),
        )

        return {
          data,
          error: null,
        }
      } catch (e: any) {
        return {
          data: null,
          error: {
            message:
              e instanceof Error
                ? e.message
                : 'Unable to create account.',
          },
        }
      }
    },

    async getUser() {
      try {
        const json = await apiFetch(
          '/auth.php?action=getUser',
        )

        const user =
          json?.data?.user ??
          json?.data?.session?.user ??
          null

        return {
          data: {
            user,
          },
          error: null,
        }
      } catch (e: any) {
        return {
          data: {
            user: null,
          },
          error: {
            message:
              e instanceof Error
                ? e.message
                : 'Unable to load user.',
          },
        }
      }
    },

    async getSession() {
      try {
        const json = await apiFetch(
          '/auth.php?action=getSession',
        )

        const session =
          json?.data?.session ?? null

        return {
          data: {
            session,
          },
          error: null,
        }
      } catch (e: any) {
        return {
          data: {
            session: null,
          },
          error: {
            message:
              e instanceof Error
                ? e.message
                : 'Unable to load session.',
          },
        }
      }
    },

    onAuthStateChange(
      callback: (
        event: string,
        session: any,
      ) => void,
    ) {
      const handler = (e: Event) => {
        const detail =
          (e as CustomEvent).detail || {}

        callback(
          detail.event,
          detail.session || null,
        )
      }

      window.addEventListener(
        authEventName,
        handler as EventListener,
      )

      return {
        data: {
          subscription: {
            unsubscribe: () => {
              window.removeEventListener(
                authEventName,
                handler as EventListener,
              )
            },
          },
        },
      }
    },

    async resetPasswordForEmail(
      _email: string,
      _opts?: any,
    ) {
      return {
        error: null,
      }
    },

    async updateUser(_payload: any) {
      return {
        error: null,
      }
    },
  },

  // ===========================================================================
  // Supabase-style table interface
  // ===========================================================================

  from(table: string) {
    const filters: Record<string, string> = {}

    let order: string | undefined
    let selectStr = '*'

    // Pending operation state.
    let operation:
      | {
          type: 'select'
        }
      | {
          type: 'insert'
          payload: any
        }
      | {
          type: 'update'
          payload: any
        }
      | {
          type: 'delete'
        } = {
      type: 'select',
    }

    // -------------------------------------------------------------------------
    // SELECT execution
    // -------------------------------------------------------------------------

    const executeSelect = async () => {
      const params =
        new URLSearchParams()

      params.set('table', table)
      params.set('select', selectStr)

      Object.entries(filters).forEach(
        ([key, value]) => {
          params.set(key, value)
        },
      )

      if (order) {
        params.set('order', order)
      }

      const json = await apiFetch(
        `/rest.php?${params.toString()}`,
      )

      return {
        data: json?.data ?? null,
        error: null,
      }
    }

    // -------------------------------------------------------------------------
    // INSERT execution
    // -------------------------------------------------------------------------

    const executeInsert = async (
      payload: any,
    ) => {
      const json = await apiFetch(
        `/rest.php?table=${encodeURIComponent(
          table,
        )}`,
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
          },
          body: JSON.stringify(
            payload,
          ),
        },
      )

      return {
        data: json?.data ?? null,
        error: null,
      }
    }

    // -------------------------------------------------------------------------
    // UPDATE execution
    // -------------------------------------------------------------------------

    const executeUpdate = async (
      payload: any,
    ) => {
      const id = filters['eq_id']

      if (!id) {
        return {
          data: null,
          error: {
            message:
              'Missing id for update',
          },
        }
      }

      try {
        const json = await apiFetch(
          `/rest.php?table=${encodeURIComponent(
            table,
          )}&id=${encodeURIComponent(
            id,
          )}`,
          {
            method: 'PUT',
            headers: {
              'Content-Type':
                'application/json',
            },
            body: JSON.stringify(
              payload,
            ),
          },
        )

        return {
          data: json?.data ?? null,
          error: null,
        }
      } catch (e: any) {
        return {
          data: null,
          error: {
            message:
              e instanceof Error
                ? e.message
                : 'Update failed.',
          },
        }
      }
    }

    // -------------------------------------------------------------------------
    // DELETE execution
    // -------------------------------------------------------------------------

    const executeDelete = async () => {
      const id = filters['eq_id']

      if (!id) {
        return {
          data: null,
          error: {
            message:
              'Missing id for delete',
          },
        }
      }

      try {
        const json = await apiFetch(
          `/rest.php?table=${encodeURIComponent(
            table,
          )}&id=${encodeURIComponent(
            id,
          )}`,
          {
            method: 'DELETE',
          },
        )

        return {
          data: json ?? null,
          error: null,
        }
      } catch (e: any) {
        return {
          data: null,
          error: {
            message:
              e instanceof Error
                ? e.message
                : 'Delete failed.',
          },
        }
      }
    }

    // -------------------------------------------------------------------------
    // Execute whichever operation is currently pending
    // -------------------------------------------------------------------------

    const execute = async () => {
      try {
        switch (operation.type) {
          case 'select':
            return await executeSelect()

          case 'insert':
            return await executeInsert(
              operation.payload,
            )

          case 'update':
            return await executeUpdate(
              operation.payload,
            )

          case 'delete':
            return await executeDelete()
        }
      } catch (e: any) {
        return {
          data: null,
          error: {
            message:
              e instanceof Error
                ? e.message
                : 'API request failed.',
          },
        }
      }
    }

    const api: any = {
      // -----------------------------------------------------------------------
      // SELECT
      // -----------------------------------------------------------------------

      select: (
        value = '*',
      ) => {
        selectStr = value
        operation = {
          type: 'select',
        }
        return api
      },

      // -----------------------------------------------------------------------
      // WHERE column = value
      // -----------------------------------------------------------------------

      eq: (
        col: string,
        val: string,
      ) => {
        filters[`eq_${col}`] = val
        return api
      },

      // -----------------------------------------------------------------------
      // ORDER BY
      // -----------------------------------------------------------------------

      order: (
        value: string,
        _opts?: any,
      ) => {
        order = value
        return api
      },

      // -----------------------------------------------------------------------
      // INSERT
      // -----------------------------------------------------------------------

      insert: (
        payload: any,
      ) => {
        operation = {
          type: 'insert',
          payload,
        }

        return api
      },

      // -----------------------------------------------------------------------
      // UPDATE
      // -----------------------------------------------------------------------

      update: (
        payload: any,
      ) => {
        /*
         * IMPORTANT:
         *
         * This is intentionally NOT async.
         *
         * That lets existing code do:
         *
         * .update({...})
         * .eq('id', userId)
         *
         * before the request executes.
         */
        operation = {
          type: 'update',
          payload,
        }

        return api
      },

      // -----------------------------------------------------------------------
      // DELETE
      // -----------------------------------------------------------------------

      delete: () => {
        /*
         * Also intentionally NOT async so this works:
         *
         * .delete()
         * .eq('id', id)
         */
        operation = {
          type: 'delete',
        }

        return api
      },

      // -----------------------------------------------------------------------
      // Execute first row
      // -----------------------------------------------------------------------

      maybeSingle: async () => {
        const result = await execute()

        return {
          data: Array.isArray(
            result?.data,
          )
            ? result.data[0] ?? null
            : result?.data ?? null,

          error:
            result?.error ?? null,
        }
      },

      // -----------------------------------------------------------------------
      // Execute first row
      // -----------------------------------------------------------------------

      single: async () => {
        const result = await execute()

        return {
          data: Array.isArray(
            result?.data,
          )
            ? result.data[0] ?? null
            : result?.data ?? null,

          error:
            result?.error ?? null,
        }
      },
    }

    // -------------------------------------------------------------------------
    // Promise-like behavior
    // -------------------------------------------------------------------------
    //
    // This makes:
    //
    // await supabase
    //   .from('users_profile')
    //   .update({...})
    //   .eq('id', userId)
    //
    // execute automatically.
    // -------------------------------------------------------------------------

    ;(api as any).then = (
      resolve: any,
      reject: any,
    ) => {
      execute()
        .then(resolve)
        .catch(reject)
    }

    return api
  },

  // ===========================================================================
  // Local storage / file API
  // ===========================================================================

  storage: {
    from: (
      _bucket: string,
    ) => ({
      upload: async (
        path: string,
        file: any,
        _opts?: any,
      ) => {
        try {
          const formData =
            new FormData()

          formData.append(
            'file',
            file,
          )

          formData.append(
            'storage_path',
            path,
          )

          /*
           * Do not manually specify Content-Type.
           * The browser adds the multipart boundary.
           */
          const response =
            await fetch(
              resolveApiUrl(
                '/upload.php',
              ),
              {
                method: 'POST',
                body: formData,
                credentials:
                  'include',
              },
            )

          const json =
            await response
              .json()
              .catch(
                () => null,
              )

          /*
           * HTTP errors OR JSON errors are both failures.
           */
          if (
            !response.ok ||
            json?.error
          ) {
            return {
              data: null,
              error: {
                message:
                  json?.error ??
                  json?.message ??
                  `Upload failed: ${response.status}`,
              },
            }
          }

          if (!json?.data) {
            return {
              data: null,
              error: {
                message:
                  'Upload completed but the server returned no file information.',
              },
            }
          }

          return {
            data: json.data,
            error: null,
          }
        } catch (e: any) {
          return {
            data: null,
            error: {
              message:
                e instanceof Error
                  ? e.message
                  : 'Upload failed.',
            },
          }
        }
      },

      getPublicUrl: (
        avatarPath:
          | string
          | null
          | undefined,
      ) => {
        if (!avatarPath) {
          return {
            data: {
              publicUrl: null,
            },
          }
        }

        if (
          avatarPath.startsWith(
            'http://',
          ) ||
          avatarPath.startsWith(
            'https://',
          )
        ) {
          return {
            data: {
              publicUrl:
                avatarPath,
            },
          }
        }

        const cleanPath =
          avatarPath.replace(
            /^\/+/,
            '',
          )

        return {
          data: {
            publicUrl:
              `${window.location.origin}/matta/${cleanPath}`,
          },
        }
      },

      createSignedUrl: async (
        storagePath: string,
        _expiresIn: number,
      ) => {
        if (
          storagePath.startsWith(
            'http://',
          ) ||
          storagePath.startsWith(
            'https://',
          )
        ) {
          return {
            data: {
              signedUrl:
                storagePath,
            },
            error: null,
          }
        }

        const cleanPath =
          storagePath.replace(
            /^\/+/,
            '',
          )

        return {
          data: {
            signedUrl:
              `${window.location.origin}/matta/${cleanPath}`,
          },
          error: null,
        }
      },

      remove: async (
        _paths: string[],
      ) => {
        /*
         * Physical deletion isn't implemented yet.
         */
        return {
          error: null,
        }
      },
    }),
  },
}

export const apiClient: any =
  _apiClient