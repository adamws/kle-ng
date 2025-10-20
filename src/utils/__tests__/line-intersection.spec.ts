import { describe, it, expect } from 'vitest'
import { lineIntersectsKey, findKeysAlongLine } from '../line-intersection'
import type { Key } from '@/stores/keyboard'

describe('line-intersection', () => {
  describe('lineIntersectsKey', () => {
    it('horizontal line intersects standard 1u key', () => {
      const key = { x: 0, y: 0, width: 1, height: 1 } as Key
      const lineStart = { x: -1, y: 0.5 } // Horizontal line through key center Y
      const lineEnd = { x: 2, y: 0.5 }

      const result = lineIntersectsKey(lineStart, lineEnd, key)

      expect(result).toBe(true)
    })

    it('horizontal line does NOT intersect key 1u above (perpendicular distance > threshold)', () => {
      const key = { x: 0, y: 0, width: 1, height: 1 } as Key
      const lineStart = { x: -1, y: -1 } // 1u above the key
      const lineEnd = { x: 2, y: -1 }

      const result = lineIntersectsKey(lineStart, lineEnd, key)

      // Perpendicular distance is 1.5u (from center at 0.5 to line at -1)
      // Threshold for horizontal line is height/2 = 0.5u
      expect(result).toBe(false)
    })

    it('horizontal line does NOT intersect key 1u below', () => {
      const key = { x: 0, y: 0, width: 1, height: 1 } as Key
      const lineStart = { x: -1, y: 1.6 } // > 1u below the key center
      const lineEnd = { x: 2, y: 1.6 }

      const result = lineIntersectsKey(lineStart, lineEnd, key)

      expect(result).toBe(false)
    })

    it('vertical line intersects standard 1u key', () => {
      const key = { x: 0, y: 0, width: 1, height: 1 } as Key
      const lineStart = { x: 0.5, y: -1 } // Vertical line through key center X
      const lineEnd = { x: 0.5, y: 2 }

      const result = lineIntersectsKey(lineStart, lineEnd, key)

      expect(result).toBe(true)
    })

    it('vertical line does NOT intersect key 1u left', () => {
      const key = { x: 0, y: 0, width: 1, height: 1 } as Key
      const lineStart = { x: -1, y: -1 } // 1u left of the key
      const lineEnd = { x: -1, y: 2 }

      const result = lineIntersectsKey(lineStart, lineEnd, key)

      expect(result).toBe(false)
    })

    it('vertical line does NOT intersect key 1u right', () => {
      const key = { x: 0, y: 0, width: 1, height: 1 } as Key
      const lineStart = { x: 1.6, y: -1 } // > 1u right of the key center
      const lineEnd = { x: 1.6, y: 2 }

      const result = lineIntersectsKey(lineStart, lineEnd, key)

      expect(result).toBe(false)
    })

    it('diagonal line (45°) intersects keys along path', () => {
      const key = { x: 1, y: 1, width: 1, height: 1 } as Key
      const lineStart = { x: 0, y: 0 }
      const lineEnd = { x: 3, y: 3 } // 45° diagonal line

      const result = lineIntersectsKey(lineStart, lineEnd, key)

      // Line passes through center (1.5, 1.5) - should intersect
      expect(result).toBe(true)
    })

    it('CRITICAL: horizontal line at y=2.5 does NOT intersect 2u spacebar at y=3.5 (Planck bug)', () => {
      // Planck scenario: horizontal line at row 3 (y between 2 and 3, e.g., 2.5u)
      // 2u spacebar at row 4 (y=3, height=1, so center at y=3.5u)
      const lineStart = { x: 1.5, y: 2.5 }
      const lineEnd = { x: 11.5, y: 2.5 }
      const spacebar = { x: 5, y: 3, width: 2, height: 1 } as Key

      const result = lineIntersectsKey(lineStart, lineEnd, spacebar)

      // Perpendicular distance is |3.5 - 2.5| = 1.0u
      // Threshold for horizontal line should be height/2 = 0.5u (not diagonal/2 ≈ 1.12u)
      expect(result).toBe(false)
    })

    it('line intersects rotated key correctly (ErgoDox thumb cluster)', () => {
      // ErgoDox thumb cluster: r:30, rx:6.5, ry:4.25
      const key = {
        x: 1,
        y: 0,
        width: 1,
        height: 1,
        rotation_angle: 30,
        rotation_x: 6.5,
        rotation_y: 4.25,
      } as Key

      // Get actual rotated center (from keyboard-geometry tests: ~4.045, ~-1.5)
      // Draw line through that center
      const lineStart = { x: 3, y: -1.5 }
      const lineEnd = { x: 5, y: -1.5 }

      const result = lineIntersectsKey(lineStart, lineEnd, key)

      // For rotated keys, we use diagonal/2 as threshold (~0.707u)
      // Line passes near center, should intersect
      expect(result).toBe(true)
    })

    it('line intersects ISO Enter key (rotated 90° + 2u tall)', () => {
      const isoEnter = {
        x: 13,
        y: 1,
        width: 1.25,
        height: 2,
        rotation_angle: 90,
        rotation_x: 13.5,
        rotation_y: 1.5,
      } as Key

      // Draw line through its center area
      const lineStart = { x: 12, y: 1.5 }
      const lineEnd = { x: 15, y: 1.5 }

      const result = lineIntersectsKey(lineStart, lineEnd, isoEnter)

      expect(result).toBe(true)
    })

    it('edge case: line is essentially a point (lineLength < 0.0001)', () => {
      const key = { x: 0, y: 0, width: 1, height: 1 } as Key
      const lineStart = { x: 0.5, y: 0.5 } // Same point (key center)
      const lineEnd = { x: 0.5, y: 0.5 }

      const result = lineIntersectsKey(lineStart, lineEnd, key)

      // Point is at key center - should intersect
      expect(result).toBe(true)
    })

    it('edge case: line at exact threshold distance', () => {
      const key = { x: 0, y: 0, width: 1, height: 1 } as Key
      // Horizontal line exactly 0.5u above center (0.5u)
      const lineStart = { x: -1, y: 0 }
      const lineEnd = { x: 2, y: 0 }

      const result = lineIntersectsKey(lineStart, lineEnd, key)

      // Distance = |0.5 - 0| = 0.5u
      // Threshold = height/2 = 0.5u
      // Should intersect (<=)
      expect(result).toBe(true)
    })

    it('line passes through key corner', () => {
      const key = { x: 0, y: 0, width: 1, height: 1 } as Key
      // Diagonal line through top-left corner (0, 0)
      const lineStart = { x: -1, y: -1 }
      const lineEnd = { x: 1, y: 1 }

      const result = lineIntersectsKey(lineStart, lineEnd, key)

      // Line passes through corner, should be close enough to intersect
      expect(result).toBe(true)
    })

    it('very short line segment within key bounds', () => {
      const key = { x: 0, y: 0, width: 1, height: 1 } as Key
      // Short line near key center
      const lineStart = { x: 0.4, y: 0.4 }
      const lineEnd = { x: 0.6, y: 0.6 }

      const result = lineIntersectsKey(lineStart, lineEnd, key)

      expect(result).toBe(true)
    })

    it('line far from key does not intersect', () => {
      const key = { x: 0, y: 0, width: 1, height: 1 } as Key
      const lineStart = { x: 10, y: 10 }
      const lineEnd = { x: 20, y: 20 }

      const result = lineIntersectsKey(lineStart, lineEnd, key)

      expect(result).toBe(false)
    })
  })

  describe('findKeysAlongLine', () => {
    it('finds keys along horizontal line sorted by distance from start', () => {
      const keys = [
        { x: 0, y: 0, width: 1, height: 1 } as Key, // 0
        { x: 1, y: 0, width: 1, height: 1 } as Key, // 1
        { x: 2, y: 0, width: 1, height: 1 } as Key, // 2
        { x: 3, y: 0, width: 1, height: 1 } as Key, // 3
      ]

      const lineStart = { x: -1, y: 0.5 }
      const lineEnd = { x: 4, y: 0.5 }

      const result = findKeysAlongLine(lineStart, lineEnd, keys)

      expect(result).toHaveLength(4)
      expect(result[0]).toBe(keys[0]) // Closest to start
      expect(result[1]).toBe(keys[1])
      expect(result[2]).toBe(keys[2])
      expect(result[3]).toBe(keys[3]) // Farthest from start
    })

    it('finds keys along vertical line', () => {
      const keys = [
        { x: 0, y: 0, width: 1, height: 1 } as Key,
        { x: 0, y: 1, width: 1, height: 1 } as Key,
        { x: 0, y: 2, width: 1, height: 1 } as Key,
        { x: 5, y: 1, width: 1, height: 1 } as Key, // Not on line
      ]

      const lineStart = { x: 0.5, y: -1 }
      const lineEnd = { x: 0.5, y: 4 }

      const result = findKeysAlongLine(lineStart, lineEnd, keys)

      expect(result).toHaveLength(3)
      expect(result[0]).toBe(keys[0])
      expect(result[1]).toBe(keys[1])
      expect(result[2]).toBe(keys[2])
    })

    it('finds keys along diagonal line', () => {
      const keys = [
        { x: 0, y: 0, width: 1, height: 1 } as Key,
        { x: 1, y: 1, width: 1, height: 1 } as Key,
        { x: 2, y: 2, width: 1, height: 1 } as Key,
        { x: 0, y: 2, width: 1, height: 1 } as Key, // Not on diagonal
      ]

      const lineStart = { x: 0, y: 0 }
      const lineEnd = { x: 3, y: 3 }

      const result = findKeysAlongLine(lineStart, lineEnd, keys)

      expect(result).toHaveLength(3)
      expect(result[0]).toBe(keys[0])
      expect(result[1]).toBe(keys[1])
      expect(result[2]).toBe(keys[2])
    })

    it('returns empty array when line does not intersect any keys', () => {
      const keys = [
        { x: 0, y: 0, width: 1, height: 1 } as Key,
        { x: 1, y: 0, width: 1, height: 1 } as Key,
      ]

      const lineStart = { x: 0, y: 10 } // Line far away
      const lineEnd = { x: 10, y: 10 }

      const result = findKeysAlongLine(lineStart, lineEnd, keys)

      expect(result).toHaveLength(0)
    })

    it('filters out ghost and decal keys', () => {
      const keys = [
        { x: 0, y: 0, width: 1, height: 1 } as Key, // Normal key
        { x: 1, y: 0, width: 1, height: 1, ghost: true } as Key, // Ghost
        { x: 2, y: 0, width: 1, height: 1, decal: true } as Key, // Decal
        { x: 3, y: 0, width: 1, height: 1 } as Key, // Normal key
      ]

      const lineStart = { x: -1, y: 0.5 }
      const lineEnd = { x: 5, y: 0.5 }

      const result = findKeysAlongLine(lineStart, lineEnd, keys)

      // Should only include the 2 normal keys
      expect(result).toHaveLength(2)
      expect(result[0]).toBe(keys[0])
      expect(result[1]).toBe(keys[3])
    })

    it('sorting order is correct (closest to start first)', () => {
      const keys = [
        { x: 5, y: 0, width: 1, height: 1 } as Key, // Far
        { x: 2, y: 0, width: 1, height: 1 } as Key, // Middle
        { x: 0, y: 0, width: 1, height: 1 } as Key, // Close
      ]

      const lineStart = { x: -1, y: 0.5 }
      const lineEnd = { x: 10, y: 0.5 }

      const result = findKeysAlongLine(lineStart, lineEnd, keys)

      expect(result).toHaveLength(3)
      // Should be sorted by distance from start, not by array order
      expect(result[0]).toBe(keys[2]) // x=0 (closest)
      expect(result[1]).toBe(keys[1]) // x=2
      expect(result[2]).toBe(keys[0]) // x=5 (farthest)
    })
  })
})
