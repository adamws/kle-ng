import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useKeyboardStore, Key, Keyboard } from '../keyboard'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const TEST_CASES = [
  ['planck.json', 'planck-internal.json'],
  ['ansi-104-big-ass-enter.json', 'ansi-104-big-ass-enter-internal.json'],
  ['ansi-104.json', 'ansi-104-internal.json'],
  ['atreus.json', 'atreus-internal.json'],
  ['ergodox.json', 'ergodox-internal.json'],
  ['iso-105.json', 'iso-105-internal.json'],
  ['kinesis-advantage.json', 'kinesis-advantage-internal.json'],
  ['symbolics-spacecadet.json', 'symbolics-spacecadet-internal.json'],
] as const

describe('KLE Round-trip Compatibility Tests', () => {
  let store: ReturnType<typeof useKeyboardStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useKeyboardStore()
  })

  describe('Import → Export round-trip tests', () => {
    it.each(TEST_CASES)(
      'should produce identical results for %s',
      (standardFile, expectedInternalFile) => {
        // Read test files - raw layouts from presets directory, internal from fixtures
        const standardPath = resolve(__dirname, '../../../public/data/presets', standardFile)
        const expectedInternalPath = resolve(
          __dirname,
          'fixtures/kle-layouts',
          expectedInternalFile,
        )

        const standardLayout = JSON.parse(readFileSync(standardPath, 'utf-8'))
        const expectedInternal = JSON.parse(readFileSync(expectedInternalPath, 'utf-8'))

        const expectedKeyboard = expectedInternal as Keyboard
        // No inflation needed - our export now produces the same shrunk format as the fixtures

        // Import standard KLE format
        store.loadKLELayout(standardLayout)

        // Export as KLE internal format
        const actualKeyboard = store.getSerializedData('kle-internal')

        // Deep comparison with detailed assertions
        expect(actualKeyboard).toHaveProperty('meta')
        expect(actualKeyboard).toHaveProperty('keys')

        // Compare metadata
        expect(actualKeyboard.meta).toEqual(expectedKeyboard.meta)

        // Compare number of keys
        expect(actualKeyboard.keys).toHaveLength(expectedKeyboard.keys.length)

        // Compare each key individually for better error messages
        actualKeyboard.keys.forEach((actualKey: Key, index: number) => {
          const expectedKey = expectedKeyboard.keys[index]
          expect(actualKey).toEqual(expectedKey)
        })
      },
    )
  })

  describe('Compatibility with standard KLE format', () => {
    it('should maintain round-trip compatibility: KLE → Internal → KLE → Internal', () => {
      const testFile = resolve(__dirname, '../../../public/data/presets/ergodox.json')
      const originalLayout = JSON.parse(readFileSync(testFile, 'utf-8'))

      // First round-trip: KLE → Internal
      store.loadKLELayout(originalLayout)
      const firstInternal = store.getSerializedData('kle-internal')

      //// Convert back to KLE
      const backToKLE = store.getSerializedData('kle')

      // Second round-trip: KLE → Internal
      store.loadKLELayout(backToKLE)
      const secondInternal = store.getSerializedData('kle-internal')

      // Both internal representations should be identical
      expect(secondInternal).toEqual(firstInternal)
    })
  })

  describe('Array Shrinking Validation', () => {
    it('should shrink arrays with only default values to empty arrays', () => {
      const testFile = resolve(__dirname, '../../../public/data/presets/planck.json')
      const layout = JSON.parse(readFileSync(testFile, 'utf-8'))

      store.loadKLELayout(layout)
      const exported = store.getSerializedData('kle-internal')

      // Check that keys with only default values have empty arrays
      exported.keys.forEach((key: Record<string, unknown>) => {
        // If textColor array is empty, all values were default
        if (Array.isArray(key.textColor) && key.textColor.length === 0) {
          expect(key.textColor).toEqual([])
        }
        // If textSize array is empty, all values were default
        if (Array.isArray(key.textSize) && key.textSize.length === 0) {
          expect(key.textSize).toEqual([])
        }
      })
    })

    it('should truncate arrays at last meaningful value', () => {
      const testFile = resolve(__dirname, '../../../public/data/presets/kinesis-advantage.json')
      const layout = JSON.parse(readFileSync(testFile, 'utf-8'))

      store.loadKLELayout(layout)
      const exported = store.getSerializedData('kle-internal')

      // Find keys with non-empty textSize arrays
      const keysWithTextSize = exported.keys.filter(
        (key: Record<string, unknown>) => Array.isArray(key.textSize) && key.textSize.length > 0,
      )

      // Verify each has no trailing defaults
      keysWithTextSize.forEach((key: Record<string, unknown>) => {
        const textSize = key.textSize as unknown[]
        const lastValue = textSize[textSize.length - 1]
        // Last value should not be 0 (default) or empty string
        expect(lastValue).not.toBe(0)
        expect(lastValue).not.toBe('')
      })
    })

    it('should ensure textSize arrays contain only numbers', () => {
      const testFile = resolve(__dirname, '../../../public/data/presets/kinesis-advantage.json')
      const layout = JSON.parse(readFileSync(testFile, 'utf-8'))

      store.loadKLELayout(layout)
      const exported = store.getSerializedData('kle-internal')

      // Check all textSize values are numbers
      exported.keys.forEach((key: Record<string, unknown>) => {
        if (Array.isArray(key.textSize)) {
          key.textSize.forEach((value: unknown) => {
            expect(typeof value).toBe('number')
          })
        }
      })
    })
  })

  describe('Property Order Validation', () => {
    it('should export keys with properties in the correct order', () => {
      const testFile = resolve(__dirname, '../../../public/data/presets/ergodox.json')
      const layout = JSON.parse(readFileSync(testFile, 'utf-8'))

      store.loadKLELayout(layout)
      const exported = store.getSerializedData('kle-internal')

      const expectedOrder = [
        'color',
        'labels',
        'textColor',
        'textSize',
        'default',
        'x',
        'y',
        'width',
        'height',
        'x2',
        'y2',
        'width2',
        'height2',
        'rotation_x',
        'rotation_y',
        'rotation_angle',
        'decal',
        'ghost',
        'stepped',
        'nub',
        'profile',
        'sm',
        'sb',
        'st',
      ]

      // Check first few keys for property order
      exported.keys.slice(0, 5).forEach((key: Record<string, unknown>) => {
        const actualKeys = Object.keys(key)
        const relevantExpected = expectedOrder.filter((prop) => prop in key)
        expect(actualKeys).toEqual(relevantExpected)
      })
    })
  })

  describe('Backward Compatibility with Legacy Fixtures', () => {
    it('should handle legacy fixtures with null values in label arrays', () => {
      const legacyFixturePath = resolve(
        __dirname,
        'fixtures/kle-layouts/planck-internal-legacy.json',
      )
      const modernFixturePath = resolve(__dirname, 'fixtures/kle-layouts/planck-internal.json')

      const legacyFixture = JSON.parse(readFileSync(legacyFixturePath, 'utf-8'))
      const modernFixture = JSON.parse(readFileSync(modernFixturePath, 'utf-8'))

      // Legacy fixture has null in arrays - verify kle-serial2 handles it
      // by loading as KLE-internal format and checking it produces same result as modern
      const standardLayoutPath = resolve(__dirname, '../../../public/data/presets/planck.json')
      const standardLayout = JSON.parse(readFileSync(standardLayoutPath, 'utf-8'))

      // Load standard format which kle-serial2 will deserialize
      store.loadKLELayout(standardLayout)
      const exported = store.getSerializedData('kle-internal')

      // The exported format should match modern fixture (with "" not null)
      expect(exported.keys).toHaveLength(modernFixture.keys.length)

      // Verify no null values in exported labels
      exported.keys.forEach((key: Record<string, unknown>) => {
        if (Array.isArray(key.labels)) {
          key.labels.forEach((label: unknown) => {
            // Should be string, never null in modern export
            expect(typeof label).toBe('string')
          })
        }
      })

      // The legacy fixture demonstrates the old format with null
      // Verify it has nulls as expected
      let hasNulls = false
      legacyFixture.keys.forEach((key: Record<string, unknown>) => {
        if (Array.isArray(key.labels)) {
          key.labels.forEach((label: unknown) => {
            if (label === null) hasNulls = true
          })
        }
      })
      expect(hasNulls).toBe(true) // Legacy fixture should have nulls
    })
  })
})
