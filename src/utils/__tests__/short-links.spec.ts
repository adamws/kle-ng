import { describe, it, expect, beforeEach, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getSupabaseConfig: vi.fn<() => { url: string; anonKey: string } | null>(() => ({
    url: 'https://project.supabase.co',
    anonKey: 'anon-key',
  })),
  getSupabaseClient: vi.fn(),
}))

vi.mock('@/config/supabase', () => ({
  getSupabaseConfig: mocks.getSupabaseConfig,
}))

// Not imported by the module under test — asserted below to stay that way, since the
// whole point of the raw fetch is that an anonymous visitor never loads supabase-js.
vi.mock('@/utils/supabase-loader', () => ({
  getSupabaseClient: mocks.getSupabaseClient,
}))

import {
  SHORT_LINK_PARAM,
  ShortLinkError,
  buildShortLinkUrl,
  clearShortLinkFromUrl,
  isValidShortLinkId,
  resolveShortLinkPayload,
  restoreShortLinkOnFailure,
  takeShortLinkIdFromUrl,
} from '../short-links'

const VALID_ID = '7kQ2mBx9Lp' // what short_link_id() emits: 10 random base62 chars

// Mock window.location / window.history, following url-sharing.spec.ts
const mockLocation = {
  href: 'http://localhost:3000/',
  origin: 'http://localhost:3000',
  pathname: '/',
  search: '',
  hash: '',
}

const mockHistory = { replaceState: vi.fn() }

Object.defineProperty(window, 'location', { value: mockLocation, writable: true })
Object.defineProperty(window, 'history', { value: mockHistory, writable: true })

/** Point the mocked location at a full URL, keeping its parts consistent. */
function setLocation(href: string) {
  const url = new URL(href)
  mockLocation.href = href
  mockLocation.origin = url.origin
  mockLocation.pathname = url.pathname
  mockLocation.search = url.search
  mockLocation.hash = url.hash
}

function jsonResponse(body: string, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => JSON.parse(body),
  } as unknown as Response
}

