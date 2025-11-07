/**
 * SVGCache - Caches SVG content to data URL conversions
 *
 * Optimizes performance by avoiding redundant encodeURIComponent() calls
 * for the same SVG content across multiple renders.
 *
 * Uses LRU (Least Recently Used) eviction to prevent memory bloat.
 */

import { LRUCache } from './LRUCache'

export interface SVGCacheStats {
  hits: number
  misses: number
  size: number
  maxSize: number
  evictions: number
  hitRate: number
}

export interface SVGCacheOptions {
  /**
   * Maximum number of SVG entries to cache
   * Default: 1000
   */
  maxSize?: number
}

export class SVGCache {
  private cache: LRUCache<string, string>

  /**
   * Create a new SVG cache
   * @param options - Cache configuration options
   */
  constructor(options: SVGCacheOptions = {}) {
    this.cache = new LRUCache<string, string>({
      maxSize: options.maxSize ?? 1000,
    })
  }

  /**
   * Convert SVG content to a data URL, using cache if available
   * @param svgContent - The raw SVG string
   * @returns Data URL suitable for use as an image source
   */
  public toDataUrl(svgContent: string): string {
    // Check cache first
    const cached = this.cache.get(svgContent)
    if (cached !== undefined) {
      return cached
    }

    // Cache miss - convert and store
    const dataUrl = this.convertToDataUrl(svgContent)
    this.cache.set(svgContent, dataUrl)
    return dataUrl
  }

  /**
   * Convert SVG string to data URL (internal implementation)
   */
  private convertToDataUrl(svgContent: string): string {
    // Encode the SVG content for use in a data URL
    // Using encodeURIComponent ensures special characters are properly handled
    const encoded = encodeURIComponent(svgContent)
    return `data:image/svg+xml;charset=utf-8,${encoded}`
  }

  /**
   * Clear all cached entries
   */
  public clear(): void {
    this.cache.clear()
  }

  /**
   * Remove a specific entry from the cache
   * @param svgContent - The SVG content to remove
   * @returns true if entry was removed, false if not found
   */
  public remove(svgContent: string): boolean {
    return this.cache.delete(svgContent)
  }

  /**
   * Get current cache statistics
   */
  public getStats(): SVGCacheStats {
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
  public has(svgContent: string): boolean {
    return this.cache.has(svgContent)
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
export const svgCache = new SVGCache()
