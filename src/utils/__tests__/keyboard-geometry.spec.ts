import { describe, it, expect } from 'vitest'
import { getKeyCenter, getKeyDistance } from '../keyboard-geometry'
import type { Key } from '@/stores/keyboard'

describe('keyboard-geometry', () => {
  describe('getKeyCenter', () => {
    it('calculates center for standard 1u key at origin', () => {
      const key = { x: 0, y: 0, width: 1, height: 1 } as Key
      const center = getKeyCenter(key)

      expect(center.x).toBeCloseTo(0.5, 2) // 0.5u
      expect(center.y).toBeCloseTo(0.5, 2)
    })

    it('calculates center for 2u wide key (spacebar)', () => {
      const key = { x: 0, y: 0, width: 2, height: 1 } as Key
      const center = getKeyCenter(key)

      expect(center.x).toBeCloseTo(1, 2) // 1u
      expect(center.y).toBeCloseTo(0.5, 2) // 0.5u
    })

    it('calculates center for 2.25u wide key (left Shift)', () => {
      const key = { x: 0, y: 0, width: 2.25, height: 1 } as Key
      const center = getKeyCenter(key)

      expect(center.x).toBeCloseTo(1.125, 2) // 1.125u
      expect(center.y).toBeCloseTo(0.5, 2)
    })

    it('calculates center for 2u tall key (ISO Enter)', () => {
      const key = { x: 0, y: 0, width: 1, height: 2 } as Key
      const center = getKeyCenter(key)

      expect(center.x).toBeCloseTo(0.5, 2)
      expect(center.y).toBeCloseTo(1, 2) // 1u
    })

    it('calculates center for key at non-origin position', () => {
      const key = { x: 5, y: 3, width: 1, height: 1 } as Key
      const center = getKeyCenter(key)

      expect(center.x).toBeCloseTo(5.5, 2) // 5 + 0.5
      expect(center.y).toBeCloseTo(3.5, 2) // 3 + 0.5
    })

    it('calculates center for rotated key (30 degrees around origin)', () => {
      const key = {
        x: 1,
        y: 0,
        width: 1,
        height: 1,
        rotation_angle: 30,
        rotation_x: 0,
        rotation_y: 0,
      } as Key
      const center = getKeyCenter(key)

      // Expected: rotate point (1.5, 0.5) around origin (0, 0) by 30°
      // x' = x*cos(30°) - y*sin(30°) = 1.5*0.866 - 0.5*0.5 = 1.049
      // y' = x*sin(30°) + y*cos(30°) = 1.5*0.5 + 0.5*0.866 = 1.183
      expect(center.x).toBeCloseTo(1.049, 2) // ~1.049u
      expect(center.y).toBeCloseTo(1.183, 2) // ~1.183u
    })

    it('calculates center for rotated key (45 degrees)', () => {
      const key = {
        x: 1,
        y: 0,
        width: 1,
        height: 1,
        rotation_angle: 45,
        rotation_x: 0,
        rotation_y: 0,
      } as Key
      const center = getKeyCenter(key)

      // Expected: rotate point (1.5, 0.5) around origin (0, 0) by 45°
      // x' = 1.5*cos(45°) - 0.5*sin(45°) = 1.5*0.707 - 0.5*0.707 = 0.707
      // y' = 1.5*sin(45°) + 0.5*cos(45°) = 1.5*0.707 + 0.5*0.707 = 1.414
      expect(center.x).toBeCloseTo(0.707, 2) // ~0.707u
      expect(center.y).toBeCloseTo(1.414, 2) // ~1.414u
    })

    it('calculates center for rotated key (90 degrees)', () => {
      const key = {
        x: 1,
        y: 0,
        width: 1,
        height: 1,
        rotation_angle: 90,
        rotation_x: 0,
        rotation_y: 0,
      } as Key
      const center = getKeyCenter(key)

      // Expected: rotate point (1.5, 0.5) around origin (0, 0) by 90°
      // x' = 1.5*cos(90°) - 0.5*sin(90°) = 0 - 0.5 = -0.5
      // y' = 1.5*sin(90°) + 0.5*cos(90°) = 1.5 + 0 = 1.5
      expect(center.x).toBeCloseTo(-0.5, 2) // -0.5u
      expect(center.y).toBeCloseTo(1.5, 2) // 1.5u
    })

    it('calculates center for rotated key with negative angle (-30 degrees)', () => {
      const key = {
        x: 1,
        y: 0,
        width: 1,
        height: 1,
        rotation_angle: -30,
        rotation_x: 0,
        rotation_y: 0,
      } as Key
      const center = getKeyCenter(key)

      // Expected: rotate point (1.5, 0.5) around origin (0, 0) by -30°
      // x' = 1.5*cos(-30°) - 0.5*sin(-30°) = 1.5*0.866 + 0.5*0.5 = 1.549
      // y' = 1.5*sin(-30°) + 0.5*cos(-30°) = -1.5*0.5 + 0.5*0.866 = -0.317
      expect(center.x).toBeCloseTo(1.549, 2) // ~1.549u
      expect(center.y).toBeCloseTo(-0.317, 2) // ~-0.317u
    })

    it('calculates center for ErgoDox thumb cluster key (custom rotation origin)', () => {
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
      const center = getKeyCenter(key)

      // Key center in local coords: (1.5, 0.5)
      // Relative to rotation origin (6.5, 4.25): (-5, -3.75)
      // After 30° rotation: (-5*cos30 + 3.75*sin30, -5*sin30 - 3.75*cos30)
      //                   ≈ (-4.33 + 1.875, -2.5 - 3.25) = (-2.455, -5.75)
      // Back to absolute: (6.5 - 2.455, 4.25 - 5.75) = (4.045, -1.5)
      expect(center.x).toBeCloseTo(4.045, 2) // ~4.045u
      expect(center.y).toBeCloseTo(-1.5, 2) // ~-1.5u
    })

    it('calculates center for rotated key without explicit rotation origin', () => {
      // When rotation_x/rotation_y are not provided, they default to the key's center
      const key = {
        x: 2,
        y: 1,
        width: 1,
        height: 1,
        rotation_angle: 45,
      } as Key
      const center = getKeyCenter(key)

      // Key center: (2.5, 1.5)
      // No rotation origin specified, so it rotates around its own center
      // Result should be the same as the center itself
      expect(center.x).toBeCloseTo(2.5, 2) // 2.5u
      expect(center.y).toBeCloseTo(1.5, 2) // 1.5u
    })

    it('handles keys without explicit width/height (defaults to 1u)', () => {
      const key = { x: 0, y: 0 } as Key
      const center = getKeyCenter(key)

      expect(center.x).toBeCloseTo(0.5, 2) // Default 1u key
      expect(center.y).toBeCloseTo(0.5, 2)
    })

    it('handles zero rotation angle (same as no rotation)', () => {
      const key = {
        x: 1,
        y: 1,
        width: 1,
        height: 1,
        rotation_angle: 0,
        rotation_x: 0,
        rotation_y: 0,
      } as Key
      const center = getKeyCenter(key)

      expect(center.x).toBeCloseTo(1.5, 2) // 1.5u
      expect(center.y).toBeCloseTo(1.5, 2)
    })

    it('returns center in layout units regardless of pixel size', () => {
      const key = { x: 0, y: 0, width: 1, height: 1 } as Key

      // Function no longer takes unit size parameter
      // It always returns layout units (0.5u for a 1u key centered at origin)
      const center = getKeyCenter(key)
      expect(center.x).toBeCloseTo(0.5, 2) // 0.5u
      expect(center.y).toBeCloseTo(0.5, 2)
    })
  })

  describe('getKeyDistance', () => {
    it('calculates distance between horizontally adjacent 1u keys', () => {
      const key1 = { x: 0, y: 0, width: 1, height: 1 } as Key
      const key2 = { x: 1, y: 0, width: 1, height: 1 } as Key
      const distance = getKeyDistance(key1, key2)

      expect(distance).toBeCloseTo(1, 2) // 1u
    })

    it('calculates distance between vertically adjacent 1u keys', () => {
      const key1 = { x: 0, y: 0, width: 1, height: 1 } as Key
      const key2 = { x: 0, y: 1, width: 1, height: 1 } as Key
      const distance = getKeyDistance(key1, key2)

      expect(distance).toBeCloseTo(1, 2) // 1u
    })

    it('calculates distance between diagonally adjacent keys', () => {
      const key1 = { x: 0, y: 0, width: 1, height: 1 } as Key
      const key2 = { x: 1, y: 1, width: 1, height: 1 } as Key
      const distance = getKeyDistance(key1, key2)

      // Diagonal: sqrt(1² + 1²) = sqrt(2) ≈ 1.414u
      expect(distance).toBeCloseTo(1.414, 2)
    })

    it('calculates distance with 2u spacebar to 1u key', () => {
      const spacebar = { x: 5, y: 3, width: 2, height: 1 } as Key
      const normalKey = { x: 7, y: 3, width: 1, height: 1 } as Key
      const distance = getKeyDistance(spacebar, normalKey)

      // Spacebar center: (6u, 3.5u), Normal key center: (7.5u, 3.5u)
      // Distance: 1.5u
      expect(distance).toBeCloseTo(1.5, 2)
    })

    it('calculates distance with rotated keys', () => {
      const key1 = { x: 0, y: 0, width: 1, height: 1 } as Key
      const key2 = {
        x: 1,
        y: 0,
        width: 1,
        height: 1,
        rotation_angle: 30,
        rotation_x: 0,
        rotation_y: 0,
      } as Key
      const distance = getKeyDistance(key1, key2)

      // key1 center: (0.5, 0.5)
      // key2 center (rotated): (~1.049, ~1.183)
      // Distance: sqrt((1.049-0.5)² + (1.183-0.5)²) ≈ sqrt(0.301 + 0.467) ≈ 0.876u
      expect(distance).toBeGreaterThan(0)
      expect(distance).toBeCloseTo(0.876, 2)
    })

    it('calculates zero distance for same key', () => {
      const key = { x: 2, y: 3, width: 1, height: 1 } as Key
      const distance = getKeyDistance(key, key)

      expect(distance).toBeCloseTo(0, 2)
    })

    it('returns distance in layout units', () => {
      const key1 = { x: 0, y: 0, width: 1, height: 1 } as Key
      const key2 = { x: 1, y: 0, width: 1, height: 1 } as Key

      // Function no longer takes unit size parameter
      // It always returns layout units
      const distance = getKeyDistance(key1, key2)
      expect(distance).toBeCloseTo(1, 2) // 1u
    })

    it('calculates distance for keys far apart', () => {
      const key1 = { x: 0, y: 0, width: 1, height: 1 } as Key
      const key2 = { x: 10, y: 5, width: 1, height: 1 } as Key
      const distance = getKeyDistance(key1, key2)

      // Center to center: sqrt(10² + 5²) = sqrt(125) ≈ 11.18u
      expect(distance).toBeCloseTo(11.18, 2)
    })
  })
})
