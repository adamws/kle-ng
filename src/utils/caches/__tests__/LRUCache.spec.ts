/**
 * LRUCache Tests
 *
 * Comprehensive test suite for the LRU cache implementation
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { LRUCache } from '../LRUCache'

describe('LRUCache', () => {
  describe('constructor', () => {
    it('should create cache with default max size', () => {
      const cache = new LRUCache<string, string>()
      const stats = cache.getStats()

      expect(stats.maxSize).toBe(1000)
      expect(stats.size).toBe(0)
    })

    it('should create cache with custom max size', () => {
      const cache = new LRUCache<string, string>({ maxSize: 50 })
      const stats = cache.getStats()

      expect(stats.maxSize).toBe(50)
    })

    it('should handle maxSize of 0', () => {
      const cache = new LRUCache<string, string>({ maxSize: 0 })
      cache.set('key', 'value')

      expect(cache.size).toBe(0)
      expect(cache.get('key')).toBeUndefined()
    })
  })

  describe('basic operations', () => {
    let cache: LRUCache<string, string>

    beforeEach(() => {
      cache = new LRUCache<string, string>({ maxSize: 5 })
    })

    it('should set and get values', () => {
      cache.set('key1', 'value1')
      cache.set('key2', 'value2')

      expect(cache.get('key1')).toBe('value1')
      expect(cache.get('key2')).toBe('value2')
    })

    it('should return undefined for non-existent keys', () => {
      expect(cache.get('nonexistent')).toBeUndefined()
    })

    it('should check if key exists', () => {
      cache.set('key1', 'value1')

      expect(cache.has('key1')).toBe(true)
      expect(cache.has('nonexistent')).toBe(false)
    })

    it('should delete entries', () => {
      cache.set('key1', 'value1')
      cache.set('key2', 'value2')

      expect(cache.delete('key1')).toBe(true)
      expect(cache.has('key1')).toBe(false)
      expect(cache.has('key2')).toBe(true)
      expect(cache.size).toBe(1)
    })

    it('should return false when deleting non-existent key', () => {
      expect(cache.delete('nonexistent')).toBe(false)
    })

    it('should clear all entries', () => {
      cache.set('key1', 'value1')
      cache.set('key2', 'value2')
      cache.clear()

      expect(cache.size).toBe(0)
      expect(cache.has('key1')).toBe(false)
      expect(cache.has('key2')).toBe(false)
    })

    it('should track cache size', () => {
      expect(cache.size).toBe(0)

      cache.set('key1', 'value1')
      expect(cache.size).toBe(1)

      cache.set('key2', 'value2')
      expect(cache.size).toBe(2)

      cache.delete('key1')
      expect(cache.size).toBe(1)

      cache.clear()
      expect(cache.size).toBe(0)
    })

    it('should update existing keys without increasing size', () => {
      cache.set('key1', 'value1')
      expect(cache.size).toBe(1)

      cache.set('key1', 'value2')
      expect(cache.size).toBe(1)
      expect(cache.get('key1')).toBe('value2')
    })
  })

  describe('LRU eviction behavior', () => {
    let cache: LRUCache<string, string>

    beforeEach(() => {
      cache = new LRUCache<string, string>({ maxSize: 3 })
    })

    it('should evict least recently used entry when cache is full', () => {
      cache.set('key1', 'value1')
      cache.set('key2', 'value2')
      cache.set('key3', 'value3')

      // Cache is full, next set should evict key1
      cache.set('key4', 'value4')

      expect(cache.has('key1')).toBe(false)
      expect(cache.has('key2')).toBe(true)
      expect(cache.has('key3')).toBe(true)
      expect(cache.has('key4')).toBe(true)
      expect(cache.size).toBe(3)
    })

    it('should update access order on get', () => {
      cache.set('key1', 'value1')
      cache.set('key2', 'value2')
      cache.set('key3', 'value3')

      // Access key1 to make it most recently used
      cache.get('key1')

      // Now key2 is least recently used, should be evicted next
      cache.set('key4', 'value4')

      expect(cache.has('key1')).toBe(true)
      expect(cache.has('key2')).toBe(false)
      expect(cache.has('key3')).toBe(true)
      expect(cache.has('key4')).toBe(true)
    })

    it('should update access order on set for existing key', () => {
      cache.set('key1', 'value1')
      cache.set('key2', 'value2')
      cache.set('key3', 'value3')

      // Update key1 to make it most recently used
      cache.set('key1', 'updated1')

      // Now key2 is least recently used
      cache.set('key4', 'value4')

      expect(cache.has('key1')).toBe(true)
      expect(cache.has('key2')).toBe(false)
      expect(cache.has('key3')).toBe(true)
      expect(cache.has('key4')).toBe(true)
    })

    it('should handle complex access patterns', () => {
      cache.set('a', '1')
      cache.set('b', '2')
      cache.set('c', '3')

      // Access pattern: b -> a -> c (c is now most recent, a is least recent)
      cache.get('b')
      cache.get('a')
      cache.get('c')

      // Should evict b (least recently accessed)
      cache.set('d', '4')

      expect(cache.has('a')).toBe(true)
      expect(cache.has('b')).toBe(false)
      expect(cache.has('c')).toBe(true)
      expect(cache.has('d')).toBe(true)
    })
  })

  describe('statistics tracking', () => {
    let cache: LRUCache<string, number>

    beforeEach(() => {
      cache = new LRUCache<string, number>({ maxSize: 5 })
    })

    it('should track hits and misses', () => {
      cache.set('key1', 1)

      // Cache hit
      cache.get('key1')
      let stats = cache.getStats()
      expect(stats.hits).toBe(1)
      expect(stats.misses).toBe(0)

      // Cache miss
      cache.get('key2')
      stats = cache.getStats()
      expect(stats.hits).toBe(1)
      expect(stats.misses).toBe(1)
    })

    it('should calculate hit rate correctly', () => {
      cache.set('key1', 1)

      cache.get('key1') // hit
      cache.get('key1') // hit
      cache.get('key2') // miss

      const stats = cache.getStats()
      expect(stats.hitRate).toBeCloseTo(2 / 3)
    })

    it('should track evictions', () => {
      cache.set('key1', 1)
      cache.set('key2', 2)
      cache.set('key3', 3)
      cache.set('key4', 4)
      cache.set('key5', 5)

      // This should trigger eviction
      cache.set('key6', 6)

      const stats = cache.getStats()
      expect(stats.evictions).toBe(1)
    })

    it('should reset stats on clear', () => {
      cache.set('key1', 1)
      cache.get('key1')
      cache.get('nonexistent')

      cache.clear()

      const stats = cache.getStats()
      expect(stats.hits).toBe(0)
      expect(stats.misses).toBe(0)
      expect(stats.evictions).toBe(0)
    })

    it('should allow manual stats reset', () => {
      cache.set('key1', 1)
      cache.get('key1')
      cache.get('nonexistent')

      cache.resetStats()

      const stats = cache.getStats()
      expect(stats.hits).toBe(0)
      expect(stats.misses).toBe(0)
      expect(stats.size).toBe(1) // Cache content is not cleared
    })

    it('should handle zero total accesses', () => {
      const stats = cache.getStats()
      expect(stats.hitRate).toBe(0)
    })
  })

  describe('iteration', () => {
    let cache: LRUCache<string, number>

    beforeEach(() => {
      cache = new LRUCache<string, number>({ maxSize: 5 })
      cache.set('a', 1)
      cache.set('b', 2)
      cache.set('c', 3)
    })

    it('should iterate over keys', () => {
      const keys = Array.from(cache.keys())
      expect(keys).toEqual(['a', 'b', 'c'])
    })

    it('should iterate over values', () => {
      const values = Array.from(cache.values())
      expect(values).toEqual([1, 2, 3])
    })

    it('should iterate over entries', () => {
      const entries = Array.from(cache.entries())
      expect(entries).toEqual([
        ['a', 1],
        ['b', 2],
        ['c', 3],
      ])
    })

    it('should reflect access order in iteration', () => {
      // Access 'a' to move it to end
      cache.get('a')

      const keys = Array.from(cache.keys())
      expect(keys).toEqual(['b', 'c', 'a'])
    })
  })

  describe('resize', () => {
    let cache: LRUCache<string, number>

    beforeEach(() => {
      cache = new LRUCache<string, number>({ maxSize: 5 })
      cache.set('a', 1)
      cache.set('b', 2)
      cache.set('c', 3)
      cache.set('d', 4)
      cache.set('e', 5)
    })

    it('should resize to larger capacity', () => {
      cache.resize(10)

      const stats = cache.getStats()
      expect(stats.maxSize).toBe(10)
      expect(stats.size).toBe(5)
    })

    it('should evict entries when resizing to smaller capacity', () => {
      cache.resize(3)

      const stats = cache.getStats()
      expect(stats.maxSize).toBe(3)
      expect(stats.size).toBe(3)

      // Oldest entries (a, b) should be evicted
      expect(cache.has('a')).toBe(false)
      expect(cache.has('b')).toBe(false)
      expect(cache.has('c')).toBe(true)
      expect(cache.has('d')).toBe(true)
      expect(cache.has('e')).toBe(true)
    })

    it('should track evictions from resize', () => {
      cache.resize(2)

      const stats = cache.getStats()
      expect(stats.evictions).toBe(3)
    })

    it('should handle resize to 0', () => {
      cache.resize(0)

      const stats = cache.getStats()
      expect(stats.size).toBe(0)
      expect(stats.evictions).toBe(5)
    })
  })

  describe('edge cases', () => {
    it('should handle empty cache operations', () => {
      const cache = new LRUCache<string, string>({ maxSize: 5 })

      expect(cache.get('key')).toBeUndefined()
      expect(cache.has('key')).toBe(false)
      expect(cache.delete('key')).toBe(false)
      expect(cache.size).toBe(0)
    })

    it('should handle single entry cache', () => {
      const cache = new LRUCache<string, string>({ maxSize: 1 })

      cache.set('key1', 'value1')
      expect(cache.size).toBe(1)

      cache.set('key2', 'value2')
      expect(cache.size).toBe(1)
      expect(cache.has('key1')).toBe(false)
      expect(cache.has('key2')).toBe(true)
    })

    it('should handle complex value types', () => {
      interface ComplexValue {
        id: number
        data: string[]
      }

      const cache = new LRUCache<string, ComplexValue>({ maxSize: 5 })
      const value: ComplexValue = { id: 1, data: ['a', 'b', 'c'] }

      cache.set('key', value)
      const retrieved = cache.get('key')

      expect(retrieved).toEqual(value)
      expect(retrieved?.data).toEqual(['a', 'b', 'c'])
    })

    it('should handle object keys', () => {
      interface KeyType {
        id: number
      }

      const cache = new LRUCache<KeyType, string>({ maxSize: 5 })
      const key1 = { id: 1 }
      const key2 = { id: 2 }

      cache.set(key1, 'value1')
      cache.set(key2, 'value2')

      expect(cache.get(key1)).toBe('value1')
      expect(cache.get(key2)).toBe('value2')
    })

    it('should handle undefined and null values', () => {
      const cache = new LRUCache<string, string | null | undefined>({ maxSize: 5 })

      cache.set('null', null)
      cache.set('undefined', undefined)

      // Note: undefined values are treated as cache miss in Map
      expect(cache.get('null')).toBe(null)
      expect(cache.has('null')).toBe(true)
      expect(cache.has('undefined')).toBe(true)
    })
  })

  describe('stress test', () => {
    it('should handle many entries without errors', () => {
      const cache = new LRUCache<number, string>({ maxSize: 100 })

      // Add 1000 entries (will cause evictions)
      for (let i = 0; i < 1000; i++) {
        cache.set(i, `value${i}`)
      }

      // Cache should contain last 100 entries
      expect(cache.size).toBe(100)

      const stats = cache.getStats()
      expect(stats.evictions).toBe(900)

      // Verify most recent entries are present
      for (let i = 900; i < 1000; i++) {
        expect(cache.has(i)).toBe(true)
        expect(cache.get(i)).toBe(`value${i}`)
      }

      // Verify old entries are evicted
      for (let i = 0; i < 900; i++) {
        expect(cache.has(i)).toBe(false)
      }
    })

    it('should maintain correct order after many operations', () => {
      const cache = new LRUCache<string, number>({ maxSize: 3 })

      // Perform many mixed operations
      cache.set('a', 1)
      cache.set('b', 2)
      cache.set('c', 3)
      cache.get('a') // a is now most recent
      cache.set('b', 22) // b is now most recent
      cache.set('d', 4) // should evict c

      expect(cache.has('c')).toBe(false)
      expect(cache.has('a')).toBe(true)
      expect(cache.has('b')).toBe(true)
      expect(cache.has('d')).toBe(true)
    })
  })
})
