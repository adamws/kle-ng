import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const mocks = vi.hoisted(() => ({
  isAuthConfigured: vi.fn(() => true),
  getSupabaseClient: vi.fn(),
}))

vi.mock('@/config/supabase', () => ({
  AUTH_STORAGE_KEY: 'kle-ng-auth',
  isAuthConfigured: mocks.isAuthConfigured,
}))

vi.mock('@/utils/supabase-loader', () => ({
  getSupabaseClient: mocks.getSupabaseClient,
}))

import { SHORT_LINK_TOO_LARGE, useShortLinksStore } from '../short-links'
import { MAX_SHORT_LINK_PAYLOAD_LENGTH } from '@/utils/short-links'

/** Minimal stand-in: create_short_link is the only call this store makes. */
function fakeClient(result: { data?: unknown; error?: unknown } = { data: '7kQ2mBx9Lp' }) {
  return {
    rpc: vi.fn(async () => ({ data: result.data ?? null, error: result.error ?? null })),
  }
}

describe('Short Links Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mocks.isAuthConfigured.mockReturnValue(true)
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  describe('create', () => {
    it('calls the RPC with the payload and returns the id', async () => {
      const client = fakeClient()
      mocks.getSupabaseClient.mockResolvedValue(client)
      const store = useShortLinksStore()

      await expect(store.create('compressed')).resolves.toBe('7kQ2mBx9Lp')

      expect(client.rpc).toHaveBeenCalledWith('create_short_link', { payload: 'compressed' })
      expect(store.errorMessage).toBeNull()
      expect(store.busy).toBe(false)
    })

    it('rejects an oversized payload locally, without loading the client', async () => {
      const store = useShortLinksStore()

      await expect(store.create('x'.repeat(MAX_SHORT_LINK_PAYLOAD_LENGTH + 1))).resolves.toBeNull()

      expect(mocks.getSupabaseClient).not.toHaveBeenCalled()
      expect(store.errorMessage).toBe(SHORT_LINK_TOO_LARGE)
    })

    it('ignores a second call while one is in flight', async () => {
      const client = fakeClient()
      mocks.getSupabaseClient.mockResolvedValue(client)
      const store = useShortLinksStore()

      const first = store.create('compressed')
      const second = store.create('compressed')

      await expect(second).resolves.toBeNull()
      await first
      expect(client.rpc).toHaveBeenCalledTimes(1)
    })

    it('does not report a previous failure as the reason for an in-flight call', async () => {
      // The caller renders errorMessage for any null return, so a message left over
      // from an earlier attempt would be shown as the cause of a request that is still
      // running and about to succeed.
      mocks.getSupabaseClient.mockResolvedValue(fakeClient({ error: { message: 'boom' } }))
      const store = useShortLinksStore()

      await expect(store.create('compressed')).resolves.toBeNull()
      expect(store.errorMessage).toBe('boom')

      mocks.getSupabaseClient.mockResolvedValue(fakeClient())
      const inFlight = store.create('compressed')
      await expect(store.create('compressed')).resolves.toBeNull()
      expect(store.errorMessage).toBeNull()

      await expect(inFlight).resolves.toBe('7kQ2mBx9Lp')
    })

    it('clears busy after a failure', async () => {
      mocks.getSupabaseClient.mockResolvedValue(fakeClient({ error: { message: 'boom' } }))
      const store = useShortLinksStore()

      await expect(store.create('compressed')).resolves.toBeNull()
      expect(store.busy).toBe(false)
      expect(store.errorMessage).toBe('boom')
    })

    it('fails when accounts are not configured', async () => {
      mocks.isAuthConfigured.mockReturnValue(false)
      const store = useShortLinksStore()

      await expect(store.create('compressed')).resolves.toBeNull()
      expect(store.errorMessage).toBe('Accounts are not configured')
    })

    it('rejects a non-string response', async () => {
      mocks.getSupabaseClient.mockResolvedValue(fakeClient({ data: 42 }))
      const store = useShortLinksStore()

      await expect(store.create('compressed')).resolves.toBeNull()
      expect(store.errorMessage).toContain('Unexpected response')
    })
  })

  describe('describeError', () => {
    const cases: Array<[string, string]> = [
      [
        'short_link_auth_required',
        'Your session has expired. Sign in again to create a short link.',
      ],
      ['new row violates check constraint "short_links_payload_length"', SHORT_LINK_TOO_LARGE],
      [
        'short_link_rate_limit_exceeded',
        'You have created a lot of short links recently. Please try again later.',
      ],
      [
        'short_link_id_collision',
        'Could not create a short link for this layout. Please try again.',
      ],
      ['PGRST202', 'Short links are not available on this server yet.'],
      [
        'Could not find the function public.create_short_link',
        'Short links are not available on this server yet.',
      ],
      [
        'permission denied for function create_short_link',
        'You need to be signed in to create a short link.',
      ],
    ]

    it.each(cases)('translates %s', async (dbMessage, expected) => {
      mocks.getSupabaseClient.mockResolvedValue(fakeClient({ error: { message: dbMessage } }))
      const store = useShortLinksStore()

      await store.create('compressed')

      expect(store.errorMessage).toBe(expected)
    })

    it('falls back to the raw message for anything unrecognised', async () => {
      mocks.getSupabaseClient.mockResolvedValue(fakeClient({ error: { message: 'weird failure' } }))
      const store = useShortLinksStore()

      await store.create('compressed')

      expect(store.errorMessage).toBe('weird failure')
    })
  })

  describe('reset', () => {
    it('clears state for the next user', async () => {
      mocks.isAuthConfigured.mockReturnValue(false)
      const store = useShortLinksStore()
      await store.create('compressed')
      expect(store.errorMessage).not.toBeNull()

      store.reset()

      expect(store.errorMessage).toBeNull()
      expect(store.busy).toBe(false)
    })
  })
})
