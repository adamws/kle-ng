import { describe, it, expect } from 'vitest'
import { calculateKeyboardDimensions } from '../keyboard-dimensions'
import { Key } from '@adamws/kle-serial'

describe('keyboard-dimensions', () => {
  describe('calculateKeyboardDimensions', () => {
    it('returns null for empty keyboard', () => {
      const result = calculateKeyboardDimensions([])
      expect(result).toBeNull()
    })

    it('returns null for keyboard with only decal keys', () => {
      const key = new Key()
      key.x = 0
      key.y = 0
      key.width = 1
      key.height = 1
      key.decal = true

      const result = calculateKeyboardDimensions([key])
      expect(result).toBeNull()
    })

    it('returns null for keyboard with only ghost keys', () => {
      const key = new Key()
      key.x = 0
      key.y = 0
      key.width = 1
      key.height = 1
      key.ghost = true

      const result = calculateKeyboardDimensions([key])
      expect(result).toBeNull()
    })

    it('calculates dimensions for simple 1x1 key at origin', () => {
      const key = new Key()
      key.x = 0
      key.y = 0
      key.width = 1
      key.height = 1

      const result = calculateKeyboardDimensions([key])
      expect(result).not.toBeNull()
      expect(result!.width).toBeCloseTo(1, 1)
      expect(result!.height).toBeCloseTo(1, 1)
      expect(result!.widthFormatted).toBe('1')
      expect(result!.heightFormatted).toBe('1')
    })

    it('calculates dimensions for simple 2x2 layout', () => {
      const keys = [
        Object.assign(new Key(), { x: 0, y: 0, width: 1, height: 1 }),
        Object.assign(new Key(), { x: 1, y: 0, width: 1, height: 1 }),
        Object.assign(new Key(), { x: 0, y: 1, width: 1, height: 1 }),
        Object.assign(new Key(), { x: 1, y: 1, width: 1, height: 1 }),
      ]

      const result = calculateKeyboardDimensions(keys)
      expect(result).not.toBeNull()
      expect(result!.width).toBeCloseTo(2, 1)
      expect(result!.height).toBeCloseTo(2, 1)
    })

    it('calculates dimensions for Planck-style 12x4 layout', () => {
      const keys = []
      for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 12; col++) {
          keys.push(Object.assign(new Key(), { x: col, y: row, width: 1, height: 1 }))
        }
      }

      const result = calculateKeyboardDimensions(keys)
      expect(result).not.toBeNull()
      expect(result!.width).toBeCloseTo(12, 1)
      expect(result!.height).toBeCloseTo(4, 1)
    })

    it('ignores decal keys in dimension calculation', () => {
      const keys = [
        Object.assign(new Key(), { x: 0, y: 0, width: 1, height: 1 }),
        Object.assign(new Key(), { x: 10, y: 10, width: 5, height: 5, decal: true }),
      ]

      const result = calculateKeyboardDimensions(keys)
      expect(result).not.toBeNull()
      // Should only consider the first key
      expect(result!.width).toBeCloseTo(1, 1)
      expect(result!.height).toBeCloseTo(1, 1)
    })

    it('ignores ghost keys in dimension calculation', () => {
      const keys = [
        Object.assign(new Key(), { x: 0, y: 0, width: 1, height: 1 }),
        Object.assign(new Key(), { x: 20, y: 20, width: 5, height: 5, ghost: true }),
      ]

      const result = calculateKeyboardDimensions(keys)
      expect(result).not.toBeNull()
      // Should only consider the first key
      expect(result!.width).toBeCloseTo(1, 1)
      expect(result!.height).toBeCloseTo(1, 1)
    })

    it('ignores both decal and ghost keys', () => {
      const keys = [
        Object.assign(new Key(), { x: 0, y: 0, width: 1, height: 1 }),
        Object.assign(new Key(), { x: 10, y: 10, width: 5, height: 5, decal: true }),
        Object.assign(new Key(), { x: 20, y: 20, width: 5, height: 5, ghost: true }),
      ]

      const result = calculateKeyboardDimensions(keys)
      expect(result).not.toBeNull()
      expect(result!.width).toBeCloseTo(1, 1)
      expect(result!.height).toBeCloseTo(1, 1)
    })

    it('handles keys with different sizes', () => {
      const keys = [
        Object.assign(new Key(), { x: 0, y: 0, width: 1, height: 1 }),
        Object.assign(new Key(), { x: 1, y: 0, width: 2.25, height: 1 }), // Left shift size
        Object.assign(new Key(), { x: 0, y: 1, width: 1.5, height: 1 }), // Tab size
        Object.assign(new Key(), { x: 1.5, y: 1, width: 6.25, height: 1 }), // Spacebar size
      ]

      const result = calculateKeyboardDimensions(keys)
      expect(result).not.toBeNull()
      // Width: 1.5 + 6.25 = 7.75
      expect(result!.width).toBeCloseTo(7.75, 1)
      expect(result!.height).toBeCloseTo(2, 1)
    })

    it('calculates dimensions for rotated keys (Atreus-style)', () => {
      // Simplified Atreus layout: keys at different rotation origins
      const keys = [
        // Left side - rotated 10 degrees
        Object.assign(new Key(), {
          x: 0,
          y: 0,
          width: 1,
          height: 1,
          rotation_angle: 10,
          rotation_x: 2,
          rotation_y: 2,
        }),
        Object.assign(new Key(), {
          x: 1,
          y: 0,
          width: 1,
          height: 1,
          rotation_angle: 10,
          rotation_x: 2,
          rotation_y: 2,
        }),
        // Right side - rotated -10 degrees
        Object.assign(new Key(), {
          x: 3,
          y: 0,
          width: 1,
          height: 1,
          rotation_angle: -10,
          rotation_x: 2,
          rotation_y: 2,
        }),
        Object.assign(new Key(), {
          x: 4,
          y: 0,
          width: 1,
          height: 1,
          rotation_angle: -10,
          rotation_x: 2,
          rotation_y: 2,
        }),
      ]

      const result = calculateKeyboardDimensions(keys)
      expect(result).not.toBeNull()
      // With rotation, bounding box should be larger than simple 5×1
      expect(result!.width).toBeGreaterThan(4)
      // Should have some height due to rotation
      expect(result!.height).toBeGreaterThan(1)
    })

    it('handles non-rectangular keys (ISO Enter)', () => {
      const isoEnter = new Key()
      isoEnter.x = 0
      isoEnter.y = 0
      isoEnter.width = 1.25
      isoEnter.height = 2
      isoEnter.x2 = 0.25
      isoEnter.y2 = -1
      isoEnter.width2 = 1.5
      isoEnter.height2 = 1

      const result = calculateKeyboardDimensions([isoEnter])
      expect(result).not.toBeNull()
      // Width should account for secondary rectangle: max(1.25, 0.25 + 1.5) = 1.75
      expect(result!.width).toBeCloseTo(1.75, 1)
      // Height should be 3 (y2=-1 extends from -1 to main height of 2, total 3)
      expect(result!.height).toBeCloseTo(3, 1)
    })

    it('handles negative coordinates', () => {
      const keys = [
        Object.assign(new Key(), { x: -1, y: -1, width: 1, height: 1 }),
        Object.assign(new Key(), { x: 0, y: 0, width: 1, height: 1 }),
        Object.assign(new Key(), { x: 1, y: 1, width: 1, height: 1 }),
      ]

      const result = calculateKeyboardDimensions(keys)
      expect(result).not.toBeNull()
      // From -1 to 2 (1+1)
      expect(result!.width).toBeCloseTo(3, 1)
      expect(result!.height).toBeCloseTo(3, 1)
    })

    it('formats dimensions to 6 decimal place', () => {
      const keys = [Object.assign(new Key(), { x: 0, y: 0, width: 2.25, height: 1.0123456 })]

      const result = calculateKeyboardDimensions(keys)
      expect(result).not.toBeNull()
      expect(result!.widthFormatted).toBe('2.25')
      expect(result!.heightFormatted).toBe('1.012346')
    })

    it('handles very large layouts efficiently', () => {
      // Create a 100×100 grid (10,000 keys)
      const keys = []
      for (let row = 0; row < 100; row++) {
        for (let col = 0; col < 100; col++) {
          keys.push(Object.assign(new Key(), { x: col, y: row, width: 1, height: 1 }))
        }
      }

      const startTime = performance.now()
      const result = calculateKeyboardDimensions(keys)
      const endTime = performance.now()

      expect(result).not.toBeNull()
      expect(result!.width).toBeCloseTo(100, 1)
      expect(result!.height).toBeCloseTo(100, 1)
      // Should complete in reasonable time (< 50ms)
      expect(endTime - startTime).toBeLessThan(50)
    })
  })
})
