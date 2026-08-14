import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  captureReturnUrl,
  clearAuthParamsFromUrl,
  hasAuthCallbackParams,
  readAuthCallbackError,
  restoreReturnUrl,
} from '../auth-return-url'

/**
 * These tests guard the interaction between the OAuth callback and the editor's use of
 * the URL fragment (#share= / #url= / #gist=). A regression here silently drops shared
 * layouts when a user signs in.
 */

const BASE = 'https://editor.keyboard-tools.xyz/'

function setLocation(href: string) {
  const url = new URL(href)
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
}

describe('auth-return-url', () => {
  beforeEach(() => {
    sessionStorage.clear()
    setLocation(BASE)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('hasAuthCallbackParams', () => {
    it('detects a PKCE code', () => {
      expect(hasAuthCallbackParams('?code=abc123')).toBe(true)
    })

    it('detects a provider error', () => {
      expect(hasAuthCallbackParams('?error=access_denied')).toBe(true)
    })

    it('ignores an ordinary URL', () => {
      expect(hasAuthCallbackParams('')).toBe(false)
      expect(hasAuthCallbackParams('?foo=bar')).toBe(false)
    })
  })

  describe('restoreReturnUrl', () => {
    it('restores a #share= fragment after an OAuth callback', () => {
      captureReturnUrl(`${BASE}#share=NrDeCIGN+abc`)
      setLocation(`${BASE}?code=abc123`)

      restoreReturnUrl()

      expect(window.location.hash).toBe('#share=NrDeCIGN+abc')
      // The PKCE code must survive — supabase-js still needs to exchange it
      expect(window.location.search).toBe('?code=abc123')
    })

    it('restores #url= and #gist= fragments too', () => {
      for (const hash of ['#url=https://example.com/l.json', '#gist=abc123']) {
        sessionStorage.clear()
        captureReturnUrl(`${BASE}${hash}`)
        setLocation(`${BASE}?code=abc123`)

        restoreReturnUrl()

        expect(window.location.hash).toBe(hash)
      }
    })

    it('does nothing on a normal page load', () => {
      captureReturnUrl(`${BASE}#share=abc`)
      setLocation(`${BASE}?foo=bar`)

      restoreReturnUrl()

      expect(window.location.hash).toBe('')
      expect(window.location.search).toBe('?foo=bar')
    })

    it('does not clobber a fragment the callback already carries', () => {
      captureReturnUrl(`${BASE}#share=saved`)
      setLocation(`${BASE}?code=abc123#share=current`)

      restoreReturnUrl()

      expect(window.location.hash).toBe('#share=current')
    })

    it('consumes the stored value so a later load does not resurrect it', () => {
      captureReturnUrl(`${BASE}#share=abc`)
      setLocation(`${BASE}?code=abc123`)
      restoreReturnUrl()

      setLocation(`${BASE}?code=def456`)
      restoreReturnUrl()

      expect(window.location.hash).toBe('')
    })

    it('is a no-op when nothing was captured', () => {
      setLocation(`${BASE}?code=abc123`)
      expect(() => restoreReturnUrl()).not.toThrow()
      expect(window.location.hash).toBe('')
    })

    it('survives sessionStorage being unavailable', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('denied')
      })
      setLocation(`${BASE}?code=abc123`)

      expect(() => restoreReturnUrl()).not.toThrow()
    })
  })

  describe('clearAuthParamsFromUrl', () => {
    it('removes OAuth params while preserving the fragment', () => {
      setLocation(`${BASE}?code=abc123&state=xyz#share=keepme`)

      clearAuthParamsFromUrl()

      expect(window.location.search).toBe('')
      expect(window.location.hash).toBe('#share=keepme')
    })

    it('preserves unrelated query parameters', () => {
      setLocation(`${BASE}?code=abc123&foo=bar`)

      clearAuthParamsFromUrl()

      expect(window.location.search).toBe('?foo=bar')
    })

    it('leaves a clean URL untouched', () => {
      setLocation(`${BASE}?foo=bar#share=abc`)

      clearAuthParamsFromUrl()

      expect(window.location.search).toBe('?foo=bar')
      expect(window.location.hash).toBe('#share=abc')
    })
  })

  describe('readAuthCallbackError', () => {
    it('prefers the human-readable description', () => {
      expect(readAuthCallbackError('?error=access_denied&error_description=User+said+no')).toBe(
        'User said no',
      )
    })

    it('falls back to the error code', () => {
      expect(readAuthCallbackError('?error=access_denied')).toBe('access_denied')
    })

    it('returns null when there is no error', () => {
      expect(readAuthCallbackError('?code=abc')).toBeNull()
    })
  })
})
