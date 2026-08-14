import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const mocks = vi.hoisted(() => ({
  isAuthConfigured: vi.fn(() => true),
  isTestSignInAvailable: vi.fn(() => false),
  getSupabaseClient: vi.fn(),
  showError: vi.fn(),
  showSuccess: vi.fn(),
  captureReturnUrl: vi.fn(),
}))

vi.mock('@/config/supabase', () => ({
  AUTH_STORAGE_KEY: 'kle-ng-auth',
  LOCAL_TEST_USER: { email: 'dev@test.local', password: 'password123' },
  isAuthConfigured: mocks.isAuthConfigured,
  isTestSignInAvailable: mocks.isTestSignInAvailable,
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
    it('is unavailable unless a dev build points at a local instance', async () => {
      mocks.isTestSignInAvailable.mockReturnValue(false)
      mocks.getSupabaseClient.mockResolvedValue(fakeClient())
      const auth = useAuthStore()

      expect(auth.canUseTestUser).toBe(false)
      await auth.signInAsTestUser()

      // Nothing loaded, nothing attempted — the shortcut simply does not exist
      expect(mocks.getSupabaseClient).not.toHaveBeenCalled()
    })

    it('signs in with the seeded credentials and applies the session', async () => {
      mocks.isTestSignInAvailable.mockReturnValue(true)
      const client = fakeClient({ user: GITHUB_USER })
      mocks.getSupabaseClient.mockResolvedValue(client)
      const auth = useAuthStore()

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

    it('points at the seed command when the test user is missing', async () => {
      mocks.isTestSignInAvailable.mockReturnValue(true)
      const client = fakeClient()
      client.auth.signInWithPassword = vi
        .fn()
        .mockResolvedValue({
          data: { session: null },
          error: new Error('Invalid login credentials'),
        })
      mocks.getSupabaseClient.mockResolvedValue(client)
      const auth = useAuthStore()

      await auth.signInAsTestUser()

      expect(mocks.showError).toHaveBeenCalledWith(
        'No local test user found. Run `npm run supabase:reset` to seed it.',
        'Sign-in Failed',
      )
      expect(auth.busy).toBe(false)
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

    it('keeps the session when sign-out fails', async () => {
      localStorage.setItem('kle-ng-auth', '{}')
      const client = fakeClient({ user: GITHUB_USER })
      client.auth.signOut = vi.fn().mockResolvedValue({ error: new Error('offline') })
      mocks.getSupabaseClient.mockResolvedValue(client)
      const auth = useAuthStore()
      await auth.initialize()

      await auth.signOut()

      expect(mocks.showError).toHaveBeenCalledWith('offline', 'Sign-out Failed')
      expect(auth.isSignedIn).toBe(true)
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
