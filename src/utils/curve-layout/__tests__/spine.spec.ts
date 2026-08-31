import { describe, expect, it } from 'vitest'
import { Key } from '@adamws/kle-serial'
import {
  buildArcLengthTable,
  computeBlockFrame,
  curvatureAt,
  defaultSpineForKeys,
  frameAtDistance,
  pointAtDistance,
  projectOntoFrame,
  tangentAtDistance,
  type CurveSpine,
} from '../spine'

const makeKey = (values: Partial<Key>): Key => Object.assign(new Key(), values)

const row = (count: number): Key[] =>
  Array.from({ length: count }, (_, index) => makeKey({ x: index, y: 0 }))

const straight: CurveSpine = [
  { x: 0, y: 0 },
  { x: 3, y: 0 },
  { x: 6, y: 0 },
  { x: 9, y: 0 },
]

const arc: CurveSpine = [
  { x: 0, y: 0 },
  { x: 3, y: -4 },
  { x: 6, y: -4 },
  { x: 9, y: 0 },
]

describe('arc-length parameterization', () => {
  it('measures a straight spine exactly', () => {
    const table = buildArcLengthTable(straight)
    expect(table.total).toBeCloseTo(9, 9)
  })

  it('maps arc distance to evenly spaced points on a curved spine', () => {
    const table = buildArcLengthTable(arc)
    const step = table.total / 20
    const points = Array.from({ length: 21 }, (_, i) => pointAtDistance(arc, table, i * step))

    const distances = points
      .slice(1)
      .map((point, i) => Math.hypot(point.x - points[i]!.x, point.y - points[i]!.y))

    // This is the property the fork's model lacked: stepping uniformly must produce uniform
    // spacing. Measured as relative spread, since chord length sits marginally under arc length
    // on a curved segment and that bias grows with curvature.
    const spread = Math.max(...distances) / Math.min(...distances)
    expect(spread).toBeLessThan(1.005)
  })

  it('walking t uniformly would NOT give uniform spacing (regression guard)', () => {
    // Documents why arc length is required at all: the naive approach varies by >20% here.
    const points = Array.from({ length: 21 }, (_, i) => {
      const t = i / 20
      const u = 1 - t
      return {
        x:
          u ** 3 * arc[0].x +
          3 * u ** 2 * t * arc[1].x +
          3 * u * t ** 2 * arc[2].x +
          t ** 3 * arc[3].x,
        y:
          u ** 3 * arc[0].y +
          3 * u ** 2 * t * arc[1].y +
          3 * u * t ** 2 * arc[2].y +
          t ** 3 * arc[3].y,
      }
    })
    const distances = points
      .slice(1)
      .map((point, i) => Math.hypot(point.x - points[i]!.x, point.y - points[i]!.y))
    const spread = Math.max(...distances) / Math.min(...distances)
    expect(spread).toBeGreaterThan(1.2)
  })
})

describe('spine extension past the endpoints', () => {
  it('extends backwards along the start tangent', () => {
    const table = buildArcLengthTable(arc)
    const point = pointAtDistance(arc, table, -2)
    const tangent = table.startTangent
    expect(point.x).toBeCloseTo(table.start.x - tangent.x * 2, 9)
    expect(point.y).toBeCloseTo(table.start.y - tangent.y * 2, 9)
  })

  it('extends forwards along the end tangent', () => {
    const table = buildArcLengthTable(arc)
    const point = pointAtDistance(arc, table, table.total + 3)
    expect(point.x).toBeCloseTo(table.end.x + table.endTangent.x * 3, 9)
    expect(point.y).toBeCloseTo(table.end.y + table.endTangent.y * 3, 9)
  })

  it('keeps the tangent constant on the extensions', () => {
    const table = buildArcLengthTable(arc)
    const before = tangentAtDistance(arc, table, -5)
    const alsoBefore = tangentAtDistance(arc, table, -1)
    expect(before).toEqual(alsoBefore)

    const after = tangentAtDistance(arc, table, table.total + 1)
    const alsoAfter = tangentAtDistance(arc, table, table.total + 9)
    expect(after).toEqual(alsoAfter)
  })

  it('is continuous in position and direction across both endpoints', () => {
    const table = buildArcLengthTable(arc)
    const step = 0.01

    // Position: the curve and its extension meet exactly at the endpoints.
    expect(pointAtDistance(arc, table, 0)).toEqual(table.start)
    expect(pointAtDistance(arc, table, table.total)).toEqual(table.end)

    // Direction: stepping inwards from an endpoint moves along the same tangent the extension
    // uses when stepping outwards, so there is no kink where the two meet. Compared as a
    // direction rather than a magnitude, since the arc-length table resolves length to about
    // 0.1% and that bias would otherwise dominate the check.
    const alignment = (
      from: { x: number; y: number },
      to: { x: number; y: number },
      tangent: {
        x: number
        y: number
      },
    ) => {
      const dx = to.x - from.x
      const dy = to.y - from.y
      const length = Math.hypot(dx, dy)
      return (dx / length) * tangent.x + (dy / length) * tangent.y
    }

    expect(
      alignment(table.start, pointAtDistance(arc, table, step), table.startTangent),
    ).toBeGreaterThan(0.9999)
    expect(
      alignment(pointAtDistance(arc, table, table.total - step), table.end, table.endTangent),
    ).toBeGreaterThan(0.9999)
  })
})

