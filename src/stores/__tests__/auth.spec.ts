import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const TEST_USER = {
  email: 'dev@test.local',
  password: 'password123',
  label: 'local development',
}

const mocks = vi.hoisted(() => ({
  isAuthConfigured: vi.fn(() => true),
  getTestUser: vi.fn<() => { email: string; password: string; label: string } | null>(() => null),
  getSupabaseClient: vi.fn(),
  showError: vi.fn(),
  showSuccess: vi.fn(),
  captureReturnUrl: vi.fn(),
}))

vi.mock('@/config/supabase', () => ({
  AUTH_STORAGE_KEY: 'kle-ng-auth',
  isAuthConfigured: mocks.isAuthConfigured,
  getTestUser: mocks.getTestUser,
}))

vi.mock('@/utils/supabase-loader', () => ({
  getSupabaseClient: mocks.getSupabaseClient,
}))

vi.mock('@/composables/useToast', () => ({
  toast: { showError: mocks.showError, showSuccess: mocks.showSuccess },
}))

vi.mock('@/utils/auth-return-url', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/utils/auth-return-url')>()),
  captureReturnUrl: mocks.captureReturnUrl,
}))

import { useAuthStore } from '../auth'

const GITHUB_USER = {
  id: 'user-1',
  email: 'dev@example.com',
  user_metadata: { user_name: 'adamws', avatar_url: 'https://example.com/a.png' },
}

function fakeClient(session: unknown = null) {
  return {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session }, error: null }),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
      signInWithOAuth: vi.fn().mockResolvedValue({ error: null }),
      signInWithPassword: vi.fn().mockResolvedValue({ data: { session }, error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  }
}

