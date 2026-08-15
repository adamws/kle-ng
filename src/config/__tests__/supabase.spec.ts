import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  getSupabaseConfig,
  getTestUser,
  isAuthConfigured,
  isLocalSupabase,
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

    describe('local seeded account', () => {
      it('is offered in a dev build against a local instance', () => {
        vi.stubEnv('DEV', true)
        configure('http://127.0.0.1:54321')

        expect(getTestUser()).toEqual({
          email: 'dev@test.local',
          password: 'password123',
          label: 'local development',
        })
      })

      it('is never offered in a production build, even against localhost', () => {
        vi.stubEnv('DEV', false)
        configure('http://127.0.0.1:54321')

        expect(getTestUser()).toBeNull()
      })

      it('is never offered against a remote project', () => {
        vi.stubEnv('DEV', true)
        configure(PREVIEW_URL)

        expect(getTestUser()).toBeNull()
      })
    })

    // Preview used to compile in a shared password account of its own. It was removed
    // because the preview project has password sign-in disabled, so it could not work;
    // a preview build must now look exactly like production here.
    it.each([
      ['preview', PREVIEW_URL],
      ['production', PRODUCTION_URL],
    ])('is absent from a %s build', (_label, url) => {
      vi.stubEnv('DEV', false)
      configure(url)

      expect(getTestUser()).toBeNull()
    })

    // The env vars that used to carry them are gone; setting them must do nothing.
    it('ignores VITE_TEST_USER_* if something still injects them', () => {
      vi.stubEnv('DEV', false)
      vi.stubEnv('VITE_TEST_USER_EMAIL', 'preview@example.com')
      vi.stubEnv('VITE_TEST_USER_PASSWORD', 'preview-secret')
      configure(PREVIEW_URL)

      expect(getTestUser()).toBeNull()
    })

    it('is absent when accounts are unconfigured', () => {
      vi.stubEnv('DEV', true)
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
