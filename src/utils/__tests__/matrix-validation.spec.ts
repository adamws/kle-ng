/**
 * Tests for matrix validation utilities
 * Including option,choice parsing and duplicate validation
 */

import { describe, it, expect } from 'vitest'
import { Key } from '@adamws/kle-serial'
import {
  parseMatrixCoordinates,
  parseOptionChoice,
  hasOptionChoice,
  getKeyOption,
  getKeyChoice,
  validateMatrixDuplicates,
  getDefaultLayoutKeys,
} from '../matrix-validation'

// Helper to create a key with specific labels
function createKey(
  labels0: string = '',
  labels8: string = '',
  options: { ghost?: boolean; decal?: boolean } = {},
): Key {
  const key = new Key()
  key.labels[0] = labels0 // Matrix coordinates
  key.labels[8] = labels8 // Option,choice
  if (options.ghost) key.ghost = true
  if (options.decal) key.decal = true
  return key
}

describe('Matrix Validation', () => {
  describe('parseMatrixCoordinates', () => {
    it('should parse valid row,col format', () => {
      const key = createKey('0,0')
      expect(parseMatrixCoordinates(key)).toEqual({ row: 0, col: 0 })
    })

    it('should parse larger row,col values', () => {
      const key = createKey('5,12')
      expect(parseMatrixCoordinates(key)).toEqual({ row: 5, col: 12 })
    })

    it('should return null for empty label', () => {
      const key = createKey('')
      expect(parseMatrixCoordinates(key)).toEqual({ row: null, col: null })
    })

    it('should return null for invalid format', () => {
      const key = createKey('invalid')
      expect(parseMatrixCoordinates(key)).toEqual({ row: null, col: null })
    })

    it('should handle row-only format', () => {
      const key = createKey('3,')
      expect(parseMatrixCoordinates(key)).toEqual({ row: 3, col: null })
    })

    it('should handle col-only format', () => {
      const key = createKey(',5')
      expect(parseMatrixCoordinates(key)).toEqual({ row: null, col: 5 })
    })
  })

  describe('parseOptionChoice', () => {
    it('should parse valid option,choice format', () => {
      const key = createKey('', '0,0')
      expect(parseOptionChoice(key)).toEqual({ option: 0, choice: 0 })
    })

    it('should parse larger option,choice values', () => {
      const key = createKey('', '2,1')
      expect(parseOptionChoice(key)).toEqual({ option: 2, choice: 1 })
    })

    it('should return null for empty label', () => {
      const key = createKey('', '')
      expect(parseOptionChoice(key)).toBeNull()
    })

    it('should return null for invalid format', () => {
      const key = createKey('', 'invalid')
      expect(parseOptionChoice(key)).toBeNull()
    })

    it('should return null for partial format (option only)', () => {
      const key = createKey('', '0,')
      expect(parseOptionChoice(key)).toBeNull()
    })

    it('should return null for partial format (choice only)', () => {
      const key = createKey('', ',0')
      expect(parseOptionChoice(key)).toBeNull()
    })

    it('should handle whitespace', () => {
      const key = createKey('', '  1,2  ')
      expect(parseOptionChoice(key)).toEqual({ option: 1, choice: 2 })
    })

    it('should return null for negative numbers', () => {
      const key = createKey('', '-1,0')
      expect(parseOptionChoice(key)).toBeNull()
    })

    it('should return null for non-numeric values', () => {
      const key = createKey('', 'a,b')
      expect(parseOptionChoice(key)).toBeNull()
    })
  })

  describe('hasOptionChoice', () => {
    it('should return true when option,choice is present', () => {
      const key = createKey('0,0', '0,1')
      expect(hasOptionChoice(key)).toBe(true)
    })

    it('should return false when labels[8] is empty', () => {
      const key = createKey('0,0', '')
      expect(hasOptionChoice(key)).toBe(false)
    })

    it('should return false for invalid format', () => {
      const key = createKey('0,0', 'invalid')
      expect(hasOptionChoice(key)).toBe(false)
    })
  })

  describe('getKeyOption', () => {
    it('should return option number when present', () => {
      const key = createKey('', '3,1')
      expect(getKeyOption(key)).toBe(3)
    })

    it('should return null when option,choice is missing', () => {
      const key = createKey('', '')
      expect(getKeyOption(key)).toBeNull()
    })
  })

  describe('getKeyChoice', () => {
    it('should return choice number when present', () => {
      const key = createKey('', '3,2')
      expect(getKeyChoice(key)).toBe(2)
    })

    it('should return null when option,choice is missing', () => {
      const key = createKey('', '')
      expect(getKeyChoice(key)).toBeNull()
    })
  })

  describe('validateMatrixDuplicates', () => {
    it('should return valid for layout with no duplicates', () => {
      const keys = [createKey('0,0'), createKey('0,1'), createKey('1,0'), createKey('1,1')]

      const result = validateMatrixDuplicates(keys)

      expect(result.isValid).toBe(true)
      expect(result.duplicatesWithoutOption).toHaveLength(0)
      expect(result.validLayoutOptions).toHaveLength(0)
    })

    it('should detect invalid duplicates (no option,choice)', () => {
      const keys = [
        createKey('0,0'), // First key at 0,0
        createKey('0,0'), // Second key at 0,0 - duplicate without option,choice
        createKey('0,1'),
      ]

      const result = validateMatrixDuplicates(keys)

      expect(result.isValid).toBe(false)
      expect(result.duplicatesWithoutOption).toHaveLength(1)
      expect(result.duplicatesWithoutOption[0]?.position).toBe('0,0')
      expect(result.duplicatesWithoutOption[0]?.keys).toHaveLength(2)
    })

    it('should recognize valid layout options (all have option,choice)', () => {
      const keys = [
        createKey('0,0', '0,0'), // Key at 0,0 with option 0, choice 0
        createKey('0,0', '0,1'), // Key at 0,0 with option 0, choice 1
        createKey('0,1'),
      ]

      const result = validateMatrixDuplicates(keys)

      expect(result.isValid).toBe(true)
      expect(result.duplicatesWithoutOption).toHaveLength(0)
      expect(result.validLayoutOptions).toHaveLength(1)
      expect(result.validLayoutOptions[0]?.position).toBe('0,0')
      expect(result.validLayoutOptions[0]?.keys).toHaveLength(2)
    })

    it('should detect mixed duplicates (some with option,choice, some without)', () => {
      const keys = [
        createKey('0,0', '0,0'), // Has option,choice
        createKey('0,0'), // Missing option,choice - invalid
        createKey('0,1'),
      ]

      const result = validateMatrixDuplicates(keys)

      expect(result.isValid).toBe(false)
      expect(result.duplicatesWithoutOption).toHaveLength(1)
      expect(result.validLayoutOptions).toHaveLength(0)
    })

    it('should exclude ghost keys from validation', () => {
      const keys = [
        createKey('0,0'),
        createKey('0,0', '', { ghost: true }), // Ghost key - should be excluded
        createKey('0,1'),
      ]

      const result = validateMatrixDuplicates(keys)

      expect(result.isValid).toBe(true)
      expect(result.duplicatesWithoutOption).toHaveLength(0)
    })

    it('should exclude decal keys from validation', () => {
      const keys = [
        createKey('0,0'),
        createKey('0,0', '', { decal: true }), // Decal key - should be excluded
        createKey('0,1'),
      ]

      const result = validateMatrixDuplicates(keys)

      expect(result.isValid).toBe(true)
      expect(result.duplicatesWithoutOption).toHaveLength(0)
    })

    it('should handle keys without matrix coordinates', () => {
      const keys = [
        createKey('0,0'),
        createKey(''), // No matrix coordinates
        createKey('0,1'),
      ]

      const result = validateMatrixDuplicates(keys)

      expect(result.isValid).toBe(true)
      expect(result.duplicatesWithoutOption).toHaveLength(0)
    })

    it('should handle multiple duplicate positions', () => {
      const keys = [
        createKey('0,0'),
        createKey('0,0'), // Duplicate at 0,0
        createKey('1,1'),
        createKey('1,1'), // Duplicate at 1,1
      ]

      const result = validateMatrixDuplicates(keys)

      expect(result.isValid).toBe(false)
      expect(result.duplicatesWithoutOption).toHaveLength(2)
    })

    it('should return valid for empty keys array', () => {
      const result = validateMatrixDuplicates([])

      expect(result.isValid).toBe(true)
      expect(result.duplicatesWithoutOption).toHaveLength(0)
      expect(result.validLayoutOptions).toHaveLength(0)
    })
  })

  describe('getDefaultLayoutKeys', () => {
    it('should include keys without option,choice', () => {
      const keys = [createKey('0,0'), createKey('0,1'), createKey('1,0')]

      const result = getDefaultLayoutKeys(keys)

      expect(result).toHaveLength(3)
    })

    it('should include keys with choice=0', () => {
      const keys = [
        createKey('0,0', '0,0'), // Option 0, choice 0 - included
        createKey('0,0', '0,1'), // Option 0, choice 1 - excluded
        createKey('0,1'),
      ]

      const result = getDefaultLayoutKeys(keys)

      expect(result).toHaveLength(2)
      expect(result.some((k) => k.labels[8] === '0,0')).toBe(true)
      expect(result.some((k) => k.labels[8] === '0,1')).toBe(false)
    })

    it('should exclude keys without matrix coordinates', () => {
      const keys = [
        createKey('0,0'),
        createKey(''), // No matrix coordinates
        createKey('0,1'),
      ]

      const result = getDefaultLayoutKeys(keys)

      expect(result).toHaveLength(2)
    })

    it('should exclude ghost keys', () => {
      const keys = [createKey('0,0'), createKey('0,1', '', { ghost: true })]

      const result = getDefaultLayoutKeys(keys)

      expect(result).toHaveLength(1)
    })

    it('should exclude decal keys', () => {
      const keys = [createKey('0,0'), createKey('0,1', '', { decal: true })]

      const result = getDefaultLayoutKeys(keys)

      expect(result).toHaveLength(1)
    })

    it('should include keys with different options but all choice=0', () => {
      const keys = [
        createKey('0,0', '0,0'), // Option 0, choice 0
        createKey('0,1', '1,0'), // Option 1, choice 0
        createKey('1,0', '2,0'), // Option 2, choice 0
      ]

      const result = getDefaultLayoutKeys(keys)

      expect(result).toHaveLength(3)
    })

    it('should handle empty keys array', () => {
      const result = getDefaultLayoutKeys([])

      expect(result).toHaveLength(0)
    })
  })
})
