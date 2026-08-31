/**
 * Curve Layout — spine geometry
 *
 * A "spine" is a cubic Bézier used as the path that a block of keys is bent around.
 *
 * The important property of this module is that positions along the spine are addressed by
 * **arc distance in layout units**, never by the Bézier parameter `t`. The two are not
 * proportional: `|B'(t)|` varies along a cubic, so stepping `t` uniformly produces
 * non-uniform spacing on the curve. Addressing by arc length is what lets the layout solver
 * preserve key pitch when a block is bent.
 *
 * The spine is also defined **beyond** its endpoints: for arc distances below 0 or above the
 * curve length it extends along the end tangents as a straight ray. This gives keys that do
 * not fit inside the drawn curve a well-defined place to go, instead of piling up on P0/P3.
 *
 * @module curve-layout/spine
 */

import type { Key } from '@adamws/kle-serial'
import { getKeyCenter } from '../keyboard-geometry'

export interface Point {
  x: number
  y: number
}

/** Cubic Bézier control points: [start, control1, control2, end]. */
export type CurveSpine = [Point, Point, Point, Point]

/**
 * A local orthonormal frame on the spine at some arc distance.
 *
 * `tangent` points forward along the spine, `normal` is `tangent` rotated +90°, and
 * `angle` is the tangent direction in degrees (KLE's rotation convention).
 */
export interface SpineFrame {
  origin: Point
  tangent: Point
  normal: Point
  angle: number
}

/**
 * Cumulative arc-length lookup table for a spine.
 *
 * `lengths[i]` is the arc distance from the start of the curve to `t = ts[i]`.
 * Built once per spine shape and reused across the many samples a solver needs.
 */
export interface ArcLengthTable {
  ts: number[]
  lengths: number[]
  /** Total arc length of the curve between t=0 and t=1. */
  total: number
  /** Unit tangent at t=0, used to extend the spine backwards past the start. */
  startTangent: Point
  /** Unit tangent at t=1, used to extend the spine forwards past the end. */
  endTangent: Point
  start: Point
  end: Point
}

const DEFAULT_SAMPLES = 1000
const EPSILON = 1e-12

/** Evaluate the spine at Bézier parameter `t`. */
export function cubicPoint(spine: CurveSpine, t: number): Point {
  const [a, b, c, d] = spine
  const u = 1 - t
  return {
    x: u ** 3 * a.x + 3 * u ** 2 * t * b.x + 3 * u * t ** 2 * c.x + t ** 3 * d.x,
    y: u ** 3 * a.y + 3 * u ** 2 * t * b.y + 3 * u * t ** 2 * c.y + t ** 3 * d.y,
  }
}

/** First derivative of the spine at `t` (not normalized). */
export function cubicDerivative(spine: CurveSpine, t: number): Point {
  const [a, b, c, d] = spine
  const u = 1 - t
  return {
    x: 3 * u ** 2 * (b.x - a.x) + 6 * u * t * (c.x - b.x) + 3 * t ** 2 * (d.x - c.x),
    y: 3 * u ** 2 * (b.y - a.y) + 6 * u * t * (c.y - b.y) + 3 * t ** 2 * (d.y - c.y),
  }
}

/** Second derivative of the spine at `t`. */
export function cubicSecondDerivative(spine: CurveSpine, t: number): Point {
  const [a, b, c, d] = spine
  const u = 1 - t
  return {
    x: 6 * u * (c.x - 2 * b.x + a.x) + 6 * t * (d.x - 2 * c.x + b.x),
    y: 6 * u * (c.y - 2 * b.y + a.y) + 6 * t * (d.y - 2 * c.y + b.y),
  }
}

/**
 * Signed curvature at `t`. Positive means the curve bends towards the +normal side.
 *
 * Reported for diagnostics only — the layout solver does not need a curvature limit, because
 * it transports rigid slices rather than warping a continuum.
 */
export function curvatureAt(spine: CurveSpine, t: number): number {
  const first = cubicDerivative(spine, t)
  const second = cubicSecondDerivative(spine, t)
  const speed = Math.hypot(first.x, first.y)
  if (speed < EPSILON) return 0
  return (first.x * second.y - first.y * second.x) / speed ** 3
}

/**
 * Unit tangent at `t`.
 *
 * `B'(t)` vanishes at a cusp, and also at t=0 when P1 coincides with P0 (a very common state
 * while the user is dragging handles). Fall back to a nearby finite difference, then to the
 * P0→P3 chord, so callers always receive a usable direction.
 */
