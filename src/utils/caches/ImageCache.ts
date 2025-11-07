/**
 * ImageCache - Manages image loading and caching
 *
 * Handles image loading states and provides centralized image cache management
 * for the canvas renderer. Supports loading callbacks and error handling.
 *
 * Uses LRU (Least Recently Used) eviction to prevent memory bloat.
 *
 * Cache states:
 * - 'loading': Image is currently being loaded
 * - 'error': Image failed to load
 * - HTMLImageElement: Image successfully loaded
 */

import { renderScheduler } from '../utils/RenderScheduler'
import { LRUCache } from './LRUCache'

export interface ImageCacheStats {
  loaded: number
  loading: number
  errors: number
  total: number
  maxSize: number
  evictions: number
}

export interface ImageCacheOptions {
  /**
   * Maximum number of images to cache
   * Default: 1000
   */
  maxSize?: number
}

export type ImageCacheState = HTMLImageElement | 'loading' | 'error'

export class ImageCache {
  private cache: LRUCache<string, ImageCacheState>
  private loadCallbacks = new Map<string, (() => void)[]>()

  /**
   * Create a new image cache
   * @param options - Cache configuration options
   */
  constructor(options: ImageCacheOptions = {}) {
    this.cache = new LRUCache<string, ImageCacheState>({
      maxSize: options.maxSize ?? 1000,
    })
  }

  /**
   * Get an image from the cache if it's loaded
   * @param url - The image URL
   * @returns The loaded image element or null if not loaded
   */
  public getImage(url: string): HTMLImageElement | null {
    const cached = this.cache.get(url)
    if (cached instanceof HTMLImageElement) {
      return cached
    }
    return null
  }

  /**
   * Get the current state of an image in the cache
   * @param url - The image URL
   * @returns The cache state or undefined if not in cache
   */
  public getState(url: string): ImageCacheState | undefined {
    return this.cache.get(url)
  }

  /**
   * Load an image and cache it
   * @param url - The image URL to load
   * @param onLoad - Optional callback to call when image loads (or immediately if already loaded)
   * @param onError - Optional callback to call when image fails to load
   */
  public loadImage(url: string, onLoad?: () => void, onError?: (url: string) => void): void {
    // Check if already in cache
    const cached = this.cache.get(url)
    if (cached === 'loading') {
      // Already loading, add callback
      if (onLoad) {
        const callbacks = this.loadCallbacks.get(url) || []
        callbacks.push(onLoad)
        this.loadCallbacks.set(url, callbacks)
      }
      return
    } else if (cached instanceof HTMLImageElement || cached === 'error') {
      // Already loaded or failed, schedule callback to execute in next animation frame
      if (onLoad) {
        renderScheduler.schedule(onLoad)
      }
      return
    }

    // Mark as loading
    this.cache.set(url, 'loading')

    // Create image element
    const img = new Image()
    // Set crossOrigin to 'anonymous' to allow canvas export (toBlob/toDataURL)
    // This works for same-origin images and cross-origin images with CORS headers
    // Without this, the canvas becomes "tainted" and cannot be exported
    img.crossOrigin = 'anonymous'

    // Set up callbacks array for this URL
    if (onLoad) {
      this.loadCallbacks.set(url, [onLoad])
    }

    img.onload = () => {
      // Validate SVG dimensions (required for proper rendering in Firefox)
      if (this.isSvgUrl(url)) {
        if (!img.naturalWidth || !img.naturalHeight) {
          console.warn(
            `SVG image at ${url} may not render correctly in all browsers. ` +
              `SVG files should have explicit width and height attributes (not percentages).`,
          )
        }
      }

      // Store the loaded image
      this.cache.set(url, img)

      // Schedule all callbacks to execute in the next animation frame
      const callbacks = this.loadCallbacks.get(url) || []
      if (callbacks.length > 0) {
        renderScheduler.schedule(() => {
          callbacks.forEach((callback) => callback())
        })
      }
      this.loadCallbacks.delete(url)
    }

    img.onerror = () => {
      this.cache.set(url, 'error')
      console.warn(`Failed to load image: ${url}`)

      // Call error callback
      if (onError) {
        onError(url)
      }

      // Schedule callbacks to execute even on error (so renderer knows to continue)
      const callbacks = this.loadCallbacks.get(url) || []
      if (callbacks.length > 0) {
        renderScheduler.schedule(() => {
          callbacks.forEach((callback) => callback())
        })
      }
      this.loadCallbacks.delete(url)
    }

    // Start loading
    img.src = url
  }

  /**
   * Check if a URL is likely an SVG file
   */
  private isSvgUrl(url: string): boolean {
    return url.toLowerCase().endsWith('.svg') || url.includes('image/svg+xml')
  }

  /**
   * Check if an image is loaded and available
   * @param url - The image URL
   * @returns true if image is loaded successfully
   */
  public isLoaded(url: string): boolean {
    const cached = this.cache.get(url)
    return cached instanceof HTMLImageElement
  }

  /**
   * Check if an image is currently loading
   * @param url - The image URL
   * @returns true if image is currently loading
   */
  public isLoading(url: string): boolean {
    return this.cache.get(url) === 'loading'
  }

  /**
   * Check if an image failed to load
   * @param url - The image URL
   * @returns true if image failed to load
   */
  public hasError(url: string): boolean {
    return this.cache.get(url) === 'error'
  }

  /**
   * Clear all cached images
   */
  public clear(): void {
    this.cache.clear()
    this.loadCallbacks.clear()
  }

  /**
   * Remove a specific image from the cache
   * @param url - The image URL to remove
   * @returns true if image was removed, false if not found
   */
  public remove(url: string): boolean {
    this.loadCallbacks.delete(url)
    return this.cache.delete(url)
  }

  /**
   * Get current cache statistics
   */
  public getStats(): ImageCacheStats {
    let loaded = 0
    let loading = 0
    let errors = 0

    // Convert iterator to array for compatibility
    const states = Array.from(this.cache.values())
    for (const state of states) {
      if (state instanceof HTMLImageElement) {
        loaded++
      } else if (state === 'loading') {
        loading++
      } else if (state === 'error') {
        errors++
      }
    }

    const lruStats = this.cache.getStats()

    return {
      loaded,
      loading,
      errors,
      total: this.cache.size,
      maxSize: lruStats.maxSize,
      evictions: lruStats.evictions,
    }
  }

  /**
   * Get the current cache size
   */
  public get size(): number {
    return this.cache.size
  }

  /**
   * Check if a URL exists in the cache
   */
  public has(url: string): boolean {
    return this.cache.has(url)
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
export const imageCache = new ImageCache()
