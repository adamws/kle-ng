/**
 * Dragging drawn tracks, like KiCad's interactive router:
 *
 * - a segment moves sideways, keeping its direction; each neighbouring track
 *   that meets it at a free corner stretches or shrinks along its own line, so
 *   corners stay 45°/90°. An end that can't follow (on a pad or via, a
 *   junction of three tracks, or a free end) stays put, joined to the moved
 *   segment by a new 45° track;
 * - a corner (a track end) moves freely, with every track end on it.
 *
 * `cleanupTracks` runs when a drag ends: tracks shrunk to nothing disappear
 * and collinear tracks meeting at a free corner merge, so dragging a segment
 * into line with its neighbour's far end turns three tracks into one.
 *
 * Everything works on the switch-local items in mm; moved points are rounded
 * to whole nm and shared corners use one rounded point, so kbplacer's exact
 * end matching still holds.
 */
import type { CopperLayer, TrackItem, TrackSegment } from '@/types/tracks'
import type { PadInfo } from './connectivity'
import { pointSegment, shapeContains, type Vec } from './distance'

/** Points this close are one point, mm (well under 1 nm). */
const EPS = 1e-7

const sub = (p: Vec, q: Vec): Vec => ({ x: p.x - q.x, y: p.y - q.y })
const add = (p: Vec, q: Vec): Vec => ({ x: p.x + q.x, y: p.y + q.y })
const mul = (p: Vec, k: number): Vec => ({ x: p.x * k, y: p.y * k })
const dot = (p: Vec, q: Vec) => p.x * q.x + p.y * q.y
const cross = (p: Vec, q: Vec) => p.x * q.y - p.y * q.x
const len = (p: Vec) => Math.hypot(p.x, p.y)
const same = (p: Vec, q: Vec) => Math.abs(p.x - q.x) < EPS && Math.abs(p.y - q.y) < EPS
const unit = (p: Vec): Vec => mul(p, 1 / len(p))
/** Whole nanometres, like the wire format. */
export const roundNm = (p: Vec): Vec => ({
  x: Math.round(p.x * 1e6) / 1e6,
  y: Math.round(p.y * 1e6) / 1e6,
})

type End = 'start' | 'end'
const other = (end: End): End => (end === 'start' ? 'end' : 'start')

export interface TrackEnd {
  item: number
  end: End
}

/** Track ends at `p` on `layer`. */
export function endsAt(items: readonly TrackItem[], p: Vec, layer: CopperLayer): TrackEnd[] {
  const out: TrackEnd[] = []
  items.forEach((item, i) => {
    if (item.type !== 'track' || item.layer !== layer) return
    if (same(item.start, p)) out.push({ item: i, end: 'start' })
    if (same(item.end, p)) out.push({ item: i, end: 'end' })
  })
  return out
}

/**
 * True when tracks meeting at `p` may move with it: no pad copper or via
 * there, and no track passing through it (a T junction).
 */
function isFreeCorner(
  items: readonly TrackItem[],
  pads: readonly PadInfo[],
  p: Vec,
  layer: CopperLayer,
): boolean {
  if (pads.some((pad) => pad.layers.includes(layer) && pad.copper.some((s) => shapeContains(s, p))))
    return false
  return items.every((item) => {
    if (item.type === 'via') return !same(item.position, p)
    if (item.type !== 'track' || item.layer !== layer) return true
    if (same(item.start, p) || same(item.end, p)) return true
    return pointSegment(p, item.start, item.end).d > EPS
  })
}

// Handles

export type DragHandle =
  /** A whole segment, dragged sideways. */
  | { kind: 'segment'; item: number }
  /** A corner or track end, dragged freely. */
  | { kind: 'corner'; point: Vec; layer: CopperLayer }

/** Unit normal of a segment (left of start → end). */
export function segmentNormal(t: TrackSegment): Vec {
  const d = unit(sub(t.end, t.start))
  return { x: -d.y, y: d.x }
}

export interface DragResult {
  items: TrackItem[]
  /** Indexes (in `items`) of moved and new tracks. */
  changed: number[]
  /** Index of the dragged segment. */
  item: number
}

/**
 * Moves segment `index` by `offset` mm along its normal. Returns null when a
 * track would turn back on itself (the drag went past where it vanishes).
 */
