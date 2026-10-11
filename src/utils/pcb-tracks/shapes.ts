/**
 * Collision shapes of pads, tracks and vias in the switch-local frame.
 *
 * Pad copper follows KiCad: roundrect = rect inset by the corner radius plus
 * that radius (exact), oval = capsule, chamfers ignored and trapezoids as
 * their rect (both conservative). Drills (plated or not) are separate hole
 * shapes, which block every layer.
 *
 * As in KiCad, the drill is at the pad position and its `offset` moves the
 * copper (PAD::ShapePos), not the hole.
 */
import type { FootprintPad } from '@/utils/kicad/footprint-pads'
import { rotateKicad } from '@/utils/kicad/transform'
import type { TrackSegment, TrackVia } from '@/types/tracks'
import type { Shape, Vec } from './distance'

/** Pad-frame point to switch-local (KiCad rotation is counter-clockwise on screen). */
function padToLocal(pad: FootprintPad, p: Vec): Vec {
  const r = rotateKicad(p, pad.at.rot)
  return { x: pad.at.x + r.x, y: pad.at.y + r.y }
}

function rectShape(
  pad: FootprintPad,
  cx: number,
  cy: number,
  w: number,
  h: number,
  r: number,
): Shape {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2))
  const hw = w / 2 - rr
  const hh = h / 2 - rr
  if (hw === 0 && hh === 0)
    return { core: { kind: 'point', p: padToLocal(pad, { x: cx, y: cy }) }, r: rr }
  if (hw === 0 || hh === 0) {
    const a = hw === 0 ? { x: cx, y: cy - hh } : { x: cx - hw, y: cy }
    const b = hw === 0 ? { x: cx, y: cy + hh } : { x: cx + hw, y: cy }
    return { core: { kind: 'segment', a: padToLocal(pad, a), b: padToLocal(pad, b) }, r: rr }
  }
  const pts = [
    { x: cx - hw, y: cy - hh },
    { x: cx + hw, y: cy - hh },
    { x: cx + hw, y: cy + hh },
    { x: cx - hw, y: cy + hh },
  ].map((p) => padToLocal(pad, p))
  return { core: { kind: 'polygon', pts }, r: rr }
}

/** Copper shapes of a placed pad (empty for NPTH, which has no copper). */
export function padCopperShapes(pad: FootprintPad): Shape[] {
  if (pad.type === 'np_thru_hole') return []
  const { w, h } = pad.size
  // the copper's centre in the pad frame
  const o = pad.drill?.offset ?? { x: 0, y: 0 }
  const at = (p: Vec) => padToLocal(pad, { x: o.x + p.x, y: o.y + p.y })
  switch (pad.shape) {
    case 'circle':
      return [{ core: { kind: 'point', p: at({ x: 0, y: 0 }) }, r: w / 2 }]
    case 'oval':
      return [rectShape(pad, o.x, o.y, w, h, Math.min(w, h) / 2)]
    case 'roundrect':
      return [rectShape(pad, o.x, o.y, w, h, (pad.rratio ?? 0.25) * Math.min(w, h))]
    case 'rect':
    case 'trapezoid':
      return [rectShape(pad, o.x, o.y, w, h, 0)]
    case 'custom': {
      const anchor =
        pad.anchor === 'circle'
          ? { core: { kind: 'point' as const, p: at({ x: 0, y: 0 }) }, r: w / 2 }
          : rectShape(pad, o.x, o.y, w, h, 0)
      const primitives = (pad.primitives ?? []).map((p): Shape =>
        p.type === 'poly'
          ? { core: { kind: 'polygon', pts: p.points.map(at) }, r: p.width / 2 }
          : { core: { kind: 'point', p: at(p.center) }, r: p.radius + p.width / 2 },
      )
      return [anchor, ...primitives]
    }
  }
}

/** Hole shape of a placed pad's drill, or null for SMD pads. */
export function padHoleShape(pad: FootprintPad): Shape | null {
  const drill = pad.drill
  if (!drill) return null
  const { w, h } = drill
  return w === h
    ? { core: { kind: 'point', p: padToLocal(pad, { x: 0, y: 0 }) }, r: w / 2 }
    : rectShape(pad, 0, 0, w, h, Math.min(w, h) / 2)
}

export function trackShape(track: TrackSegment): Shape {
  return { core: { kind: 'segment', a: track.start, b: track.end }, r: track.width / 2 }
}

export function viaShape(via: TrackVia): Shape {
  return { core: { kind: 'point', p: via.position }, r: via.diameter / 2 }
}

export function viaHoleShape(via: TrackVia): Shape {
  return { core: { kind: 'point', p: via.position }, r: via.drillDiameter / 2 }
}
