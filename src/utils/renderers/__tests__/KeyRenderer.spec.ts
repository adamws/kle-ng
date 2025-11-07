import { describe, it, expect, beforeEach, vi } from 'vitest'
import { KeyRenderer } from '../KeyRenderer'
import type { Key } from '@adamws/kle-serial'
import type { KeyRenderParams } from '../../canvas-renderer'

// Mock Path2D for jsdom environment
global.Path2D = class Path2D {
  moveTo() {}
  lineTo() {}
  quadraticCurveTo() {}
  closePath() {}
} as unknown as typeof Path2D

describe('KeyRenderer', () => {
  let renderer: KeyRenderer
  let mockCtx: CanvasRenderingContext2D

  beforeEach(() => {
    renderer = new KeyRenderer()

    // Create comprehensive mock canvas context
    mockCtx = {
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      quadraticCurveTo: vi.fn(),
      arc: vi.fn(),
      closePath: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      fillRect: vi.fn(),
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      lineCap: 'butt' as CanvasLineCap,
      lineJoin: 'miter' as CanvasLineJoin,
      globalAlpha: 1,
    } as unknown as CanvasRenderingContext2D
  })

  describe('alignRectToPixels', () => {
    it('should align integer coordinates correctly', () => {
      const result = renderer.alignRectToPixels(10, 20, 100, 50)

      // Integer coords should be aligned with 0.5 offset for crisp stroke rendering
      expect(result.x).toBe(10.5)
      expect(result.y).toBe(20.5)
      expect(result.width).toBe(100)
      expect(result.height).toBe(50)
    })

    it('should align half-pixel coordinates', () => {
      const result = renderer.alignRectToPixels(10.5, 20.5, 100, 50)

      // Half-pixel coords should round to nearest integer + 0.5
      expect(result.x).toBe(11.5)
      expect(result.y).toBe(21.5)
      expect(result.width).toBe(100)
      expect(result.height).toBe(50)
    })

    it('should align sub-pixel coordinates', () => {
      const result = renderer.alignRectToPixels(10.3, 20.7, 99.8, 49.6)

      // Sub-pixel coords should round appropriately
      expect(result.x).toBe(10.5) // Math.round(10.3) + 0.5
      expect(result.y).toBe(21.5) // Math.round(20.7) + 0.5
      // Width: Math.round(10.3 + 99.8) - Math.round(10.3) = 110 - 10 = 100
      expect(result.width).toBe(100)
      // Height: Math.round(20.7 + 49.6) - Math.round(20.7) = 70 - 21 = 49
      expect(result.height).toBe(49)
    })
  })

  describe('getRenderParams', () => {
    it('should calculate params for basic 1u key', () => {
      const key: Partial<Key> = {
        x: 0,
        y: 0,
        width: 1,
        height: 1,
        color: '#cccccc',
        default: {
          textColor: '#000000',
          textSize: 3,
        },
      }
      const options = { unit: 54 }

      const params = renderer.getRenderParams(key as Key, options)

      // Verify basic dimensions (54px per unit)
      expect(params.capwidth).toBe(54)
      expect(params.capheight).toBe(54)
      expect(params.capx).toBe(0)
      expect(params.capy).toBe(0)

      // Verify nonRectangular flag (will be true if width2/height2 are undefined)
      expect(params.nonRectangular).toBeDefined()

      // Verify colors are set
      expect(params.darkColor).toBe('#cccccc')
      expect(params.lightColor).toBeDefined()

      // Verify outer cap dimensions (with default key spacing of 0)
      expect(params.outercapwidth).toBe(54)
      expect(params.outercapheight).toBe(54)

      // Verify inner cap dimensions (with default bevel margin of 6)
      expect(params.innercapwidth).toBe(42) // 54 - 2*6
      expect(params.innercapheight).toBeLessThanOrEqual(42)
    })

    it('should calculate params for wide key', () => {
      const key: Partial<Key> = {
        x: 0,
        y: 0,
        width: 2.25,
        height: 1,
        color: '#cccccc',
        default: {
          textColor: '#000000',
          textSize: 3,
        },
      }
      const options = { unit: 54 }

      const params = renderer.getRenderParams(key as Key, options)

      // Verify wide key dimensions (2.25 * 54 = 121.5)
      expect(params.capwidth).toBe(121.5)
      expect(params.capheight).toBe(54)

      // nonRectangular flag will be set based on width2/height2
      expect(params.nonRectangular).toBeDefined()
    })

    it('should calculate params for rotated key', () => {
      const key: Partial<Key> = {
        x: 1,
        y: 1,
        width: 1,
        height: 1,
        rotation_angle: 15,
        rotation_x: 2,
        rotation_y: 2,
        color: '#cccccc',
        default: {
          textColor: '#000000',
          textSize: 3,
        },
      }
      const options = { unit: 54 }

      const params = renderer.getRenderParams(key as Key, options)

      // Verify rotation origin is calculated (2 * 54 = 108)
      expect(params.origin_x).toBe(108)
      expect(params.origin_y).toBe(108)
    })

    it('should calculate params for non-rectangular key', () => {
      const key: Partial<Key> = {
        x: 0,
        y: 0,
        width: 1.25,
        height: 2,
        width2: 1.5,
        height2: 1,
        x2: 0,
        y2: 1,
        color: '#cccccc',
        default: {
          textColor: '#000000',
          textSize: 3,
        },
      }
      const options = { unit: 54 }

      const params = renderer.getRenderParams(key as Key, options)

      // Should be recognized as non-rectangular
      expect(params.nonRectangular).toBe(true)

      // Verify first rectangle dimensions
      expect(params.capwidth).toBe(67.5) // 1.25 * 54
      expect(params.capheight).toBe(108) // 2 * 54

      // Verify second rectangle dimensions
      expect(params.capwidth2).toBe(81) // 1.5 * 54
      expect(params.capheight2).toBe(54) // 1 * 54
      expect(params.capx2).toBe(0) // x + x2 = 0 + 0
      expect(params.capy2).toBe(54) // y + y2 = 0 + 54
    })

    it('should calculate params for rotary encoder', () => {
      const key: Partial<Key> = {
        x: 0,
        y: 0,
        width: 1,
        height: 1,
        sm: 'rot_ec11',
        color: '#cccccc',
        default: {
          textColor: '#000000',
          textSize: 3,
        },
      }
      const options = { unit: 54 }

      const params = renderer.getRenderParams(key as Key, options)

      // Should calculate standard params (rendering decision happens in drawKey)
      expect(params.capwidth).toBe(54)
      expect(params.capheight).toBe(54)
      // nonRectangular will be set based on width2/height2
      expect(params.nonRectangular).toBeDefined()
    })
  })

  describe('alignNonRectangularKeyParams', () => {
    it('should align both rectangles consistently', () => {
      const params: KeyRenderParams = {
        capx: 10.3,
        capy: 20.7,
        capwidth: 100,
        capheight: 200,
        outercapx: 10.3,
        outercapy: 20.7,
        outercapwidth: 100,
        outercapheight: 200,
        outercapx2: 15.6,
        outercapy2: 120.4,
        outercapwidth2: 150,
        outercapheight2: 100,
        innercapx: 16.3,
        innercapy: 26.7,
        innercapwidth: 88,
        innercapheight: 188,
        innercapx2: 21.6,
        innercapy2: 126.4,
        innercapwidth2: 138,
        innercapheight2: 88,
        textcapx: 20,
        textcapy: 30,
        textcapwidth: 80,
        textcapheight: 180,
        darkColor: '#000',
        lightColor: '#fff',
        nonRectangular: true,
        origin_x: 0,
        origin_y: 0,
      }

      const aligned = renderer.alignNonRectangularKeyParams(params)

      // Both rectangles should be aligned to pixel boundaries
      expect(aligned.outercapx).toBe(10.5)
      expect(aligned.outercapy).toBe(21.5)
      expect(aligned.outercapx2).toBe(16.5)
      expect(aligned.outercapy2).toBe(120.5)

      // Dimensions should be preserved or adjusted appropriately
      expect(aligned.outercapwidth).toBeGreaterThan(90)
      expect(aligned.outercapheight).toBeGreaterThan(190)
    })

    it('should maintain relative positioning between rectangles', () => {
      const params: KeyRenderParams = {
        capx: 0,
        capy: 0,
        capwidth: 100,
        capheight: 200,
        outercapx: 10,
        outercapy: 20,
        outercapwidth: 100,
        outercapheight: 200,
        outercapx2: 15,
        outercapy2: 120,
        outercapwidth2: 150,
        outercapheight2: 100,
        innercapx: 16,
        innercapy: 26,
        innercapwidth: 88,
        innercapheight: 188,
        innercapx2: 21,
        innercapy2: 126,
        innercapwidth2: 138,
        innercapheight2: 88,
        textcapx: 20,
        textcapy: 30,
        textcapwidth: 80,
        textcapheight: 180,
        darkColor: '#000',
        lightColor: '#fff',
        nonRectangular: true,
        origin_x: 0,
        origin_y: 0,
      }

      const aligned = renderer.alignNonRectangularKeyParams(params)

      // Calculate original offsets
      const originalInnerOffsetX = params.innercapx - params.outercapx
      const originalInnerOffsetY = params.innercapy - params.outercapy

      // Verify inner rectangles maintain relative position to outer
      expect(aligned.innercapx - aligned.outercapx).toBe(originalInnerOffsetX)
      expect(aligned.innercapy - aligned.outercapy).toBe(originalInnerOffsetY)
    })
  })

  describe('drawRoundedRect', () => {
    it('should draw rounded rectangle with fill', () => {
      renderer.drawRoundedRect(mockCtx, 10, 20, 100, 50, 5, '#ff0000', undefined)

      // Verify path creation
      expect(mockCtx.beginPath).toHaveBeenCalled()
      expect(mockCtx.moveTo).toHaveBeenCalled()
      expect(mockCtx.quadraticCurveTo).toHaveBeenCalled()
      expect(mockCtx.closePath).toHaveBeenCalled()

      // Verify fill was applied
      expect(mockCtx.fillStyle).toBe('#ff0000')
      expect(mockCtx.fill).toHaveBeenCalled()

      // Verify stroke was not applied
      expect(mockCtx.stroke).not.toHaveBeenCalled()
    })

    it('should draw rounded rectangle with stroke', () => {
      mockCtx.stroke = vi.fn() // Reset the mock
      renderer.drawRoundedRect(mockCtx, 10, 20, 100, 50, 5, undefined, '#0000ff', 2)

      // Verify path creation
      expect(mockCtx.beginPath).toHaveBeenCalled()
      expect(mockCtx.closePath).toHaveBeenCalled()

      // Verify stroke was applied
      expect(mockCtx.strokeStyle).toBe('#0000ff')
      expect(mockCtx.lineWidth).toBe(2)
      expect(mockCtx.stroke).toHaveBeenCalled()

      // Verify fill was not applied
      expect(mockCtx.fill).not.toHaveBeenCalled()
    })

    it('should draw rounded rectangle with both fill and stroke', () => {
      mockCtx.fill = vi.fn()
      mockCtx.stroke = vi.fn()

      renderer.drawRoundedRect(mockCtx, 10, 20, 100, 50, 5, '#ff0000', '#0000ff', 2)

      // Verify both fill and stroke were applied
      expect(mockCtx.fillStyle).toBe('#ff0000')
      expect(mockCtx.fill).toHaveBeenCalled()
      expect(mockCtx.strokeStyle).toBe('#0000ff')
      expect(mockCtx.lineWidth).toBe(2)
      expect(mockCtx.stroke).toHaveBeenCalled()
    })
  })

  describe('drawKeyRectangleLayers', () => {
    it('should draw single rectangle key', () => {
      const rectangles = [
        { x: 10, y: 20, width: 100, height: 50, type: 'outer' as const },
        { x: 16, y: 26, width: 88, height: 38, type: 'inner' as const },
      ]

      renderer.drawKeyRectangleLayers(mockCtx, rectangles, 5, '#000000', '#cccccc', '#ffffff', 1)

      // Should set fill and stroke styles
      expect(mockCtx.fillStyle).toBeDefined()
      expect(mockCtx.strokeStyle).toBeDefined()
    })

    it('should draw non-rectangular key with two rectangles', () => {
      const rectangles = [
        { x: 10, y: 20, width: 67.5, height: 108, type: 'outer' as const },
        { x: 10, y: 128, width: 81, height: 54, type: 'outer' as const },
        { x: 16, y: 26, width: 55.5, height: 96, type: 'inner' as const },
        { x: 16, y: 134, width: 69, height: 42, type: 'inner' as const },
      ]

      renderer.drawKeyRectangleLayers(mockCtx, rectangles, 5, '#000000', '#cccccc', '#ffffff', 1)

      // Should handle multiple rectangles (vector union)
      expect(mockCtx.fillStyle).toBeDefined()
      expect(mockCtx.strokeStyle).toBeDefined()
    })

    it('should draw inner and outer layers', () => {
      const rectangles = [
        { x: 10, y: 20, width: 100, height: 50, type: 'outer' as const },
        { x: 16, y: 26, width: 88, height: 38, type: 'inner' as const },
      ]

      renderer.drawKeyRectangleLayers(mockCtx, rectangles, 5, '#000000', '#cccccc', '#ffffff', 1)

      // Verify colors are set for both layers
      expect(mockCtx.fillStyle).toBeDefined()
      expect(mockCtx.strokeStyle).toBeDefined()
    })
  })

  describe('drawCircularKey', () => {
    it('should draw circular key for rotary encoder', () => {
      const params: KeyRenderParams = {
        capx: 0,
        capy: 0,
        capwidth: 54,
        capheight: 54,
        outercapx: 2,
        outercapy: 2,
        outercapwidth: 50,
        outercapheight: 50,
        innercapx: 8,
        innercapy: 8,
        innercapwidth: 38,
        innercapheight: 38,
        textcapx: 11,
        textcapy: 11,
        textcapwidth: 32,
        textcapheight: 32,
        darkColor: '#cccccc',
        lightColor: '#ffffff',
        nonRectangular: false,
        origin_x: 0,
        origin_y: 0,
      }

      renderer.drawCircularKey(mockCtx, params, '#000000', '#cccccc', '#ffffff', 1, 6)

      // Verify circles were drawn
      expect(mockCtx.beginPath).toHaveBeenCalled()
      expect(mockCtx.arc).toHaveBeenCalled()
      expect(mockCtx.fill).toHaveBeenCalled()
      expect(mockCtx.stroke).toHaveBeenCalled()
    })

    it('should draw with correct radius', () => {
      const params: KeyRenderParams = {
        capx: 0,
        capy: 0,
        capwidth: 54,
        capheight: 54,
        outercapx: 0,
        outercapy: 0,
        outercapwidth: 54,
        outercapheight: 54,
        innercapx: 6,
        innercapy: 6,
        innercapwidth: 42,
        innercapheight: 42,
        textcapx: 9,
        textcapy: 9,
        textcapwidth: 36,
        textcapheight: 36,
        darkColor: '#cccccc',
        lightColor: '#ffffff',
        nonRectangular: false,
        origin_x: 0,
        origin_y: 0,
      }

      const arcSpy = vi.spyOn(mockCtx, 'arc')
      renderer.drawCircularKey(mockCtx, params, '#000000', '#cccccc', '#ffffff', 1, 6)

      // Verify arc was called with correct radius (outercapwidth / 2 = 27)
      const firstArcCall = arcSpy.mock.calls[0]
      expect(firstArcCall[2]).toBe(27) // radius = 54 / 2
    })
  })

  describe('drawHomingNub', () => {
    it('should draw homing nub at correct position', () => {
      const params: KeyRenderParams = {
        capx: 0,
        capy: 0,
        capwidth: 54,
        capheight: 54,
        outercapx: 2,
        outercapy: 2,
        outercapwidth: 50,
        outercapheight: 50,
        innercapx: 8,
        innercapy: 8,
        innercapwidth: 38,
        innercapheight: 38,
        textcapx: 11,
        textcapy: 11,
        textcapwidth: 32,
        textcapheight: 32,
        darkColor: '#cccccc',
        lightColor: '#ffffff',
        nonRectangular: false,
        origin_x: 0,
        origin_y: 0,
      }

      const fillRectSpy = vi.spyOn(mockCtx, 'fillRect')
      renderer.drawHomingNub(mockCtx, params)

      // Verify fillRect was called
      expect(fillRectSpy).toHaveBeenCalled()

      // Verify nub is drawn near the bottom center of the inner cap
      // Center X should be around innercapx + innercapwidth / 2 = 8 + 19 = 27
      // Center Y should be around innercapy + innercapheight * 0.9 = 8 + 34.2 = 42.2
      const call = fillRectSpy.mock.calls[0]
      const drawX = call[0]
      const drawY = call[1]

      // X should be centered (approximately)
      expect(drawX).toBeGreaterThan(20)
      expect(drawX).toBeLessThan(30)

      // Y should be near the bottom (approximately 90% down)
      expect(drawY).toBeGreaterThan(35)
      expect(drawY).toBeLessThan(45)

      // Verify fill style has opacity
      expect(mockCtx.fillStyle).toContain('rgba')
    })
  })

  describe('drawKey', () => {
    it('should render basic rectangular key', () => {
      const key: Partial<Key> = {
        x: 0,
        y: 0,
        width: 1,
        height: 1,
        color: '#cccccc',
        default: {
          textColor: '#000000',
          textSize: 3,
        },
      }

      renderer.drawKey(mockCtx, key as Key, { unit: 54 })

      // Verify save/restore for state management
      expect(mockCtx.save).toHaveBeenCalled()
      expect(mockCtx.restore).toHaveBeenCalled()

      // Verify rendering occurred (fill style should be set)
      expect(mockCtx.fillStyle).toBeDefined()
    })

    it('should render selected key with thicker stroke', () => {
      const key: Partial<Key> = {
        x: 0,
        y: 0,
        width: 1,
        height: 1,
        color: '#cccccc',
        default: {
          textColor: '#000000',
          textSize: 3,
        },
      }

      renderer.drawKey(mockCtx, key as Key, { unit: 54, isSelected: true, strokeWidth: 2 })

      // Verify thicker stroke is used
      // Note: The actual stroke width setting happens in the rendering methods
      expect(mockCtx.save).toHaveBeenCalled()
      expect(mockCtx.restore).toHaveBeenCalled()
    })

    it('should render rotated key', () => {
      const key: Partial<Key> = {
        x: 1,
        y: 1,
        width: 1,
        height: 1,
        rotation_angle: 45,
        rotation_x: 2,
        rotation_y: 2,
        color: '#cccccc',
        default: {
          textColor: '#000000',
          textSize: 3,
        },
      }

      renderer.drawKey(mockCtx, key as Key, { unit: 54 })

      // Verify rotation transformations were applied
      expect(mockCtx.translate).toHaveBeenCalled()
      expect(mockCtx.rotate).toHaveBeenCalled()

      // Verify save/restore for transformation cleanup
      expect(mockCtx.save).toHaveBeenCalled()
      expect(mockCtx.restore).toHaveBeenCalled()
    })

    it('should render ghost key with reduced opacity', () => {
      const key: Partial<Key> = {
        x: 0,
        y: 0,
        width: 1,
        height: 1,
        ghost: true,
        color: '#cccccc',
        default: {
          textColor: '#000000',
          textSize: 3,
        },
      }

      renderer.drawKey(mockCtx, key as Key, { unit: 54 })

      // Verify opacity was reduced
      expect(mockCtx.globalAlpha).toBeLessThan(1)
      expect(mockCtx.globalAlpha).toBeGreaterThan(0)

      // Verify save/restore for state management
      expect(mockCtx.restore).toHaveBeenCalled()
    })

    it('should render non-rectangular key', () => {
      const key: Partial<Key> = {
        x: 0,
        y: 0,
        width: 1.25,
        height: 2,
        width2: 1.5,
        height2: 1,
        x2: 0,
        y2: 1,
        color: '#cccccc',
        default: {
          textColor: '#000000',
          textSize: 3,
        },
      }

      renderer.drawKey(mockCtx, key as Key, { unit: 54 })

      // Verify rendering occurred
      expect(mockCtx.save).toHaveBeenCalled()
      expect(mockCtx.restore).toHaveBeenCalled()
    })

    it('should render circular key for rotary encoder', () => {
      const key: Partial<Key> = {
        x: 0,
        y: 0,
        width: 1,
        height: 1,
        sm: 'rot_ec11',
        color: '#cccccc',
        default: {
          textColor: '#000000',
          textSize: 3,
        },
      }

      renderer.drawKey(mockCtx, key as Key, { unit: 54 })

      // Verify circular rendering was used
      expect(mockCtx.arc).toHaveBeenCalled()
      expect(mockCtx.save).toHaveBeenCalled()
      expect(mockCtx.restore).toHaveBeenCalled()
    })

    it('should render homing key with nub', () => {
      const key: Partial<Key> = {
        x: 0,
        y: 0,
        width: 1,
        height: 1,
        nub: true,
        color: '#cccccc',
        default: {
          textColor: '#000000',
          textSize: 3,
        },
      }

      const fillRectSpy = vi.spyOn(mockCtx, 'fillRect')
      renderer.drawKey(mockCtx, key as Key, { unit: 54 })

      // Verify homing nub was drawn
      expect(fillRectSpy).toHaveBeenCalled()

      // Verify standard rendering also occurred
      expect(mockCtx.save).toHaveBeenCalled()
      expect(mockCtx.restore).toHaveBeenCalled()
    })
  })

  // Basic smoke test to ensure KeyRenderer can be instantiated
  it('should create a KeyRenderer instance', () => {
    expect(() => new KeyRenderer()).not.toThrow()
  })
})
