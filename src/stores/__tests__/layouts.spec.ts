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

import { MAX_PAYLOAD_LENGTH, useLayoutsStore } from '../layouts'

const ROW_A = {
  id: 'id-a',
  name: 'Alpha',
  payload: 'payload-a',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-02T00:00:00Z',
}
const ROW_B = {
  id: 'id-b',
  name: 'Beta',
  payload: 'payload-b',
  created_at: '2026-02-01T00:00:00Z',
  updated_at: '2026-02-02T00:00:00Z',
}

interface FakeOptions {
  select?: { data: unknown; error: unknown }
  insert?: { data: unknown; error: unknown }
  update?: { data: unknown; error: unknown }
  delete?: { data: unknown; error: unknown }
  quota?: number
}

/**
 * Minimal stand-in for the PostgREST query builder: every method chains, and awaiting
 * the builder resolves to whatever the operation was configured to return.
 */
function fakeClient(options: FakeOptions = {}) {
  const calls = {
    insert: [] as unknown[],
    update: [] as unknown[],
    eq: [] as unknown[][],
    deletes: 0,
  }
  let op: keyof FakeOptions = 'select'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const builder: any = {}
  builder.select = vi.fn(() => builder)
  builder.order = vi.fn(() => builder)
  builder.single = vi.fn(() => builder)
  builder.eq = vi.fn((column: string, value: unknown) => {
    calls.eq.push([column, value])
    return builder
  })
  builder.insert = vi.fn((payload: unknown) => {
    op = 'insert'
    calls.insert.push(payload)
    return builder
  })
  builder.update = vi.fn((payload: unknown) => {
    op = 'update'
    calls.update.push(payload)
    return builder
  })
  builder.delete = vi.fn(() => {
    op = 'delete'
    calls.deletes++
    return builder
  })
  builder.then = (resolve: (value: unknown) => unknown) =>
    Promise.resolve(options[op] ?? { data: null, error: null }).then(resolve)

  return {
    from: vi.fn(() => {
      op = 'select'
      return builder
    }),
    rpc: vi.fn(async () => ({ data: options.quota ?? 5, error: null })),
    calls,
  }
}

