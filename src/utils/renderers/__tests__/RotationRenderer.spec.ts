import { describe, it, expect, beforeEach, vi } from 'vitest'
import { RotationRenderer } from '../RotationRenderer'
import type { Key } from '@adamws/kle-serial'

describe('RotationRenderer', () => {
  let renderer: RotationRenderer
  let mockCtx: CanvasRenderingContext2D
  let canvas: HTMLCanvasElement

  beforeEach(() => {
    renderer = new RotationRenderer()
    canvas = document.createElement('canvas')
    canvas.width = 800
    canvas.height = 600

    // Mock canvas context methods for testing
    mockCtx = {
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(),
      arc: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      getTransform: vi.fn(() => ({
        a: 1,
        b: 0,
        c: 0,
        d: 1,
        e: 0,
        f: 0,
      })),
      setLineDash: vi.fn(),
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
    } as unknown as CanvasRenderingContext2D
  })

  describe('drawRotationOriginIndicator', () => {
    it('should draw rotation origin indicator', () => {
      const key: Partial<Key> = {
        x: 0,
        y: 0,
        width: 1,
        height: 1,
        rotation_x: 0.5,
        rotation_y: 0.5,
        rotation_angle: 45,
      }

      // Should not throw
      expect(() => {
        renderer.drawRotationOriginIndicator(mockCtx, key as Key, 50)
      }).not.toThrow()
    })

    it('should handle key without rotation', () => {
      const key: Partial<Key> = {
        x: 0,
        y: 0,
        width: 1,
        height: 1,
      }

      expect(() => {
        renderer.drawRotationOriginIndicator(mockCtx, key as Key, 50)
      }).not.toThrow()
    })
  })

  describe('drawRotationPoints', () => {
    it('should draw rotation points for selected keys', () => {
      const keys: Partial<Key>[] = [
        {
          x: 0,
          y: 0,
          width: 1,
          height: 1,
        },
      ]

      expect(() => {
        renderer.drawRotationPoints(mockCtx, keys as Key[], 50)
      }).not.toThrow()
    })

    it('should handle empty key array', () => {
      expect(() => {
        renderer.drawRotationPoints(mockCtx, [], 50)
      }).not.toThrow()
    })

    it('should handle rotated keys', () => {
      // Mock canvas creation for rotation calculations
      const mockCanvasCtx = {
        save: vi.fn(),
        restore: vi.fn(),
        translate: vi.fn(),
        rotate: vi.fn(),
        getTransform: vi.fn(() => ({
          a: 1,
          b: 0,
          c: 0,
          d: 1,
          e: 0,
          f: 0,
        })),
      }
      const mockCanvas = {
        getContext: vi.fn(() => mockCanvasCtx),
      }
      vi.spyOn(document, 'createElement').mockReturnValue(
        mockCanvas as unknown as HTMLCanvasElement,
      )

      const keys: Partial<Key>[] = [
        {
          x: 0,
          y: 0,
          width: 1,
          height: 1,
          rotation_angle: 45,
          rotation_x: 0.5,
          rotation_y: 0.5,
        },
      ]

      expect(() => {
        renderer.drawRotationPoints(mockCtx, keys as Key[], 50)
      }).not.toThrow()

      // Verify rotation transformations were used
      expect(mockCtx.save).toHaveBeenCalled()
      expect(mockCtx.restore).toHaveBeenCalled()

      // Restore original createElement
      vi.restoreAllMocks()
    })

    it('should handle hover state', () => {
      const keys: Partial<Key>[] = [
        {
          x: 0,
          y: 0,
          width: 1,
          height: 1,
        },
      ]

      expect(() => {
        renderer.drawRotationPoints(mockCtx, keys as Key[], 50, 'corner-0-0')
      }).not.toThrow()
    })

    it('should handle selected rotation origin', () => {
      const keys: Partial<Key>[] = [
        {
          x: 0,
          y: 0,
          width: 1,
          height: 1,
        },
      ]

      expect(() => {
        renderer.drawRotationPoints(mockCtx, keys as Key[], 50, undefined, { x: 0.5, y: 0.5 })
      }).not.toThrow()
    })
  })

  describe('getRotationPointAtPosition', () => {
    it('should return null when no points exist', () => {
      const point = renderer.getRotationPointAtPosition(100, 100)
      expect(point).toBeNull()
    })

    it('should find rotation point after drawing', () => {
      const keys: Partial<Key>[] = [
        {
          x: 0,
          y: 0,
          width: 1,
          height: 1,
        },
      ]

      renderer.drawRotationPoints(mockCtx, keys as Key[], 50)

      // Try to find a point near top-left corner (0, 0)
      const point = renderer.getRotationPointAtPosition(0, 0)
      expect(point).toBeTruthy()
    })

    it('should return null for position far from any point', () => {
      const keys: Partial<Key>[] = [
        {
          x: 0,
          y: 0,
          width: 1,
          height: 1,
        },
      ]

      renderer.drawRotationPoints(mockCtx, keys as Key[], 50)

      // Try position far away
      const point = renderer.getRotationPointAtPosition(1000, 1000)
      expect(point).toBeNull()
    })
  })

  describe('clearRotationPoints', () => {
    it('should clear rotation points', () => {
      const keys: Partial<Key>[] = [
        {
          x: 0,
          y: 0,
          width: 1,
          height: 1,
        },
      ]

      renderer.drawRotationPoints(mockCtx, keys as Key[], 50)
      renderer.clearRotationPoints()

      const points = renderer.getRotationPoints()
      expect(points).toHaveLength(0)
    })
  })

  describe('getRotationPoints', () => {
    it('should return empty array initially', () => {
      const points = renderer.getRotationPoints()
      expect(points).toEqual([])
    })

    it('should return points after drawing', () => {
      const keys: Partial<Key>[] = [
        {
          x: 0,
          y: 0,
          width: 1,
          height: 1,
        },
      ]

      renderer.drawRotationPoints(mockCtx, keys as Key[], 50)

      const points = renderer.getRotationPoints()
      // Should have 5 points: 4 corners + 1 center
      expect(points.length).toBe(5)
    })
  })
})
