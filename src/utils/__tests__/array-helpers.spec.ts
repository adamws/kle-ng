/**
 * Tests for Array12 utility functions
 */

import { describe, it, expect } from 'vitest'
import {
  isArray12,
  ensureArray12,
  createEmptyLabels,
  createEmptyTextColors,
  createEmptyTextSizes,
  shrinkArray,
  cloneArray12,
} from '../array-helpers'
import type { Array12 } from '@adamws/kle-serial'

describe('Array Helpers', () => {
  describe('isArray12', () => {
    it('should return true for array with exactly 12 elements', () => {
      const arr = Array(12).fill('')
      expect(isArray12(arr)).toBe(true)
    })

    it('should return false for array with less than 12 elements', () => {
      const arr = Array(11).fill('')
      expect(isArray12(arr)).toBe(false)
    })

    it('should return false for array with more than 12 elements', () => {
      const arr = Array(13).fill('')
      expect(isArray12(arr)).toBe(false)
    })

    it('should return false for empty array', () => {
      expect(isArray12([])).toBe(false)
    })
  })

  describe('ensureArray12', () => {
    it('should return array as-is if already 12 elements', () => {
      const arr = Array(12).fill('x')
      const result = ensureArray12(arr, '')
      expect(result).toHaveLength(12)
      expect(result.every((v) => v === 'x')).toBe(true)
    })

    it('should pad short array with default values', () => {
      const arr = ['a', 'b', 'c']
      const result = ensureArray12(arr, '')
      expect(result).toHaveLength(12)
      expect(result[0]).toBe('a')
      expect(result[1]).toBe('b')
      expect(result[2]).toBe('c')
      expect(result[3]).toBe('')
      expect(result[11]).toBe('')
    })

    it('should truncate long array to 12 elements', () => {
      const arr = Array(20).fill('x')
      const result = ensureArray12(arr, '')
      expect(result).toHaveLength(12)
    })

    it('should pad empty array', () => {
      const result = ensureArray12([], 'default')
      expect(result).toHaveLength(12)
      expect(result.every((v) => v === 'default')).toBe(true)
    })
  })

  describe('createEmptyLabels', () => {
    it('should create array of 12 empty strings', () => {
      const result = createEmptyLabels()
      expect(result).toHaveLength(12)
      expect(result.every((v) => v === '')).toBe(true)
    })
  })

  describe('createEmptyTextColors', () => {
    it('should create array of 12 empty strings', () => {
      const result = createEmptyTextColors()
      expect(result).toHaveLength(12)
      expect(result.every((v) => v === '')).toBe(true)
    })
  })

  describe('createEmptyTextSizes', () => {
    it('should create array of 12 zeros', () => {
      const result = createEmptyTextSizes()
      expect(result).toHaveLength(12)
      expect(result.every((v) => v === 0)).toBe(true)
    })
  })

  describe('shrinkArray', () => {
    it('should return empty array when all values are empty', () => {
      const arr = Array(12).fill('')
      expect(shrinkArray(arr)).toEqual([])
    })

    it('should return empty array when all values are 0', () => {
      const arr = Array(12).fill(0)
      expect(shrinkArray(arr)).toEqual([])
    })

    it('should truncate at last meaningful value', () => {
      const arr = ['a', 'b', '', '', '']
      expect(shrinkArray(arr)).toEqual(['a', 'b'])
    })

    it('should keep trailing meaningful values', () => {
      const arr = ['', '', '', 'x']
      expect(shrinkArray(arr)).toEqual(['', '', '', 'x'])
    })

    it('should treat 0, empty string, and -1 as empty', () => {
      const arr = ['a', 0, '', -1, 'b', 0, '', -1]
      expect(shrinkArray(arr)).toEqual(['a', 0, '', -1, 'b'])
    })

    it('should handle mixed types', () => {
      const arr = [1, 2, 3, 0, 0, 0]
      expect(shrinkArray(arr)).toEqual([1, 2, 3])
    })

    it('should handle null and undefined as empty', () => {
      const arr = ['a', null, undefined, 'b', null, undefined]
      expect(shrinkArray(arr)).toEqual(['a', null, undefined, 'b'])
    })

    it('should return empty array for all null/undefined', () => {
      const arr = [null, undefined, null, undefined]
      expect(shrinkArray(arr)).toEqual([])
    })
  })

  describe('cloneArray12', () => {
    it('should create a new array with same values', () => {
      const original: Array12<string> = [
        'a',
        'b',
        'c',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
      ] as Array12<string>
      const clone = cloneArray12(original)

      expect(clone).toEqual(original)
      expect(clone).not.toBe(original) // Different reference
    })

    it('should not affect original when clone is modified', () => {
      const original: Array12<number> = [1, 2, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0] as Array12<number>
      const clone = cloneArray12(original)

      clone[0] = 999
      expect(original[0]).toBe(1)
      expect(clone[0]).toBe(999)
    })
  })
})
