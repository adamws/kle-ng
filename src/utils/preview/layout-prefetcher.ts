import { LRUCache } from '../caches/LRUCache'
import type { LayoutSource, PreviewLayout } from './layout-source'

/**
 * Downloads and caches keyboard layouts for preview, off the UI's critical
 * path.
 *
 * Neither backing service offers a usable bulk endpoint — QMK's full dump is
 * ~28 MB, and VIA definitions live as individual files on raw.githubusercontent
 * — so "download in bulk" means a concurrency-limited pool of small requests
 * (QMK ≈ 9 KB each, VIA ≈ 2.4 KB each), prioritised by what the user is
 * actually looking at:
 *
 * - `high` — the hovered item. Jumps the queue, and survives a query change.
 * - `low`  — rows scrolled into view. Cancelled wholesale when the search
 *            changes, and capped per query so scrolling a 2,500-entry catalog
 *            can't spawn thousands of requests.
 */

export interface LayoutPrefetcherOptions {
  /** Maximum simultaneous in-flight requests */
  concurrency?: number
  /** Maximum cached layouts (successes and failures) */
  cacheSize?: number
  /** Maximum low-priority fetches per search query */
  queryCap?: number
}

type Priority = 'high' | 'low'

interface CacheEntry {
  layout?: PreviewLayout
  error?: string
}

interface Waiter {
  resolve: (layout: PreviewLayout) => void
  reject: (error: Error) => void
}

interface PendingRequest {
  name: string
  priority: Priority
  /** Every caller that asked for this name while it sat in the queue */
  waiters: Waiter[]
}

interface InFlightRequest {
  promise: Promise<PreviewLayout>
  controller: AbortController
  priority: Priority
}

/** Thrown when a request is dropped because its priority band was cancelled */
export class PrefetchCancelledError extends Error {
  constructor(name: string) {
    super(`Preview request for "${name}" was cancelled`)
    this.name = 'PrefetchCancelledError'
  }
}

export function isCancellation(error: unknown): boolean {
  return (
    error instanceof PrefetchCancelledError ||
    (error instanceof Error && error.name === 'AbortError')
  )
}

function rejectAll(entry: PendingRequest, error: Error): void {
  for (const waiter of entry.waiters) waiter.reject(error)
}

const DEFAULT_CONCURRENCY = 6
const DEFAULT_CACHE_SIZE = 200
const DEFAULT_QUERY_CAP = 60

export class LayoutPrefetcher {
  private readonly cache: LRUCache<string, CacheEntry>
  private readonly inFlight = new Map<string, InFlightRequest>()
  private readonly queue: PendingRequest[] = []
  private readonly concurrency: number
  private readonly queryCap: number
  private lowPriorityBudget: number
  private active = 0
  private disposed = false

  constructor(
    private readonly source: LayoutSource,
    options: LayoutPrefetcherOptions = {},
  ) {
    this.concurrency = options.concurrency ?? DEFAULT_CONCURRENCY
    this.queryCap = options.queryCap ?? DEFAULT_QUERY_CAP
    this.lowPriorityBudget = this.queryCap
    this.cache = new LRUCache<string, CacheEntry>({
      maxSize: options.cacheSize ?? DEFAULT_CACHE_SIZE,
    })
  }

  /**
   * Synchronous cache lookup. Lets the UI paint an already-downloaded preview
   * without a loading flash.
   */
  public peek(name: string): PreviewLayout | undefined {
    return this.cache.get(name)?.layout
  }

