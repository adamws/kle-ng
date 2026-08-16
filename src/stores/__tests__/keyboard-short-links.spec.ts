import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import * as LZString from 'lz-string'

const mocks = vi.hoisted(() => ({
  takeShortLinkIdFromUrl: vi.fn<() => string | null>(() => null),
  resolveShortLinkPayload: vi.fn<(id: string) => Promise<string | null>>(),
  extractLayoutFromCurrentUrl: vi.fn(() => null),
  showError: vi.fn(),
  showSuccess: vi.fn(),
  showInfo: vi.fn(() => 'toast-id'),
  removeToast: vi.fn(),
}))

// Partial: only the two entry points are stubbed. restoreShortLinkOnFailure() stays
// real so the retry path is exercised rather than mocked away, and ShortLinkError has
// to be the real class for `instanceof`.
vi.mock('@/utils/short-links', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/utils/short-links')>()),
  takeShortLinkIdFromUrl: mocks.takeShortLinkIdFromUrl,
  resolveShortLinkPayload: mocks.resolveShortLinkPayload,
}))

vi.mock('../../utils/url-sharing', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../utils/url-sharing')>()),
  extractLayoutFromCurrentUrl: mocks.extractLayoutFromCurrentUrl,
}))

vi.mock('../../composables/useToast', () => ({
  toast: {
    showError: mocks.showError,
    showSuccess: mocks.showSuccess,
    showInfo: mocks.showInfo,
    removeToast: mocks.removeToast,
  },
  // The real one only schedules a delayed toast and a minimum-visible delay, neither of
  // which these tests assert on — and its timers would make every case wait 500ms.
  beginLoadingToast: () => ({
    finish: async () => {},
    cancel: () => {},
  }),
}))

import { useKeyboardStore } from '../keyboard'
import { ShortLinkError } from '@/utils/short-links'

/** A payload in the format a short link stores: lz-string compressed KLE. */
const payloadFor = (kle: unknown) => LZString.compressToEncodedURIComponent(JSON.stringify(kle))

const TWO_KEY_PAYLOAD = payloadFor([['A', 'B']])
const VALID_ID = '7kQ2mBx9Lp'

// The restore and hash-clearing paths both write through history.replaceState, so the
// address bar has to be observable here.
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

