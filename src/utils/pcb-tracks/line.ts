/**
 * Track lines, like KiCad's router (pcbnew/router/pns_node.cpp AssembleLine,
 * pns_joint.h IsLineCorner): the chain of same-layer tracks joined at
 * corners where exactly two tracks of one width meet and nothing else. Pad
 * copper, vias, junctions of three or more tracks (or a track end on another
 * track), width changes and free ends end a line.
 *
 * Drags work on a line as a point chain and write it back as new tracks.
 */
import type { CopperLayer, TrackItem, TrackSegment } from '@/types/tracks'
import type { PadInfo } from './connectivity'
import { pointSegment, shapeContains, type Vec } from './distance'
import { NM, POINT_EPS, samePoint } from './units'

export type End = 'start' | 'end'

export interface TrackEnd {
  item: number
  end: End
}

/** Track ends at `p` on `layer`. */
export function endsAt(items: readonly TrackItem[], p: Vec, layer: CopperLayer): TrackEnd[] {
  const out: TrackEnd[] = []
  items.forEach((item, i) => {
    if (item.type !== 'track' || item.layer !== layer) return
    if (samePoint(item.start, p)) out.push({ item: i, end: 'start' })
    if (samePoint(item.end, p)) out.push({ item: i, end: 'end' })
  })
  return out
}

/** True when `p` touches no pad copper, via or track passing through it (a T junction). */
export function isFreePoint(
  items: readonly TrackItem[],
  pads: readonly PadInfo[],
  p: Vec,
  layer: CopperLayer,
): boolean {
  if (pads.some((pad) => pad.layers.includes(layer) && pad.copper.some((s) => shapeContains(s, p))))
    return false
  return items.every((item) => {
    if (item.type === 'via') return !samePoint(item.position, p)
    if (item.type !== 'track' || item.layer !== layer) return true
    if (samePoint(item.start, p) || samePoint(item.end, p)) return true
    return pointSegment(p, item.start, item.end).d > POINT_EPS
  })
}

/** Two tracks of one width meet at `p` and nothing else: the line goes on. */
export function isLineCorner(
  items: readonly TrackItem[],
  pads: readonly PadInfo[],
  p: Vec,
  layer: CopperLayer,
): boolean {
  const ends = endsAt(items, p, layer)
  if (ends.length !== 2 || ends[0]!.item === ends[1]!.item) return false
  const [a, b] = ends.map((e) => items[e.item] as TrackSegment)
  return Math.abs(a!.width - b!.width) < POINT_EPS && isFreePoint(items, pads, p, layer)
}

/** A line end a drag may move: one track end, nothing else there. */
export function isFreeEnd(
  items: readonly TrackItem[],
  pads: readonly PadInfo[],
  p: Vec,
  layer: CopperLayer,
): boolean {
  return endsAt(items, p, layer).length === 1 && isFreePoint(items, pads, p, layer)
}

export interface TrackLine {
  /** Chain points; segment k runs from points[k] to points[k + 1]. */
  points: Vec[]
  /** Item index of each segment. */
  items: number[]
  layer: CopperLayer
  width: number
}

/** The line through track `index`, oriented like that track. */
export function assembleLine(
  items: readonly TrackItem[],
  pads: readonly PadInfo[],
  index: number,
): TrackLine {
  const seg = items[index] as TrackSegment
  const points = [seg.start, seg.end]
  const line = [index]
  const seen = new Set(line)

  for (const forward of [true, false]) {
    for (;;) {
      const p = forward ? points[points.length - 1]! : points[0]!
      if (!isLineCorner(items, pads, p, seg.layer)) break
      const next = endsAt(items, p, seg.layer).find((e) => !seen.has(e.item))
      if (!next) break // a closed loop
      const t = items[next.item] as TrackSegment
      const far = next.end === 'start' ? t.end : t.start
      seen.add(next.item)
      if (forward) {
        points.push(far)
        line.push(next.item)
      } else {
        points.unshift(far)
        line.unshift(next.item)
      }
    }
  }
  return { points, items: line, layer: seg.layer, width: seg.width }
}

/**
 * Removes repeated points and points on the straight path between their
 * neighbours (KiCad's SHAPE_LINE_CHAIN::Simplify), so zero-length and
 * collinear segments disappear. Keeps at least the two end points.
 */
export function simplifyChain(points: readonly Vec[], tolerance = NM / 2): Vec[] {
  const out: Vec[] = []
  for (const p of points) if (!out.length || !samePoint(out[out.length - 1]!, p)) out.push(p)
  for (let i = 1; i < out.length - 1;) {
    if (pointSegment(out[i]!, out[i - 1]!, out[i + 1]!).d <= tolerance) out.splice(i, 1)
    else i++
  }
  if (out.length === 1) out.push(out[0]!)
  return out
}

export interface LineReplacement {
  items: TrackItem[]
  /** Indexes of the line's new tracks. */
  changed: number[]
}

/**
 * Replaces the line's tracks with tracks along `points`, placed where the
 * line's first item was and in that item's direction, so items keep
 * walking outward from a pad (kbplacer places them in order).
 */
export function replaceLine(
  items: readonly TrackItem[],
  line: TrackLine,
  points: readonly Vec[],
): LineReplacement {
  return replaceLines(items, [{ line, points }])
}

/**
 * Replaces several lines at once (a via's fanout), each like `replaceLine`,
 * and optionally replaces single items (the dragged via). `changed` lists the
 * new tracks and the replaced items.
 */
export function replaceLines(
  items: readonly TrackItem[],
  lines: readonly { line: TrackLine; points: readonly Vec[] }[],
  replace: ReadonlyMap<number, TrackItem> = new Map(),
): LineReplacement {
  const inserts = new Map<number, TrackSegment[]>()
  const drop = new Set<number>()
  for (const { line, points } of lines) {
    const first = Math.min(...line.items)
    const k = line.items.indexOf(first)
    const sameWay = samePoint((items[first] as TrackSegment).start, line.points[k]!)
    const chain = sameWay ? points : [...points].reverse()
    const tracks: TrackSegment[] = []
    for (let i = 1; i < chain.length; i++) {
      tracks.push({
        type: 'track',
        start: chain[i - 1]!,
        end: chain[i]!,
        width: line.width,
        layer: line.layer,
      })
    }
    inserts.set(first, tracks)
    line.items.forEach((i) => drop.add(i))
  }
  const out: TrackItem[] = []
  const changed: number[] = []
  items.forEach((item, i) => {
    for (const t of inserts.get(i) ?? []) {
      changed.push(out.length)
      out.push(t)
    }
    if (drop.has(i)) return
    const next = replace.get(i)
    if (next) changed.push(out.length)
    out.push(next ?? item)
  })
  return { items: out, changed }
}
