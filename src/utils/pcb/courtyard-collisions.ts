/**
 * Courtyard collisions between the parts placed around a switch, the way
 * KiCad's DRC checks them: a front courtyard only collides with front
 * courtyards, a back one with back ones. Outlines that only touch are fine.
 *
 * Besides the parts of one key, the diode, LED and capacitor are checked
 * against the parts of the eight neighbouring keys on the 1u grid (19.05 mm,
 * kbplacer's default key distance): a part placed past the key's edge runs
 * into the next key's switch or parts.
 */
import type { Courtyard } from '@/utils/kicad/courtyard'
import type { Point } from '@/utils/kicad/transform'
import { cross, pointInPolygon, pointSegment, sub } from '@/utils/pcb-tracks/distance'

/** Distances below this are treated as touching (mm). */
const EPS = 1e-6
/** How far inside an edge to sample an interior point (mm). */
const NUDGE = 1e-3

/** Distance between neighbouring 1u keys (mm). */
export const KEY_PITCH = 19.05

export interface CourtyardPart {
  /** 'SW', 'D', 'LED' or 'C', as in the preview's pad owners. */
  owner: string
  /** In the switch-local frame. */
  courtyard: Courtyard
}

export interface CourtyardCollision {
  a: string
  b: string
  side: 'front' | 'back'
  /** `b` belongs to a neighbouring key. */
  neighbour: boolean
  /** The colliding outlines of both parts, switch-local, for drawing. */
  outlines: Point[][]
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

function translate(c: Courtyard, o: Point): Courtyard {
  const move = (outlines: Point[][]) =>
    outlines.map((pts) => pts.map((p) => ({ x: p.x + o.x, y: p.y + o.y })))
  return { front: move(c.front), back: move(c.back) }
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
  const report = (a: CourtyardPart, b: CourtyardPart, bc: Courtyard, neighbour: boolean) => {
    for (const side of ['front', 'back'] as const) {
      const key = `${a.owner}|${b.owner}|${side}|${neighbour}`
      if (seen.has(key) || !overlapping(a.courtyard[side], bc[side])) continue
      seen.add(key)
      found.push({
        a: a.owner,
        b: b.owner,
        side,
        neighbour,
        outlines: [...a.courtyard[side], ...bc[side]],
      })
    }
  }
  parts.forEach((a, i) => parts.slice(i + 1).forEach((b) => report(a, b, b.courtyard, false)))
  // the switches' own spacing isn't a setting, so only the other parts
  for (const a of parts.filter((p) => p.owner !== 'SW')) {
    for (const o of neighbourOffsets) {
      for (const b of parts) report(a, b, translate(b.courtyard, o), true)
    }
  }
  return found
}

/** The eight keys around a 1u key, in board axes. */
export const NEIGHBOUR_OFFSETS: readonly Point[] = [-1, 0, 1].flatMap((i) =>
  [-1, 0, 1].filter((j) => i || j).map((j) => ({ x: i * KEY_PITCH, y: j * KEY_PITCH })),
)
