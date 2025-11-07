import { describe, it, expect, beforeEach } from 'vitest'
import { BoundsCalculator } from '../BoundsCalculator'
import type { Key } from '@adamws/kle-serial'

describe('BoundsCalculator', () => {
  let calculator: BoundsCalculator

  beforeEach(() => {
    calculator = new BoundsCalculator(50) // 50 pixels per unit
  })

  describe('calculateBounds', () => {
    it('should return zero bounds for empty array', () => {
      const bounds = calculator.calculateBounds([])
      expect(bounds).toEqual({ x: 0, y: 0, width: 0, height: 0 })
    })

    it('should calculate bounds for single key', () => {
      const keys: Partial<Key>[] = [
        {
          x: 0,
          y: 0,
          width: 1,
          height: 1,
        },
      ]

      const bounds = calculator.calculateBounds(keys as Key[])
      expect(bounds.x).toBe(0)
      expect(bounds.y).toBe(0)
      expect(bounds.width).toBeGreaterThan(0)
      expect(bounds.height).toBeGreaterThan(0)
    })

    it('should calculate bounds for multiple keys', () => {
      const keys: Partial<Key>[] = [
        { x: 0, y: 0, width: 1, height: 1 },
        { x: 2, y: 0, width: 1, height: 1 },
        { x: 0, y: 2, width: 1, height: 1 },
      ]

      const bounds = calculator.calculateBounds(keys as Key[])
      expect(bounds.width).toBeGreaterThan(50) // Should span multiple keys
      expect(bounds.height).toBeGreaterThan(50)
    })
  })

  describe('calculateRotatedKeyBounds', () => {
    it('should calculate bounds for non-rotated key', () => {
      const key: Partial<Key> = {
        x: 0,
        y: 0,
        width: 1,
        height: 1,
      }

      const bounds = calculator.calculateRotatedKeyBounds(key as Key)
      expect(bounds.minX).toBe(0)
      expect(bounds.minY).toBe(0)
      expect(bounds.maxX).toBe(51) // 50 + 1 for stroke
      expect(bounds.maxY).toBe(51)
    })

    it('should calculate bounds for rotated key', () => {
      const key: Partial<Key> = {
        x: 0,
        y: 0,
        width: 1,
        height: 1,
        rotation_angle: 45,
        rotation_x: 0.5,
        rotation_y: 0.5,
      }

      const bounds = calculator.calculateRotatedKeyBounds(key as Key)
      // Rotated square should have larger bounds
      expect(bounds.maxX - bounds.minX).toBeGreaterThan(50)
      expect(bounds.maxY - bounds.minY).toBeGreaterThan(50)
    })

    it('should handle non-rectangular keys', () => {
      const key: Partial<Key> = {
        x: 0,
        y: 0,
        width: 1.25,
        height: 2,
        x2: 0.25,
        y2: 1,
        width2: 1.5,
        height2: 1,
      }

      const bounds = calculator.calculateRotatedKeyBounds(key as Key)
      expect(bounds.maxX - bounds.minX).toBeGreaterThan(50)
      expect(bounds.maxY - bounds.minY).toBeGreaterThan(50)
    })

    it('should handle rotated non-rectangular keys', () => {
      const key: Partial<Key> = {
        x: 0,
        y: 0,
        width: 1.25,
        height: 2,
        x2: 0.25,
        y2: 1,
        width2: 1.5,
        height2: 1,
        rotation_angle: 30,
        rotation_x: 1,
        rotation_y: 1,
      }

      const bounds = calculator.calculateRotatedKeyBounds(key as Key)
      expect(bounds.maxX - bounds.minX).toBeGreaterThan(0)
      expect(bounds.maxY - bounds.minY).toBeGreaterThan(0)
    })
  })

  describe('setUnit', () => {
    it('should update unit and affect calculations', () => {
      const key: Partial<Key> = {
        x: 0,
        y: 0,
        width: 1,
        height: 1,
      }

      const bounds1 = calculator.calculateRotatedKeyBounds(key as Key)

      calculator.setUnit(100)

      const bounds2 = calculator.calculateRotatedKeyBounds(key as Key)

      // With double the unit, bounds should be double (plus stroke)
      expect(bounds2.maxX).toBeGreaterThan(bounds1.maxX)
      expect(bounds2.maxY).toBeGreaterThan(bounds1.maxY)
    })
  })
})