describe('short-links', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getSupabaseConfig.mockReturnValue({
      url: 'https://project.supabase.co',
      anonKey: 'anon-key',
    })
    setLocation('http://localhost:3000/')
  })

  describe('isValidShortLinkId', () => {
    it('accepts the 10-character id the server emits', () => {
      expect(isValidShortLinkId(VALID_ID)).toBe(true)
    })

    it('accepts the full range the constraint allows', () => {
      // The range exists so ids can be lengthened later without a data migration
      expect(isValidShortLinkId('a'.repeat(8))).toBe(true)
      expect(isValidShortLinkId('a'.repeat(32))).toBe(true)
    })

    it('rejects ids outside the length bounds', () => {
      expect(isValidShortLinkId('a'.repeat(7))).toBe(false)
      expect(isValidShortLinkId('a'.repeat(33))).toBe(false)
      expect(isValidShortLinkId('')).toBe(false)
    })

    it('rejects anything non-alphanumeric', () => {
      // base62 only — '-' and '_' would be legal base64url but are deliberately not
      // used, so an id never needs percent-encoding and never looks like punctuation
      expect(isValidShortLinkId('7kQ2mBx9L-')).toBe(false)
      expect(isValidShortLinkId('7kQ2mBx9L_')).toBe(false)
      expect(isValidShortLinkId('7kQ2mBx9L+')).toBe(false)
      expect(isValidShortLinkId('7kQ2mBx9L=')).toBe(false)
      expect(isValidShortLinkId('../../etc/pw')).toBe(false)
    })
  })

  describe('buildShortLinkUrl', () => {
    it('builds from origin + pathname by default', () => {
      expect(buildShortLinkUrl(VALID_ID)).toBe(`http://localhost:3000/?s=${VALID_ID}`)
    })

    it('honours an explicit base', () => {
      expect(buildShortLinkUrl(VALID_ID, 'https://editor.keyboard-tools.xyz/')).toBe(
        `https://editor.keyboard-tools.xyz/?s=${VALID_ID}`,
      )
    })

    it('uses a query parameter, never a fragment', () => {
      expect(buildShortLinkUrl(VALID_ID)).not.toContain('#')
    })
  })

  describe('takeShortLinkIdFromUrl', () => {
    it('returns null and leaves history alone when there is no ?s=', () => {
      expect(takeShortLinkIdFromUrl()).toBeNull()
      expect(mockHistory.replaceState).not.toHaveBeenCalled()
    })

    it('returns the id and strips it from the URL', () => {
      setLocation(`http://localhost:3000/?s=${VALID_ID}`)

      expect(takeShortLinkIdFromUrl()).toBe(VALID_ID)
      expect(mockHistory.replaceState).toHaveBeenCalledWith({}, '', '/')
    })

    it('preserves the ?code= OAuth parameter and the fragment while stripping', () => {
      // The regression guard: clearShareFromUrl() drops the whole fragment, which would
      // destroy what restoreReturnUrl() had just put back. This must not.
      setLocation(`http://localhost:3000/?s=${VALID_ID}&code=abc#share=xyz`)

      expect(takeShortLinkIdFromUrl()).toBe(VALID_ID)
      expect(mockHistory.replaceState).toHaveBeenCalledWith({}, '', '/?code=abc#share=xyz')
    })

    it('strips an invalid id too, so a reload does not retry it', () => {
      setLocation('http://localhost:3000/?s=nope')

      expect(takeShortLinkIdFromUrl()).toBe('nope')
      expect(mockHistory.replaceState).toHaveBeenCalledWith({}, '', '/')
    })
  })

  describe('clearShortLinkFromUrl', () => {
    it('does nothing when the parameter is absent', () => {
      setLocation('http://localhost:3000/?other=1')
      clearShortLinkFromUrl()
      expect(mockHistory.replaceState).not.toHaveBeenCalled()
    })

    it('keeps unrelated query parameters', () => {
      setLocation(`http://localhost:3000/?a=1&${SHORT_LINK_PARAM}=${VALID_ID}&b=2`)
      clearShortLinkFromUrl()
      expect(mockHistory.replaceState).toHaveBeenCalledWith({}, '', '/?a=1&b=2')
    })
  })

  describe('restoreShortLinkOnFailure', () => {
    it.each(['network', 'server'] as const)(
      'puts the id back after a %s failure, which a retry could fix',
      (code) => {
        setLocation('http://localhost:3000/')
        restoreShortLinkOnFailure(VALID_ID, new ShortLinkError(code, 'x'))
        expect(mockHistory.replaceState).toHaveBeenCalledWith(
          {},
          '',
          `/?${SHORT_LINK_PARAM}=${VALID_ID}`,
        )
      },
    )

    it('puts the id back after a 5xx, which may pass on the next attempt', () => {
      setLocation('http://localhost:3000/')
      restoreShortLinkOnFailure(VALID_ID, new ShortLinkError('server', 'x', undefined, 503))
      expect(mockHistory.replaceState).toHaveBeenCalledWith(
        {},
        '',
        `/?${SHORT_LINK_PARAM}=${VALID_ID}`,
      )
    })

    // A 404 means the migration was never pushed to this project and a 401/403 means the
    // EXECUTE grant is gone. Both describe the deployment, so a reload only repeats them.
    it.each([404, 401, 403])('leaves it alone after a %i, which describes the deployment', (s) => {
      setLocation('http://localhost:3000/')
      restoreShortLinkOnFailure(VALID_ID, new ShortLinkError('server', 'x', undefined, s))
      expect(mockHistory.replaceState).not.toHaveBeenCalled()
    })

    // The regression this guards: `unconfigured` reads like a server problem, but it means
    // VITE_SUPABASE_* were absent at build time, so no reload can ever resolve the id.
    it('leaves it alone when accounts are unconfigured — it is baked into the bundle', () => {
      setLocation('http://localhost:3000/')
      restoreShortLinkOnFailure(VALID_ID, new ShortLinkError('unconfigured', 'x'))
      expect(mockHistory.replaceState).not.toHaveBeenCalled()
    })

    it('preserves other parameters and the fragment', () => {
      setLocation('http://localhost:3000/?a=1#anchor')
      restoreShortLinkOnFailure(VALID_ID, new ShortLinkError('network', 'x'))
      expect(mockHistory.replaceState).toHaveBeenCalledWith(
        {},
        '',
        `/?a=1&${SHORT_LINK_PARAM}=${VALID_ID}#anchor`,
      )
    })

    it('leaves the address bar alone for an invalid id — a reload cannot help', () => {
      setLocation('http://localhost:3000/')
      restoreShortLinkOnFailure(VALID_ID, new ShortLinkError('invalid-id', 'x'))
      expect(mockHistory.replaceState).not.toHaveBeenCalled()
    })

    it('leaves it alone for a non-ShortLinkError, e.g. a corrupt payload', () => {
      setLocation('http://localhost:3000/')
      restoreShortLinkOnFailure(VALID_ID, new Error('Failed to decode layout data'))
      expect(mockHistory.replaceState).not.toHaveBeenCalled()
    })

    it('does nothing when that id is already there', () => {
      setLocation(`http://localhost:3000/?${SHORT_LINK_PARAM}=${VALID_ID}`)
      restoreShortLinkOnFailure(VALID_ID, new ShortLinkError('network', 'x'))
      expect(mockHistory.replaceState).not.toHaveBeenCalled()
    })
  })

  describe('resolveShortLinkPayload', () => {
    it('posts to the RPC endpoint with both PostgREST headers', async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse('"compressed-payload"'))
      vi.stubGlobal('fetch', fetchMock)

      await expect(resolveShortLinkPayload(VALID_ID)).resolves.toBe('compressed-payload')

      const [url, init] = fetchMock.mock.calls[0]!
      expect(url).toBe('https://project.supabase.co/rest/v1/rpc/resolve_short_link')
      expect(init.method).toBe('POST')
      expect(init.headers.apikey).toBe('anon-key')
      expect(init.headers.Authorization).toBe('Bearer anon-key')
      expect(JSON.parse(init.body)).toEqual({ link_id: VALID_ID })
    })

    it('returns null for an unknown id — 200 with a null body, not a 404', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse('null')))

      await expect(resolveShortLinkPayload(VALID_ID)).resolves.toBeNull()
    })

    it('rejects a non-string body as a server error', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse('{"unexpected":true}')))

      await expect(resolveShortLinkPayload(VALID_ID)).rejects.toMatchObject({
        code: 'server',
      })
    })

    // The timeout has to span the body read too: `fetch` settles on headers, so a server
    // that answers and then stalls its body would otherwise hang startup forever.
    it('times out a stalled body instead of hanging', async () => {
      vi.useFakeTimers()
      try {
        let abortSignal: AbortSignal | undefined
        vi.stubGlobal(
          'fetch',
          vi.fn(async (_url: string, init: RequestInit) => {
            abortSignal = init.signal ?? undefined
            return {
              ok: true,
              status: 200,
              // Never settles on its own — only the abort can end this.
              json: () =>
                new Promise((_resolve, reject) => {
                  abortSignal?.addEventListener('abort', () => reject(new Error('aborted')))
                }),
            } as unknown as Response
          }),
        )

        // Caught inline rather than with `.rejects`, so the handler is attached before
        // the timers run and the rejection is never briefly unhandled.
        const pending = resolveShortLinkPayload(VALID_ID).catch((error: unknown) => error)

        await vi.advanceTimersByTimeAsync(20_000)

        expect(await pending).toMatchObject({ code: 'network' })
        expect(abortSignal?.aborted).toBe(true)
      } finally {
        vi.useRealTimers()
      }
    })

    it('reads a 404 as a missing function, not a missing link', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse('null', 404)))

      await expect(resolveShortLinkPayload(VALID_ID)).rejects.toMatchObject({
        code: 'server',
        message: 'Short links are not available on this server yet.',
      })
    })

    it('surfaces other HTTP failures', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse('null', 500)))

      await expect(resolveShortLinkPayload(VALID_ID)).rejects.toMatchObject({ code: 'server' })
    })

    it('reports a rejected fetch as a network failure', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))

      await expect(resolveShortLinkPayload(VALID_ID)).rejects.toMatchObject({ code: 'network' })
    })

    it('fails without calling fetch when Supabase is not configured', async () => {
      mocks.getSupabaseConfig.mockReturnValue(null)
      const fetchMock = vi.fn()
      vi.stubGlobal('fetch', fetchMock)

      await expect(resolveShortLinkPayload(VALID_ID)).rejects.toMatchObject({
        code: 'unconfigured',
      })
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('rejects an invalid id without calling fetch', async () => {
      const fetchMock = vi.fn()
      vi.stubGlobal('fetch', fetchMock)

      await expect(resolveShortLinkPayload('nope')).rejects.toBeInstanceOf(ShortLinkError)
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('never loads supabase-js — that is the reason this is a raw fetch', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse('"payload"')))

      await resolveShortLinkPayload(VALID_ID)

      expect(mocks.getSupabaseClient).not.toHaveBeenCalled()
    })
  })
})
