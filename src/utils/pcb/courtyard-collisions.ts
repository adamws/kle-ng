/**
 * Courtyard collisions between the parts placed around a switch, the way
 * KiCad's DRC checks them: a front courtyard only collides with front
 * courtyards, a back one with back ones. Outlines that only touch are fine.
 * A hole (plated or not) collides with another part's courtyard on either
 * side, as KiCad's "PTH/NPTH inside courtyard" rules: a through-hole part's
 * leads come out on the other side too.
 *
 * Besides the parts of one key, the diode, LED and capacitor are checked
 * against the parts of the eight neighbouring keys on the 1u grid (19.05 mm,
 * kbplacer's default key distance): a part placed past the key's edge runs
 * into the next key's switch or parts.
 */
import type { Courtyard } from '@/utils/kicad/courtyard'
import type { FootprintPad } from '@/utils/kicad/footprint-pads'
import type { Point } from '@/utils/kicad/transform'
import { cross, pointInPolygon, pointPolygon, pointSegment, sub } from '@/utils/pcb-tracks/distance'

/** Distances below this are treated as touching (mm). */
const EPS = 1e-6
/** How far inside an edge to sample an interior point (mm). */
const NUDGE = 1e-3

/** Distance between neighbouring 1u keys (mm). */
export const KEY_PITCH = 19.05

/** A drill as a circle (a slot by its longer side). */
export interface Hole {
  x: number
  y: number
  r: number
}

export interface CourtyardPart {
  /** 'SW', 'D', 'LED' or 'C', as in the preview's pad owners. */
  owner: string
  /** In the switch-local frame; empty sides when the footprint has none. */
  courtyard: Courtyard
  /** Drills of its pads, switch-local. */
  holes: readonly Hole[]
}

export interface CourtyardCollision {
  /** Courtyards overlap, or a hole of `a` is inside the courtyard of `b`. */
  kind: 'overlap' | 'hole'
  a: string
  b: string
  side: 'front' | 'back'
  /** Which of the two belongs to a neighbouring key, if one does. */
  neighbour: 'a' | 'b' | null
  /** The colliding outlines (courtyards, holes), switch-local, for drawing. */
  outlines: Point[][]
}

const HOLE_STEPS = 24

/** The drills of placed pads (the drill is at the pad position). */
export function holesOf(pads: readonly FootprintPad[]): Hole[] {
  return pads.flatMap((pad) =>
    pad.drill ? [{ x: pad.at.x, y: pad.at.y, r: Math.max(pad.drill.w, pad.drill.h) / 2 }] : [],
  )
}

const sign = (v: number) => (v > EPS ? 1 : v < -EPS ? -1 : 0)

function edges(pts: readonly Point[]): [Point, Point][] {
  return pts.map((p, i) => [p, pts[(i + 1) % pts.length]!])
}

/** Segments ab and cd cross at a point inside both (not just touching). */
function properlyCross(a: Point, b: Point, c: Point, d: Point): boolean {
  const ab = sub(b, a)
  const cd = sub(d, c)
  return (
    sign(cross(ab, sub(c, a))) * sign(cross(ab, sub(d, a))) < 0 &&
    sign(cross(cd, sub(a, c))) * sign(cross(cd, sub(b, c))) < 0
  )
}

function strictlyInside(p: Point, pts: readonly Point[]): boolean {
  if (!pointInPolygon(p, pts)) return false
  return edges(pts).every(([a, b]) => pointSegment(p, a, b).d > EPS)
}

/** Points just either side of each edge's midpoint. */
function nearEdgePoints(pts: readonly Point[]): Point[] {
  return edges(pts).flatMap(([a, b]) => {
    const len = Math.hypot(b.x - a.x, b.y - a.y)
    if (len === 0) return []
    const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
    const n = { x: (-(b.y - a.y) / len) * NUDGE, y: ((b.x - a.x) / len) * NUDGE }
    return [
      { x: m.x + n.x, y: m.y + n.y },
      { x: m.x - n.x, y: m.y - n.y },
    ]
  })
}

