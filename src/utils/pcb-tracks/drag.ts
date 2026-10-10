/**
 * Dragging drawn tracks, ported from KiCad's interactive router
 * (pcbnew/router/pns_line.cpp, highlight-collisions mode, 45° only):
 *
 * - a segment drag (`dragSegment45`) keeps the segment's direction and moves
 *   it through the cursor. Each side gets guides for the new neighbour: a
 *   neighbour at a 90° or 135° corner keeps its own line; one at a 45°
 *   corner is rebuilt from its far end at either 45° to the dragged
 *   direction (so dragged past that end it flips by 90°); at a line end a
 *   new track leaves the fixed end at either 45°. Of all guide pairs, with
 *   crossing pieces cut short, the shortest path wins;
 * - a corner drag (`dragCorner45`) puts the corner at the cursor and rebuilds
 *   both halves of the line as 45° walks, from the nearest vertex where the
 *   walk can continue the line without a sharp turn.
 *
 * Both work on a line's point chain (see line.ts); the caller rounds the
 * result to nm and simplifies it, so zero-length and collinear pieces vanish
 * while dragging. Free-angle dragging (KiCad's G) is not ported.
 */
import type { CopperLayer, TrackItem, TrackSegment } from '@/types/tracks'
import type { PadInfo } from './connectivity'
import { pointSegment, segmentIntersection, type Vec } from './distance'
import {
  angle,
  buildInitialTrace,
  dirBetween,
  dirVector,
  isDiagonal,
  left,
  right,
  type Dir,
} from './direction45'
import { endsAt, EPS, isFreePoint } from './line'

const sub = (p: Vec, q: Vec): Vec => ({ x: p.x - q.x, y: p.y - q.y })
const dot = (p: Vec, q: Vec) => p.x * q.x + p.y * q.y
const cross = (p: Vec, q: Vec) => p.x * q.y - p.y * q.x
const len = (p: Vec) => Math.hypot(p.x, p.y)

export type DragHandle =
  /** A whole segment, dragged sideways. */
  | { kind: 'segment'; item: number }
  /** A corner of a line, or a free line end. */
  | { kind: 'corner'; point: Vec; layer: CopperLayer }

interface Guide {
  p: Vec
  d: Dir
}

/** Intersection of the infinite lines through two guides, null when parallel. */
function intersectLines(a: Guide, b: Guide): Vec | null {
  const u = dirVector(a.d)
  const v = dirVector(b.d)
  const denom = cross(u, v)
  if (Math.abs(denom) < 1e-12) return null
  const t = cross(sub(b.p, a.p), v) / denom
  return { x: a.p.x + u.x * t, y: a.p.y + u.y * t }
}

type Seg = [Vec, Vec]

const chainLength = (pts: readonly Vec[]) =>
  pts.reduce((sum, p, i) => (i ? sum + len(sub(p, pts[i - 1]!)) : 0), 0)

/**
 * KiCad's LINE::dragSegment45: segment `index` of the chain moved so its
 * line passes through `target`. Returns the new chain (not simplified).
 */
