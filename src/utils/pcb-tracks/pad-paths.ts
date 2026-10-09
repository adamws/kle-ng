/**
 * SVG outlines of footprint pads, in the pad's own frame (centred on the pad
 * position, unrotated, +Y down). The caller places them with
 * `translate(at) rotate(-at.rot)` (KiCad rotations are counter-clockwise).
 */
import type { FootprintPad, PadDrill } from '@/utils/kicad/footprint-pads'

export interface PadPath {
  d: string
  /** Outline stroke of a custom pad primitive (mm), 0 for a filled shape only. */
  strokeWidth: number
}

const fmt = (v: number) => Number(v.toFixed(6))

/** Closed path of a rectangle centred on (cx, cy) with corner radius r. */
export function roundedRectPath(cx: number, cy: number, w: number, h: number, r: number): string {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2))
  const x0 = cx - w / 2
  const y0 = cy - h / 2
  const x1 = cx + w / 2
  const y1 = cy + h / 2
  if (rr === 0) {
    return `M${fmt(x0)} ${fmt(y0)}H${fmt(x1)}V${fmt(y1)}H${fmt(x0)}Z`
  }
  const arc = (x: number, y: number) => `A${fmt(rr)} ${fmt(rr)} 0 0 1 ${fmt(x)} ${fmt(y)}`
  return (
    `M${fmt(x0 + rr)} ${fmt(y0)}H${fmt(x1 - rr)}${arc(x1, y0 + rr)}` +
    `V${fmt(y1 - rr)}${arc(x1 - rr, y1)}H${fmt(x0 + rr)}${arc(x0, y1 - rr)}` +
    `V${fmt(y0 + rr)}${arc(x0 + rr, y0)}Z`
  )
}

/** Closed path of a circle. */
export function circlePath(cx: number, cy: number, r: number): string {
  return (
    `M${fmt(cx - r)} ${fmt(cy)}A${fmt(r)} ${fmt(r)} 0 1 0 ${fmt(cx + r)} ${fmt(cy)}` +
    `A${fmt(r)} ${fmt(r)} 0 1 0 ${fmt(cx - r)} ${fmt(cy)}Z`
  )
}

/** Copper outline of a pad (one path per custom pad primitive). */
export function padCopperPaths(pad: FootprintPad): PadPath[] {
  const { w, h } = pad.size
  switch (pad.shape) {
    case 'circle':
      return [{ d: circlePath(0, 0, w / 2), strokeWidth: 0 }]
    case 'oval':
      return [{ d: roundedRectPath(0, 0, w, h, Math.min(w, h) / 2), strokeWidth: 0 }]
    case 'roundrect':
      return [
        { d: roundedRectPath(0, 0, w, h, (pad.rratio ?? 0.25) * Math.min(w, h)), strokeWidth: 0 },
      ]
    case 'rect':
    case 'trapezoid':
      return [{ d: roundedRectPath(0, 0, w, h, 0), strokeWidth: 0 }]
    case 'custom': {
      const anchor =
        pad.anchor === 'circle' ? circlePath(0, 0, w / 2) : roundedRectPath(0, 0, w, h, 0)
      const primitives = (pad.primitives ?? []).map((p) =>
        p.type === 'poly'
          ? {
              d: `M${p.points.map((q) => `${fmt(q.x)} ${fmt(q.y)}`).join('L')}Z`,
              strokeWidth: p.width,
            }
          : { d: circlePath(p.center.x, p.center.y, p.radius), strokeWidth: p.width },
      )
      return [{ d: anchor, strokeWidth: 0 }, ...primitives]
    }
  }
}

/** Outline of a drill (round hole or oval slot), in the pad's frame. */
export function drillPath(drill: PadDrill): string {
  const { w, h, offset } = drill
  return w === h
    ? circlePath(offset.x, offset.y, w / 2)
    : roundedRectPath(offset.x, offset.y, w, h, Math.min(w, h) / 2)
}

/** SVG transform placing pad-frame paths at the pad (KiCad rotation is CCW). */
export function padTransform(pad: FootprintPad): string {
  const rot = pad.at.rot % 360 === 0 ? '' : ` rotate(${-pad.at.rot})`
  return `translate(${fmt(pad.at.x)} ${fmt(pad.at.y)})${rot}`
}
