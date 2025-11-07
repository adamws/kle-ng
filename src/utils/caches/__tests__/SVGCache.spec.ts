import { describe, it, expect, beforeEach } from 'vitest'
import { SVGCache } from '../SVGCache'

describe('SVGCache', () => {
  let cache: SVGCache

  beforeEach(() => {
    cache = new SVGCache()
  })

  describe('toDataUrl', () => {
    it('should convert SVG content to data URL', () => {
      const svgContent = '<svg width="32" height="32"><circle cx="16" cy="16" r="12"/></svg>'
      const dataUrl = cache.toDataUrl(svgContent)

      expect(dataUrl).toContain('data:image/svg+xml;charset=utf-8,')
      expect(dataUrl).toContain(encodeURIComponent(svgContent))
    })

    it('should return same data URL for same SVG content', () => {
      const svgContent = '<svg width="32" height="32"><circle cx="16" cy="16" r="12"/></svg>'
      const dataUrl1 = cache.toDataUrl(svgContent)
      const dataUrl2 = cache.toDataUrl(svgContent)

      expect(dataUrl1).toBe(dataUrl2)
    })

    it('should cache the result', () => {
      const svgContent = '<svg width="32" height="32"><circle cx="16" cy="16" r="12"/></svg>'

      // First call - cache miss
      cache.toDataUrl(svgContent)
      let stats = cache.getStats()
      expect(stats.misses).toBe(1)
      expect(stats.hits).toBe(0)

      // Second call - cache hit
      cache.toDataUrl(svgContent)
      stats = cache.getStats()
      expect(stats.misses).toBe(1)
      expect(stats.hits).toBe(1)
    })

    it('should handle different SVG content separately', () => {
      const svg1 = '<svg width="32" height="32"><circle cx="16" cy="16" r="12"/></svg>'
      const svg2 = '<svg width="64" height="64"><rect x="8" y="8" width="48" height="48"/></svg>'

      const dataUrl1 = cache.toDataUrl(svg1)
      const dataUrl2 = cache.toDataUrl(svg2)

      expect(dataUrl1).not.toBe(dataUrl2)
      expect(cache.size).toBe(2)
    })

    it('should handle special characters in SVG', () => {
      const svgWithSpecialChars = '<svg><text>Hello "World" & Test</text></svg>'
      const dataUrl = cache.toDataUrl(svgWithSpecialChars)

      expect(dataUrl).toContain('data:image/svg+xml;charset=utf-8,')
      // Special characters should be encoded
      expect(dataUrl).toContain('%22') // "
      expect(dataUrl).toContain('%26') // &
      expect(dataUrl).toContain('%3C') // <
      expect(dataUrl).toContain('%3E') // >
    })

    it('should handle empty SVG', () => {
      const emptySvg = ''
      const dataUrl = cache.toDataUrl(emptySvg)

      expect(dataUrl).toBe('data:image/svg+xml;charset=utf-8,')
    })
  })

  describe('clear', () => {
    it('should clear all cached entries', () => {
      const svg1 = '<svg width="32" height="32"><circle cx="16" cy="16" r="12"/></svg>'
      const svg2 = '<svg width="64" height="64"><rect x="8" y="8" width="48" height="48"/></svg>'

      cache.toDataUrl(svg1)
      cache.toDataUrl(svg2)
      expect(cache.size).toBe(2)

      cache.clear()
      expect(cache.size).toBe(0)
    })

    it('should reset statistics', () => {
      const svg = '<svg width="32" height="32"><circle cx="16" cy="16" r="12"/></svg>'

      cache.toDataUrl(svg)
      cache.toDataUrl(svg)
      expect(cache.getStats().hits).toBe(1)

      cache.clear()
      const stats = cache.getStats()
      expect(stats.hits).toBe(0)
      expect(stats.misses).toBe(0)
    })

    it('should allow new entries after clear', () => {
      const svg = '<svg width="32" height="32"><circle cx="16" cy="16" r="12"/></svg>'

      cache.toDataUrl(svg)
      cache.clear()

      cache.toDataUrl(svg)
      expect(cache.size).toBe(1)
      expect(cache.getStats().misses).toBe(1)
    })
  })

  describe('remove', () => {
    it('should remove specific entry', () => {
      const svg1 = '<svg width="32" height="32"><circle cx="16" cy="16" r="12"/></svg>'
      const svg2 = '<svg width="64" height="64"><rect x="8" y="8" width="48" height="48"/></svg>'

      cache.toDataUrl(svg1)
      cache.toDataUrl(svg2)
      expect(cache.size).toBe(2)

      const removed = cache.remove(svg1)
      expect(removed).toBe(true)
      expect(cache.size).toBe(1)
      expect(cache.has(svg1)).toBe(false)
      expect(cache.has(svg2)).toBe(true)
    })

    it('should return false for non-existent entry', () => {
      const svg = '<svg width="32" height="32"><circle cx="16" cy="16" r="12"/></svg>'

      const removed = cache.remove(svg)
      expect(removed).toBe(false)
    })

    it('should not affect statistics', () => {
      const svg = '<svg width="32" height="32"><circle cx="16" cy="16" r="12"/></svg>'

      cache.toDataUrl(svg)
      cache.toDataUrl(svg)
      const statsBeforeRemove = cache.getStats()

      cache.remove(svg)
      const statsAfterRemove = cache.getStats()

      expect(statsAfterRemove.hits).toBe(statsBeforeRemove.hits)
      expect(statsAfterRemove.misses).toBe(statsBeforeRemove.misses)
    })
  })

  describe('getStats', () => {
    it('should return correct statistics', () => {
      const svg1 = '<svg width="32" height="32"><circle cx="16" cy="16" r="12"/></svg>'
      const svg2 = '<svg width="64" height="64"><rect x="8" y="8" width="48" height="48"/></svg>'

      cache.toDataUrl(svg1) // miss
      cache.toDataUrl(svg1) // hit
      cache.toDataUrl(svg2) // miss
      cache.toDataUrl(svg1) // hit
      cache.toDataUrl(svg2) // hit

      const stats = cache.getStats()
      expect(stats.hits).toBe(3)
      expect(stats.misses).toBe(2)
      expect(stats.size).toBe(2)
      expect(stats.hitRate).toBe(3 / 5) // 60%
    })

    it('should return zero hitRate when no accesses', () => {
      const stats = cache.getStats()
      expect(stats.hitRate).toBe(0)
      expect(stats.hits).toBe(0)
      expect(stats.misses).toBe(0)
    })

    it('should calculate hitRate correctly', () => {
      const svg = '<svg width="32" height="32"><circle cx="16" cy="16" r="12"/></svg>'

      // First access - miss
      cache.toDataUrl(svg)
      expect(cache.getStats().hitRate).toBe(0)

      // Second access - hit (1 hit, 1 miss = 50%)
      cache.toDataUrl(svg)
      expect(cache.getStats().hitRate).toBe(0.5)

      // Third access - hit (2 hits, 1 miss = 66.67%)
      cache.toDataUrl(svg)
      expect(cache.getStats().hitRate).toBeCloseTo(2 / 3)
    })
  })

  describe('resetStats', () => {
    it('should reset statistics counters', () => {
      const svg = '<svg width="32" height="32"><circle cx="16" cy="16" r="12"/></svg>'

      cache.toDataUrl(svg)
      cache.toDataUrl(svg)
      expect(cache.getStats().hits).toBe(1)

      cache.resetStats()
      const stats = cache.getStats()
      expect(stats.hits).toBe(0)
      expect(stats.misses).toBe(0)
      expect(stats.hitRate).toBe(0)
    })

    it('should not clear cached entries', () => {
      const svg = '<svg width="32" height="32"><circle cx="16" cy="16" r="12"/></svg>'

      cache.toDataUrl(svg)
      expect(cache.size).toBe(1)

      cache.resetStats()
      expect(cache.size).toBe(1)
      expect(cache.has(svg)).toBe(true)
    })
  })

  describe('has', () => {
    it('should return true for cached entries', () => {
      const svg = '<svg width="32" height="32"><circle cx="16" cy="16" r="12"/></svg>'

      cache.toDataUrl(svg)
      expect(cache.has(svg)).toBe(true)
    })

    it('should return false for non-cached entries', () => {
      const svg = '<svg width="32" height="32"><circle cx="16" cy="16" r="12"/></svg>'

      expect(cache.has(svg)).toBe(false)
    })
  })

  describe('size', () => {
    it('should return correct cache size', () => {
      expect(cache.size).toBe(0)

      const svg1 = '<svg width="32" height="32"><circle cx="16" cy="16" r="12"/></svg>'
      cache.toDataUrl(svg1)
      expect(cache.size).toBe(1)

      const svg2 = '<svg width="64" height="64"><rect x="8" y="8" width="48" height="48"/></svg>'
      cache.toDataUrl(svg2)
      expect(cache.size).toBe(2)

      // Accessing same SVG shouldn't increase size
      cache.toDataUrl(svg1)
      expect(cache.size).toBe(2)
    })
  })

  describe('singleton instance', () => {
    it('should export a singleton instance', async () => {
      const { svgCache } = await import('../SVGCache')
      expect(svgCache).toBeInstanceOf(SVGCache)
    })
  })

  describe('LRU eviction', () => {
    it('should evict least recently used entries when cache is full', () => {
      const smallCache = new SVGCache({ maxSize: 3 })
      const svg1 = '<svg><circle r="1"/></svg>'
      const svg2 = '<svg><circle r="2"/></svg>'
      const svg3 = '<svg><circle r="3"/></svg>'
      const svg4 = '<svg><circle r="4"/></svg>'

      smallCache.toDataUrl(svg1)
      smallCache.toDataUrl(svg2)
      smallCache.toDataUrl(svg3)

      // Cache is full, next entry should evict svg1
      smallCache.toDataUrl(svg4)

      expect(smallCache.has(svg1)).toBe(false)
      expect(smallCache.has(svg2)).toBe(true)
      expect(smallCache.has(svg3)).toBe(true)
      expect(smallCache.has(svg4)).toBe(true)
      expect(smallCache.size).toBe(3)
    })

    it('should track evictions in statistics', () => {
      const smallCache = new SVGCache({ maxSize: 2 })
      const svg1 = '<svg><circle r="1"/></svg>'
      const svg2 = '<svg><circle r="2"/></svg>'
      const svg3 = '<svg><circle r="3"/></svg>'

      smallCache.toDataUrl(svg1)
      smallCache.toDataUrl(svg2)
      smallCache.toDataUrl(svg3) // Should evict svg1

      const stats = smallCache.getStats()
      expect(stats.evictions).toBe(1)
    })

    it('should update access order on cache hit', () => {
      const smallCache = new SVGCache({ maxSize: 3 })
      const svg1 = '<svg><circle r="1"/></svg>'
      const svg2 = '<svg><circle r="2"/></svg>'
      const svg3 = '<svg><circle r="3"/></svg>'
      const svg4 = '<svg><circle r="4"/></svg>'

      smallCache.toDataUrl(svg1)
      smallCache.toDataUrl(svg2)
      smallCache.toDataUrl(svg3)

      // Access svg1 to make it most recently used
      smallCache.toDataUrl(svg1)

      // Now svg2 is least recently used, should be evicted
      smallCache.toDataUrl(svg4)

      expect(smallCache.has(svg1)).toBe(true)
      expect(smallCache.has(svg2)).toBe(false)
      expect(smallCache.has(svg3)).toBe(true)
      expect(smallCache.has(svg4)).toBe(true)
    })
  })

  describe('resize', () => {
    it('should resize cache to new capacity', () => {
      const svg1 = '<svg><circle r="1"/></svg>'
      const svg2 = '<svg><circle r="2"/></svg>'

      cache.toDataUrl(svg1)
      cache.toDataUrl(svg2)

      cache.resize(100)
      const stats = cache.getStats()
      expect(stats.maxSize).toBe(100)
      expect(stats.size).toBe(2)
    })

    it('should evict entries when resizing to smaller capacity', () => {
      const svg1 = '<svg><circle r="1"/></svg>'
      const svg2 = '<svg><circle r="2"/></svg>'
      const svg3 = '<svg><circle r="3"/></svg>'
      const svg4 = '<svg><circle r="4"/></svg>'
      const svg5 = '<svg><circle r="5"/></svg>'

      cache.toDataUrl(svg1)
      cache.toDataUrl(svg2)
      cache.toDataUrl(svg3)
      cache.toDataUrl(svg4)
      cache.toDataUrl(svg5)

      cache.resize(3)

      // Oldest entries should be evicted
      expect(cache.has(svg1)).toBe(false)
      expect(cache.has(svg2)).toBe(false)
      expect(cache.has(svg3)).toBe(true)
      expect(cache.has(svg4)).toBe(true)
      expect(cache.has(svg5)).toBe(true)
      expect(cache.size).toBe(3)
    })
  })

  describe('performance characteristics', () => {
    it('should handle large SVG content', () => {
      // Generate a large SVG with many elements
      const elements = Array.from({ length: 100 }, (_, i) => {
        return `<circle cx="${i * 10}" cy="${i * 10}" r="5"/>`
      }).join('\n')
      const largeSvg = `<svg width="1000" height="1000">\n${elements}\n</svg>`

      const dataUrl = cache.toDataUrl(largeSvg)
      expect(dataUrl).toContain('data:image/svg+xml;charset=utf-8,')
      expect(cache.has(largeSvg)).toBe(true)
    })

    it('should handle many unique SVGs', () => {
      const svgs = Array.from({ length: 100 }, (_, i) => {
        return `<svg width="${i}" height="${i}"><circle cx="${i}" cy="${i}" r="${i}"/></svg>`
      })

      svgs.forEach((svg) => cache.toDataUrl(svg))

      expect(cache.size).toBe(100)
      expect(cache.getStats().misses).toBe(100)
      expect(cache.getStats().hits).toBe(0)
    })

    it('should demonstrate cache benefit', () => {
      const svg = '<svg width="32" height="32"><circle cx="16" cy="16" r="12"/></svg>'

      // Simulate multiple renders with same SVG
      for (let i = 0; i < 10; i++) {
        cache.toDataUrl(svg)
      }

      const stats = cache.getStats()
      expect(stats.misses).toBe(1) // Only first call does conversion
      expect(stats.hits).toBe(9) // All subsequent calls use cache
      expect(stats.hitRate).toBe(0.9) // 90% cache hit rate
    })
  })
})