export function unitTangent(spine: CurveSpine, t: number): Point {
  const derivative = cubicDerivative(spine, t)
  const speed = Math.hypot(derivative.x, derivative.y)
  if (speed > EPSILON) {
    return { x: derivative.x / speed, y: derivative.y / speed }
  }

  const before = cubicPoint(spine, Math.max(0, t - 1e-4))
  const after = cubicPoint(spine, Math.min(1, t + 1e-4))
  const dx = after.x - before.x
  const dy = after.y - before.y
  const length = Math.hypot(dx, dy)
  if (length > EPSILON) {
    return { x: dx / length, y: dy / length }
  }

  const chordX = spine[3].x - spine[0].x
  const chordY = spine[3].y - spine[0].y
  const chord = Math.hypot(chordX, chordY)
  if (chord > EPSILON) {
    return { x: chordX / chord, y: chordY / chord }
  }

  return { x: 1, y: 0 }
}

/**
 * Build the cumulative arc-length table for a spine.
 *
 * Uses chord summation over uniformly sampled `t`. With 1000 samples the length error on the
 * curvatures a keyboard layout produces is far below the 1e-4 tolerance the packer resolves
 * contact positions to.
 *
 * @param spine - Control points
 * @param samples - Number of segments to integrate over
 */
export function buildArcLengthTable(
  spine: CurveSpine,
  samples: number = DEFAULT_SAMPLES,
): ArcLengthTable {
  const count = Math.max(2, Math.floor(samples))
  const ts: number[] = [0]
  const lengths: number[] = [0]

  let previous = cubicPoint(spine, 0)
  let cumulative = 0

  for (let i = 1; i <= count; i++) {
    const t = i / count
    const current = cubicPoint(spine, t)
    cumulative += Math.hypot(current.x - previous.x, current.y - previous.y)
    ts.push(t)
    lengths.push(cumulative)
    previous = current
  }

  return {
    ts,
    lengths,
    total: cumulative,
    startTangent: unitTangent(spine, 0),
    endTangent: unitTangent(spine, 1),
    start: cubicPoint(spine, 0),
    end: cubicPoint(spine, 1),
  }
}

/**
 * Invert the arc-length table: find the Bézier parameter at a given arc distance.
 *
 * Distances outside [0, total] clamp to the endpoints — callers that need the straight
 * extension use {@link pointAtDistance} instead, which handles it explicitly.
 */
export function tAtDistance(table: ArcLengthTable, distance: number): number {
  if (distance <= 0) return 0
  if (distance >= table.total) return 1

  // Binary search for the segment containing `distance`.
  let low = 0
  let high = table.lengths.length - 1
  while (high - low > 1) {
    const mid = (low + high) >> 1
    if (table.lengths[mid]! <= distance) {
      low = mid
    } else {
      high = mid
    }
  }

  const lowLength = table.lengths[low]!
  const highLength = table.lengths[high]!
  const span = highLength - lowLength
  if (span < EPSILON) return table.ts[low]!

  const ratio = (distance - lowLength) / span
  return table.ts[low]! + ratio * (table.ts[high]! - table.ts[low]!)
}

/**
 * Point on the spine at arc distance `distance` from the start.
 *
 * Outside [0, length] the spine continues as a straight ray along the corresponding end
 * tangent, so the mapping is defined for every real distance.
 */
export function pointAtDistance(spine: CurveSpine, table: ArcLengthTable, distance: number): Point {
  if (distance < 0) {
    return {
      x: table.start.x + table.startTangent.x * distance,
      y: table.start.y + table.startTangent.y * distance,
    }
  }
  if (distance > table.total) {
    const overshoot = distance - table.total
    return {
      x: table.end.x + table.endTangent.x * overshoot,
      y: table.end.y + table.endTangent.y * overshoot,
    }
  }
  return cubicPoint(spine, tAtDistance(table, distance))
}

/**
 * Unit tangent at arc distance `distance`.
 *
 * Constant on the straight extensions past either end.
 */
export function tangentAtDistance(
  spine: CurveSpine,
  table: ArcLengthTable,
  distance: number,
): Point {
  if (distance < 0) return table.startTangent
  if (distance > table.total) return table.endTangent
  return unitTangent(spine, tAtDistance(table, distance))
}

/**
 * Local frame on the spine at arc distance `distance`.
 *
 * The normal is the tangent rotated +90° in screen coordinates (y down), matching the sign
 * convention {@link projectOntoFrame} uses for the source block.
 */
export function frameAtDistance(
  spine: CurveSpine,
  table: ArcLengthTable,
  distance: number,
): SpineFrame {
  const origin = pointAtDistance(spine, table, distance)
  const tangent = tangentAtDistance(spine, table, distance)
  return {
    origin,
    tangent,
    normal: { x: -tangent.y, y: tangent.x },
    angle: (Math.atan2(tangent.y, tangent.x) * 180) / Math.PI,
  }
}

