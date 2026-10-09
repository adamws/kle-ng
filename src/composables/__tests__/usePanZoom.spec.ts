import { describe, it, expect } from 'vitest'
import {
  MAX_VIEW_WIDTH,
  MIN_VIEW_WIDTH,
  clientToSvg,
  panViewBox,
  wheelZoomFactor,
  zoomViewBoxAt,
} from '../usePanZoom'

const vb = { x: -10, y: -5, width: 40, height: 20 }

describe('zoomViewBoxAt', () => {
  it('keeps the zoom point fixed and scales the size', () => {
    const at = { x: 6, y: 1 }
    const zoomed = zoomViewBoxAt(vb, at, 2)
    expect(zoomed.width).toBe(20)
    expect(zoomed.height).toBe(10)
    // `at` keeps its relative position in the view
    expect((at.x - zoomed.x) / zoomed.width).toBeCloseTo((at.x - vb.x) / vb.width)
    expect((at.y - zoomed.y) / zoomed.height).toBeCloseTo((at.y - vb.y) / vb.height)
  })

  it('is undone by the inverse factor', () => {
    const at = { x: 3, y: -2 }
    const back = zoomViewBoxAt(zoomViewBoxAt(vb, at, 1.7), at, 1 / 1.7)
    expect(back.x).toBeCloseTo(vb.x)
    expect(back.y).toBeCloseTo(vb.y)
    expect(back.width).toBeCloseTo(vb.width)
    expect(back.height).toBeCloseTo(vb.height)
  })

  it('clamps to the zoom limits, keeping the aspect ratio', () => {
    const tight = zoomViewBoxAt(vb, { x: 0, y: 0 }, 1000)
    expect(tight.width).toBe(MIN_VIEW_WIDTH)
    expect(tight.height).toBeCloseTo(MIN_VIEW_WIDTH / 2)
    expect(zoomViewBoxAt(vb, { x: 0, y: 0 }, 1e-4).width).toBe(MAX_VIEW_WIDTH)
  })
})

describe('panViewBox', () => {
  it('moves the view opposite to the content', () => {
    expect(panViewBox(vb, { x: 2, y: -3 })).toEqual({ x: -12, y: -2, width: 40, height: 20 })
  })
})

describe('wheelZoomFactor', () => {
  it('zooms in on wheel up and out on wheel down, symmetrically', () => {
    expect(wheelZoomFactor(-100, 0)).toBeCloseTo(1.2)
    expect(wheelZoomFactor(100, 0)).toBeCloseTo(1 / 1.2)
    expect(wheelZoomFactor(-3, 1)).toBeCloseTo(wheelZoomFactor(-99, 0))
  })
})

describe('clientToSvg', () => {
  it('inverts the screen CTM', () => {
    // 4 px per unit, view origin at screen (100, 50)
    const ctm = { a: 4, b: 0, c: 0, d: 4, e: 100, f: 50 }
    expect(clientToSvg(ctm, 108, 42)).toEqual({ x: 2, y: -2 })
  })

  it('handles a rotated CTM', () => {
    // rotated 90° clockwise on screen: svg (1, 0) -> screen (0, 1)
    const ctm = { a: 0, b: 1, c: -1, d: 0, e: 0, f: 0 }
    const p = clientToSvg(ctm, 0, 1)
    expect(p.x).toBeCloseTo(1)
    expect(p.y).toBeCloseTo(0)
  })
})