/** Two closed outlines share some area. */
export function outlinesOverlap(p: readonly Point[], q: readonly Point[]): boolean {
  for (const [a, b] of edges(p)) {
    for (const [c, d] of edges(q)) if (properlyCross(a, b, c, d)) return true
  }
  if (p.some((v) => strictlyInside(v, q)) || q.some((v) => strictlyInside(v, p))) return true
  // no crossing and no vertex inside: only coincident outlines remain
  return nearEdgePoints(p).some((v) => strictlyInside(v, p) && strictlyInside(v, q))
}

function overlapping(p: readonly Point[][], q: readonly Point[][]): boolean {
  return p.some((a) => q.some((b) => outlinesOverlap(a, b)))
}

/** The hole reaches into the outline (not just touching it). */
function holeInside(h: Hole, pts: readonly Point[]): boolean {
  return pointPolygon(h, pts).d < h.r - EPS
}

function circle(h: Hole): Point[] {
  return Array.from({ length: HOLE_STEPS }, (_, i) => {
    const t = (2 * Math.PI * i) / HOLE_STEPS
    return { x: h.x + h.r * Math.cos(t), y: h.y + h.r * Math.sin(t) }
  })
}

function translate(part: CourtyardPart, o: Point): CourtyardPart {
  const move = (outlines: Point[][]) =>
    outlines.map((pts) => pts.map((p) => ({ x: p.x + o.x, y: p.y + o.y })))
  return {
    owner: part.owner,
    courtyard: { front: move(part.courtyard.front), back: move(part.courtyard.back) },
    holes: part.holes.map((h) => ({ ...h, x: h.x + o.x, y: h.y + o.y })),
  }
}

/**
 * Courtyard collisions among the parts of one key, then between its diode,
 * LED and capacitor and the parts of the keys at `neighbourOffsets`
 * (switch-local), each reported once.
 */
export function findCourtyardCollisions(
  parts: readonly CourtyardPart[],
  neighbourOffsets: readonly Point[] = [],
): CourtyardCollision[] {
  const found: CourtyardCollision[] = []
  const seen = new Set<string>()
  const add = (c: CourtyardCollision) => {
    const key = `${c.kind}|${c.a}|${c.b}|${c.side}|${c.neighbour}`
    if (seen.has(key)) return
    seen.add(key)
    found.push(c)
  }
  // a's holes in b's courtyard, on either side
  const holesIn = (a: CourtyardPart, b: CourtyardPart, neighbour: 'a' | 'b' | null) => {
    for (const side of ['front', 'back'] as const) {
      const holes = a.holes.filter((h) => b.courtyard[side].some((pts) => holeInside(h, pts)))
      if (holes.length) {
        add({
          kind: 'hole',
          a: a.owner,
          b: b.owner,
          side,
          neighbour,
          outlines: [...b.courtyard[side], ...holes.map(circle)],
        })
      }
    }
  }
  // b is the neighbour's part when `neighbour`
  const check = (a: CourtyardPart, b: CourtyardPart, neighbour: boolean) => {
    for (const side of ['front', 'back'] as const) {
      if (!overlapping(a.courtyard[side], b.courtyard[side])) continue
      add({
        kind: 'overlap',
        a: a.owner,
        b: b.owner,
        side,
        neighbour: neighbour ? 'b' : null,
        outlines: [...a.courtyard[side], ...b.courtyard[side]],
      })
    }
    holesIn(a, b, neighbour ? 'b' : null)
    holesIn(b, a, neighbour ? 'a' : null)
  }
  parts.forEach((a, i) => parts.slice(i + 1).forEach((b) => check(a, b, false)))
  // the switches' own spacing isn't a setting, so only the other parts
  for (const a of parts.filter((p) => p.owner !== 'SW')) {
    for (const o of neighbourOffsets) {
      for (const b of parts) check(a, translate(b, o), true)
    }
  }
  return found
}

/** The eight keys around a 1u key, in board axes. */
export const NEIGHBOUR_OFFSETS: readonly Point[] = [-1, 0, 1].flatMap((i) =>
  [-1, 0, 1].filter((j) => i || j).map((j) => ({ x: i * KEY_PITCH, y: j * KEY_PITCH })),
)