describe('unit tangent robustness', () => {
  it('returns a usable direction when the first control point is coincident with the start', () => {
    // B'(0) is exactly zero here, which happens constantly while dragging handles.
    const degenerate: CurveSpine = [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 6, y: 0 },
    ]
    const table = buildArcLengthTable(degenerate)
    const tangent = tangentAtDistance(degenerate, table, 0)
    expect(Math.hypot(tangent.x, tangent.y)).toBeCloseTo(1, 6)
  })

  it('falls back to a unit vector for a fully collapsed spine', () => {
    const collapsed: CurveSpine = [
      { x: 2, y: 2 },
      { x: 2, y: 2 },
      { x: 2, y: 2 },
      { x: 2, y: 2 },
    ]
    const table = buildArcLengthTable(collapsed)
    const tangent = tangentAtDistance(collapsed, table, 0)
    expect(Math.hypot(tangent.x, tangent.y)).toBeCloseTo(1, 6)
  })
})

describe('curvature', () => {
  it('is zero on a straight spine', () => {
    expect(curvatureAt(straight, 0.5)).toBeCloseTo(0, 9)
  })

  it('is non-zero and peaks in the middle of a symmetric arc', () => {
    expect(Math.abs(curvatureAt(arc, 0.5))).toBeGreaterThan(Math.abs(curvatureAt(arc, 0.1)))
  })
})

describe('block frame orientation', () => {
  it('finds a horizontal axis for a row', () => {
    const frame = computeBlockFrame(row(6))
    expect(frame.axis.x).toBeCloseTo(1, 6)
    expect(frame.axis.y).toBeCloseTo(0, 6)
    expect(frame.length).toBeCloseTo(5, 6)
  })

  it('finds a vertical axis for a column', () => {
    const column = Array.from({ length: 5 }, (_, i) => makeKey({ x: 0, y: i }))
    const frame = computeBlockFrame(column)
    expect(Math.abs(frame.axis.x)).toBeCloseTo(0, 6)
    expect(Math.abs(frame.axis.y)).toBeCloseTo(1, 6)
    expect(frame.length).toBeCloseTo(4, 6)
  })

  it('finds a diagonal axis for a diagonal cluster', () => {
    const diagonal = Array.from({ length: 5 }, (_, i) => makeKey({ x: i, y: i }))
    const frame = computeBlockFrame(diagonal)
    expect(frame.angle).toBeCloseTo(45, 4)
  })

  it('handles a single key without producing a degenerate spine', () => {
    const spine = defaultSpineForKeys([makeKey({ x: 0, y: 0 })])
    const table = buildArcLengthTable(spine)
    expect(table.total).toBeGreaterThan(0)
  })

  it('round-trips a key centre through project/reconstruct', () => {
    const keys = [makeKey({ x: 2, y: 1 }), makeKey({ x: 5, y: 3 }), makeKey({ x: 8, y: 0 })]
    const frame = computeBlockFrame(keys)
    for (const key of keys) {
      const center = { x: key.x + 0.5, y: key.y + 0.5 }
      const { along, offset } = projectOntoFrame(frame, center)
      const reconstructed = {
        x: frame.origin.x + frame.axis.x * along + frame.normal.x * offset,
        y: frame.origin.y + frame.axis.y * along + frame.normal.y * offset,
      }
      expect(reconstructed.x).toBeCloseTo(center.x, 9)
      expect(reconstructed.y).toBeCloseTo(center.y, 9)
    }
  })
})

describe('default spine', () => {
  it('is a straight line that reproduces the block frame exactly', () => {
    const keys = row(6)
    const frame = computeBlockFrame(keys)
    const spine = defaultSpineForKeys(keys)
    const table = buildArcLengthTable(spine)

    expect(curvatureAt(spine, 0.5)).toBeCloseTo(0, 9)
    expect(table.total).toBeCloseTo(frame.length, 6)

    // Sampling the spine by arc distance must land exactly on the block's own axis.
    for (const distance of [0, 1, 2.5, frame.length]) {
      const point = pointAtDistance(spine, table, distance)
      expect(point.x).toBeCloseTo(frame.origin.x + frame.axis.x * distance, 6)
      expect(point.y).toBeCloseTo(frame.origin.y + frame.axis.y * distance, 6)
    }
  })

  it('produces a frame whose angle matches the block axis', () => {
    const keys = row(4)
    const spine = defaultSpineForKeys(keys)
    const table = buildArcLengthTable(spine)
    const frame = computeBlockFrame(keys)
    expect(frameAtDistance(spine, table, 1).angle).toBeCloseTo(frame.angle, 6)
  })
})
