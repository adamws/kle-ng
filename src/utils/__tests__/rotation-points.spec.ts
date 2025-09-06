import { describe, it, expect } from 'vitest'
import { Key } from '@/stores/keyboard'
import { calculateRotationPoints, pointsEqual, findClosestRotationPoint } from '../rotation-points'

describe('rotation-points', () => {
  describe('calculateRotationPoints', () => {
    it('should return empty array for no selected keys', () => {
      const points = calculateRotationPoints([], 0.25)
      expect(points).toEqual([])
    })

    it('should calculate correct points for single 1u key', () => {
      const key = new Key()
      key.x = 0
      key.y = 0
      key.width = 1
      key.height = 1

      const points = calculateRotationPoints([key], 0.25)

      // Should have 4 corners + 1 center = 5 points
      expect(points).toHaveLength(5)

      // Check corners
      const corners = points.filter((p) => p.type === 'corner')
      expect(corners).toHaveLength(4)
      expect(corners.map((p) => [p.x, p.y])).toEqual([
        [0, 0], // top-left
        [1, 0], // top-right
        [0, 1], // bottom-left
        [1, 1], // bottom-right
      ])

      // Check center
      const centers = points.filter((p) => p.type === 'center')
      expect(centers).toHaveLength(1)
      expect(centers[0].x).toBe(0.5)
      expect(centers[0].y).toBe(0.5)
    })

    it('should deduplicate overlapping corners for 2x2 grid', () => {
      const keys = [
        { x: 0, y: 0, width: 1, height: 1 }, // top-left
        { x: 1, y: 0, width: 1, height: 1 }, // top-right
        { x: 0, y: 1, width: 1, height: 1 }, // bottom-left
        { x: 1, y: 1, width: 1, height: 1 }, // bottom-right
      ].map((props) => Object.assign(new Key(), props))

      const points = calculateRotationPoints(keys, 0.25)

      // Should have 9 unique corners + 4 centers = 13 points
      // Corners: (0,0), (1,0), (2,0), (0,1), (1,1), (2,1), (0,2), (1,2), (2,2)
      // Centers: (0.5,0.5), (1.5,0.5), (0.5,1.5), (1.5,1.5)
      expect(points).toHaveLength(13)

      const corners = points.filter((p) => p.type === 'corner')
      expect(corners).toHaveLength(9)

      const centers = points.filter((p) => p.type === 'center')
      expect(centers).toHaveLength(4)

      // Verify no duplicate corners
      const cornerCoords = corners.map((p) => `${p.x},${p.y}`)
      const uniqueCornerCoords = [...new Set(cornerCoords)]
      expect(cornerCoords).toHaveLength(uniqueCornerCoords.length)
    })

    it('should handle non-1u keys correctly', () => {
      const key = new Key()
      key.x = 0
      key.y = 0
      key.width = 2
      key.height = 1

      const points = calculateRotationPoints([key], 0.25)

      // Should have 4 corners + 1 center = 5 points
      expect(points).toHaveLength(5)

      const corners = points.filter((p) => p.type === 'corner')
      expect(corners.map((p) => [p.x, p.y])).toEqual([
        [0, 0], // top-left
        [2, 0], // top-right
        [0, 1], // bottom-left
        [2, 1], // bottom-right
      ])

      const center = points.find((p) => p.type === 'center')
      expect(center!.x).toBe(1) // center of 2u width
      expect(center!.y).toBe(0.5) // center of 1u height
    })

    it('should snap points to grid based on moveStep', () => {
      const key = new Key()
      key.x = 0.1 // Not aligned to 0.25 grid
      key.y = 0.1
      key.width = 1
      key.height = 1

      const points = calculateRotationPoints([key], 0.25)

      // All points should be snapped to 0.25 grid
      points.forEach((point) => {
        expect(point.x % 0.25).toBeCloseTo(0, 4)
        expect(point.y % 0.25).toBeCloseTo(0, 4)
      })
    })

    it('should handle overlapping keys of different sizes', () => {
      const keys = [
        { x: 0, y: 0, width: 2, height: 1 }, // 2u wide key
        { x: 0, y: 0, width: 1, height: 2 }, // 2u tall key overlapping at origin
      ].map((props) => Object.assign(new Key(), props))

      const points = calculateRotationPoints(keys, 0.25)

      // Should deduplicate overlapping corners at (0,0)
      const corners = points.filter((p) => p.type === 'corner')
      const cornerAt00 = corners.filter((p) => p.x === 0 && p.y === 0)
      expect(cornerAt00).toHaveLength(1) // Should be deduplicated

      // Should have both centers
      const centers = points.filter((p) => p.type === 'center')
      expect(centers).toHaveLength(2)
    })

    it('should sort points consistently', () => {
      const keys = [
        { x: 1, y: 1, width: 1, height: 1 },
        { x: 0, y: 0, width: 1, height: 1 },
      ].map((props) => Object.assign(new Key(), props))

      const points = calculateRotationPoints(keys, 0.25)

      // Points should be sorted by y first, then x
      for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1]
        const curr = points[i]

        if (Math.abs(prev.y - curr.y) > 0.0001) {
          expect(prev.y).toBeLessThan(curr.y)
        } else {
          expect(prev.x).toBeLessThanOrEqual(curr.x)
        }
      }
    })
  })

  describe('pointsEqual', () => {
    it('should return true for identical points', () => {
      const a = { x: 1, y: 2 }
      const b = { x: 1, y: 2 }
      expect(pointsEqual(a, b)).toBe(true)
    })

    it('should return true for points within tolerance', () => {
      const a = { x: 1.0, y: 2.0 }
      const b = { x: 1.0001, y: 2.0001 }
      expect(pointsEqual(a, b, 0.001)).toBe(true) // Use larger tolerance for test
    })

    it('should return false for points outside tolerance', () => {
      const a = { x: 1, y: 2 }
      const b = { x: 1.1, y: 2 }
      expect(pointsEqual(a, b)).toBe(false)
    })
  })

  describe('findClosestRotationPoint', () => {
    const rotationPoints = [
      { x: 0, y: 0, type: 'corner' as const, id: 'corner-0,0' },
      { x: 1, y: 0, type: 'corner' as const, id: 'corner-1,0' },
      { x: 0.5, y: 0.5, type: 'center' as const, id: 'center-0.5,0.5' },
    ]

    it('should find closest point within distance', () => {
      const position = { x: 0.1, y: 0.1 }
      const closest = findClosestRotationPoint(position, rotationPoints)

      expect(closest).not.toBeNull()
      expect(closest!.x).toBe(0)
      expect(closest!.y).toBe(0)
    })

    it('should return null if no point within max distance', () => {
      const position = { x: 5, y: 5 }
      const closest = findClosestRotationPoint(position, rotationPoints)

      expect(closest).toBeNull()
    })

    it('should respect custom max distance', () => {
      const position = { x: 0.3, y: 0.3 }

      // With default max distance (0.5), should find center point
      const closestDefault = findClosestRotationPoint(position, rotationPoints)
      expect(closestDefault!.type).toBe('center')

      // With smaller max distance, should find nothing
      const closestSmall = findClosestRotationPoint(position, rotationPoints, 0.2)
      expect(closestSmall).toBeNull()
    })
  })
})