describe('auth store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mocks.isAuthConfigured.mockReturnValue(true)
    mocks.getTestUser.mockReturnValue(null)
    localStorage.clear()
    window.history.replaceState({}, '', '/')
  })

  describe('initialize', () => {
    it('does nothing when accounts are not configured', async () => {
      mocks.isAuthConfigured.mockReturnValue(false)
      const auth = useAuthStore()

      await auth.initialize()

      expect(mocks.getSupabaseClient).not.toHaveBeenCalled()
      expect(auth.isSignedIn).toBe(false)
    })

    it('does not load supabase-js for an anonymous visitor', async () => {
      const auth = useAuthStore()

      await auth.initialize()

      expect(mocks.getSupabaseClient).not.toHaveBeenCalled()
    })

    it('restores a persisted session', async () => {
      localStorage.setItem('kle-ng-auth', '{"access_token":"t"}')
      mocks.getSupabaseClient.mockResolvedValue(fakeClient({ user: GITHUB_USER }))
      const auth = useAuthStore()

      await auth.initialize()

      expect(auth.isSignedIn).toBe(true)
      expect(auth.user).toEqual({
        id: 'user-1',
        email: 'dev@example.com',
        name: 'adamws',
        avatarUrl: 'https://example.com/a.png',
      })
    })

    it('exchanges the PKCE code on an OAuth callback and cleans the URL', async () => {
      window.history.replaceState({}, '', '/?code=abc123#share=keepme')
      mocks.getSupabaseClient.mockResolvedValue(fakeClient({ user: GITHUB_USER }))
      const auth = useAuthStore()

      await auth.initialize()

      expect(mocks.getSupabaseClient).toHaveBeenCalled()
      expect(auth.isSignedIn).toBe(true)
      expect(window.location.search).toBe('')
      // The shared layout must survive the sign-in round trip
      expect(window.location.hash).toBe('#share=keepme')
    })

    it('surfaces a provider error without loading supabase-js', async () => {
      window.history.replaceState({}, '', '/?error=access_denied&error_description=Nope')
      const auth = useAuthStore()

      await auth.initialize()

      expect(mocks.getSupabaseClient).not.toHaveBeenCalled()
      expect(mocks.showError).toHaveBeenCalledWith('Nope', 'Sign-in Failed')
      expect(window.location.search).toBe('')
    })

    it('reports a failed session restore instead of throwing', async () => {
      localStorage.setItem('kle-ng-auth', '{}')
      mocks.getSupabaseClient.mockRejectedValue(new Error('network down'))
      const auth = useAuthStore()

      await expect(auth.initialize()).resolves.toBeUndefined()

      expect(mocks.showError).toHaveBeenCalledWith('network down', 'Sign-in Failed')
      expect(auth.busy).toBe(false)
    })

    it('runs only once', async () => {
      localStorage.setItem('kle-ng-auth', '{}')
      mocks.getSupabaseClient.mockResolvedValue(fakeClient({ user: GITHUB_USER }))
      const auth = useAuthStore()

      await auth.initialize()
      await auth.initialize()

      expect(mocks.getSupabaseClient).toHaveBeenCalledTimes(1)
    })
  })

  describe('user mapping', () => {
    it('falls back through Google metadata', async () => {
      localStorage.setItem('kle-ng-auth', '{}')
      mocks.getSupabaseClient.mockResolvedValue(
        fakeClient({
          user: {
            id: 'user-2',
            email: 'g@example.com',
            user_metadata: { full_name: 'Ada Lovelace', picture: 'https://example.com/g.png' },
          },
        }),
      )
      const auth = useAuthStore()

      await auth.initialize()

      expect(auth.user?.name).toBe('Ada Lovelace')
      expect(auth.user?.avatarUrl).toBe('https://example.com/g.png')
    })

    it('falls back to the email when no name metadata exists', async () => {
      localStorage.setItem('kle-ng-auth', '{}')
      mocks.getSupabaseClient.mockResolvedValue(
        fakeClient({ user: { id: 'user-3', email: 'x@example.com', user_metadata: {} } }),
      )
      const auth = useAuthStore()

      await auth.initialize()

      expect(auth.user?.name).toBe('x@example.com')
      expect(auth.user?.avatarUrl).toBe('')
    })
  })

  describe('signIn', () => {
    it('captures the fragment and starts the redirect', async () => {
      const client = fakeClient()
      mocks.getSupabaseClient.mockResolvedValue(client)
      const auth = useAuthStore()

      await auth.signIn('github')

      expect(mocks.captureReturnUrl).toHaveBeenCalled()
      expect(client.auth.signInWithOAuth).toHaveBeenCalledWith({
        provider: 'github',
        options: { redirectTo: `${window.location.origin}/` },
      })
    })

    it('does nothing when accounts are not configured', async () => {
      mocks.isAuthConfigured.mockReturnValue(false)
      const auth = useAuthStore()

      await auth.signIn('google')

      expect(mocks.getSupabaseClient).not.toHaveBeenCalled()
    })

    it('reports a failure and clears the busy flag', async () => {
      mocks.getSupabaseClient.mockRejectedValue(new Error('popup blocked'))
      const auth = useAuthStore()

      await auth.signIn('github')

      expect(mocks.showError).toHaveBeenCalledWith('popup blocked', 'Sign-in Failed')
      expect(auth.busy).toBe(false)
    })
  })

  describe('signInAsTestUser', () => {
    /** Rejects the sign-in the way Supabase does when the account is absent */
    const clientWithoutTestUser = () => {
      const client = fakeClient()
      client.auth.signInWithPassword = vi.fn().mockResolvedValue({
        data: { session: null },
        error: new Error('Invalid login credentials'),
      })
      return client
    }

    it('is unavailable when no test user is configured', async () => {
      mocks.getTestUser.mockReturnValue(null)
      mocks.getSupabaseClient.mockResolvedValue(fakeClient())
      const auth = useAuthStore()

      expect(auth.canUseTestUser).toBe(false)
      await auth.signInAsTestUser()

      // Nothing loaded, nothing attempted — the shortcut simply does not exist
      expect(mocks.getSupabaseClient).not.toHaveBeenCalled()
    })

    it('signs in with the configured credentials and applies the session', async () => {
      mocks.getTestUser.mockReturnValue(TEST_USER)
      const client = fakeClient({ user: GITHUB_USER })
      mocks.getSupabaseClient.mockResolvedValue(client)
      const auth = useAuthStore()

      expect(auth.canUseTestUser).toBe(true)
      await auth.signInAsTestUser()

      expect(client.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'dev@test.local',
        password: 'password123',
      })
      // No page reload on this path, so the session must be applied directly
      expect(auth.isSignedIn).toBe(true)
      // …and future changes must still be observed
      expect(client.auth.onAuthStateChange).toHaveBeenCalled()
    })

    // The store takes whatever getTestUser() hands it rather than knowing the seeded
    // account itself, so the gating stays in one place — config/supabase.ts.
    it('uses whichever credentials are configured', async () => {
      mocks.getTestUser.mockReturnValue({
        email: 'someone@example.com',
        password: 'another-secret',
        label: 'local development',
      })
      const client = fakeClient({ user: GITHUB_USER })
      mocks.getSupabaseClient.mockResolvedValue(client)
      const auth = useAuthStore()

      await auth.signInAsTestUser()

      expect(client.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'someone@example.com',
        password: 'another-secret',
      })
      expect(auth.isSignedIn).toBe(true)
    })

    // The shortcut only exists on a dev build against a local stack, so a missing
    // account can only ever mean the seed has not run — there is no second message.
    it('points at the seed command when the test user is missing', async () => {
      mocks.getTestUser.mockReturnValue(TEST_USER)
      mocks.getSupabaseClient.mockResolvedValue(clientWithoutTestUser())
      const auth = useAuthStore()

      await auth.signInAsTestUser()

      expect(mocks.showError).toHaveBeenCalledWith(
        'No local test user found. Run `npm run supabase:reset` to seed it.',
        'Sign-in Failed',
      )
      expect(auth.busy).toBe(false)
    })

    // Anything else is surfaced as-is rather than rewritten into the seed hint.
    it('passes through a failure that is not a missing account', async () => {
      mocks.getTestUser.mockReturnValue(TEST_USER)
      const client = fakeClient()
      client.auth.signInWithPassword = vi.fn().mockResolvedValue({
        data: { session: null },
        error: new Error('Failed to fetch'),
      })
      mocks.getSupabaseClient.mockResolvedValue(client)
      const auth = useAuthStore()

      await auth.signInAsTestUser()

      expect(mocks.showError).toHaveBeenCalledWith('Failed to fetch', 'Sign-in Failed')
    })
  })

  describe('signOut', () => {
    it('clears the user', async () => {
      localStorage.setItem('kle-ng-auth', '{}')
      const client = fakeClient({ user: GITHUB_USER })
      mocks.getSupabaseClient.mockResolvedValue(client)
      const auth = useAuthStore()
      await auth.initialize()
      expect(auth.isSignedIn).toBe(true)

      await auth.signOut()

      expect(client.auth.signOut).toHaveBeenCalled()
      expect(auth.isSignedIn).toBe(false)
      expect(mocks.showSuccess).toHaveBeenCalled()
    })

    it('still ends the session when sign-out fails', async () => {
      // A sign-out control must not fail towards "still signed in". The server call not
      // revoking the refresh token is reported, but the session in this browser goes
      // either way, via a local-scope sign-out that cannot fail against the network.
      localStorage.setItem('kle-ng-auth', '{}')
      const client = fakeClient({ user: GITHUB_USER })
      client.auth.signOut = vi.fn().mockResolvedValue({ error: new Error('offline') })
      mocks.getSupabaseClient.mockResolvedValue(client)
      const auth = useAuthStore()
      await auth.initialize()

      await auth.signOut()

      expect(mocks.showError).toHaveBeenCalledWith('offline', 'Sign-out Failed')
      expect(client.auth.signOut).toHaveBeenCalledWith({ scope: 'local' })
      expect(auth.isSignedIn).toBe(false)
    })
  })

  describe('getAccessToken', () => {
    it('returns null when signed out', async () => {
      const auth = useAuthStore()
      expect(await auth.getAccessToken()).toBeNull()
      expect(mocks.getSupabaseClient).not.toHaveBeenCalled()
    })

    it('returns the token when signed in', async () => {
      localStorage.setItem('kle-ng-auth', '{}')
      mocks.getSupabaseClient.mockResolvedValue(
        fakeClient({ user: GITHUB_USER, access_token: 'jwt-token' }),
      )
      const auth = useAuthStore()
      await auth.initialize()

      expect(await auth.getAccessToken()).toBe('jwt-token')
    })
  })
})
