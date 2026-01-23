/**
 * ParseCache - Caches HTML label parsing results
 *
 * Optimizes performance by avoiding redundant parsing
 * for the same label content across multiple renders.
 *
 * Uses LRU (Least Recently Used) eviction to prevent memory bloat.
 */

import { LRUCache } from './LRUCache'
import type { LabelNode } from '../parsers/LabelAST'

export interface ParseCacheStats {
  hits: number
  misses: number
  size: number
  maxSize: number
  evictions: number
  hitRate: number
}

export interface ParseCacheOptions {
  /**
   * Maximum number of parse results to cache
   * Default: 1000
   */
  maxSize?: number
}

export class ParseCache {
  private cache: LRUCache<string, LabelNode[]>

  /**
   * Create a new parse cache
   * @param options - Cache configuration options
   */
  constructor(options: ParseCacheOptions = {}) {
    this.cache = new LRUCache<string, LabelNode[]>({
      maxSize: options.maxSize ?? 1000,
    })
  }

  /**
   * Get cached parse result or parse and cache
   * @param text - The label text to parse
   * @param parser - Function to parse the text (called only on cache miss)
   * @returns Parsed nodes
   */
  public getParsed(text: string, parser: (text: string) => LabelNode[]): LabelNode[] {
    // Check cache first
    const cached = this.cache.get(text)
    if (cached !== undefined) {
      return cached
    }

    // Cache miss - parse and store
    const result = parser(text)
    this.cache.set(text, result)
    return result
  }

  /**
   * Clear all cached entries
   */
  public clear(): void {
    this.cache.clear()
  }

  /**
   * Remove a specific entry from the cache
   * @param text - The label text to remove
   * @returns true if entry was removed, false if not found
   */
  public remove(text: string): boolean {
    return this.cache.delete(text)
  }

  /**
   * Get current cache statistics
   */
  public getStats(): ParseCacheStats {
    const lruStats = this.cache.getStats()

    return {
      hits: lruStats.hits,
      misses: lruStats.misses,
      size: lruStats.size,
      maxSize: lruStats.maxSize,
      evictions: lruStats.evictions,
      hitRate: lruStats.hitRate,
    }
  }

  /**
   * Reset statistics counters
   */
  public resetStats(): void {
    this.cache.resetStats()
  }

  /**
   * Get the current cache size
   */
  public get size(): number {
    return this.cache.size
  }

  /**
   * Check if an entry exists in the cache
   */
  public has(text: string): boolean {
    return this.cache.has(text)
  }

  /**
   * Resize the cache to a new maximum size
   * @param newMaxSize - The new maximum size
   */
  public resize(newMaxSize: number): void {
    this.cache.resize(newMaxSize)
  }
}

/**
 * Singleton instance for global use
 */
export const parseCache = new ParseCache()
