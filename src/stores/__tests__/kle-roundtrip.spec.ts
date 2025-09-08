import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useKeyboardStore, Key, KeyboardMetadata } from '../keyboard'
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
        const standardPath = resolve(__dirname, '../../data/presets', standardFile)
        const expectedInternalPath = resolve(
          __dirname,
          'fixtures/kle-layouts',
          expectedInternalFile,
        )

        const standardLayout = JSON.parse(readFileSync(standardPath, 'utf-8'))
        const expectedInternal = JSON.parse(readFileSync(expectedInternalPath, 'utf-8'))

        // Import standard KLE format
        store.loadKLELayout(standardLayout)

        // Export as KLE internal format
        const actualInternal = store.getSerializedData('kle-internal') as {
          meta: KeyboardMetadata
          keys: Key[]
        }

        // Deep comparison with detailed assertions
        expect(actualInternal).toHaveProperty('meta')
        expect(actualInternal).toHaveProperty('keys')

        // Compare metadata
        expect(actualInternal.meta).toEqual(expectedInternal.meta)

        // Compare number of keys
        expect(actualInternal.keys).toHaveLength(expectedInternal.keys.length)

        // Compare each key individually for better error messages
        actualInternal.keys.forEach((actualKey, index) => {
          const expectedKey = expectedInternal.keys[index]

          // Validate numeric precision for all numeric properties
          const numericProps = [
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
          ]

          numericProps.forEach((prop) => {
            const value = actualKey[prop as keyof Key]
            if (typeof value === 'number' && value !== Math.floor(value)) {
              const decimalPlaces = (value.toString().split('.')[1] || '').length
              expect(
                decimalPlaces,
                `Key ${index} ${prop}: ${value} should have ≤ 6 decimal places`,
              ).toBeLessThanOrEqual(6)
            }
          })

          // Compare basic properties
          expect(actualKey.x, `Key ${index}: x coordinate`).toBe(expectedKey.x)
          expect(actualKey.y, `Key ${index}: y coordinate`).toBe(expectedKey.y)
          expect(actualKey.width, `Key ${index}: width`).toBe(expectedKey.width)
          expect(actualKey.height, `Key ${index}: height`).toBe(expectedKey.height)

          // Compare positioning properties
          expect(actualKey.x2, `Key ${index}: x2`).toBe(expectedKey.x2)
          expect(actualKey.y2, `Key ${index}: y2`).toBe(expectedKey.y2)
          expect(actualKey.width2, `Key ${index}: width2`).toBe(expectedKey.width2)
          expect(actualKey.height2, `Key ${index}: height2`).toBe(expectedKey.height2)

          // Compare rotation properties
          expect(actualKey.rotation_x, `Key ${index}: rotation_x`).toBe(expectedKey.rotation_x)
          expect(actualKey.rotation_y, `Key ${index}: rotation_y`).toBe(expectedKey.rotation_y)
          expect(actualKey.rotation_angle, `Key ${index}: rotation_angle`).toBe(
            expectedKey.rotation_angle,
          )

          // Compare appearance properties
          expect(actualKey.color, `Key ${index}: color`).toBe(expectedKey.color)
          expect(actualKey.labels, `Key ${index}: labels`).toEqual(expectedKey.labels)
          expect(actualKey.textColor, `Key ${index}: textColor`).toEqual(expectedKey.textColor)
          expect(actualKey.textSize, `Key ${index}: textSize`).toEqual(expectedKey.textSize)
          expect(actualKey.default, `Key ${index}: default`).toEqual(expectedKey.default)

          // Compare boolean flags
          expect(actualKey.decal, `Key ${index}: decal`).toBe(expectedKey.decal)
          expect(actualKey.ghost, `Key ${index}: ghost`).toBe(expectedKey.ghost)
          expect(actualKey.stepped, `Key ${index}: stepped`).toBe(expectedKey.stepped)
          expect(actualKey.nub, `Key ${index}: nub`).toBe(expectedKey.nub)

          // Compare switch properties
          expect(actualKey.sm, `Key ${index}: switch mount`).toBe(expectedKey.sm)
          expect(actualKey.sb, `Key ${index}: switch brand`).toBe(expectedKey.sb)
          expect(actualKey.st, `Key ${index}: switch type`).toBe(expectedKey.st)

          // Compare profile
          expect(actualKey.profile, `Key ${index}: profile`).toBe(expectedKey.profile)
        })
      },
    )
  })

  describe('Compatibility with standard KLE format', () => {
    it('should maintain round-trip compatibility: KLE → Internal → KLE → Internal', () => {
      const testFile = resolve(__dirname, '../../data/presets/ergodox.json')
      const originalLayout = JSON.parse(readFileSync(testFile, 'utf-8'))

      // First round-trip: KLE → Internal
      store.loadKLELayout(originalLayout)
      const firstInternal = store.getSerializedData('kle-internal')

      // Convert back to KLE
      const backToKLE = store.getSerializedData('kle')

      // Second round-trip: KLE → Internal
      store.loadKLELayout(backToKLE)
      const secondInternal = store.getSerializedData('kle-internal')

      // Both internal representations should be identical
      expect(secondInternal).toEqual(firstInternal)
    })
  })
})
