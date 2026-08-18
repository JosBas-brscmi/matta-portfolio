import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { apiClient as supabase } from '../services/apiClient'
import {
  getCurrentUser,
  loadUserProfile,
  signInWithEmail,
  signOut as authSignOut,
  AuthUser,
} from '../services/authService'

export interface UserProfile {
  id: string
  email: string
  full_name: string
  english_name: string | null
  role: 'mt' | 'ma_center' | 'mentor' | 'manager' | 'ma_board' | 'owner'
  department: string | null
  status: 'active' | 'inactive'
}

interface AuthContextValue {
  user: AuthUser | null
  profile: UserProfile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  // Fetch the user_profile row, racing against an 8s timeout so the UI
  // is never permanently locked even if the network query hangs.
  const fetchProfile = async (userId: string) => {
    console.log('[AuthContext] fetchProfile start for', userId)
    try {
      const result = await Promise.race([
        loadUserProfile(userId),
        new Promise<{ profile: null; error: { message: string } }>((resolve) =>
          setTimeout(
            () =>
              resolve({
                profile: null,
                error: { message: 'Profile load timed out after 8 seconds' },
              }),
            8000,
          ),
        ),
      ])
      if (result.error) {
        console.error('[AuthContext] fetchProfile error:', result.error)
        setProfile(null)
      } else {
        console.log('[AuthContext] fetchProfile success:', result.profile)
        setProfile(result.profile as UserProfile)
      }
    } catch (e) {
      console.error('[AuthContext] fetchProfile threw:', e)
      setProfile(null)
    }
  }

  useEffect(() => {
    let mounted = true

    // ---- Initial session check on app mount ----
    console.log('[AuthContext] mounting, checking initial session')
    supabase.auth.getSession().then(async ({ data: { session } }: { data: { session: any } }) => {
      if (!mounted) return
      const currentUser = session?.user ?? null
      console.log('[AuthContext] initial session user id:', currentUser?.id ?? 'none')
      setUser(currentUser)
      if (currentUser) {
        await fetchProfile(currentUser.id)
      }
      if (mounted) setLoading(false)
    })

    // ---- Auth state change subscription ----
    //
    // CRITICAL: do NOT do async work inside this callback that uses the
    // same supabase client (e.g. supabase.from()). supabase-js v2 holds
    // a storage lock while emitting these events, and a from() call
    // here will deadlock waiting for the same lock.
    //
    // Safe pattern: do synchronous state updates here, then defer any
    // supabase queries with setTimeout(..., 0).
    //
    // See: https://github.com/supabase/supabase-js/issues/783
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: string, session: any) => {
      if (!mounted) return
      console.log('[AuthContext] auth state change:', event, 'user id:', session?.user?.id ?? 'none')

      const currentUser = session?.user ?? null
      setUser(currentUser)

      if (currentUser) {
        // Defer the profile fetch to break out of the supabase lock context.
        setTimeout(() => {
          if (!mounted) return
          fetchProfile(currentUser.id).finally(() => {
            if (mounted) setLoading(false)
          })
        }, 0)
      } else {
        setProfile(null)
        setLoading(false)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const signIn = async (email: string, password: string) => {
    console.log('[AuthContext] signIn invoked')
    const { error } = await signInWithEmail(email, password)
    console.log('[AuthContext] signIn result error:', error?.message ?? 'none')
    return { error: error?.message ?? null }
  }

  const signOut = async () => {
    await authSignOut()
    setUser(null)
    setProfile(null)
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used inside <AuthProvider>')
  }
  return ctx
}