describe('Keyboard Store — short links', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mocks.takeShortLinkIdFromUrl.mockReturnValue(null)
    mocks.extractLayoutFromCurrentUrl.mockReturnValue(null)
    mockLocation.href = 'http://localhost:3000/'
    mockLocation.origin = 'http://localhost:3000'
    mockLocation.pathname = '/'
    mockLocation.search = ''
    mockLocation.hash = ''
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  describe('loadFromShortLink', () => {
    it('loads the resolved payload into the editor', async () => {
      mocks.resolveShortLinkPayload.mockResolvedValue(TWO_KEY_PAYLOAD)
      const store = useKeyboardStore()

      await expect(store.loadFromShortLink(VALID_ID)).resolves.toBe(true)

      expect(mocks.resolveShortLinkPayload).toHaveBeenCalledWith(VALID_ID)
      expect(store.keys).toHaveLength(2)
      expect(mocks.showSuccess).toHaveBeenCalled()
    })

    it('reports an unknown id without loading anything', async () => {
      mocks.resolveShortLinkPayload.mockResolvedValue(null)
      const store = useKeyboardStore()

      await expect(store.loadFromShortLink(VALID_ID)).resolves.toBe(false)

      expect(store.keys).toHaveLength(0)
      expect(mocks.showError).toHaveBeenCalledWith(expect.any(String), 'Link Not Found')
    })

    it('surfaces a resolver failure as an error toast', async () => {
      mocks.resolveShortLinkPayload.mockRejectedValue(new Error('Could not reach the service.'))
      const store = useKeyboardStore()

      await expect(store.loadFromShortLink(VALID_ID)).resolves.toBe(false)

      expect(mocks.showError).toHaveBeenCalledWith('Could not reach the service.', 'Load Failed')
    })

    describe('restoring ?s= after a retryable failure', () => {
      // The id is consumed before the fetch, so a transient failure would otherwise
      // leave nothing for a reload to retry — the user's instinctive response to
      // "could not reach the service" would silently load the sample layout instead.
      it.each(['network', 'server'] as const)(
        'puts the id back after a %s failure',
        async (code) => {
          mocks.resolveShortLinkPayload.mockRejectedValue(new ShortLinkError(code, 'nope'))
          const store = useKeyboardStore()

          await expect(store.loadFromShortLink(VALID_ID)).resolves.toBe(false)

          expect(mockHistory.replaceState).toHaveBeenCalledWith(
            {},
            '',
            expect.stringContaining(`s=${VALID_ID}`),
          )
        },
      )

      it.each(['invalid-id', 'unconfigured'] as const)(
        'leaves the address bar clean after a %s failure, which no reload can fix',
        async (code) => {
          mocks.resolveShortLinkPayload.mockRejectedValue(new ShortLinkError(code, 'nope'))
          const store = useKeyboardStore()

          await expect(store.loadFromShortLink(VALID_ID)).resolves.toBe(false)

          expect(mockHistory.replaceState).not.toHaveBeenCalled()
        },
      )

      it('leaves the address bar clean after an unknown id', async () => {
        mocks.resolveShortLinkPayload.mockResolvedValue(null)
        const store = useKeyboardStore()

        await expect(store.loadFromShortLink(VALID_ID)).resolves.toBe(false)

        expect(mockHistory.replaceState).not.toHaveBeenCalled()
      })
    })

    it('clears a layout-bearing fragment that came with the short link', async () => {
      // `/?s=ID#gist=X` must not load the short link now and the gist on the next
      // reload — one address, two layouts.
      mockLocation.href = 'http://localhost:3000/?s=' + VALID_ID + '#gist=abc'
      mockLocation.hash = '#gist=abc'
      mocks.resolveShortLinkPayload.mockResolvedValue(TWO_KEY_PAYLOAD)
      const store = useKeyboardStore()

      await expect(store.loadFromShortLink(VALID_ID)).resolves.toBe(true)

      expect(mockHistory.replaceState).toHaveBeenCalledWith(
        {},
        expect.anything(),
        'http://localhost:3000/?s=' + VALID_ID,
      )
    })

    it('leaves an unrelated fragment alone', async () => {
      mockLocation.href = 'http://localhost:3000/#some-anchor'
      mockLocation.hash = '#some-anchor'
      mocks.resolveShortLinkPayload.mockResolvedValue(TWO_KEY_PAYLOAD)
      const store = useKeyboardStore()

      await expect(store.loadFromShortLink(VALID_ID)).resolves.toBe(true)

      expect(mockHistory.replaceState).not.toHaveBeenCalled()
    })

    it('routes the payload through the decode guards', async () => {
      // Not a compressed KLE payload — decodeLayoutFromUrl must reject it rather than
      // anything reaching Serial.deserialize raw.
      mocks.resolveShortLinkPayload.mockResolvedValue('not-a-valid-payload')
      const store = useKeyboardStore()

      await expect(store.loadFromShortLink(VALID_ID)).resolves.toBe(false)

      expect(store.keys).toHaveLength(0)
      expect(mocks.showError).toHaveBeenCalledWith(expect.any(String), 'Load Failed')
    })
  })

  describe('startup dispatch', () => {
    it('resolves a ?s= id found at startup', async () => {
      mocks.takeShortLinkIdFromUrl.mockReturnValue(VALID_ID)
      mocks.resolveShortLinkPayload.mockResolvedValue(TWO_KEY_PAYLOAD)

      const store = useKeyboardStore()
      // initWithSample() is fire-and-forget from the store setup
      await vi.waitFor(() => expect(store.keys).toHaveLength(2))

      expect(mocks.resolveShortLinkPayload).toHaveBeenCalledWith(VALID_ID)
    })

    it('never touches the network when there is no ?s=', async () => {
      useKeyboardStore()
      await vi.waitFor(() => expect(mocks.takeShortLinkIdFromUrl).toHaveBeenCalled())

      expect(mocks.resolveShortLinkPayload).not.toHaveBeenCalled()
    })

    it('lets #share= win when a URL carries both, but still consumes the id', async () => {
      const shared = { keys: [{ labels: ['S'] }], meta: {} }
      mocks.extractLayoutFromCurrentUrl.mockReturnValue(shared as never)
      mocks.takeShortLinkIdFromUrl.mockReturnValue(VALID_ID)

      useKeyboardStore()
      await vi.waitFor(() => expect(mocks.extractLayoutFromCurrentUrl).toHaveBeenCalled())

      // The id is read (and therefore stripped) even though #share= handled the load
      expect(mocks.takeShortLinkIdFromUrl).toHaveBeenCalled()
      expect(mocks.resolveShortLinkPayload).not.toHaveBeenCalled()
    })
  })

  describe('encodeCurrentLayout', () => {
    it('produces the same payload a #share= link carries', () => {
      const store = useKeyboardStore()
      store.addKey()

      const payload = store.encodeCurrentLayout()

      expect(payload).toBe(store.generateShareUrl().split('#share=')[1])
    })
  })
})
