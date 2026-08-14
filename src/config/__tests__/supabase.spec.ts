import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  getSupabaseConfig,
  getTestUser,
  isAuthConfigured,
  isLocalSupabase,
  isTestSignInAvailable,
  resetSupabaseConfigCache,
} from '../supabase'

describe('supabase config', () => {
  beforeEach(() => {
    resetSupabaseConfigCache()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    resetSupabaseConfigCache()
  })

  it('reports accounts as unconfigured when both vars are missing', () => {
    vi.stubEnv('VITE_SUPABASE_URL', '')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')

    expect(isAuthConfigured()).toBe(false)
    expect(getSupabaseConfig()).toBeNull()
  })

  it('requires both the URL and the anon key', () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://abc.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')

    expect(isAuthConfigured()).toBe(false)
  })

  it('returns the config when both are set', () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://abc.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key')

    expect(getSupabaseConfig()).toEqual({
      url: 'https://abc.supabase.co',
      anonKey: 'anon-key',
    })
  })

  it('allows plain http outside production, for local Supabase', () => {
    vi.stubEnv('PROD', false)
    vi.stubEnv('VITE_SUPABASE_URL', 'http://localhost:54321')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key')

    expect(isAuthConfigured()).toBe(true)
  })

  it('refuses plain http in production', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubEnv('PROD', true)
    vi.stubEnv('VITE_SUPABASE_URL', 'http://abc.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key')

    expect(isAuthConfigured()).toBe(false)
    expect(error).toHaveBeenCalled()
  })

  describe('local instance detection', () => {
    const configure = (url: string) => {
      vi.stubEnv('VITE_SUPABASE_URL', url)
      vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key')
      resetSupabaseConfigCache()
    }

    it.each([
      ['http://127.0.0.1:54321', true],
      ['http://localhost:54321', true],
      ['https://cdcvedgnkamejhhowach.supabase.co', false],
      // A hostname that merely contains "localhost" is not local
      ['https://localhost.example.com', false],
    ])('%s → isLocalSupabase %s', (url, expected) => {
      configure(url)
      expect(isLocalSupabase()).toBe(expected)
    })

    it('is not local when accounts are unconfigured', () => {
      vi.stubEnv('VITE_SUPABASE_URL', '')
      vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')
      resetSupabaseConfigCache()

      expect(isLocalSupabase()).toBe(false)
    })
  })

  describe('test user shortcut', () => {
    const PREVIEW_URL = 'https://kle-ng-preview.supabase.co'
    /** The live project, which must never offer the shortcut (see .env.production) */
    const PRODUCTION_URL = 'https://cdcvedgnkamejhhowach.supabase.co'

    const configure = (url: string) => {
      vi.stubEnv('VITE_SUPABASE_URL', url)
      vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key')
      resetSupabaseConfigCache()
    }

    const withPreviewCredentials = () => {
      vi.stubEnv('VITE_TEST_USER_EMAIL', 'preview@example.com')
      vi.stubEnv('VITE_TEST_USER_PASSWORD', 'preview-secret')
    }

    beforeEach(() => {
      // Absent unless a test opts in, as they are in every build but the preview one
      vi.stubEnv('VITE_TEST_USER_EMAIL', '')
      vi.stubEnv('VITE_TEST_USER_PASSWORD', '')
    })

    describe('local seeded account', () => {
      it('is offered in a dev build against a local instance', () => {
        vi.stubEnv('DEV', true)
        configure('http://127.0.0.1:54321')

        expect(getTestUser()).toEqual({
          email: 'dev@test.local',
          password: 'password123',
          label: 'local development',
        })
        expect(isTestSignInAvailable()).toBe(true)
      })

      it('is never offered in a production build, even against localhost', () => {
        vi.stubEnv('DEV', false)
        configure('http://127.0.0.1:54321')

        expect(isTestSignInAvailable()).toBe(false)
      })

      it('is never offered against a remote project', () => {
        vi.stubEnv('DEV', true)
        configure(PREVIEW_URL)

        expect(isTestSignInAvailable()).toBe(false)
      })
    })

    describe('preview credentials', () => {
      it('are used in a production build against a hosted project', () => {
        vi.stubEnv('DEV', false)
        withPreviewCredentials()
        configure(PREVIEW_URL)

        expect(getTestUser()).toEqual({
          email: 'preview@example.com',
          password: 'preview-secret',
          label: 'shared preview account',
        })
      })

      it('take precedence over the seeded account', () => {
        vi.stubEnv('DEV', true)
        withPreviewCredentials()
        configure('http://127.0.0.1:54321')

        expect(getTestUser()?.email).toBe('preview@example.com')
      })

      it.each([
        ['email only', 'preview@example.com', ''],
        ['password only', '', 'preview-secret'],
      ])('do nothing with %s', (_label, email, password) => {
        vi.stubEnv('DEV', false)
        vi.stubEnv('VITE_TEST_USER_EMAIL', email)
        vi.stubEnv('VITE_TEST_USER_PASSWORD', password)
        configure(PREVIEW_URL)

        expect(getTestUser()).toBeNull()
      })
    })

    it('is absent from an ordinary production build', () => {
      vi.stubEnv('DEV', false)
      configure(PRODUCTION_URL)

      expect(getTestUser()).toBeNull()
    })

    it('is refused against the production project even with credentials compiled in', () => {
      vi.stubEnv('DEV', true)
      withPreviewCredentials()
      configure(PRODUCTION_URL)

      expect(getTestUser()).toBeNull()
    })

    it('is absent when accounts are unconfigured', () => {
      vi.stubEnv('DEV', true)
      withPreviewCredentials()
      vi.stubEnv('VITE_SUPABASE_URL', '')
      vi.stubEnv('VITE_SUPABASE_ANON_KEY', '')
      resetSupabaseConfigCache()

      expect(getTestUser()).toBeNull()
    })
  })

  it('memoises the result', () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://abc.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key')

    const first = getSupabaseConfig()
    expect(getSupabaseConfig()).toBe(first)
  })
})
