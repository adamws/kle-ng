/**
 * Courtyards of KiCad footprints (F.CrtYd and B.CrtYd): the area a part needs
 * on each side of the board, which KiCad's DRC keeps clear of other parts'
 * courtyards on the same side.
 *
 * `parseCourtyard` turns a footprint's courtyard graphics (lines, arcs, rects,
 * circles, polygons; KiCad 5 and 6+ syntax) into closed outlines, chaining
 * lines and arcs end to end. scripts/generate-footprint-pads.mjs stores them
 * with the pads. `placeCourtyard` puts them into the switch-local frame like
 * `placePads`: a BACK footprint is mirrored and its sides swap.
 *
 * Imported by a Node script, so it uses `.ts` import paths and only erasable
 * TypeScript syntax.
 */

import { atom, child, head, num } from './sexpr.ts'
import type { SExpr } from './sexpr.ts'
import { placePoint, type Placement, type Point } from './transform.ts'

/** Closed outlines (last point not repeated), mm in the footprint's frame. */
export interface Courtyard {
  front: Point[][]
  back: Point[][]
}

/** Endpoints closer than this join (mm); KiCad files round to 1 nm or 1 µm. */
const JOIN_EPS = 1e-3
const ARC_STEPS = 16
const CIRCLE_STEPS = 32

function point(node: SExpr[] | undefined): Point {
  return { x: num(node, 1), y: num(node, 2) }
}

const near = (p: Point, q: Point) => Math.hypot(p.x - q.x, p.y - q.y) <= JOIN_EPS

/** Points along the arc from start through mid to end (inclusive). */
function arcPoints(start: Point, mid: Point, end: Point): Point[] {
  const { x: ax, y: ay } = start
  const { x: bx, y: by } = mid
  const { x: cx, y: cy } = end
  const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by))
  if (Math.abs(d) < 1e-12) return [start, end]
  const a2 = ax * ax + ay * ay
  const b2 = bx * bx + by * by
  const c2 = cx * cx + cy * cy
  const ux = (a2 * (by - cy) + b2 * (cy - ay) + c2 * (ay - by)) / d
  const uy = (a2 * (cx - bx) + b2 * (ax - cx) + c2 * (bx - ax)) / d
  const r = Math.hypot(ax - ux, ay - uy)
  const norm = (v: number) => ((v % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)
  const angle = (p: Point) => Math.atan2(p.y - uy, p.x - ux)
  const a0 = angle(start)
  let sweep = norm(angle(end) - a0)
  if (norm(angle(mid) - a0) > sweep) sweep -= 2 * Math.PI
  const out: Point[] = []
  for (let i = 0; i <= ARC_STEPS; i++) {
    const t = a0 + (sweep * i) / ARC_STEPS
    out.push({ x: ux + r * Math.cos(t), y: uy + r * Math.sin(t) })
  }
  // exact ends, so they chain with the neighbouring lines
  out[0] = start
  out[ARC_STEPS] = end
  return out
}

/** An arc node: KiCad 6+ (start, mid, end) or KiCad 5 (start = centre, end = arc start, angle). */
function arcNodePoints(node: SExpr[]): Point[] {
  const mid = child(node, 'mid')
  if (mid) return arcPoints(point(child(node, 'start')), point(mid), point(child(node, 'end')))
  const c = point(child(node, 'start'))
  const s = point(child(node, 'end'))
  // degrees, clockwise on screen (+Y down)
  const sweep = (num(child(node, 'angle'), 1) * Math.PI) / 180
  const r = Math.hypot(s.x - c.x, s.y - c.y)
  const a0 = Math.atan2(s.y - c.y, s.x - c.x)
  const at = (t: number) => ({ x: c.x + r * Math.cos(t), y: c.y + r * Math.sin(t) })
  return arcPoints(s, at(a0 + sweep / 2), at(a0 + sweep))
}

