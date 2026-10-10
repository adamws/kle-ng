/**
 * kbplacer's coordinate contract as plain-number maths: KiCad rotations and
 * the placement of an element relative to its switch (see the contract in
 * src/utils/footprintUtils.ts).
 *
 * Imported by a Node script (through footprint-pads.ts), so it has no
 * dependencies and uses only erasable TypeScript syntax.
 */

export interface Point {
  x: number
  y: number
}

/** A placement relative to the switch: kbplacer's CUSTOM position option. */
export interface Placement {
  x: number
  y: number
  rotation: number
  side: 'FRONT' | 'BACK'
}

/** Rotates a point by a KiCad orientation (counter-clockwise on screen). */
export function rotateKicad(p: Point, degrees: number): Point {
  if (degrees % 360 === 0) return { x: p.x, y: p.y }
  const rad = (degrees * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  return { x: p.x * cos + p.y * sin, y: -p.x * sin + p.y * cos }
}

/** Mirrors a point top to bottom (y → −y) for a BACK placement, as kbplacer flips a footprint. */
export function mirrorForSide(p: Point, side: Placement['side']): Point {
  return side === 'BACK' ? { x: p.x, y: -p.y } : { x: p.x, y: p.y }
}

/** A point of an element's own frame in the switch-local frame: mirror, rotate, offset. */
export function placePoint(p: Point, placement: Placement): Point {
  const rotated = rotateKicad(mirrorForSide(p, placement.side), placement.rotation)
  return { x: rotated.x + placement.x, y: rotated.y + placement.y }
}
