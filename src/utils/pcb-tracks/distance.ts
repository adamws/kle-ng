/**
 * Distances between collision shapes, in plain-number mm (hot path: runs on
 * every pointer move, so no Decimal.js).
 *
 * A shape is a core (point, segment or polygon) inflated by a radius:
 * - circle = point + r, track or oval = segment + r (capsule),
 * - rect = polygon + 0, roundrect = inset polygon + corner radius (exact).
 * The distance between two shapes is the core distance minus both radii.
 *
 * Arc-ready: an `arc` core (start/mid/end, like kipy.ArcTrack) slots into
 * `Core` and `coreDistance` without changing callers.
 */

import { FLOAT_EPS } from './units'

export interface Vec {
  x: number
  y: number
}

export type Core =
  | { kind: 'point'; p: Vec }
  | { kind: 'segment'; a: Vec; b: Vec }
  /** Closed simple polygon (convex or not), vertices in order. */
  | { kind: 'polygon'; pts: Vec[] }

export interface Shape {
  core: Core
  r: number
}

/** Distance with the closest points on each argument (equal when touching). */
export interface Closest {
  d: number
  a: Vec
  b: Vec
}

export const sub = (p: Vec, q: Vec): Vec => ({ x: p.x - q.x, y: p.y - q.y })
export const dot = (p: Vec, q: Vec) => p.x * q.x + p.y * q.y
export const cross = (p: Vec, q: Vec) => p.x * q.y - p.y * q.x
export const dist = (p: Vec, q: Vec) => Math.hypot(p.x - q.x, p.y - q.y)

function flip(c: Closest): Closest {
  return { d: c.d, a: c.b, b: c.a }
}

/** Closest point on segment ab to p. */
export function closestOnSegment(p: Vec, a: Vec, b: Vec): Vec {
  const ab = sub(b, a)
  const len2 = dot(ab, ab)
  if (len2 === 0) return { x: a.x, y: a.y }
  const t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / len2))
  return { x: a.x + ab.x * t, y: a.y + ab.y * t }
}

export function pointSegment(p: Vec, a: Vec, b: Vec): Closest {
  const q = closestOnSegment(p, a, b)
  return { d: dist(p, q), a: p, b: q }
}

/** Intersection point of segments ab and cd, or null (collinear overlaps give an endpoint). */
export function segmentIntersection(a: Vec, b: Vec, c: Vec, d: Vec): Vec | null {
  const r = sub(b, a)
  const s = sub(d, c)
  const denom = cross(r, s)
  const ca = sub(c, a)
  if (denom === 0) {
    if (cross(ca, r) !== 0) return null // parallel
    // collinear: overlapping if an endpoint of one lies on the other
    for (const [p, q0, q1] of [
      [c, a, b],
      [d, a, b],
      [a, c, d],
      [b, c, d],
    ] as const) {
      if (pointSegment(p, q0, q1).d === 0) return { x: p.x, y: p.y }
    }
    return null
  }
  const t = cross(ca, s) / denom
  const u = cross(ca, r) / denom
  if (t < 0 || t > 1 || u < 0 || u > 1) return null
  return { x: a.x + r.x * t, y: a.y + r.y * t }
}

export function segmentSegment(a: Vec, b: Vec, c: Vec, d: Vec): Closest {
  const hit = segmentIntersection(a, b, c, d)
  if (hit) return { d: 0, a: hit, b: hit }
  let best = pointSegment(a, c, d)
  for (const cand of [
    pointSegment(b, c, d),
    flip(pointSegment(c, a, b)),
    flip(pointSegment(d, a, b)),
  ]) {
    if (cand.d < best.d) best = cand
  }
  return best
}

/** Even-odd point in polygon test (boundary counts as inside). */
export function pointInPolygon(p: Vec, pts: readonly Vec[]): boolean {
  let inside = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i]!
    const b = pts[j]!
    if (pointSegment(p, a, b).d === 0) return true
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside
    }
  }
  return inside
}

function edges(pts: readonly Vec[]): [Vec, Vec][] {
  return pts.map((p, i) => [p, pts[(i + 1) % pts.length]!])
}

