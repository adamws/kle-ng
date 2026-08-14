import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  getSupabaseConfig,
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

    it('offers the test-user shortcut in a dev build against a local instance', () => {
      vi.stubEnv('DEV', true)
      configure('http://127.0.0.1:54321')

      expect(isTestSignInAvailable()).toBe(true)
    })

    it('never offers the shortcut in a production build, even against localhost', () => {
      vi.stubEnv('DEV', false)
      configure('http://127.0.0.1:54321')

      expect(isTestSignInAvailable()).toBe(false)
    })

    it('never offers the shortcut against a remote project', () => {
      vi.stubEnv('DEV', true)
      configure('https://cdcvedgnkamejhhowach.supabase.co')

      expect(isTestSignInAvailable()).toBe(false)
    })
  })

  it('memoises the result', () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://abc.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key')

    const first = getSupabaseConfig()
    expect(getSupabaseConfig()).toBe(first)
  })
})
