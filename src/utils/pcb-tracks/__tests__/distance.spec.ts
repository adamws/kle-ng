import { describe, it, expect } from 'vitest'
import {
  boxesNear,
  coreDistance,
  pointInPolygon,
  segmentIntersection,
  shapeContains,
  shapeBounds,
  shapeGap,
  type Core,
  type Shape,
} from '../distance'

const pt = (x: number, y: number): Core => ({ kind: 'point', p: { x, y } })
const seg = (ax: number, ay: number, bx: number, by: number): Core => ({
  kind: 'segment',
  a: { x: ax, y: ay },
  b: { x: bx, y: by },
})
const square = (cx: number, cy: number, h: number): Core => ({
  kind: 'polygon',
  pts: [
    { x: cx - h, y: cy - h },
    { x: cx + h, y: cy - h },
    { x: cx + h, y: cy + h },
    { x: cx - h, y: cy + h },
  ],
})
// L-shaped (non-convex) polygon
const ell: Core = {
  kind: 'polygon',
  pts: [
    { x: 0, y: 0 },
    { x: 4, y: 0 },
    { x: 4, y: 1 },
    { x: 1, y: 1 },
    { x: 1, y: 4 },
    { x: 0, y: 4 },
  ],
}

describe('coreDistance', () => {
  it.each<[string, Core, Core, number]>([
    ['point-point', pt(0, 0), pt(3, 4), 5],
    ['point-segment (interior)', pt(1, 1), seg(0, 0, 2, 0), 1],
    ['point-segment (end)', pt(-3, 4), seg(0, 0, 2, 0), 5],
    ['segment-segment crossing', seg(-1, 0, 1, 0), seg(0, -1, 0, 1), 0],
    ['segment-segment parallel', seg(0, 0, 2, 0), seg(0, 1, 2, 1), 1],
    ['segment-segment skew', seg(0, 0, 1, 0), seg(2, 1, 2, 3), Math.SQRT2],
    ['segment-segment collinear apart', seg(0, 0, 1, 0), seg(3, 0, 4, 0), 2],
    ['segment-segment collinear overlap', seg(0, 0, 2, 0), seg(1, 0, 4, 0), 0],
    ['point in polygon', pt(0.5, 0.5), square(0, 0, 1), 0],
    ['point outside polygon', pt(3, 0), square(0, 0, 1), 2],
    ['point in non-convex notch', pt(3, 3), ell, 2],
    ['segment through polygon', seg(-5, 0, 5, 0), square(0, 0, 1), 0],
    ['segment inside polygon', seg(-0.5, 0, 0.5, 0), square(0, 0, 1), 0],
    ['segment near polygon', seg(-5, 3, 5, 3), square(0, 0, 1), 2],
    ['polygon-polygon apart', square(0, 0, 1), square(5, 0, 1), 3],
    ['polygon inside polygon', square(0, 0, 0.5), square(0, 0, 2), 0],
    ['polygon-polygon overlap', square(0, 0, 1), square(1.5, 0, 1), 0],
  ])('%s', (_name, a, b, expected) => {
    expect(coreDistance(a, b).d).toBeCloseTo(expected, 9)
    expect(coreDistance(b, a).d).toBeCloseTo(expected, 9)
  })

  it('returns the closest points on each argument', () => {
    const c = coreDistance(pt(1, 1), seg(0, 0, 2, 0))
    expect(c.a).toEqual({ x: 1, y: 1 })
    expect(c.b).toEqual({ x: 1, y: 0 })
    const flipped = coreDistance(seg(0, 0, 2, 0), pt(1, 1))
    expect(flipped.a).toEqual({ x: 1, y: 0 })
  })
})

describe('shapes', () => {
  const track: Shape = { core: seg(0, 0, 10, 0), r: 0.125 }
  const hole: Shape = { core: pt(5, 1), r: 0.5 }

  it('subtracts both radii and puts closest points on the outlines', () => {
    const gap = shapeGap(track, hole)
    expect(gap.d).toBeCloseTo(0.375)
    expect(gap.a.y).toBeCloseTo(0.125)
    expect(gap.b.y).toBeCloseTo(0.5)
  })

  it('is 0 for overlapping shapes', () => {
    expect(shapeGap(track, { core: pt(5, 0.3), r: 0.5 }).d).toBe(0)
  })

  it('tests containment with the radius', () => {
    expect(shapeContains(hole, { x: 5, y: 1.5 })).toBe(true)
    expect(shapeContains(hole, { x: 5, y: 1.51 })).toBe(false)
  })
})

describe('primitives', () => {
  it('finds segment intersections', () => {
    expect(
      segmentIntersection({ x: 0, y: 0 }, { x: 2, y: 2 }, { x: 0, y: 2 }, { x: 2, y: 0 }),
    ).toEqual({
      x: 1,
      y: 1,
    })
    expect(
      segmentIntersection({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }),
    ).toBeNull()
  })

  it('treats the polygon boundary as inside', () => {
    const sq = square(0, 0, 1)
    if (sq.kind !== 'polygon') throw new Error('expected a polygon')
    expect(pointInPolygon({ x: 1, y: 0 }, sq.pts)).toBe(true)
  })
})

describe('bounds', () => {
  it('bounds a shape with its radius', () => {
    const track: Shape = {
      core: { kind: 'segment', a: { x: 0, y: 0 }, b: { x: 10, y: 0 } },
      r: 0.125,
    }
    expect(shapeBounds(track)).toEqual({ minX: -0.125, minY: -0.125, maxX: 10.125, maxY: 0.125 })
  })

  it('tells boxes within a gap of each other', () => {
    const a = { minX: 0, minY: 0, maxX: 1, maxY: 1 }
    expect(boxesNear(a, { minX: 1.2, minY: 0, maxX: 2, maxY: 1 }, 0.2)).toBe(true)
    expect(boxesNear(a, { minX: 1.3, minY: 0, maxX: 2, maxY: 1 }, 0.2)).toBe(false)
    expect(boxesNear(a, { minX: 0, minY: -3, maxX: 1, maxY: -1.5 }, 0.2)).toBe(false)
  })
})