/**
 * The reference frame of a block of keys: where the block starts, which way it runs, and how
 * far it extends along that direction.
 */
export interface BlockFrame {
  origin: Point
  /** Unit vector along the block's principal axis. */
  axis: Point
  /** `axis` rotated +90°. */
  normal: Point
  /** Direction of `axis` in degrees. */
  angle: number
  /** Arc distance from `origin` to the far end of the block, along `axis`. */
  length: number
}

/**
 * Derive a block's principal axis from its key centres using a 2×2 PCA.
 *
 * A row of keys yields a horizontal axis, a column yields a vertical one, and a diagonal
 * cluster yields its own diagonal — so the tool behaves the same whatever orientation the
 * selection happens to have. The axis is oriented left-to-right (or top-to-bottom for a
 * vertical block) so that results are deterministic.
 *
 * @param keys - Keys to measure. Rotated keys are handled: `getKeyCenter` accounts for their
 *   rotation origin.
 */
export function computeBlockFrame(keys: Key[]): BlockFrame {
  const centers = keys.map(getKeyCenter)

  if (!centers.length) {
    return {
      origin: { x: 0, y: 0 },
      axis: { x: 1, y: 0 },
      normal: { x: 0, y: 1 },
      angle: 0,
      length: 0,
    }
  }

  const centroid = centers.reduce(
    (accumulator, center) => ({
      x: accumulator.x + center.x / centers.length,
      y: accumulator.y + center.y / centers.length,
    }),
    { x: 0, y: 0 },
  )

  // Covariance matrix [[xx, xy], [xy, yy]] of the centred points.
  let xx = 0
  let xy = 0
  let yy = 0
  for (const center of centers) {
    const dx = center.x - centroid.x
    const dy = center.y - centroid.y
    xx += dx * dx
    xy += dx * dy
    yy += dy * dy
  }

  let axis: Point
  if (Math.abs(xy) < EPSILON) {
    // Already diagonal: the principal axis is whichever cardinal direction has more spread.
    axis = yy > xx ? { x: 0, y: 1 } : { x: 1, y: 0 }
  } else {
    // Larger eigenvalue of a symmetric 2x2 matrix.
    const trace = xx + yy
    const determinantTerm = Math.sqrt((xx - yy) ** 2 + 4 * xy * xy)
    const eigenvalue = (trace + determinantTerm) / 2
    const vx = eigenvalue - yy
    const vy = xy
    const norm = Math.hypot(vx, vy)
    axis = norm < EPSILON ? { x: 1, y: 0 } : { x: vx / norm, y: vy / norm }
  }

  // Deterministic orientation: run left-to-right, or top-to-bottom for a vertical block.
  if (axis.x < -EPSILON || (Math.abs(axis.x) <= EPSILON && axis.y < 0)) {
    axis = { x: -axis.x, y: -axis.y }
  }

  const projections = centers.map((center) => {
    const dx = center.x - centroid.x
    const dy = center.y - centroid.y
    return dx * axis.x + dy * axis.y
  })
  const minProjection = Math.min(...projections)
  const maxProjection = Math.max(...projections)

  return {
    origin: {
      x: centroid.x + axis.x * minProjection,
      y: centroid.y + axis.y * minProjection,
    },
    axis,
    normal: { x: -axis.y, y: axis.x },
    angle: (Math.atan2(axis.y, axis.x) * 180) / Math.PI,
    length: maxProjection - minProjection,
  }
}

/**
 * Project a point into a block frame.
 *
 * @returns `along` — distance from the frame origin in the axis direction; `offset` — signed
 *   distance in the normal direction.
 */
export function projectOntoFrame(
  frame: BlockFrame,
  point: Point,
): { along: number; offset: number } {
  const dx = point.x - frame.origin.x
  const dy = point.y - frame.origin.y
  return {
    along: dx * frame.axis.x + dy * frame.axis.y,
    offset: dx * frame.normal.x + dy * frame.normal.y,
  }
}

/**
 * Build the initial spine for a selection: a straight line along the block's principal axis,
 * with the inner control points at 1/3 and 2/3.
 *
 * A straight spine reproduces the block's own reference frame exactly, so opening the tool is
 * an identity transform — nothing on the canvas moves until a handle is dragged.
 */
export function defaultSpineForKeys(keys: Key[]): CurveSpine {
  const frame = computeBlockFrame(keys)
  // A single key (or a pile of coincident keys) has no extent; give the spine a usable length
  // so its handles are separated and draggable.
  const length = frame.length > EPSILON ? frame.length : 1

  const at = (distance: number): Point => ({
    x: frame.origin.x + frame.axis.x * distance,
    y: frame.origin.y + frame.axis.y * distance,
  })

  return [at(0), at(length / 3), at((2 * length) / 3), at(length)]
}