/** A graphic item as an open path (line, arc) or a closed outline (rect, circle, poly). */
function itemPath(node: SExpr[]): { pts: Point[]; closed: boolean } | null {
  switch (head(node)) {
    case 'fp_line':
      return { pts: [point(child(node, 'start')), point(child(node, 'end'))], closed: false }
    case 'fp_arc':
      return { pts: arcNodePoints(node), closed: false }
    case 'fp_rect': {
      const a = point(child(node, 'start'))
      const b = point(child(node, 'end'))
      return {
        pts: [a, { x: b.x, y: a.y }, b, { x: a.x, y: b.y }],
        closed: true,
      }
    }
    case 'fp_circle': {
      const c = point(child(node, 'center'))
      const e = point(child(node, 'end'))
      const r = Math.hypot(e.x - c.x, e.y - c.y)
      const pts = Array.from({ length: CIRCLE_STEPS }, (_, i) => {
        const t = (2 * Math.PI * i) / CIRCLE_STEPS
        return { x: c.x + r * Math.cos(t), y: c.y + r * Math.sin(t) }
      })
      return { pts, closed: true }
    }
    case 'fp_poly': {
      const pts: Point[] = []
      for (const item of child(node, 'pts')?.slice(1) ?? []) {
        if (!Array.isArray(item)) continue
        if (head(item) === 'xy') pts.push(point(item))
        else if (head(item) === 'arc') pts.push(...arcNodePoints(item))
      }
      return pts.length >= 3 ? { pts, closed: true } : null
    }
    default:
      return null
  }
}

/** Drops a repeated closing point. */
function open(pts: Point[]): Point[] {
  return pts.length > 1 && near(pts[0]!, pts[pts.length - 1]!) ? pts.slice(0, -1) : pts
}

/**
 * Chains open paths end to end into outlines. A chain that never closes is
 * closed with a straight edge, so a gap in a drawing still bounds an area.
 */
function chain(paths: Point[][]): Point[][] {
  const left = paths.map((p) => [...p])
  const outlines: Point[][] = []
  while (left.length) {
    const loop = left.shift()!
    for (;;) {
      const tail = loop[loop.length - 1]!
      if (loop.length > 2 && near(tail, loop[0]!)) break
      const i = left.findIndex((p) => near(p[0]!, tail) || near(p[p.length - 1]!, tail))
      if (i < 0) break
      const next = left.splice(i, 1)[0]!
      const forward = near(next[0]!, tail) ? next : next.reverse()
      loop.push(...forward.slice(1))
    }
    const outline = open(loop)
    if (outline.length >= 3) outlines.push(outline)
  }
  return outlines
}

/** The courtyard outlines of a parsed .kicad_mod footprint, or null when it has none. */
export function parseCourtyard(root: SExpr[]): Courtyard | null {
  const paths: Record<'front' | 'back', { open: Point[][]; closed: Point[][] }> = {
    front: { open: [], closed: [] },
    back: { open: [], closed: [] },
  }
  for (const item of root) {
    if (!Array.isArray(item)) continue
    const layer = atom(child(item, 'layer'), 1)
    const side = layer === 'F.CrtYd' ? 'front' : layer === 'B.CrtYd' ? 'back' : null
    if (!side) continue
    const path = itemPath(item)
    if (path) paths[side][path.closed ? 'closed' : 'open'].push(path.pts)
  }
  const outlines = (side: 'front' | 'back') => [
    ...paths[side].closed.map(open),
    ...chain(paths[side].open),
  ]
  const courtyard = { front: outlines('front'), back: outlines('back') }
  return courtyard.front.length || courtyard.back.length ? courtyard : null
}

/** A footprint's courtyard in the switch-local frame (see `placePads`). */
export function placeCourtyard(courtyard: Courtyard, placement: Placement): Courtyard {
  const place = (outlines: Point[][]) => outlines.map((o) => o.map((p) => placePoint(p, placement)))
  return placement.side === 'BACK'
    ? { front: place(courtyard.back), back: place(courtyard.front) }
    : { front: place(courtyard.front), back: place(courtyard.back) }
}
