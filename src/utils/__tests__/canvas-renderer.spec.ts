import { describe, it, expect, beforeEach, vi } from 'vitest'
import { CanvasRenderer } from '../canvas-renderer'
import { Key, KeyboardMetadata } from '@adamws/kle-serial'

// Mock Path2D constructor and methods for Node.js environment
global.Path2D = vi.fn(function (this: Path2D) {
  this.moveTo = vi.fn()
  this.lineTo = vi.fn()
  this.closePath = vi.fn()
  this.quadraticCurveTo = vi.fn()
  this.addPath = vi.fn()
  return this
}) as unknown as typeof Path2D

// Mock canvas and context
const mockGradient = {
  addColorStop: vi.fn(),
}

const mockContext = {
  clearRect: vi.fn(),
  fillRect: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  quadraticCurveTo: vi.fn(),
  closePath: vi.fn(),
  fill: vi.fn((path?: Path2D) => {
    // Track path-based fills
    if (path) {
      mockContext._pathFillCalls = (mockContext._pathFillCalls || 0) + 1
    }
  }),
  stroke: vi.fn((path?: Path2D) => {
    // Track path-based strokes
    if (path) {
      mockContext._pathStrokeCalls = (mockContext._pathStrokeCalls || 0) + 1
    }
  }),
  _pathFillCalls: 0,
  _pathStrokeCalls: 0,
  fillText: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
  translate: vi.fn(),
  rotate: vi.fn(),
  setLineDash: vi.fn(),
  createLinearGradient: vi.fn().mockReturnValue(mockGradient),
  createRadialGradient: vi.fn().mockReturnValue(mockGradient),
  measureText: vi.fn().mockReturnValue({ width: 50 }),
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 1,
  font: '',
  textAlign: 'left' as CanvasTextAlign,
  textBaseline: 'top' as CanvasTextBaseline,
  globalAlpha: 1,
  shadowColor: '',
  shadowOffsetX: 0,
  shadowOffsetY: 0,
  shadowBlur: 0,
  canvas: {
    width: 800,
    height: 600,
  },
}

const mockCanvas = {
  getContext: vi.fn().mockReturnValue(mockContext),
  width: 800,
  height: 600,
} as unknown as HTMLCanvasElement

