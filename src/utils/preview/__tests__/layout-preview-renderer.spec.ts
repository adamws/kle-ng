import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Key, KeyboardMetadata } from '@adamws/kle-serial'
import { LayoutPreviewRenderer } from '../layout-preview-renderer'

global.Path2D = vi.fn(function (this: Path2D) {
  this.moveTo = vi.fn()
  this.lineTo = vi.fn()
  this.closePath = vi.fn()
  this.quadraticCurveTo = vi.fn()
  this.addPath = vi.fn()
  return this
}) as unknown as typeof Path2D

interface MockContext {
  setTransform: ReturnType<typeof vi.fn>
  canvas: { width: number; height: number }
  [key: string]: unknown
}

let mockContext: MockContext

const createMockContext = (): MockContext => ({
  clearRect: vi.fn(),
  fillRect: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  quadraticCurveTo: vi.fn(),
  closePath: vi.fn(),
  fill: vi.fn(),
  stroke: vi.fn(),
  fillText: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
  translate: vi.fn(),
  rotate: vi.fn(),
  scale: vi.fn(),
  setTransform: vi.fn(),
  setLineDash: vi.fn(),
  getTransform: vi.fn().mockReturnValue({ a: 1, d: 1, e: 0, f: 0 }),
  measureText: vi.fn().mockReturnValue({ width: 10 }),
  createLinearGradient: vi.fn().mockReturnValue({ addColorStop: vi.fn() }),
  createRadialGradient: vi.fn().mockReturnValue({ addColorStop: vi.fn() }),
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 1,
  font: '',
  textAlign: 'left',
  textBaseline: 'top',
  globalAlpha: 1,
  canvas: { width: 0, height: 0 },
})

const makeKey = (overrides: Partial<Key> = {}): Key =>
  ({
    ...new Key(),
    x: 0,
    y: 0,
    width: 1,
    height: 1,
    labels: ['', '', '', '', '', '', '', '', '', '', '', ''],
    textSize: [],
    textColor: [],
    default: { textColor: '#000000', textSize: 3 },
    ...overrides,
  }) as Key

/** A 10u x 4u grid of keys */
const gridKeys = (cols = 10, rows = 4): Key[] => {
  const keys: Key[] = []
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      keys.push(makeKey({ x, y }))
    }
  }
  return keys
}

describe('LayoutPreviewRenderer', () => {
  let renderer: LayoutPreviewRenderer
  const metadata = new KeyboardMetadata()

  beforeEach(() => {
    vi.clearAllMocks()
    mockContext = createMockContext()
    HTMLCanvasElement.prototype.getContext = vi
      .fn()
      .mockReturnValue(mockContext) as unknown as HTMLCanvasElement['getContext']
    renderer = new LayoutPreviewRenderer()
  })

  describe('fit scaling', () => {
    it('shrinks a wide layout to fit the target width', () => {
      // 10u x 4u => 540 x 216 px + 18 padding = 558 x 234
      const result = renderer.render(gridKeys(), metadata, {
        maxWidth: 279,
        maxHeight: 1000,
        dpr: 1,
      })

      expect(result.scale).toBeCloseTo(0.5, 5)
      expect(result.cssWidth).toBe(279) // round(558 * 0.5)
      expect(result.unitsWide).toBeCloseTo(10, 5)
      expect(result.unitsTall).toBeCloseTo(4, 5)
    })

    it('is limited by height when the box is wide and short', () => {
      const result = renderer.render(gridKeys(), metadata, {
        maxWidth: 10000,
        maxHeight: 117,
        dpr: 1,
      })

      expect(result.scale).toBeCloseTo(0.5, 5)
      expect(result.cssHeight).toBe(117)
    })

    it('never upscales a layout smaller than the box', () => {
      const result = renderer.render([makeKey()], metadata, {
        maxWidth: 1000,
        maxHeight: 1000,
        dpr: 1,
      })

      expect(result.scale).toBe(1)
      expect(result.cssWidth).toBe(72) // 54 + 2 * 9 padding
      expect(result.cssHeight).toBe(72)
    })

    it('handles an empty layout without dividing by zero', () => {
      const result = renderer.render([], metadata, { maxWidth: 200, maxHeight: 200, dpr: 1 })

      expect(result.scale).toBe(1)
      expect(result.cssWidth).toBeGreaterThan(0)
      expect(result.cssHeight).toBeGreaterThan(0)
    })
  })

  describe('device pixel ratio', () => {
    it('sizes the backing store in device pixels and the element in CSS pixels', () => {
      const result = renderer.render([makeKey()], metadata, {
        maxWidth: 1000,
        maxHeight: 1000,
        dpr: 2,
      })

      expect(result.cssWidth).toBe(72)
      expect(result.canvas.width).toBe(144)
      expect(result.canvas.height).toBe(144)
      expect(result.canvas.style.width).toBe('72px')
      expect(result.canvas.style.height).toBe('72px')
    })

    it('folds the dpr into the render transform', () => {
      renderer.render([makeKey()], metadata, { maxWidth: 1000, maxHeight: 1000, dpr: 2 })

      // The last setTransform is the content transform (the background pass
      // resets to identity first).
      const calls = mockContext.setTransform.mock.calls
      const contentTransform = calls[calls.length - 1]!
      expect(contentTransform[0]).toBeCloseTo(2, 5) // scale (1) * dpr (2)
      expect(contentTransform[3]).toBeCloseTo(2, 5)
    })
  })

  describe('content translation', () => {
    it('crops leading empty space so the layout fills the box', () => {
      // Keys start at x=5 — the preview should be the same size as if they
      // started at 0, with the content translated back.
      const shifted = [makeKey({ x: 5, y: 2 })]
      const result = renderer.render(shifted, metadata, {
        maxWidth: 1000,
        maxHeight: 1000,
        dpr: 1,
      })

      expect(result.cssWidth).toBe(72)
      expect(result.cssHeight).toBe(72)

      const calls = mockContext.setTransform.mock.calls
      const contentTransform = calls[calls.length - 1]!
      // offsetX = padding - bounds.x = 9 - (5 * 54) = -261
      expect(contentTransform[4]).toBeCloseTo(9 - 5 * 54, 5)
      expect(contentTransform[5]).toBeCloseTo(9 - 2 * 54, 5)
    })

    it('handles negative coordinates', () => {
      const result = renderer.render([makeKey({ x: -2, y: -1 })], metadata, {
        maxWidth: 1000,
        maxHeight: 1000,
        dpr: 1,
      })

      const calls = mockContext.setTransform.mock.calls
      const contentTransform = calls[calls.length - 1]!
      expect(contentTransform[4]).toBeCloseTo(9 + 2 * 54, 5)
      expect(contentTransform[5]).toBeCloseTo(9 + 1 * 54, 5)
      expect(result.cssWidth).toBe(72)
    })
  })

  describe('canvas reuse', () => {
    it('reuses the same canvas element across renders', () => {
      const first = renderer.render([makeKey()], metadata, { maxWidth: 200, maxHeight: 200 })
      const second = renderer.render(gridKeys(3, 2), metadata, { maxWidth: 200, maxHeight: 200 })

      expect(second.canvas).toBe(first.canvas)
    })

    it('drops its canvas on dispose', () => {
      const { canvas } = renderer.render([makeKey()], metadata, { maxWidth: 200, maxHeight: 200 })
      renderer.dispose()
      const next = renderer.render([makeKey()], metadata, { maxWidth: 200, maxHeight: 200 })

      expect(next.canvas).not.toBe(canvas)
    })
  })
})
