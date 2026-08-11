import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { LayoutPrefetcher, isCancellation } from '../layout-prefetcher'
import type { LayoutSource, PreviewLayout } from '../layout-source'

/**
 * A source whose downloads are resolved manually, so tests can observe the
 * pool while requests are still in flight.
 */
interface Deferred {
  name: string
  resolve: (body: unknown) => void
  reject: (error: Error) => void
  aborted: boolean
}

let pending: Deferred[] = []

const testSource: LayoutSource = {
  id: 'qmk',
  listUrl: 'https://example.test/list.json',
  layoutUrl: (name) => `https://example.test/${name}.json`,
  toPreviewLayout: (raw, name) =>
    ({
      name,
      raw,
      keyboard: { keys: [], meta: {} },
      variants: [{ label: 'Layout', keys: [] }],
      keyCount: 0,
      tooLarge: false,
    }) as unknown as PreviewLayout,
}

function settle(name: string, body: unknown = { ok: true }) {
  const entry = pending.find((p) => p.name === name)
  if (!entry) throw new Error(`no pending request for ${name}`)
  entry.resolve(body)
  return flush()
}

/** Let the fetch/JSON promise chain run to completion */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

beforeEach(() => {
  pending = []
  vi.stubGlobal('fetch', (url: string, init?: { signal?: AbortSignal }) => {
    const name = url.replace('https://example.test/', '').replace('.json', '')
    return new Promise((resolve, reject) => {
      const entry: Deferred = {
        name,
        aborted: false,
        resolve: (body: unknown) =>
          resolve({ ok: true, status: 200, statusText: 'OK', json: async () => body }),
        reject,
      }
      init?.signal?.addEventListener('abort', () => {
        entry.aborted = true
        const error = new Error('Aborted')
        error.name = 'AbortError'
        reject(error)
      })
      pending.push(entry)
    })
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('LayoutPrefetcher', () => {
  it('never exceeds the concurrency limit', async () => {
    const prefetcher = new LayoutPrefetcher(testSource, { concurrency: 3 })
    prefetcher.prefetch(['a', 'b', 'c', 'd', 'e', 'f'])
    await flush()

    expect(pending).toHaveLength(3)
    expect(prefetcher.activeCount).toBe(3)

    await settle('a')
    expect(pending.length).toBe(4) // the fourth started once a slot freed
    prefetcher.dispose()
  })

  it('caches results so a repeat request makes no second download', async () => {
    const prefetcher = new LayoutPrefetcher(testSource)
    const first = prefetcher.request('planck')
    await flush()
    await settle('planck')
    await first

    expect(pending).toHaveLength(1)
    expect(prefetcher.peek('planck')).toBeDefined()

    await prefetcher.request('planck')
    expect(pending).toHaveLength(1)
    prefetcher.dispose()
  })

  it('shares one download between concurrent requests for the same name', async () => {
    const prefetcher = new LayoutPrefetcher(testSource)
    const a = prefetcher.request('planck')
    const b = prefetcher.request('planck')
    await flush()

    expect(pending).toHaveLength(1)
    await settle('planck')
    expect(await a).toBe(await b)
    prefetcher.dispose()
  })

  it('runs high priority requests ahead of queued low priority ones', async () => {
    const prefetcher = new LayoutPrefetcher(testSource, { concurrency: 1 })
    prefetcher.prefetch(['low1', 'low2'])
    await flush()
    expect(pending.map((p) => p.name)).toEqual(['low1'])

    const hovered = prefetcher.request('hovered', 'high')
    await settle('low1')

    // 'hovered' jumped ahead of the queued 'low2'
    expect(pending.map((p) => p.name)).toEqual(['low1', 'hovered'])
    await settle('hovered')
    await hovered
    prefetcher.dispose()
  })

  it('cancelLowPriority aborts speculative work but not the hovered request', async () => {
    const prefetcher = new LayoutPrefetcher(testSource, { concurrency: 4 })
    const hovered = prefetcher.request('hovered', 'high')
    prefetcher.prefetch(['low1', 'low2'])
    await flush()
    expect(pending).toHaveLength(3)

    prefetcher.cancelLowPriority()
    await flush()

    expect(pending.find((p) => p.name === 'low1')!.aborted).toBe(true)
    expect(pending.find((p) => p.name === 'low2')!.aborted).toBe(true)
    expect(pending.find((p) => p.name === 'hovered')!.aborted).toBe(false)

    await settle('hovered')
    await expect(hovered).resolves.toBeDefined()
    prefetcher.dispose()
  })

  it('caps low priority work per query and resets the budget on cancel', async () => {
    const prefetcher = new LayoutPrefetcher(testSource, { concurrency: 10, queryCap: 2 })
    prefetcher.prefetch(['a', 'b', 'c', 'd'])
    await flush()

    expect(pending.map((p) => p.name)).toEqual(['a', 'b'])

    prefetcher.cancelLowPriority()
    prefetcher.prefetch(['e', 'f'])
    await flush()

    expect(pending.map((p) => p.name)).toEqual(['a', 'b', 'e', 'f'])
    prefetcher.dispose()
  })

  it('caches failures so a broken entry is not re-fetched on every hover', async () => {
    const prefetcher = new LayoutPrefetcher(testSource)
    const failing = prefetcher.request('broken')
    await flush()
    pending[0]!.reject(new Error('boom'))

    await expect(failing).rejects.toThrow('boom')

    await expect(prefetcher.request('broken')).rejects.toThrow('boom')
    expect(pending).toHaveLength(1) // no second network call
    prefetcher.dispose()
  })

  it('does not cache aborted requests', async () => {
    const prefetcher = new LayoutPrefetcher(testSource, { concurrency: 4 })
    // Capture the rejection up front so the promise is never momentarily
    // unhandled when cancelLowPriority() aborts it.
    const settled = prefetcher.request('a', 'low').catch((error: unknown) => error)
    await flush()

    prefetcher.cancelLowPriority()
    expect(isCancellation(await settled)).toBe(true)

    // Hovering the same row afterwards must issue a fresh request
    prefetcher.request('a', 'high').catch(() => {})
    await flush()
    expect(pending.filter((p) => p.name === 'a')).toHaveLength(2)
    prefetcher.dispose()
  })

  it('dispose aborts everything in flight', async () => {
    const prefetcher = new LayoutPrefetcher(testSource, { concurrency: 4 })
    const settled = prefetcher.request('a', 'high').catch((error: unknown) => error)
    await flush()

    prefetcher.dispose()
    await flush()

    expect(pending[0]!.aborted).toBe(true)
    expect(isCancellation(await settled)).toBe(true)
  })

  it('a cancelled request does not evict the replacement that took its slot', async () => {
    const prefetcher = new LayoutPrefetcher(testSource)

    prefetcher.prefetch(['a'])
    await flush()
    expect(pending.filter((p) => p.name === 'a')).toHaveLength(1)

    // Aborts the low-priority request and frees the name for a new one, which
    // is issued before the abort has propagated through the promise chain.
    prefetcher.cancelLowPriority()
    prefetcher.request('a', 'high').catch(() => {})
    await flush()
    expect(pending.filter((p) => p.name === 'a')).toHaveLength(2)

    // The replacement is still in flight, so this must join it rather than
    // start a third download.
    prefetcher.request('a', 'high').catch(() => {})
    await flush()
    expect(pending.filter((p) => p.name === 'a')).toHaveLength(2)
    expect(prefetcher.activeCount).toBe(1)

    // …and it must still be tracked well enough to be aborted.
    prefetcher.dispose()
    await flush()
    expect(pending.filter((p) => p.name === 'a').every((p) => p.aborted)).toBe(true)
  })

  it('rejects requests made after dispose instead of hanging', async () => {
    const prefetcher = new LayoutPrefetcher(testSource)
    prefetcher.dispose()

    const error = await prefetcher.request('a', 'high').catch((e: unknown) => e)

    expect(isCancellation(error)).toBe(true)
    expect(pending).toHaveLength(0)
  })
})
