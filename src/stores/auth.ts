import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Session, SupabaseClient, User } from '@supabase/supabase-js'
import { toast } from '@/composables/useToast'
import {
  AUTH_STORAGE_KEY,
  LOCAL_TEST_USER,
  isAuthConfigured,
  isTestSignInAvailable,
} from '@/config/supabase'
import { getSupabaseClient } from '@/utils/supabase-loader'
import {
  captureReturnUrl,
  clearAuthParamsFromUrl,
  hasAuthCallbackParams,
  readAuthCallbackError,
} from '@/utils/auth-return-url'

/**
 * Auth Store
 *
 * Optional GitHub / Google sign-in via Supabase. Everything here is inert when
 * `isAuthConfigured()` is false, so the editor works unchanged without a Supabase
 * project — see config/supabase.ts.
 *
 * Identity is never managed locally: no passwords, no reset flows, no account records.
 * Supabase owns the OAuth handshake; this store only mirrors the resulting session into
 * Vue reactivity and hands out access tokens for authenticated calls.
 */

export type AuthProvider = 'github' | 'google'

/**
 * The app's own view of a signed-in user, deliberately narrower than Supabase's `User`
 * so components never import supabase types and the identity provider stays swappable.
 */
export interface AuthUser {
  id: string
  email: string
  name: string
  avatarUrl: string
}

function toAuthUser(user: User | null | undefined): AuthUser | null {
  if (!user) return null
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>
  const pick = (...keys: string[]): string => {
    for (const key of keys) {
      const value = meta[key]
      if (typeof value === 'string' && value.trim()) return value
    }
    return ''
  }
  const email = user.email ?? ''
  return {
    id: user.id,
    email,
    name: pick('user_name', 'preferred_username', 'full_name', 'name') || email || 'Account',
    avatarUrl: pick('avatar_url', 'picture'),
  }
}

/** Cheap probe for a persisted session that avoids loading supabase-js. */
function hasPersistedSession(): boolean {
  try {
    return window.localStorage.getItem(AUTH_STORAGE_KEY) !== null
  } catch {
    return false
  }
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(null)
  const busy = ref(false)
  const initialized = ref(false)

  const isConfigured = computed(() => isAuthConfigured())
  const isSignedIn = computed(() => user.value !== null)
  const canUseTestUser = computed(() => isTestSignInAvailable())

  let unsubscribe: (() => void) | null = null

  const applySession = (session: Session | null) => {
    user.value = toAuthUser(session?.user)
  }

  /**
   * Mirror future session changes into the store. Idempotent, and needed by every
   * sign-in path that does not reload the page — an OAuth redirect re-runs
   * `initialize()`, but a password sign-in does not.
   */
  const subscribe = (supabase: SupabaseClient) => {
    if (unsubscribe) return
    const { data } = supabase.auth.onAuthStateChange((_event, session) => applySession(session))
    unsubscribe = () => data.subscription.unsubscribe()
  }

  /**
   * Restore an existing session and finish any OAuth callback.
   *
   * Returns without loading supabase-js when there is nothing to do, which is the
   * common case for anonymous visitors.
   */
  const initialize = async (): Promise<void> => {
    if (initialized.value || !isConfigured.value) return
    initialized.value = true

    const callbackError = readAuthCallbackError()
    if (callbackError) {
      clearAuthParamsFromUrl()
      toast.showError(callbackError, 'Sign-in Failed')
      return
    }

    if (!hasAuthCallbackParams() && !hasPersistedSession()) return

    busy.value = true
    try {
      const supabase = await getSupabaseClient()

      // getSession() awaits the client's own initialization, which is what performs the
      // PKCE code exchange when `detectSessionInUrl` finds `?code=` in the URL.
      const { data, error } = await supabase.auth.getSession()
      if (error) throw error
      applySession(data.session)
      subscribe(supabase)
    } catch (error) {
      console.error('Error restoring session:', error)
      toast.showError(
        error instanceof Error ? error.message : 'Could not restore your session',
        'Sign-in Failed',
      )
    } finally {
      clearAuthParamsFromUrl()
      busy.value = false
    }
  }

  /**
   * Start the OAuth redirect. The browser leaves the page, so this resolves only on
   * failure.
   */
  const signIn = async (provider: AuthProvider): Promise<void> => {
    if (!isConfigured.value || busy.value) return

    busy.value = true
    try {
      const supabase = await getSupabaseClient()

      // Stash the fragment before leaving; it does not survive the OAuth round trip.
      captureReturnUrl()

      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}${window.location.pathname}` },
      })
      if (error) throw error
    } catch (error) {
      console.error('Error starting sign-in:', error)
      toast.showError(
        error instanceof Error ? error.message : 'Could not start sign-in',
        'Sign-in Failed',
      )
      busy.value = false
    }
  }

  /**
   * Sign in as the account seeded by supabase/seed.sql. Dev builds against a local
   * instance only — see isTestSignInAvailable(). Unlike the OAuth path this does not
   * navigate away, so the session is applied here and the subscription established.
   */
  const signInAsTestUser = async (): Promise<void> => {
    if (!canUseTestUser.value || busy.value) return

    busy.value = true
    try {
      const supabase = await getSupabaseClient()
      const { data, error } = await supabase.auth.signInWithPassword({
        email: LOCAL_TEST_USER.email,
        password: LOCAL_TEST_USER.password,
      })
      if (error) throw error

      subscribe(supabase)
      applySession(data.session)
      toast.showSuccess(`Signed in as ${LOCAL_TEST_USER.email}`, 'Local Development')
    } catch (error) {
      console.error('Error signing in as test user:', error)
      const message = error instanceof Error ? error.message : 'Could not sign in'
      toast.showError(
        // Almost always means the seed has not run against this instance.
        /invalid login credentials/i.test(message)
          ? 'No local test user found. Run `npm run supabase:reset` to seed it.'
          : message,
        'Sign-in Failed',
      )
    } finally {
      busy.value = false
    }
  }

  const signOut = async (): Promise<void> => {
    if (!isConfigured.value || busy.value) return

    busy.value = true
    try {
      const supabase = await getSupabaseClient()
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      user.value = null
      toast.showSuccess('Signed out', 'Account')
    } catch (error) {
      console.error('Error signing out:', error)
      toast.showError(
        error instanceof Error ? error.message : 'Could not sign out',
        'Sign-out Failed',
      )
    } finally {
      busy.value = false
    }
  }

  /**
   * Current access token for authenticated requests (used by the link service in a
   * later phase). Returns null when signed out.
   */
  const getAccessToken = async (): Promise<string | null> => {
    if (!isConfigured.value || !isSignedIn.value) return null
    try {
      const supabase = await getSupabaseClient()
      const { data } = await supabase.auth.getSession()
      return data.session?.access_token ?? null
    } catch (error) {
      console.error('Error reading access token:', error)
      return null
    }
  }

  const cleanup = () => {
    unsubscribe?.()
    unsubscribe = null
  }

  return {
    user,
    busy,
    initialized,
    isConfigured,
    isSignedIn,
    canUseTestUser,
    initialize,
    signIn,
    signInAsTestUser,
    signOut,
    getAccessToken,
    cleanup,
  }
})