  /**
   * Request a layout. Repeated calls for the same name share a single
   * download; a queued `low` request is promoted in place rather than
   * re-issued.
   */
  public request(name: string, priority: Priority = 'high'): Promise<PreviewLayout> {
    // pump() refuses to start work once disposed, so a queued entry would
    // never settle. Reject instead of handing back a promise that hangs.
    if (this.disposed) {
      return Promise.reject(new PrefetchCancelledError(name))
    }

    const cached = this.cache.get(name)
    if (cached) {
      // Failures are cached too, so a 404 isn't re-fetched on every hover.
      return cached.layout
        ? Promise.resolve(cached.layout)
        : Promise.reject(new Error(cached.error ?? 'Failed to load layout'))
    }

    const running = this.inFlight.get(name)
    if (running) {
      // Already downloading — an in-flight low request effectively becomes
      // high, since promoting it protects it from cancelLowPriority().
      if (priority === 'high') running.priority = 'high'
      return running.promise
    }

    const queued = this.queue.find((entry) => entry.name === name)
    if (queued) {
      if (priority === 'high' && queued.priority === 'low') {
        queued.priority = 'high'
        this.queue.splice(this.queue.indexOf(queued), 1)
        this.queue.unshift(queued)
      }
      // Join the existing queue entry rather than creating a competing request.
      return new Promise<PreviewLayout>((resolve, reject) => {
        queued.waiters.push({ resolve, reject })
      })
    }

    if (priority === 'low') {
      if (this.lowPriorityBudget <= 0) {
        return Promise.reject(new PrefetchCancelledError(name))
      }
      this.lowPriorityBudget--
    }

    return new Promise<PreviewLayout>((resolve, reject) => {
      const entry: PendingRequest = { name, priority, waiters: [{ resolve, reject }] }
      if (priority === 'high') this.queue.unshift(entry)
      else this.queue.push(entry)
      this.pump()
    })
  }

  /** Queue background downloads for rows currently in view. */
  public prefetch(names: string[]): void {
    for (const name of names) {
      // Swallow rejections: speculative work must never surface an error.
      this.request(name, 'low').catch(() => {})
    }
  }

  /**
   * Drop all speculative work — called when the search query changes.
   * In-flight `high` requests (the hovered item) are deliberately left alone.
   */
  public cancelLowPriority(): void {
    for (let i = this.queue.length - 1; i >= 0; i--) {
      const entry = this.queue[i]
      if (entry && entry.priority === 'low') {
        this.queue.splice(i, 1)
        rejectAll(entry, new PrefetchCancelledError(entry.name))
      }
    }

    for (const [name, running] of this.inFlight) {
      if (running.priority === 'low') {
        running.controller.abort()
        this.inFlight.delete(name)
      }
    }

    this.lowPriorityBudget = this.queryCap
  }

  /** Abort everything and stop accepting work. */
  public dispose(): void {
    this.disposed = true
    for (const entry of this.queue.splice(0)) {
      rejectAll(entry, new PrefetchCancelledError(entry.name))
    }
    for (const running of this.inFlight.values()) {
      running.controller.abort()
    }
    this.inFlight.clear()
  }

  /** In-flight request count — used by tests to assert the concurrency cap. */
  public get activeCount(): number {
    return this.active
  }

  private pump(): void {
    while (!this.disposed && this.active < this.concurrency && this.queue.length > 0) {
      const entry = this.queue.shift()!
      this.start(entry)
    }
  }

  private start(entry: PendingRequest): void {
    const controller = new AbortController()
    this.active++

    const promise = this.download(entry.name, controller.signal)

    this.inFlight.set(entry.name, { promise, controller, priority: entry.priority })

    promise
      .then((layout) => {
        this.cache.set(entry.name, { layout })
        for (const waiter of entry.waiters) waiter.resolve(layout)
      })
      .catch((error: unknown) => {
        const err = error instanceof Error ? error : new Error(String(error))
        // Aborted requests are not failures — don't poison the cache with them.
        if (!isCancellation(err)) {
          this.cache.set(entry.name, { error: err.message })
        }
        rejectAll(entry, err)
      })
      .finally(() => {
        // Only retract our own registration. cancelLowPriority() and dispose()
        // drop the entry the moment they abort, so by the time this settles the
        // slot may already belong to a newer request for the same name —
        // deleting that one would leave it untracked, breaking both dedupe and
        // any later abort.
        if (this.inFlight.get(entry.name)?.controller === controller) {
          this.inFlight.delete(entry.name)
        }
        this.active--
        this.pump()
      })
  }

  private async download(name: string, signal: AbortSignal): Promise<PreviewLayout> {
    const response = await fetch(this.source.layoutUrl(name), { signal })
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`)
    }
    const raw = await response.json()
    if (signal.aborted) {
      throw new PrefetchCancelledError(name)
    }
    return this.source.toPreviewLayout(raw, name)
  }
}