export function dragSegment45(line: readonly Vec[], index: number, target: Vec): Vec[] {
  const segCount = line.length - 1
  const path = [...line]
  let i = index
  const seg = (k: number): Seg => [path[k]!, path[k + 1]!]

  // a zero-length prev/next at the line's ends, resized by the drag
  if (i === 0) {
    path.splice(0, 0, path[0]!)
    i++
  }
  if (i === path.length - 2) path.splice(path.length - 1, 0, path[path.length - 1]!)

  const dragDir = dirBetween(path[i]!, path[i + 1]!)
  if (dragDir === null) return [...line]
  let dirPrev = dirBetween(path[i - 1]!, path[i]!)
  let dirNext = dirBetween(path[i + 1]!, path[i + 2]!)

  // a collinear neighbour stays: the drag starts a new piece next to it
  if (dirPrev === dragDir) {
    dirPrev = left(dirPrev)
    path.splice(i, 0, path[i]!)
    i++
  } else if (dirPrev === null) {
    dirPrev = left(dragDir)
  }
  if (dirNext === dragDir) {
    dirNext = right(dirNext)
    path.splice(i + 1, 0, path[i + 1]!)
  } else if (dirNext === null) {
    dirNext = right(dragDir)
  }

  const sPrev = seg(i - 1)
  const sNext = seg(i + 1)
  const dragged = seg(i)
  const turns = (a: Dir) => ['obtuse', 'half-full'].includes(angle(a, dragDir))

  const guideA: Guide[] =
    index === 0
      ? [
          { p: dragged[0], d: right(dragDir) },
          { p: dragged[0], d: left(dragDir) },
        ]
      : turns(dirPrev)
        ? [
            { p: sPrev[0], d: left(dragDir) },
            { p: sPrev[0], d: right(dragDir) },
          ]
        : [{ p: dragged[0], d: dirPrev }]
  const guideB: Guide[] =
    index === segCount - 1
      ? [
          { p: dragged[1], d: right(dragDir) },
          { p: dragged[1], d: left(dragDir) },
        ]
      : turns(dirNext)
        ? [
            { p: sNext[1], d: left(dragDir) },
            { p: sNext[1], d: right(dragDir) },
          ]
        : [{ p: dragged[1], d: dirNext }]

  const current: Guide = { p: target, d: dragDir }
  let best: Vec[] | null = null
  let bestLen = Infinity
  for (const ga of guideA) {
    for (const gb of guideB) {
      const ip1 = intersectLines(current, ga)
      const ip2 = intersectLines(current, gb)
      if (!ip1 || !ip2) continue
      const s1: Seg = [sPrev[0], ip1]
      const s3: Seg = [ip2, sNext[1]]
      let ip: Vec | null
      let np: Vec[]
      // pieces that cross cut the path short (the dragged segment may vanish)
      if ((ip = segmentIntersection(s1[0], s1[1], sNext[0], sNext[1]))) np = [s1[0], ip, sNext[1]]
      else if ((ip = segmentIntersection(s3[0], s3[1], sPrev[0], sPrev[1])))
        np = [sPrev[0], ip, s3[1]]
      else if ((ip = segmentIntersection(s1[0], s1[1], s3[0], s3[1]))) np = [sPrev[0], ip, sNext[1]]
      else np = [sPrev[0], ip1, ip2, sNext[1]]
      const l = chainLength(np)
      if (l < bestLen - 1e-9) {
        bestLen = l
        best = np
      }
    }
  }
  if (!best) return [...line]
  // replaces the dragged segment's two points; its neighbours' far ends repeat
  return [...line.slice(0, index), ...best, ...line.slice(index + 2)]
}

/**
 * KiCad's dragCornerInternal: moves the last point of `origin` to `p`,
 * rebuilding the end of the chain as a 45° walk from the nearest vertex
 * whose segment the walk can continue straight or with an obtuse turn.
 */
function dragCornerInternal(origin: readonly Vec[], p: Vec): Vec[] {
  if (origin.length === 1) return buildInitialTrace(origin[0]!, p, false)
  if (origin.length === 2) {
    const d = dirBetween(origin[1]!, origin[0]!)
    return buildInitialTrace(origin[0]!, p, d !== null && isDiagonal(d))
  }
  for (let i = origin.length - 2; i >= 0; i--) {
    const dStart = dirBetween(origin[i]!, origin[i + 1]!)
    const dPrev = i > 0 ? dirBetween(origin[i - 1]!, origin[i]!) : null
    const paths =
      dStart === null
        ? [buildInitialTrace(origin[i]!, p, false), buildInitialTrace(origin[i]!, p, true)]
        : [buildInitialTrace(origin[i]!, p, isDiagonal(dStart))]
    const firstDir = (path: Vec[]) => dirBetween(path[0]!, path[1]!)
    const picked =
      paths.find((path) => firstDir(path) === dStart && dStart !== null) ??
      paths.find((path) => angle(firstDir(path), dPrev) === 'obtuse')
    if (picked) return [...origin.slice(0, i + 1), ...picked.slice(1)]
  }
  const d = dirBetween(origin[origin.length - 2]!, origin[origin.length - 1]!)
  return buildInitialTrace(origin[0]!, p, d !== null && isDiagonal(d))
}

/**
 * KiCad's snapDraggedCorner: the cursor snaps to where the lines of two
 * nearby segments meeting at 45° cross, within `threshold` mm.
 */
export function snapDraggedCorner(
  line: readonly Vec[],
  p: Vec,
  index: number,
  threshold: number,
): Vec {
  const segCount = line.length - 1
  const from = Math.max(index - 2, 0)
  const to = Math.min(index + 2, segCount - 1)
  let best = { d: threshold, p }
  for (let i = from; i <= to; i++) {
    const da = dirBetween(line[i]!, line[i + 1]!)
    for (let j = from; j < i; j++) {
      const db = dirBetween(line[j]!, line[j + 1]!)
      if (da === null || db === null || angle(da, db) !== 'obtuse') continue
      const ip = intersectLines({ p: line[i]!, d: da }, { p: line[j]!, d: db })
      if (!ip) continue
      const d = len(sub(ip, p))
      if (d < best.d) best = { d, p: ip }
    }
  }
  return best.p
}