describe('layouts store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mocks.isAuthConfigured.mockReturnValue(true)
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  describe('fetchAll', () => {
    it('maps rows to camelCase and reads the quota from the database', async () => {
      mocks.getSupabaseClient.mockResolvedValue(
        fakeClient({ select: { data: [ROW_B, ROW_A], error: null }, quota: 7 }),
      )
      const store = useLayoutsStore()

      await store.fetchAll()

      expect(store.layouts).toEqual([
        {
          id: 'id-b',
          name: 'Beta',
          payload: 'payload-b',
          createdAt: '2026-02-01T00:00:00Z',
          updatedAt: '2026-02-02T00:00:00Z',
        },
        {
          id: 'id-a',
          name: 'Alpha',
          payload: 'payload-a',
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-02T00:00:00Z',
        },
      ])
      // The quota is defined by layout_quota(), not duplicated in the client
      expect(store.quota).toBe(7)
      expect(store.loaded).toBe(true)
    })

    it('does not refetch once loaded unless forced', async () => {
      const client = fakeClient({ select: { data: [ROW_A], error: null } })
      mocks.getSupabaseClient.mockResolvedValue(client)
      const store = useLayoutsStore()

      await store.fetchAll()
      await store.fetchAll()
      expect(client.from).toHaveBeenCalledTimes(1)

      await store.fetchAll(true)
      expect(client.from).toHaveBeenCalledTimes(2)
    })

    it('surfaces a failure without throwing', async () => {
      mocks.getSupabaseClient.mockResolvedValue(
        fakeClient({ select: { data: null, error: { message: 'network down' } } }),
      )
      const store = useLayoutsStore()

      await expect(store.fetchAll()).resolves.toBeUndefined()

      expect(store.errorMessage).toBe('network down')
      expect(store.loaded).toBe(false)
      expect(store.loading).toBe(false)
    })

    it('refuses to run when accounts are not configured', async () => {
      mocks.isAuthConfigured.mockReturnValue(false)
      mocks.getSupabaseClient.mockResolvedValue(fakeClient())
      const store = useLayoutsStore()

      await store.fetchAll()

      expect(store.errorMessage).toBe('Accounts are not configured')
    })
  })

  describe('save', () => {
    it('inserts without a user_id — the schema defaults it from the JWT', async () => {
      const client = fakeClient({ insert: { data: ROW_A, error: null } })
      mocks.getSupabaseClient.mockResolvedValue(client)
      const store = useLayoutsStore()

      const saved = await store.save('  Alpha  ', 'payload-a')

      expect(saved?.id).toBe('id-a')
      expect(client.calls.insert).toEqual([{ name: 'Alpha', payload: 'payload-a' }])
      expect(store.layouts).toHaveLength(1)
    })

    it('translates the quota trigger into an actionable message', async () => {
      mocks.getSupabaseClient.mockResolvedValue(
        fakeClient({ insert: { data: null, error: { message: 'layout_quota_exceeded' } } }),
      )
      const store = useLayoutsStore()

      const saved = await store.save('Sixth', 'payload')

      expect(saved).toBeNull()
      expect(store.errorMessage).toBe(
        'You have reached your saved layout limit. Delete one to make room.',
      )
      expect(store.layouts).toHaveLength(0)
    })

    it('clears the busy flag after a failure', async () => {
      mocks.getSupabaseClient.mockResolvedValue(
        fakeClient({ insert: { data: null, error: { message: 'boom' } } }),
      )
      const store = useLayoutsStore()

      await store.save('Alpha', 'payload')

      expect(store.busy).toBe(false)
    })

    // The DB constraint is the real limit; this only saves the user a round trip.
    it('rejects an oversized payload without contacting the database', async () => {
      const client = fakeClient({ insert: { data: ROW_A, error: null } })
      mocks.getSupabaseClient.mockResolvedValue(client)
      const store = useLayoutsStore()

      const saved = await store.save('Huge', 'x'.repeat(MAX_PAYLOAD_LENGTH + 1))

      expect(saved).toBeNull()
      // Same wording the layouts_payload_length constraint would have produced
      expect(store.errorMessage).toBe('This layout is too large to save.')
      expect(mocks.getSupabaseClient).not.toHaveBeenCalled()
      expect(client.calls.insert).toEqual([])
      expect(store.busy).toBe(false)
    })

    it('accepts a payload exactly at the limit', async () => {
      const client = fakeClient({ insert: { data: ROW_A, error: null } })
      mocks.getSupabaseClient.mockResolvedValue(client)
      const store = useLayoutsStore()

      expect(await store.save('Alpha', 'x'.repeat(MAX_PAYLOAD_LENGTH))).not.toBeNull()
      expect(client.calls.insert).toHaveLength(1)
    })
  })

  describe('overwrite and rename', () => {
    it('replaces the row in place and scopes the update by id', async () => {
      const updated = { ...ROW_A, payload: 'payload-new', updated_at: '2026-03-01T00:00:00Z' }
      const client = fakeClient({
        select: { data: [ROW_A], error: null },
        update: { data: updated, error: null },
      })
      mocks.getSupabaseClient.mockResolvedValue(client)
      const store = useLayoutsStore()
      await store.fetchAll()

      const result = await store.overwrite('id-a', 'payload-new')

      expect(result?.payload).toBe('payload-new')
      expect(client.calls.update).toEqual([{ payload: 'payload-new' }])
      expect(client.calls.eq).toContainEqual(['id', 'id-a'])
      expect(store.layouts).toHaveLength(1)
      expect(store.layouts[0]!.payload).toBe('payload-new')
    })

    it('trims the new name and never sends updated_at', async () => {
      const client = fakeClient({ update: { data: { ...ROW_A, name: 'Renamed' }, error: null } })
      mocks.getSupabaseClient.mockResolvedValue(client)
      const store = useLayoutsStore()

      await store.rename('id-a', '  Renamed  ')

      expect(client.calls.update).toEqual([{ name: 'Renamed' }])
    })

    it('rejects an oversized overwrite without contacting the database', async () => {
      const client = fakeClient({ update: { data: ROW_A, error: null } })
      mocks.getSupabaseClient.mockResolvedValue(client)
      const store = useLayoutsStore()

      const result = await store.overwrite('id-a', 'x'.repeat(MAX_PAYLOAD_LENGTH + 1))

      expect(result).toBeNull()
      expect(store.errorMessage).toBe('This layout is too large to save.')
      expect(mocks.getSupabaseClient).not.toHaveBeenCalled()
      expect(client.calls.update).toEqual([])
      expect(store.busy).toBe(false)
    })
  })

  describe('remove', () => {
    it('drops the row locally on success', async () => {
      const client = fakeClient({
        select: { data: [ROW_A, ROW_B], error: null },
        delete: { data: null, error: null },
      })
      mocks.getSupabaseClient.mockResolvedValue(client)
      const store = useLayoutsStore()
      await store.fetchAll()

      expect(await store.remove('id-a')).toBe(true)

      expect(store.layouts.map((l) => l.id)).toEqual(['id-b'])
      expect(client.calls.eq).toContainEqual(['id', 'id-a'])
    })

    it('keeps the row when the delete fails', async () => {
      const client = fakeClient({
        select: { data: [ROW_A], error: null },
        delete: { data: null, error: { message: 'offline' } },
      })
      mocks.getSupabaseClient.mockResolvedValue(client)
      const store = useLayoutsStore()
      await store.fetchAll()

      expect(await store.remove('id-a')).toBe(false)

      expect(store.layouts).toHaveLength(1)
      expect(store.errorMessage).toBe('offline')
    })
  })

  describe('quota state', () => {
    it('reports full at the limit', async () => {
      const rows = Array.from({ length: 5 }, (_, i) => ({ ...ROW_A, id: `id-${i}` }))
      mocks.getSupabaseClient.mockResolvedValue(
        fakeClient({ select: { data: rows, error: null }, quota: 5 }),
      )
      const store = useLayoutsStore()

      await store.fetchAll()

      expect(store.count).toBe(5)
      expect(store.isFull).toBe(true)
    })

    it('is not full below the limit', async () => {
      mocks.getSupabaseClient.mockResolvedValue(
        fakeClient({ select: { data: [ROW_A], error: null }, quota: 5 }),
      )
      const store = useLayoutsStore()

      await store.fetchAll()

      expect(store.isFull).toBe(false)
    })
  })

  describe('reset', () => {
    it('clears cached rows so the next user starts clean', async () => {
      mocks.getSupabaseClient.mockResolvedValue(
        fakeClient({ select: { data: [ROW_A, ROW_B], error: null } }),
      )
      const store = useLayoutsStore()
      await store.fetchAll()

      store.reset()

      expect(store.layouts).toEqual([])
      expect(store.loaded).toBe(false)
      expect(store.errorMessage).toBeNull()
    })
  })
})
