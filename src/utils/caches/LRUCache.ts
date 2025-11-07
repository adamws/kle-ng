/**
 * LRUCache - Least Recently Used Cache with automatic eviction
 *
 * Generic cache implementation that automatically evicts the least recently
 * used entries when the cache reaches its maximum size. This prevents memory
 * bloat while maintaining optimal performance for frequently accessed items.
 *
 * Features:
 * - Configurable maximum size
 * - Automatic eviction of least recently used entries
 * - Access-order tracking (most recent at end)
 * - Statistics tracking (hits, misses, evictions)
 * - Type-safe generic implementation
 */

export interface LRUCacheOptions {
  /**
   * Maximum number of entries in the cache
   * Default: 1000
   */
  maxSize?: number
}

export interface LRUCacheStats {
  /** Current number of entries */
  size: number
  /** Maximum capacity */
  maxSize: number
  /** Number of cache hits */
  hits: number
  /** Number of cache misses */
  misses: number
  /** Number of evictions */
  evictions: number
  /** Cache hit rate (0-1) */
  hitRate: number
}

/**
 * Generic LRU (Least Recently Used) Cache implementation
 *
 * @example
 * ```typescript
 * const cache = new LRUCache<string, string>({ maxSize: 100 })
 * cache.set('key1', 'value1')
 * const value = cache.get('key1') // 'value1'
 * ```
 */
export class LRUCache<K, V> {
  private cache = new Map<K, V>()
  private maxSize: number
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
  }

  /**
   * Create a new LRU cache
   * @param options - Cache configuration options
   */
  constructor(options: LRUCacheOptions = {}) {
    this.maxSize = options.maxSize ?? 1000
  }

  /**
   * Get a value from the cache
   * Updates access order (moves to most recently used position)
   *
   * @param key - The cache key
   * @returns The cached value or undefined if not found
   */
  public get(key: K): V | undefined {
    const value = this.cache.get(key)

    if (value !== undefined) {
      // Cache hit - move to end (most recently used position)
      this.cache.delete(key)
      this.cache.set(key, value)
      this.stats.hits++
      return value
    }

    // Cache miss
    this.stats.misses++
    return undefined
  }

  /**
   * Set a value in the cache
   * If cache is full, evicts the least recently used entry
   *
   * @param key - The cache key
   * @param value - The value to cache
   */
  public set(key: K, value: V): void {
    // Don't add anything if maxSize is 0
    if (this.maxSize === 0) {
      return
    }

    // If key already exists, delete it first (will re-add at end)
    if (this.cache.has(key)) {
      this.cache.delete(key)
    } else if (this.cache.size >= this.maxSize) {
      // Cache is full - evict least recently used (first entry)
      const firstKey = this.cache.keys().next().value
      if (firstKey !== undefined) {
        this.cache.delete(firstKey)
        this.stats.evictions++
      }
    }

    // Add to cache (at end = most recently used position)
    this.cache.set(key, value)
  }

  /**
   * Check if a key exists in the cache
   * Does NOT update access order
   *
   * @param key - The cache key
   * @returns true if key exists in cache
   */
  public has(key: K): boolean {
    return this.cache.has(key)
  }

  /**
   * Delete a specific entry from the cache
   *
   * @param key - The cache key to delete
   * @returns true if entry was deleted, false if not found
   */
  public delete(key: K): boolean {
    return this.cache.delete(key)
  }

  /**
   * Clear all entries from the cache
   */
  public clear(): void {
    this.cache.clear()
    this.resetStats()
  }

  /**
   * Get the current size of the cache
   */
  public get size(): number {
    return this.cache.size
  }

  /**
   * Get cache statistics
   */
  public getStats(): LRUCacheStats {
    const total = this.stats.hits + this.stats.misses
    const hitRate = total > 0 ? this.stats.hits / total : 0

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hits: this.stats.hits,
      misses: this.stats.misses,
      evictions: this.stats.evictions,
      hitRate,
    }
  }

  /**
   * Reset statistics counters
   */
  public resetStats(): void {
    this.stats.hits = 0
    this.stats.misses = 0
    this.stats.evictions = 0
  }

  /**
   * Get all keys in the cache (in access order, oldest first)
   */
  public keys(): IterableIterator<K> {
    return this.cache.keys()
  }

  /**
   * Get all values in the cache (in access order, oldest first)
   */
  public values(): IterableIterator<V> {
    return this.cache.values()
  }

  /**
   * Get all entries in the cache (in access order, oldest first)
   */
  public entries(): IterableIterator<[K, V]> {
    return this.cache.entries()
  }

  /**
   * Resize the cache to a new maximum size
   * If new size is smaller, evicts oldest entries
   *
   * @param newMaxSize - The new maximum size
   */
  public resize(newMaxSize: number): void {
    this.maxSize = newMaxSize

    // Evict entries if over new limit
    while (this.cache.size > this.maxSize) {
      const firstKey = this.cache.keys().next().value
      if (firstKey !== undefined) {
        this.cache.delete(firstKey)
        this.stats.evictions++
      } else {
        break
      }
    }
  }
}