export function dragSegment(
  items: readonly TrackItem[],
  pads: readonly PadInfo[],
  index: number,
  offset: number,
): DragResult | null {
  const seg = items[index]
  if (!seg || seg.type !== 'track') return null
  const d = unit(sub(seg.end, seg.start))
  const n = { x: -d.y, y: d.x }
  const shift = mul(n, offset)
  const out = items.map((item) => ({ ...item }) as TrackItem)
  const changed = new Set<number>([index])
  // connectors to insert before (start) and after (end) the segment
  let before: TrackSegment | null = null
  let after: TrackSegment | null = null
  const moved: Record<End, Vec> = { start: seg.start, end: seg.end }

  for (const end of ['start', 'end'] as const) {
    const corner = seg[end]
    const lineAt = add(corner, shift)
    const others = endsAt(items, corner, seg.layer).filter((e) => e.item !== index)
    const neighbour = others.length === 1 ? (items[others[0]!.item] as TrackSegment) : null
    const far = neighbour ? neighbour[other(others[0]!.end)] : null
    const dirN = neighbour && far ? sub(corner, far) : null
    const free =
      neighbour &&
      dirN &&
      len(dirN) > EPS &&
      Math.abs(cross(unit(dirN), d)) > 1e-9 &&
      isFreeCorner(items, pads, corner, seg.layer)

    if (offset === 0) continue
    if (free) {
      // the neighbour keeps its line through `far`: meet the moved segment there
      const t = cross(sub(lineAt, far!), d) / cross(dirN!, d)
      const meet = roundNm(add(far!, mul(dirN!, t)))
      // shrunk past zero: the neighbour would turn back
      if (dot(sub(meet, far!), dirN!) < -EPS) return null
      const k = others[0]!.item
      ;(out[k] as TrackSegment)[others[0]!.end] = meet
      changed.add(k)
      moved[end] = meet
    } else {
      // keep the end, join it to the moved segment with a 45° track
      const inward = end === 'start' ? d : mul(d, -1)
      const dir = unit(add(mul(n, Math.sign(offset)), inward))
      const joint = roundNm(add(corner, mul(dir, Math.abs(offset) * Math.SQRT2)))
      const link: TrackSegment = {
        type: 'track',
        start: end === 'start' ? corner : joint,
        end: end === 'start' ? joint : corner,
        width: seg.width,
        layer: seg.layer,
      }
      if (end === 'start') before = link
      else after = link
      moved[end] = joint
    }
  }

  // the segment turned back on itself
  if (dot(sub(moved.end, moved.start), d) < -EPS) return null
  out[index] = { ...seg, start: moved.start, end: moved.end }

  const result = [...out.slice(0, index), ...(before ? [before] : []), out[index]!]
  result.push(...(after ? [after] : []), ...out.slice(index + 1))
  const shiftAt = (i: number) => (before && i >= index ? i + 1 : i) + (after && i > index ? 1 : 0)
  const changedOut = [...changed].map(shiftAt)
  const item = shiftAt(index)
  if (before) changedOut.push(item - 1)
  if (after) changedOut.push(item + 1)
  return { items: result, changed: changedOut.sort((a, b) => a - b), item }
}

/** Moves every track end at `from` (on `layer`) to `to`. */
export function dragCorner(
  items: readonly TrackItem[],
  from: Vec,
  layer: CopperLayer,
  to: Vec,
): DragResult {
  const target = roundNm(to)
  const ends = endsAt(items, from, layer)
  const out = items.map((item) => ({ ...item }) as TrackItem)
  for (const e of ends) (out[e.item] as TrackSegment)[e.end] = target
  return { items: out, changed: ends.map((e) => e.item), item: ends[0]?.item ?? -1 }
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
        const farA = a[other(endA)]
        const farB = b[other(o.end)]
        // collinear and on opposite sides of the corner
        if (pointSegment(p, farA, farB).d > 1e-6) continue
        if (!isFreeCorner(current, pads, p, a.layer)) continue
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

/**
 * Snaps a segment drag offset: to put the segment in line with an anchor
 * (a pad centre or track end of its net, within `radius` mm), else to the
 * grid when the segment runs at a multiple of 45°.
 */
export function snapSegmentOffset(
  seg: TrackSegment,
  raw: number,
  anchors: readonly Vec[],
  grid: number,
  radius: number,
): number {
  const n = segmentNormal(seg)
  let best: { d: number; offset: number } | null = null
  for (const q of anchors) {
    const offset = dot(sub(q, seg.start), n)
    const d = Math.abs(offset - raw)
    if (d <= radius && (!best || d < best.d)) best = { d, offset }
  }
  if (best) return best.offset
  // grid lines along the segment: multiples of grid (axis) or grid/√2 (diagonal)
  const axis = Math.abs(n.x) < 1e-9 || Math.abs(n.y) < 1e-9
  const diagonal = Math.abs(Math.abs(n.x) - Math.abs(n.y)) < 1e-9
  if (grid <= 0 || (!axis && !diagonal)) return raw
  const pitch = axis ? grid : grid / Math.SQRT2
  const base = dot(seg.start, n)
  return Math.round((base + raw) / pitch) * pitch - base
}
