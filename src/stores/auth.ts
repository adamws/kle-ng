import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Session, SupabaseClient, User } from '@supabase/supabase-js'
import { toast } from '@/composables/useToast'
import { AUTH_STORAGE_KEY, getTestUser, isAuthConfigured } from '@/config/supabase'
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

/**
 * An avatar URL we are willing to put in an `<img src>`.
 *
 * `user_metadata` is provider-controlled, so it is checked rather than trusted. A
 * `javascript:` URL is inert in `src` on every current browser, but the allowlist is
 * cheap and it matches openLinkSafely() in KeyboardCanvas.vue, which does the same for
 * `<a href>` on the label path. An unusable value degrades to the initials avatar.
 */
function safeAvatarUrl(raw: string): string {
  if (!raw) return ''
  try {
    const { protocol } = new URL(raw, window.location.origin)
    return protocol === 'https:' || protocol === 'http:' ? raw : ''
  } catch {
    return ''
  }
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
    avatarUrl: safeAvatarUrl(pick('avatar_url', 'picture')),
  }
}

/**
 * What to do about a test user that the configured project does not have.
 *
 * Only ever one message: the shortcut is offered exclusively on a dev build against a
 * local stack (see `getTestUser()`), so the seeded account is the only test user this
 * can be about. A hosted project can never reach here.
 */
const MISSING_TEST_USER_HINT = 'No local test user found. Run `npm run supabase:reset` to seed it.'

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
  const testUser = computed(() => getTestUser())
  const canUseTestUser = computed(() => testUser.value !== null)

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
   * Sign in as the account `supabase/seed.sql` creates on the local stack. Available
   * only in a dev build pointed at that stack — no deployment offers it, production
   * included; see getTestUser(). Unlike the OAuth path this does not navigate away, so
   * the session is applied here and the subscription established.
   */
  const signInAsTestUser = async (): Promise<void> => {
    const credentials = testUser.value
    if (!credentials || busy.value) return

    busy.value = true
    try {
      const supabase = await getSupabaseClient()
      const { data, error } = await supabase.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password,
      })
      if (error) throw error

      subscribe(supabase)
      applySession(data.session)
      toast.showSuccess(`Signed in as ${credentials.email}`, 'Test User')
    } catch (error) {
      console.error('Error signing in as test user:', error)
      const message = error instanceof Error ? error.message : 'Could not sign in'
      toast.showError(
        // Almost always means the account does not exist on this instance.
        /invalid login credentials/i.test(message) ? MISSING_TEST_USER_HINT : message,
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
      if (error) {
        // Report it, but still end the session locally — a local sign-out touches only
        // storage, so it cannot fail the way the network call just did.
        await supabase.auth.signOut({ scope: 'local' }).catch(() => {})
        throw error
      }
      toast.showSuccess('Signed out', 'Account')
    } catch (error) {
      console.error('Error signing out:', error)
      toast.showError(
        error instanceof Error ? error.message : 'Could not sign out',
        'Sign-out Failed',
      )
    } finally {
      // Cleared however the call ended, so the UI and the stored credential agree. A
      // sign-out that fails towards "still signed in" is the wrong way round: supabase-js
      // drops the stored session on most failure paths anyway, which would otherwise
      // leave a signed-in account on screen with no session behind it.
      user.value = null
      busy.value = false
    }
  }

  /**
   * Current access token for authenticated requests. Returns null when signed out.
   *
   * Deliberately unused so far: it is for the share-link service in a later phase (see
   * notes/user-accounts-plan.md). Everything the editor stores today goes through
   * PostgREST, which supabase-js authenticates itself. Kept on purpose — do not delete
   * it as dead code without checking that plan first.
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
    testUser,
    canUseTestUser,
    initialize,
    signIn,
    signInAsTestUser,
    signOut,
    getAccessToken,
    cleanup,
  }
})