/** KiCad's LINE::dragCorner45: chain point `index` moved to `p`, both halves rebuilt. */
export function dragCorner45(line: readonly Vec[], index: number, p: Vec): Vec[] {
  const rev = (pts: readonly Vec[]) => [...pts].reverse()
  if (index === 0) return rev(dragCornerInternal(rev(line), p))
  if (index === line.length - 1) return dragCornerInternal(line, p)
  const a = dragCornerInternal(line.slice(0, index + 1), p)
  const b = rev(dragCornerInternal(rev(line.slice(index)), p))
  return [...a, ...b.slice(1)]
}

// Cleanup

export interface CleanupResult {
  items: TrackItem[]
  /** New index of each old item (a merged item maps to the one it joined), null if removed. */
  map: (number | null)[]
}

/**
 * Removes zero-length tracks and merges collinear tracks of one width that
 * meet end to end at a free corner. The merged track keeps the place and
 * direction of the earlier one, so items still walk outward from a pad.
 */
export function cleanupTracks(
  items: readonly TrackItem[],
  pads: readonly PadInfo[],
): CleanupResult {
  let list = items.map((item, i) => ({ item: { ...item } as TrackItem, from: [i] }))
  list = list.filter(({ item }) => item.type !== 'track' || len(sub(item.end, item.start)) > EPS)

  for (let merged = true; merged;) {
    merged = false
    const current = list.map((e) => e.item)
    outer: for (let i = 0; i < list.length; i++) {
      const a = list[i]!.item
      if (a.type !== 'track') continue
      for (const endA of ['start', 'end'] as const) {
        const p = a[endA]
        const ends = endsAt(current, p, a.layer)
        if (ends.length !== 2) continue
        const o = ends.find((e) => e.item !== i)
        if (!o || o.item < i) continue
        const b = list[o.item]!.item as TrackSegment
        if (Math.abs(b.width - a.width) > EPS) continue
        const farA = endA === 'start' ? a.end : a.start
        const farB = o.end === 'start' ? b.end : b.start
        // collinear and on opposite sides of the corner
        if (pointSegment(p, farA, farB).d > 1e-6) continue
        if (!isFreePoint(current, pads, p, a.layer)) continue
        const joined: TrackSegment = endA === 'end' ? { ...a, end: farB } : { ...a, start: farB }
        list[i] = { item: joined, from: [...list[i]!.from, ...list[o.item]!.from] }
        list.splice(o.item, 1)
        merged = true
        break outer
      }
    }
  }

  const map: (number | null)[] = items.map(() => null)
  list.forEach((e, i) => e.from.forEach((old) => (map[old] = i)))
  return { items: list.map((e) => e.item), map }
}

// Snapping

/** Unit normal of a segment (left of start → end). */
export function segmentNormal(a: Vec, b: Vec): Vec {
  const d = sub(b, a)
  const l = len(d)
  return { x: -d.y / l, y: d.x / l }
}

/**
 * Snaps a segment drag offset along the segment's normal: into line with an
 * anchor (a pad centre or track end of its net, within `radius` mm; this
 * covers KiCad's snapToNeighbourSegments, as the segment two away ends at
 * such a track end), else to the grid when the segment runs at a multiple
 * of 45°.
 */
export function snapSegmentOffset(
  a: Vec,
  b: Vec,
  raw: number,
  anchors: readonly Vec[],
  grid: number,
  radius: number,
): number {
  const n = segmentNormal(a, b)
  let best: { d: number; offset: number } | null = null
  for (const q of anchors) {
    const offset = dot(sub(q, a), n)
    const d = Math.abs(offset - raw)
    if (d <= radius && (!best || d < best.d)) best = { d, offset }
  }
  if (best) return best.offset
  // grid lines along the segment: multiples of grid (axis) or grid/√2 (diagonal)
  const axis = Math.abs(n.x) < 1e-9 || Math.abs(n.y) < 1e-9
  const diagonal = Math.abs(Math.abs(n.x) - Math.abs(n.y)) < 1e-9
  if (grid <= 0 || (!axis && !diagonal)) return raw
  const pitch = axis ? grid : grid / Math.SQRT2
  const base = dot(a, n)
  return Math.round((base + raw) / pitch) * pitch - base
}
