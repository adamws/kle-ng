import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ParseCache, type ParsedSegment } from '../ParseCache'

describe('ParseCache', () => {
  let cache: ParseCache
  let mockParser: ReturnType<typeof vi.fn>

  beforeEach(() => {
    cache = new ParseCache()
    mockParser = vi.fn((text: string): ParsedSegment[] => {
      // Simple mock parser that splits text into segments
      return [{ type: 'text', text, bold: false, italic: false }]
    })
  })

  describe('getParsed', () => {
    it('should call parser on first access (cache miss)', () => {
      const text = 'Hello World'
      cache.getParsed(text, mockParser)

      expect(mockParser).toHaveBeenCalledTimes(1)
      expect(mockParser).toHaveBeenCalledWith(text)
    })

    it('should not call parser on subsequent accesses (cache hit)', () => {
      const text = 'Hello World'

      cache.getParsed(text, mockParser)
      expect(mockParser).toHaveBeenCalledTimes(1)

      cache.getParsed(text, mockParser)
      expect(mockParser).toHaveBeenCalledTimes(1) // Still 1, not called again
    })

    it('should return same result from cache', () => {
      const text = 'Hello World'

      const result1 = cache.getParsed(text, mockParser)
      const result2 = cache.getParsed(text, mockParser)

      expect(result1).toBe(result2) // Same reference
    })

    it('should handle different texts separately', () => {
      const text1 = 'Hello'
      const text2 = 'World'

      cache.getParsed(text1, mockParser)
      cache.getParsed(text2, mockParser)

      expect(mockParser).toHaveBeenCalledTimes(2)
      expect(cache.size).toBe(2)
    })

    it('should update statistics correctly', () => {
      const text = 'Hello World'

      // First access - miss
      cache.getParsed(text, mockParser)
      let stats = cache.getStats()
      expect(stats.misses).toBe(1)
      expect(stats.hits).toBe(0)

      // Second access - hit
      cache.getParsed(text, mockParser)
      stats = cache.getStats()
      expect(stats.misses).toBe(1)
      expect(stats.hits).toBe(1)
    })

    it('should cache complex parse results', () => {
      const complexParser = vi.fn((): ParsedSegment[] => [
        { type: 'text', text: 'Bold', bold: true, italic: false },
        { type: 'image', src: 'icon.png', width: 32, height: 32 },
        { type: 'svg', svgContent: '<svg>...</svg>', width: 16, height: 16 },
      ])

      const text = '<b>Bold</b><img src="icon.png" width=32 height=32>'

      const result1 = cache.getParsed(text, complexParser)
      const result2 = cache.getParsed(text, complexParser)

      expect(result1).toBe(result2)
      expect(result1).toHaveLength(3)
      expect(complexParser).toHaveBeenCalledTimes(1)
    })

    it('should handle HTML entities correctly', () => {
      const htmlText = '&lt;b&gt;Test&lt;/b&gt;'
      const parser = vi.fn((text: string): ParsedSegment[] => [
        { type: 'text', text, bold: false, italic: false },
      ])

      cache.getParsed(htmlText, parser)
      cache.getParsed(htmlText, parser)

      expect(parser).toHaveBeenCalledTimes(1)
    })

    it('should handle empty strings', () => {
      const emptyText = ''
      const parser = vi.fn((): ParsedSegment[] => [])

      const result = cache.getParsed(emptyText, parser)

      expect(result).toEqual([])
      expect(parser).toHaveBeenCalledTimes(1)
    })
  })

  describe('clear', () => {
    it('should clear all cached entries', () => {
      cache.getParsed('Text 1', mockParser)
      cache.getParsed('Text 2', mockParser)
      expect(cache.size).toBe(2)

      cache.clear()
      expect(cache.size).toBe(0)
    })

    it('should reset statistics', () => {
      cache.getParsed('Text', mockParser)
      cache.getParsed('Text', mockParser)
      expect(cache.getStats().hits).toBe(1)

      cache.clear()
      const stats = cache.getStats()
      expect(stats.hits).toBe(0)
      expect(stats.misses).toBe(0)
    })

    it('should allow new entries after clear', () => {
      cache.getParsed('Text', mockParser)
      cache.clear()

      cache.getParsed('Text', mockParser)
      expect(cache.size).toBe(1)
      expect(cache.getStats().misses).toBe(1)
    })
  })

  describe('remove', () => {
    it('should remove specific entry', () => {
      cache.getParsed('Text 1', mockParser)
      cache.getParsed('Text 2', mockParser)
      expect(cache.size).toBe(2)

      const removed = cache.remove('Text 1')
      expect(removed).toBe(true)
      expect(cache.size).toBe(1)
      expect(cache.has('Text 1')).toBe(false)
      expect(cache.has('Text 2')).toBe(true)
    })

    it('should return false for non-existent entry', () => {
      const removed = cache.remove('Non-existent')
      expect(removed).toBe(false)
    })

    it('should not affect statistics', () => {
      cache.getParsed('Text', mockParser)
      cache.getParsed('Text', mockParser)
      const statsBeforeRemove = cache.getStats()

      cache.remove('Text')
      const statsAfterRemove = cache.getStats()

      expect(statsAfterRemove.hits).toBe(statsBeforeRemove.hits)
      expect(statsAfterRemove.misses).toBe(statsBeforeRemove.misses)
    })
  })

  describe('getStats', () => {
    it('should return correct statistics', () => {
      cache.getParsed('Text 1', mockParser) // miss
      cache.getParsed('Text 1', mockParser) // hit
      cache.getParsed('Text 2', mockParser) // miss
      cache.getParsed('Text 1', mockParser) // hit
      cache.getParsed('Text 2', mockParser) // hit

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
      // First access - miss
      cache.getParsed('Text', mockParser)
      expect(cache.getStats().hitRate).toBe(0)

      // Second access - hit (1 hit, 1 miss = 50%)
      cache.getParsed('Text', mockParser)
      expect(cache.getStats().hitRate).toBe(0.5)

      // Third access - hit (2 hits, 1 miss = 66.67%)
      cache.getParsed('Text', mockParser)
      expect(cache.getStats().hitRate).toBeCloseTo(2 / 3)
    })
  })

  describe('resetStats', () => {
    it('should reset statistics counters', () => {
      cache.getParsed('Text', mockParser)
      cache.getParsed('Text', mockParser)
      expect(cache.getStats().hits).toBe(1)

      cache.resetStats()
      const stats = cache.getStats()
      expect(stats.hits).toBe(0)
      expect(stats.misses).toBe(0)
      expect(stats.hitRate).toBe(0)
    })

    it('should not clear cached entries', () => {
      cache.getParsed('Text', mockParser)
      expect(cache.size).toBe(1)

      cache.resetStats()
      expect(cache.size).toBe(1)
      expect(cache.has('Text')).toBe(true)
    })
  })

  describe('has', () => {
    it('should return true for cached entries', () => {
      cache.getParsed('Text', mockParser)
      expect(cache.has('Text')).toBe(true)
    })

    it('should return false for non-cached entries', () => {
      expect(cache.has('Non-existent')).toBe(false)
    })
  })

  describe('size', () => {
    it('should return correct cache size', () => {
      expect(cache.size).toBe(0)

      cache.getParsed('Text 1', mockParser)
      expect(cache.size).toBe(1)

      cache.getParsed('Text 2', mockParser)
      expect(cache.size).toBe(2)

      // Accessing same text shouldn't increase size
      cache.getParsed('Text 1', mockParser)
      expect(cache.size).toBe(2)
    })
  })

  describe('singleton instance', () => {
    it('should export a singleton instance', async () => {
      const { parseCache } = await import('../ParseCache')
      expect(parseCache).toBeInstanceOf(ParseCache)
    })
  })

  describe('performance characteristics', () => {
    it('should handle many unique labels', () => {
      const labels = Array.from({ length: 100 }, (_, i) => `Label ${i}`)

      labels.forEach((label) => cache.getParsed(label, mockParser))

      expect(cache.size).toBe(100)
      expect(cache.getStats().misses).toBe(100)
      expect(cache.getStats().hits).toBe(0)
      expect(mockParser).toHaveBeenCalledTimes(100)
    })

    it('should demonstrate cache benefit for repeated labels', () => {
      const label = 'Repeated Label'

      // Simulate 10 renders with same label
      for (let i = 0; i < 10; i++) {
        cache.getParsed(label, mockParser)
      }

      const stats = cache.getStats()
      expect(stats.misses).toBe(1) // Only first call parses
      expect(stats.hits).toBe(9) // All subsequent calls use cache
      expect(stats.hitRate).toBe(0.9) // 90% cache hit rate
      expect(mockParser).toHaveBeenCalledTimes(1)
    })

    it('should handle complex parse results efficiently', () => {
      const complexParser = vi.fn((): ParsedSegment[] => {
        // Simulate expensive parsing
        return [
          { type: 'text', text: 'Complex', bold: true, italic: false },
          { type: 'image', src: 'img1.png', width: 32, height: 32 },
          { type: 'text', text: ' Label ', bold: false, italic: true },
          { type: 'svg', svgContent: '<svg>...</svg>', width: 16, height: 16 },
          { type: 'text', text: 'End', bold: false, italic: false },
        ]
      })

      const complexLabel = '<b>Complex</b><img src="img1.png"><i> Label </i><svg>...</svg>End'

      // First parse
      const result1 = cache.getParsed(complexLabel, complexParser)
      expect(complexParser).toHaveBeenCalledTimes(1)
      expect(result1).toHaveLength(5)

      // 100 more accesses should not call parser
      for (let i = 0; i < 100; i++) {
        const result = cache.getParsed(complexLabel, complexParser)
        expect(result).toBe(result1) // Same reference
      }

      expect(complexParser).toHaveBeenCalledTimes(1) // Still only called once
      expect(cache.getStats().hitRate).toBeCloseTo(100 / 101)
    })
  })

  describe('edge cases', () => {
    it('should handle labels with line breaks', () => {
      const multilineLabel = 'Line 1\nLine 2\nLine 3'
      cache.getParsed(multilineLabel, mockParser)
      cache.getParsed(multilineLabel, mockParser)

      expect(mockParser).toHaveBeenCalledTimes(1)
    })

    it('should handle labels with whitespace variations', () => {
      const label1 = 'Text  with   spaces'
      const label2 = 'Text  with   spaces' // Same

      cache.getParsed(label1, mockParser)
      cache.getParsed(label2, mockParser)

      expect(mockParser).toHaveBeenCalledTimes(1)
      expect(cache.size).toBe(1)
    })

    it('should treat labels with different whitespace as different', () => {
      const label1 = 'Text with spaces'
      const label2 = 'Text  with  spaces' // Different spacing

      cache.getParsed(label1, mockParser)
      cache.getParsed(label2, mockParser)

      expect(mockParser).toHaveBeenCalledTimes(2)
      expect(cache.size).toBe(2)
    })

    it('should handle very long labels', () => {
      const longLabel = 'A'.repeat(10000)
      cache.getParsed(longLabel, mockParser)
      cache.getParsed(longLabel, mockParser)

      expect(mockParser).toHaveBeenCalledTimes(1)
      expect(cache.has(longLabel)).toBe(true)
    })

    it('should handle Unicode characters', () => {
      const unicodeLabel = '你好世界 🌍 Привет мир'
      cache.getParsed(unicodeLabel, mockParser)
      cache.getParsed(unicodeLabel, mockParser)

      expect(mockParser).toHaveBeenCalledTimes(1)
      expect(cache.has(unicodeLabel)).toBe(true)
    })
  })
})