export function pointPolygon(p: Vec, pts: readonly Vec[]): Closest {
  if (pointInPolygon(p, pts)) return { d: 0, a: p, b: p }
  let best: Closest | null = null
  for (const [a, b] of edges(pts)) {
    const c = pointSegment(p, a, b)
    if (!best || c.d < best.d) best = c
  }
  return best!
}

export function segmentPolygon(a: Vec, b: Vec, pts: readonly Vec[]): Closest {
  if (pointInPolygon(a, pts)) return { d: 0, a, b: a }
  if (pointInPolygon(b, pts)) return { d: 0, a: b, b }
  let best: Closest | null = null
  for (const [c, d] of edges(pts)) {
    const cand = segmentSegment(a, b, c, d)
    if (!best || cand.d < best.d) best = cand
    if (best.d === 0) break
  }
  return best!
}

export function polygonPolygon(p: readonly Vec[], q: readonly Vec[]): Closest {
  if (q.length && pointInPolygon(q[0]!, p)) return { d: 0, a: q[0]!, b: q[0]! }
  if (p.length && pointInPolygon(p[0]!, q)) return { d: 0, a: p[0]!, b: p[0]! }
  let best: Closest | null = null
  for (const [a, b] of edges(p)) {
    const cand = segmentPolygon(a, b, q)
    if (!best || cand.d < best.d) best = cand
    if (best.d === 0) break
  }
  return best!
}

export function coreDistance(s: Core, t: Core): Closest {
  switch (s.kind) {
    case 'point':
      switch (t.kind) {
        case 'point':
          return { d: dist(s.p, t.p), a: s.p, b: t.p }
        case 'segment':
          return pointSegment(s.p, t.a, t.b)
        case 'polygon':
          return pointPolygon(s.p, t.pts)
      }
      break
    case 'segment':
      switch (t.kind) {
        case 'point':
          return flip(pointSegment(t.p, s.a, s.b))
        case 'segment':
          return segmentSegment(s.a, s.b, t.a, t.b)
        case 'polygon':
          return segmentPolygon(s.a, s.b, t.pts)
      }
      break
    case 'polygon':
      switch (t.kind) {
        case 'point':
          return flip(pointPolygon(t.p, s.pts))
        case 'segment':
          return flip(segmentPolygon(t.a, t.b, s.pts))
        case 'polygon':
          return polygonPolygon(s.pts, t.pts)
      }
  }
}

/**
 * Gap between two shapes (0 when they touch or overlap), with the closest
 * points on each shape's outline (both at the overlap when overlapping).
 */
export function shapeGap(s: Shape, t: Shape): Closest {
  const c = coreDistance(s.core, t.core)
  const gap = Math.max(0, c.d - s.r - t.r)
  if (c.d === 0) return { d: 0, a: c.a, b: c.b }
  const towards = (from: Vec, to: Vec, len: number): Vec => ({
    x: from.x + ((to.x - from.x) * len) / c.d,
    y: from.y + ((to.y - from.y) * len) / c.d,
  })
  return {
    d: gap,
    a: towards(c.a, c.b, Math.min(s.r, c.d)),
    b: towards(c.b, c.a, Math.min(t.r, c.d)),
  }
}

/** True when p lies inside the shape (boundary included). */
export function shapeContains(s: Shape, p: Vec): boolean {
  return coreDistance({ kind: 'point', p }, s.core).d <= s.r + FLOAT_EPS
}

/** Axis-aligned bounds, for cheap pre-checks before exact distances. */
export interface Box {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

/** Bounds of a shape, its radius included. */
export function shapeBounds(s: Shape): Box {
  const box = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  const add = (p: Vec) => {
    box.minX = Math.min(box.minX, p.x - s.r)
    box.minY = Math.min(box.minY, p.y - s.r)
    box.maxX = Math.max(box.maxX, p.x + s.r)
    box.maxY = Math.max(box.maxY, p.y + s.r)
  }
  const core = s.core
  if (core.kind === 'point') add(core.p)
  else if (core.kind === 'segment') {
    add(core.a)
    add(core.b)
  } else core.pts.forEach(add)
  return box
}

/** True when two boxes are no more than `gap` apart (so their shapes may be). */
export function boxesNear(a: Box, b: Box, gap: number): boolean {
  return (
    a.minX - gap <= b.maxX &&
    b.minX - gap <= a.maxX &&
    a.minY - gap <= b.maxY &&
    b.minY - gap <= a.maxY
  )
}
