import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useKeyboardStore } from '../keyboard'

describe('Matrix Coordinates', () => {
  let store: ReturnType<typeof useKeyboardStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useKeyboardStore()
    // Clear the default sample layout
    store.clearLayout()
  })

  describe('addMatrixCoordinates', () => {
    it('should add matrix coordinates to simple 3x3 grid', () => {
      // Create a simple 3x3 grid layout
      const keys = [
        // Row 0
        { x: 0, y: 0, labels: ['Q', '', '', '', '', '', '', '', '', '', '', ''] },
        { x: 1, y: 0, labels: ['W', '', '', '', '', '', '', '', '', '', '', ''] },
        { x: 2, y: 0, labels: ['E', '', '', '', '', '', '', '', '', '', '', ''] },
        // Row 1
        { x: 0, y: 1, labels: ['A', '', '', '', '', '', '', '', '', '', '', ''] },
        { x: 1, y: 1, labels: ['S', '', '', '', '', '', '', '', '', '', '', ''] },
        { x: 2, y: 1, labels: ['D', '', '', '', '', '', '', '', '', '', '', ''] },
        // Row 2
        { x: 0, y: 2, labels: ['Z', '', '', '', '', '', '', '', '', '', '', ''] },
        { x: 1, y: 2, labels: ['X', '', '', '', '', '', '', '', '', '', '', ''] },
        { x: 2, y: 2, labels: ['C', '', '', '', '', '', '', '', '', '', '', ''] },
      ]

      keys.forEach((keyData) => store.addKey(keyData))

      // Apply matrix coordinates
      store.addMatrixCoordinates()

      // Check that all keys have matrix coordinates in position 0
      // Key centers are (x + 0.5, y + 0.5), rounded to nearest integer
      expect(store.keys[0].labels[0]).toBe('1,1') // Q key center (0.5, 0.5) -> (1, 1)
      expect(store.keys[1].labels[0]).toBe('1,2') // W key center (1.5, 0.5) -> (1, 2)
      expect(store.keys[2].labels[0]).toBe('1,3') // E key center (2.5, 0.5) -> (1, 3)
      expect(store.keys[3].labels[0]).toBe('2,1') // A key center (0.5, 1.5) -> (2, 1)
      expect(store.keys[4].labels[0]).toBe('2,2') // S key center (1.5, 1.5) -> (2, 2)
      expect(store.keys[5].labels[0]).toBe('2,3') // D key center (2.5, 1.5) -> (2, 3)
      expect(store.keys[6].labels[0]).toBe('3,1') // Z key center (0.5, 2.5) -> (3, 1)
      expect(store.keys[7].labels[0]).toBe('3,2') // X key center (1.5, 2.5) -> (3, 2)
      expect(store.keys[8].labels[0]).toBe('3,3') // C key center (2.5, 2.5) -> (3, 3)

      // Check that all other label positions are cleared
      store.keys.forEach((key) => {
        for (let i = 1; i < 12; i++) {
          expect(key.labels[i]).toBe('')
        }
      })
    })

    it('should handle keys with non-standard sizes', () => {
      // Create keys with different widths and heights
      const keys = [
        { x: 0, y: 0, width: 2, height: 1 }, // 2u wide key
        { x: 2, y: 0, width: 1, height: 2 }, // 2u tall key
        { x: 0, y: 1, width: 1.5, height: 1 }, // 1.5u wide key
      ]

      keys.forEach((keyData) => store.addKey(keyData))
      store.addMatrixCoordinates()

      // Check coordinates are based on key centers
      expect(store.keys[0].labels[0]).toBe('1,1') // Center of 2u wide key at (0,0) is at (1, 0.5) -> rounds to (1, 1)
      expect(store.keys[1].labels[0]).toBe('1,3') // Center of 2u tall key at (2,0) is at (2.5, 1) -> rounds to (1, 3)
      expect(store.keys[2].labels[0]).toBe('2,1') // Center of 1.5u wide key at (0,1) is at (0.75, 1.5) -> rounds to (2, 1)
    })

    it('should handle rotated keys correctly', () => {
      // Create a rotated key
      const rotatedKey = {
        x: 1,
        y: 1,
        width: 1,
        height: 1,
        rotation_angle: 45,
        rotation_x: 1.5,
        rotation_y: 1.5,
      }

      store.addKey(rotatedKey)
      store.addMatrixCoordinates()

      // The key center should be calculated with rotation applied
      const key = store.keys[0]
      expect(key.labels[0]).toMatch(/^\d+,\d+$/) // Should have format "row,col"
    })

    it('should clear all existing legends and text formatting', () => {
      // Create a key with legends and formatting
      const key = {
        x: 0,
        y: 0,
        labels: ['Q', 'q', '', '', 'Ctrl', '', '', '', '', '', '', ''],
        textColor: ['#ff0000', '#00ff00', undefined, undefined, '#0000ff'],
        textSize: [12, 14, undefined, undefined, 16],
      }

      store.addKey(key)
      store.addMatrixCoordinates()

      const resultKey = store.keys[0]

      // Check that only position 0 has content (the matrix coordinate)
      expect(resultKey.labels[0]).toMatch(/^\d+,\d+$/)
      for (let i = 1; i < 12; i++) {
        expect(resultKey.labels[i]).toBe('')
      }

      // Check that text formatting is cleared
      if (resultKey.textColor) {
        for (let i = 0; i < resultKey.textColor.length; i++) {
          if (i !== 0) {
            expect(resultKey.textColor[i]).toBeUndefined()
          }
        }
      }

      if (resultKey.textSize) {
        for (let i = 0; i < resultKey.textSize.length; i++) {
          if (i !== 0) {
            expect(resultKey.textSize[i]).toBeUndefined()
          }
        }
      }
    })

    it('should save state and mark as dirty', () => {
      store.addKey({ x: 0, y: 0 })
      const initialHistoryLength = store.history.length

      store.addMatrixCoordinates()

      expect(store.history.length).toBe(initialHistoryLength + 1)
      expect(store.dirty).toBe(true)
    })

    it('should handle empty layout gracefully', () => {
      // Ensure layout is empty
      expect(store.keys).toHaveLength(0)

      // Should not throw error
      expect(() => store.addMatrixCoordinates()).not.toThrow()

      // Should still save state and mark dirty
      expect(store.dirty).toBe(true)
    })

    it('should generate coordinates in row,column format', () => {
      store.addKey({ x: 5, y: 3 })
      store.addMatrixCoordinates()

      const coordinate = store.keys[0].labels[0]
      expect(coordinate).toMatch(/^\d+,\d+$/)

      const [row, col] = coordinate.split(',').map(Number)
      expect(row).toBe(4) // y-coordinate (3 + 0.5) becomes row
      expect(col).toBe(6) // x-coordinate (5 + 0.5) becomes column
    })

    it('should round coordinates to nearest integer', () => {
      // Create keys at fractional positions
      const keys = [
        { x: 0.3, y: 0.7 }, // Should round to 0,0
        { x: 1.6, y: 1.4 }, // Should round to 1,2
        { x: 2.8, y: 2.2 }, // Should round to 2,3
      ]

      keys.forEach((keyData) => store.addKey(keyData))
      store.addMatrixCoordinates()

      expect(store.keys[0].labels[0]).toBe('1,1') // (0.3 + 0.5, 0.7 + 0.5) = (0.8, 1.2) -> rounds to (1, 1)
      expect(store.keys[1].labels[0]).toBe('2,2') // (1.6 + 0.5, 1.4 + 0.5) = (2.1, 1.9) -> rounds to (2, 2)
      expect(store.keys[2].labels[0]).toBe('3,3') // (2.8 + 0.5, 2.2 + 0.5) = (3.3, 2.7) -> rounds to (3, 3)
    })
  })

  describe('isViaAnnotated', () => {
    it('should return false for empty layout', () => {
      expect(store.isViaAnnotated).toBe(false)
    })

    it('should return false for layout without VIA annotations', () => {
      store.addKey({ x: 0, y: 0, labels: ['Q', '', '', '', '', '', '', '', '', '', '', ''] })
      store.addKey({ x: 1, y: 0, labels: ['W', '', '', '', '', '', '', '', '', '', '', ''] })

      expect(store.isViaAnnotated).toBe(false)
    })

    it('should return true for fully VIA-annotated layout', () => {
      store.addKey({ x: 0, y: 0, labels: ['0,0', '', '', '', '', '', '', '', '', '', '', ''] })
      store.addKey({ x: 1, y: 0, labels: ['0,1', '', '', '', '', '', '', '', '', '', '', ''] })
      store.addKey({ x: 2, y: 0, labels: ['0,2', '', '', '', '', '', '', '', '', '', '', ''] })

      expect(store.isViaAnnotated).toBe(true)
    })

    it('should return false if only some keys have VIA annotations', () => {
      store.addKey({ x: 0, y: 0, labels: ['0,0', '', '', '', '', '', '', '', '', '', '', ''] })
      store.addKey({ x: 1, y: 0, labels: ['W', '', '', '', '', '', '', '', '', '', '', ''] })
      store.addKey({ x: 2, y: 0, labels: ['0,2', '', '', '', '', '', '', '', '', '', '', ''] })

      expect(store.isViaAnnotated).toBe(false)
    })

    it('should accept various valid VIA coordinate formats', () => {
      store.addKey({ x: 0, y: 0, labels: ['0,0', '', '', '', '', '', '', '', '', '', '', ''] })
      store.addKey({ x: 1, y: 0, labels: ['12,34', '', '', '', '', '', '', '', '', '', '', ''] })
      store.addKey({ x: 2, y: 0, labels: ['100,200', '', '', '', '', '', '', '', '', '', '', ''] })

      expect(store.isViaAnnotated).toBe(true)
    })

    it('should ignore decal keys when checking annotations', () => {
      store.addKey({ x: 0, y: 0, labels: ['0,0', '', '', '', '', '', '', '', '', '', '', ''] })
      store.addKey({
        x: 1,
        y: 0,
        labels: ['Not a coordinate', '', '', '', '', '', '', '', '', '', '', ''],
        decal: true,
      })

      expect(store.isViaAnnotated).toBe(true)
    })

    it('should ignore ghost keys when checking annotations', () => {
      store.addKey({ x: 0, y: 0, labels: ['0,0', '', '', '', '', '', '', '', '', '', '', ''] })
      store.addKey({
        x: 1,
        y: 0,
        labels: ['Not a coordinate', '', '', '', '', '', '', '', '', '', '', ''],
        ghost: true,
      })

      expect(store.isViaAnnotated).toBe(true)
    })

    it('should reject invalid VIA formats', () => {
      // Just text
      store.clearLayout()
      store.addKey({ x: 0, y: 0, labels: ['ABC', '', '', '', '', '', '', '', '', '', '', ''] })
      expect(store.isViaAnnotated).toBe(false)

      // Missing comma
      store.clearLayout()
      store.addKey({ x: 0, y: 0, labels: ['00', '', '', '', '', '', '', '', '', '', '', ''] })
      expect(store.isViaAnnotated).toBe(false)

      // Extra comma
      store.clearLayout()
      store.addKey({ x: 0, y: 0, labels: ['0,0,0', '', '', '', '', '', '', '', '', '', '', ''] })
      expect(store.isViaAnnotated).toBe(false)

      // Negative numbers
      store.clearLayout()
      store.addKey({ x: 0, y: 0, labels: ['-1,0', '', '', '', '', '', '', '', '', '', '', ''] })
      expect(store.isViaAnnotated).toBe(false)

      // Decimal numbers
      store.clearLayout()
      store.addKey({ x: 0, y: 0, labels: ['0.5,1.5', '', '', '', '', '', '', '', '', '', '', ''] })
      expect(store.isViaAnnotated).toBe(false)

      // Empty label
      store.clearLayout()
      store.addKey({ x: 0, y: 0, labels: ['', '', '', '', '', '', '', '', '', '', '', ''] })
      expect(store.isViaAnnotated).toBe(false)
    })

    it('should handle whitespace in VIA coordinates', () => {
      store.addKey({ x: 0, y: 0, labels: [' 0,0 ', '', '', '', '', '', '', '', '', '', '', ''] })
      store.addKey({ x: 1, y: 0, labels: ['  1,2  ', '', '', '', '', '', '', '', '', '', '', ''] })

      expect(store.isViaAnnotated).toBe(true)
    })

    it('should return false for layout with only decal/ghost keys', () => {
      store.addKey({
        x: 0,
        y: 0,
        labels: ['0,0', '', '', '', '', '', '', '', '', '', '', ''],
        decal: true,
      })
      store.addKey({
        x: 1,
        y: 0,
        labels: ['0,1', '', '', '', '', '', '', '', '', '', '', ''],
        ghost: true,
      })

      expect(store.isViaAnnotated).toBe(false)
    })

    it('should update when keys are added or removed', () => {
      // Initially no keys
      expect(store.isViaAnnotated).toBe(false)

      // Add VIA annotated keys
      store.addKey({ x: 0, y: 0, labels: ['0,0', '', '', '', '', '', '', '', '', '', '', ''] })
      expect(store.isViaAnnotated).toBe(true)

      // Add non-annotated key
      store.addKey({ x: 1, y: 0, labels: ['W', '', '', '', '', '', '', '', '', '', '', ''] })
      expect(store.isViaAnnotated).toBe(false)

      // Clear layout
      store.clearLayout()
      expect(store.isViaAnnotated).toBe(false)
    })

    it('should detect annotation after running addMatrixCoordinates', () => {
      store.addKey({ x: 0, y: 0, labels: ['Q', '', '', '', '', '', '', '', '', '', '', ''] })
      store.addKey({ x: 1, y: 0, labels: ['W', '', '', '', '', '', '', '', '', '', '', ''] })

      expect(store.isViaAnnotated).toBe(false)

      store.addMatrixCoordinates()

      expect(store.isViaAnnotated).toBe(true)
    })
  })
})