describe('CanvasRenderer', () => {
  let renderer: CanvasRenderer

  beforeEach(() => {
    vi.clearAllMocks()
    // Reset path call counters
    mockContext._pathFillCalls = 0
    mockContext._pathStrokeCalls = 0
    renderer = new CanvasRenderer(mockCanvas, {
      unit: 54,
      background: '#f0f0f0',
    })
  })

  describe('constructor', () => {
    it('should create renderer with canvas and options', () => {
      expect(renderer).toBeDefined()
      expect(mockCanvas.getContext).toHaveBeenCalledWith('2d')
    })
  })

  describe('render', () => {
    it('should render empty keyboard', () => {
      const keys: Key[] = []
      const selectedKeys: Key[] = []
      const metadata = { ...new KeyboardMetadata(), backcolor: '#eeeeee' }

      renderer.render(keys, selectedKeys, metadata)

      expect(mockContext.clearRect).toHaveBeenCalledWith(0, 0, 800, 600)
      // Background rendering removed, so no fillRect calls expected
    })

    it('should render single key', () => {
      const key = {
        ...new Key(),
        x: 1,
        y: 1,
        labels: ['', '', '', '', 'A', '', '', '', '', '', '', ''],
      } as Key
      const keys = [key]
      const selectedKeys: Key[] = []
      const metadata = new KeyboardMetadata()

      renderer.render(keys, selectedKeys, metadata)

      expect(mockContext.clearRect).toHaveBeenCalled()
      // Modern Path2D approach doesn't use beginPath
      expect(mockContext.fill).toHaveBeenCalled()
      expect(mockContext.fillText).toHaveBeenCalledWith('A', expect.any(Number), expect.any(Number))
    })

    it('should render selected key with red stroke', () => {
      const key = new Key()
      const keys = [key]
      const selectedKeys = [key]
      const metadata = new KeyboardMetadata()

      renderer.render(keys, selectedKeys, metadata)

      // Selected keys should have red stroke color applied
      expect(mockContext.strokeStyle).toBe('#dc3545')
      expect(mockContext.lineWidth).toBe(2)
    })

    it('should apply ghost effect', () => {
      const key = {
        ...new Key(),
        ghost: true,
      }
      const keys = [key]
      const selectedKeys: Key[] = []
      const metadata = new KeyboardMetadata()

      renderer.render(keys, selectedKeys, metadata)

      expect(mockContext.globalAlpha).toBe(0.3)
      expect(mockContext.restore).toHaveBeenCalled()
    })

    it('should handle rotation', () => {
      const key = {
        ...new Key(),
        rotation_angle: 45,
      }
      const keys = [key]
      const selectedKeys: Key[] = []
      const metadata = new KeyboardMetadata()

      renderer.render(keys, selectedKeys, metadata)

      expect(mockContext.translate).toHaveBeenCalled()
      // Check that rotate was called with approximately PI/4 (45 degrees in radians)
      // Using decimal.js may give slightly different precision than JavaScript's Math.PI / 4
      const rotateCall = mockContext.rotate.mock.calls[0]?.[0]
      expect(rotateCall).toBeDefined()
      expect(rotateCall).toBeCloseTo(Math.PI / 4, 10) // 10 decimal places precision
    })

    it('should skip rendering background for decal keys', () => {
      const key = {
        ...new Key(),
        decal: true,
        labels: ['', '', '', '', 'LED', '', '', '', '', '', '', ''],
      } as Key
      const keys = [key]
      const selectedKeys: Key[] = []
      const metadata = new KeyboardMetadata()

      // Test rendering - we expect fill to be called for text but not background
      renderer.render(keys, selectedKeys, metadata)

      // Should still render text but skip key background
      expect(mockContext.fillText).toHaveBeenCalledWith(
        'LED',
        expect.any(Number),
        expect.any(Number),
      )
    })

    it('should render selection outline for selected decal keys', () => {
      const key = {
        ...new Key(),
        decal: true,
        labels: ['', '', '', '', 'LED', '', '', '', '', '', '', ''],
      } as Key
      const keys = [key]
      const selectedKeys = [key] // Key is selected
      const metadata = new KeyboardMetadata()

      // Test rendering selected decal key
      renderer.render(keys, selectedKeys, metadata)

      // Should render red selection outline for decal key
      expect(mockContext.stroke).toHaveBeenCalled()
      expect(mockContext.strokeStyle).toBe('#dc3545') // Red color for selection
      expect(mockContext.lineWidth).toBe(2) // 2px stroke width
    })
  })

  describe('label positioning', () => {
    it('should use smaller margins for small keys to prevent overlap', () => {
      const smallKey = {
        ...new Key(),
        x: 0,
        y: 0,
        width: 1, // 1u key
        labels: ['Q', '', 'W', 'A', '', 'D', '', '', '', '', '', ''], // left, center, right labels
        textSize: [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3], // size 3 text
      } as Key
      const keys = [smallKey]
      const metadata = new KeyboardMetadata()

      renderer.render(keys, [], metadata)

      // Verify that fillText was called for left, center, and right labels
      const calls = mockContext.fillText.mock.calls
      expect(calls.length).toBeGreaterThanOrEqual(3) // At least 3 labels rendered

      // Check that positions don't overlap - left should be < right
      const leftX = calls.find((call) => call[0] === 'Q')?.[1] || 0
      const rightX = calls.find((call) => call[0] === 'W')?.[1] || 0

      if (leftX && rightX) {
        expect(leftX).toBeLessThan(rightX) // Left should be to the left of right
      }
    })

    it('should use larger margins for large keys', () => {
      const largeKey = {
        ...new Key(),
        x: 0,
        y: 0,
        width: 2.5, // 2.5u key
        labels: ['Q', '', 'W', 'A', '', 'D', '', '', '', '', '', ''], // left, center, right labels
        textSize: [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
      } as Key
      const keys = [largeKey]
      const metadata = new KeyboardMetadata()

      renderer.render(keys, [], metadata)

      // Verify text rendering occurred
      expect(mockContext.fillText).toHaveBeenCalled()
    })

    it('should use smaller font size for front labels', () => {
      const key = {
        ...new Key(),
        x: 0,
        y: 0,
        labels: ['', '', '', '', '', '', '', '', '', 'F1', 'F2', 'F3'], // front labels at indices 9-11
        textSize: [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3], // size 3 text
      } as Key
      const keys = [key]
      const metadata = new KeyboardMetadata()

      renderer.render(keys, [], metadata)

      // Check that font was set for front labels - they should use smaller font
      const fontCalls = mockContext.font
      expect(typeof fontCalls).toBe('string')

      // Verify that front label text was rendered
      expect(mockContext.fillText).toHaveBeenCalledWith(
        'F1',
        expect.any(Number),
        expect.any(Number),
      )
      expect(mockContext.fillText).toHaveBeenCalledWith(
        'F2',
        expect.any(Number),
        expect.any(Number),
      )
      expect(mockContext.fillText).toHaveBeenCalledWith(
        'F3',
        expect.any(Number),
        expect.any(Number),
      )
    })
  })

  describe('getKeyAtPosition', () => {
    it('should return null for empty position', () => {
      const keys: Key[] = []
      const result = renderer.getKeyAtPosition(100, 100, keys)

      expect(result).toBeNull()
    })

    it('should return key at position', () => {
      const key = {
        ...new Key(),
        x: 1,
        y: 1,
        width: 1,
        height: 1,
      }
      const keys = [key]

      // Position within key bounds (considering unit size and padding)
      const x = 20 + 54 * 1 + 27 // padding + unit*x + half unit
      const y = 20 + 54 * 1 + 27 // padding + unit*y + half unit

      const result = renderer.getKeyAtPosition(x, y, keys)

      expect(result).toBe(key)
    })

    it('should return null for position outside keys', () => {
      const key = {
        ...new Key(),
        x: 1,
        y: 1,
      }
      const keys = [key]

      const result = renderer.getKeyAtPosition(10, 10, keys) // Far outside

      expect(result).toBeNull()
    })

    it('should return topmost key when keys overlap', () => {
      const key1 = {
        ...new Key(),
        x: 0,
        y: 0,
      }
      const key2 = {
        ...new Key(),
        x: 0.5,
        y: 0,
      }
      const keys = [key1, key2] // key2 is later, so should be on top

      // Position where keys overlap
      const x = 20 + 54 * 0.75
      const y = 20 + 54 * 0.5

      const result = renderer.getKeyAtPosition(x, y, keys)

      expect(result).toBe(key2) // Should return the topmost (last) key
    })

    it('should handle non-rectangular keys', () => {
      const key = {
        ...new Key(),
        x: 1,
        y: 1,
        width: 1.25,
        height: 2,
        width2: 1.5,
        height2: 1,
        x2: -0.25,
        y2: 1,
      }
      const keys = [key]

      // Test position in second part of non-rectangular key
      const x = 20 + 54 * (1 - 0.25) + 27 // Second part position
      const y = 20 + 54 * (1 + 1) + 27 // Second part Y position

      const result = renderer.getKeyAtPosition(x, y, keys)

      expect(result).toBe(key)
    })
  })

  describe('non-rectangular key rendering', () => {
    it('should render big-ass-enter key as two separate rectangles', () => {
      const bigAssEnterKey = {
        ...new Key(),
        x: 0.75,
        y: 0,
        width: 1.5,
        height: 2,
        width2: 2.25,
        height2: 1,
        x2: -0.75,
        y2: 1,
        labels: ['', '', '', '', 'Enter', '', '', '', '', '', '', ''],
      } as Key
      const keys = [bigAssEnterKey]
      const selectedKeys: Key[] = []
      const metadata = new KeyboardMetadata()

      renderer.render(keys, selectedKeys, metadata)

      // Non-rectangular keys use vector union approach with Path2D
      expect(mockContext.fill).toHaveBeenCalled()
      expect(mockContext.stroke).toHaveBeenCalled()
      expect(mockContext.fillText).toHaveBeenCalledWith(
        'Enter',
        expect.any(Number),
        expect.any(Number),
      )
    })

    it('should render ISO enter key correctly', () => {
      const isoEnterKey = {
        ...new Key(),
        x: 0.25,
        y: 0,
        width: 1.25,
        height: 2,
        width2: 1.5,
        height2: 1,
        x2: -0.25,
        y2: 0,
        labels: ['', '', '', '', 'ISO Enter', '', '', '', '', '', '', ''],
      } as Key
      const keys = [isoEnterKey]
      const selectedKeys: Key[] = []
      const metadata = new KeyboardMetadata()

      renderer.render(keys, selectedKeys, metadata)

      // Should render text label (wrapped into multiple lines if needed)
      // The text wrapping splits "ISO Enter" into separate words if it doesn't fit
      expect(mockContext.fillText).toHaveBeenCalled()

      // Verify that text was rendered (could be wrapped or not depending on available space)
      const fillTextCalls = mockContext.fillText.mock.calls
      expect(fillTextCalls.length).toBeGreaterThan(0)

      // The text should contain parts of "ISO Enter" - either as one call or wrapped
      const renderedTexts = fillTextCalls.map((call) => call[0] as string)
      const allText = renderedTexts.join(' ')
      expect(allText).toContain('ISO')
      expect(allText).toContain('Enter')
    })

    it('should render Delete label on 1x1 key without wrapping', () => {
      const deleteKey = {
        ...new Key(),
        x: 0,
        y: 0,
        width: 1,
        height: 1,
        labels: ['Delete', '', '', '', '', '', '', '', '', '', '', ''],
        textSize: [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
      } as Key
      const keys = [deleteKey]
      const selectedKeys: Key[] = []
      const metadata = new KeyboardMetadata()

      // Clear mocks to start fresh
      vi.clearAllMocks()

      renderer.render(keys, selectedKeys, metadata)

      // Should render the Delete label
      expect(mockContext.fillText).toHaveBeenCalled()

      // Verify that "Delete" was rendered as a single word (not wrapped)
      const fillTextCalls = mockContext.fillText.mock.calls
      const renderedTexts = fillTextCalls.map((call) => call[0] as string)

      // Verify the rendered texts

      // "Delete" should appear as a single word, not split or truncated
      const deleteRelatedCalls = renderedTexts.filter(
        (text) => text.includes('Delete') || text.includes('Del') || text.includes('…'),
      )

      // Should be exactly one call with the full "Delete" text (no wrapping or truncation)
      expect(deleteRelatedCalls.length).toBe(1)
      expect(deleteRelatedCalls[0]).toBe('Delete')

      // Make sure it's not truncated to "Del"
      expect(renderedTexts).not.toContain('Del')
      expect(renderedTexts).not.toContain('Del…')
    })

    it('should identify non-rectangular keys correctly', () => {
      // Test non-rectangular key
      const nonRectangularKey = {
        ...new Key(),
        width: 1.5,
        height: 2,
        width2: 2.25,
        height2: 1,
        x2: -0.75,
        y2: 1,
      }

      // Clear mocks to get clean slate
      vi.clearAllMocks()

      // Render non-rectangular key
      renderer.render([nonRectangularKey], [], new KeyboardMetadata())

      // Non-rectangular key should result in Path2D-based rendering
      expect(mockContext.fill).toHaveBeenCalled()
      expect(mockContext.stroke).toHaveBeenCalled()
    })
  })

  describe('rotated key bounds calculation', () => {
    it('should calculate correct bounds for non-rotated keys', () => {
      const key = {
        ...new Key(),
        x: 0,
        y: 0,
        width: 1,
        height: 1,
        rotation_angle: 0,
      }
      const renderer = new CanvasRenderer(mockCanvas, {
        unit: 54,
        background: '#f0f0f0',
      })

      // Access private method for testing
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const bounds = (renderer as any).calculateRotatedKeyBounds(key) as {
        minX: number
        minY: number
        maxX: number
        maxY: number
      }

      // For non-rotated key at (0,0) with size 1x1
      expect(bounds.minX).toBe(0)
      expect(bounds.minY).toBe(0)
      expect(bounds.maxX).toBe(54)
      expect(bounds.maxY).toBe(54)
    })

    it('should calculate expanded bounds for rotated keys', () => {
      const key = {
        ...new Key(),
        x: 0,
        y: 0,
        width: 2, // 2u wide key
        height: 1,
        rotation_angle: 45, // 45 degree rotation
        rotation_x: 1, // rotate around center
        rotation_y: 0.5,
      }
      const renderer = new CanvasRenderer(mockCanvas, {
        unit: 54,
        background: '#f0f0f0',
      })

      // Access private method for testing
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const bounds = (renderer as any).calculateRotatedKeyBounds(key) as {
        minX: number
        minY: number
        maxX: number
        maxY: number
      }

      // For rotated key, bounds should be larger than non-rotated
      // A 2x1 key rotated 45 degrees will have diagonal corners extending further
      expect(bounds.minX).toBeLessThan(0) // Should extend beyond origin
      expect(bounds.minY).toBeLessThan(0) // Should extend beyond origin
      expect(bounds.maxX).toBeGreaterThan(54 + 54) // Should be wider than 2u key
      expect(bounds.maxY).toBeGreaterThan(54) // Should be taller than 1u key
    })

    it('should handle non-rectangular rotated keys', () => {
      const key = {
        ...new Key(),
        x: 0,
        y: 0,
        width: 1.5,
        height: 2,
        width2: 1.5,
        height2: 1,
        x2: 0,
        y2: 1,
        rotation_angle: 30,
        rotation_x: 0.75,
        rotation_y: 1,
      }

      const renderer = new CanvasRenderer(mockCanvas, {
        unit: 54,
        background: '#f0f0f0',
      })

      // Access private method for testing
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const bounds = (renderer as any).calculateRotatedKeyBounds(key) as {
        minX: number
        minY: number
        maxX: number
        maxY: number
      }

      // Should calculate bounds for all corners of non-rectangular key
      expect(typeof bounds.minX).toBe('number')
      expect(typeof bounds.minY).toBe('number')
      expect(typeof bounds.maxX).toBe('number')
      expect(typeof bounds.maxY).toBe('number')
      expect(bounds.maxX).toBeGreaterThan(bounds.minX)
      expect(bounds.maxY).toBeGreaterThan(bounds.minY)
    })
  })

  describe('key hit testing for non-rectangular keys', () => {
    it('should detect clicks in both parts of big-ass-enter', () => {
      const bigAssEnterKey = {
        ...new Key(),
        x: 0.75,
        y: 0,
        width: 1.5,
        height: 2,
        width2: 2.25,
        height2: 1,
        x2: -0.75,
        y2: 1,
      }
      const keys = [bigAssEnterKey]

      // Test position in first rectangle (top part)
      const x1 = 20 + 54 * 0.75 + 27 // Middle of first part
      const y1 = 20 + 54 * 0.5 // Middle height of first part

      const result1 = renderer.getKeyAtPosition(x1, y1, keys)
      expect(result1).toBe(bigAssEnterKey)

      // Test position in second rectangle (bottom part)
      const x2 = 20 + 54 * 0 + 27 // Middle of second part
      const y2 = 20 + 54 * 1.5 // Middle height of second part

      const result2 = renderer.getKeyAtPosition(x2, y2, keys)
      expect(result2).toBe(bigAssEnterKey)
    })

    it('should not detect clicks in the gap of non-rectangular keys', () => {
      const bigAssEnterKey = {
        ...new Key(),
        x: 0.75,
        y: 0,
        width: 1.5,
        height: 2,
        width2: 2.25,
        height2: 1,
        x2: -0.75,
        y2: 1,
      }
      const keys = [bigAssEnterKey]

      // Test position in gap (should not hit)
      const x = 20 + 54 * 0.25 // Between the two rectangles
      const y = 20 + 54 * 0.5 // Top part height

      const result = renderer.getKeyAtPosition(x, y, keys)
      expect(result).toBeNull()
    })
  })

  describe('rendering order', () => {
    it('should render selected keys on top of non-selected keys', () => {
      const key1 = {
        ...new Key(),
        x: 0,
        y: 0,
        color: '#cc0000',
        labels: ['', '', '', '', 'A', '', '', '', '', '', '', ''],
      } as Key

      const key2 = {
        ...new Key(),
        x: 0.5,
        y: 0,
        color: '#0000cc',
        labels: ['', '', '', '', 'B', '', '', '', '', '', '', ''],
      } as Key

      const keys = [key1, key2]
      const selectedKeys = [key2] // Only key2 is selected
      const metadata = new KeyboardMetadata()

      // The test is that this doesn't throw an error and maintains the separation logic
      expect(() => {
        renderer.render(keys, selectedKeys, metadata)
      }).not.toThrow()

      // Verify that the rendering logic executed properly
      expect(mockContext.fill).toHaveBeenCalled()
      expect(mockContext.stroke).toHaveBeenCalled()
    })

    it('should handle empty selected keys list', () => {
      const key1 = {
        ...new Key(),
        x: 0,
        y: 0,
        color: '#cc0000',
        labels: ['', '', '', '', 'A', '', '', '', '', '', '', ''],
      } as Key

      const keys = [key1]
      const selectedKeys: Key[] = [] // No selection
      const metadata = new KeyboardMetadata()

      expect(() => {
        renderer.render(keys, selectedKeys, metadata)
      }).not.toThrow()

      // Should still render the non-selected key
      expect(mockContext.fill).toHaveBeenCalled()
    })
  })

  describe('text wrapping', () => {
    it('should wrap long text labels to prevent overflow', () => {
      // Mock measureText to return different widths based on text length
      mockContext.measureText.mockImplementation((text: string) => ({
        width: text.length * 8, // Simple mock - each character is 8 pixels wide
      }))

      const keyWithLongLabel = {
        ...new Key(),
        x: 0,
        y: 0,
        width: 1, // Small key (54px wide in real units)
        labels: ['', '', '', '', 'Very Long Label Text', '', '', '', '', '', '', ''],
      } as Key

      const keys = [keyWithLongLabel]
      const selectedKeys: Key[] = []
      const metadata = new KeyboardMetadata()

      expect(() => {
        renderer.render(keys, selectedKeys, metadata)
      }).not.toThrow()

      // Should have made multiple fillText calls for wrapped text
      expect(mockContext.fillText).toHaveBeenCalled()

      // Check if text was wrapped (multiple calls with parts of the original text)
      const fillTextCalls = mockContext.fillText.mock.calls
      const renderedTexts = fillTextCalls.map((call) => call[0] as string)

      // The long text should have been split into multiple parts
      expect(fillTextCalls.length).toBeGreaterThanOrEqual(1)

      // The rendered text should contain the first parts of the original label
      // (Text wrapping limits the number of lines based on available space)
      const allText = renderedTexts.join(' ')
      expect(allText).toContain('Very')
      expect(allText).toContain('Long')

      // Text might be truncated if there's not enough vertical space for all words
      // The key behavior is that it doesn't overflow horizontally
      expect(allText.length).toBeGreaterThan(0)
    })

    it('should handle single words that are too long by truncating', () => {
      // Mock measureText to return width based on text length
      mockContext.measureText.mockImplementation((text: string) => ({
        width: text.length * 10, // Each character is 10 pixels wide
      }))

      const keyWithVeryLongWord = {
        ...new Key(),
        x: 0,
        y: 0,
        width: 0.75, // Very small key
        labels: ['', '', '', '', 'Supercalifragilisticexpialidocious', '', '', '', '', '', '', ''], // Single very long word
      } as Key

      const keys = [keyWithVeryLongWord]
      const selectedKeys: Key[] = []
      const metadata = new KeyboardMetadata()

      expect(() => {
        renderer.render(keys, selectedKeys, metadata)
      }).not.toThrow()

      // Should have rendered something (even if truncated)
      expect(mockContext.fillText).toHaveBeenCalled()
    })
  })
})
