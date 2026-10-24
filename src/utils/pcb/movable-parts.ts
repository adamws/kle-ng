/**
 * Parts the footprint preview places with the mouse: the diode, the LED and
 * its decoupling capacitor. Each is an offset from the switch origin and a
 * rotation in the PCB settings (the Switches and LEDs tabs' fields), in the
 * switch-local frame. The switch itself stays at the origin.
 */
import type { PcbSettings } from '@/types/pcb'
import type { CopperLayer } from '@/types/tracks'
import type { PadInfo } from '@/utils/pcb-tracks/connectivity'
import { pointInPolygon, segmentPolygon, type Vec } from '@/utils/pcb-tracks/distance'
import { boxPolygon, isCrossing, padAt, type Box } from '@/utils/pcb-tracks/selection'
import type { CourtyardPart } from './courtyard-collisions'

/** Pad owners in the preview, see FootprintPreview's pad sources. */
export type MovablePart = 'D' | 'LED' | 'C'

export const PART_NAMES: Record<MovablePart, string> = {
  D: 'Diode',
  LED: 'LED',
  C: 'Capacitor',
}

type NumberField = {
  [K in keyof PcbSettings]-?: PcbSettings[K] extends number ? K : never
}[keyof PcbSettings]

const FIELDS: Record<MovablePart, { x: NumberField; y: NumberField; rotation: NumberField }> = {
  D: { x: 'diodePositionX', y: 'diodePositionY', rotation: 'diodeRotation' },
  LED: { x: 'ledPositionX', y: 'ledPositionY', rotation: 'ledRotation' },
  C: { x: 'ledCapacitorPositionX', y: 'ledCapacitorPositionY', rotation: 'ledCapacitorRotation' },
}

export interface PartPlacement {
  x: number
  y: number
  rotation: number
}

export function isMovablePart(owner: string | null | undefined): owner is MovablePart {
  return owner === 'D' || owner === 'LED' || owner === 'C'
}

export function partPlacement(settings: PcbSettings, part: MovablePart): PartPlacement {
  const f = FIELDS[part]
  return { x: settings[f.x], y: settings[f.y], rotation: settings[f.rotation] }
}

/** Writes the given fields of a part's placement into the settings. */
export function setPartPlacement(
  settings: PcbSettings,
  part: MovablePart,
  placement: Partial<PartPlacement>,
) {
  const f = FIELDS[part]
  if (placement.x !== undefined) settings[f.x] = placement.x
  if (placement.y !== undefined) settings[f.y] = placement.y
  if (placement.rotation !== undefined) settings[f.rotation] = placement.rotation
}

/**
 * A quarter turn clockwise on screen, like KiCad's Shift+R: KiCad angles turn
 * counter-clockwise, on either side of the board. Kept in [0, 360).
 */
export function rotateClockwise(rotation: number): number {
  return (((rotation - 90) % 360) + 360) % 360
}

function area(outline: readonly Vec[]): number {
  let twice = 0
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
    twice += outline[j]!.x * outline[i]!.y - outline[i]!.x * outline[j]!.y
  }
  return Math.abs(twice) / 2
}

/**
 * The movable part at a switch-local point: the owner of the pad under it (on
 * the shown copper layers),
 * else the part with the smallest courtyard outline (either side) around it,
 * so a small part inside a larger one's courtyard can still be picked.
 */
export function partAt(
  p: Vec,
  pads: readonly PadInfo[],
  parts: readonly CourtyardPart[],
  layers: readonly CopperLayer[] = ['F.Cu', 'B.Cu'],
): MovablePart | null {
  const padOwner = padAt(pads, p, layers)?.placed.owner
  if (isMovablePart(padOwner)) return padOwner
  let best: { part: MovablePart; area: number } | null = null
  for (const { owner, courtyard } of parts) {
    if (!isMovablePart(owner)) continue
    for (const outline of [...courtyard.front, ...courtyard.back]) {
      if (!pointInPolygon(p, outline)) continue
      const a = area(outline)
      if (!best || a < best.area) best = { part: owner, area: a }
    }
  }
  return best?.part ?? null
}

/**
 * The movable parts a box selection picks, like tracksInBox: dragging left to
 * right picks parts whose courtyard (else pad centres) is inside the box,
 * right to left also parts the box touches. The box is in board axes, parts
 * switch-local, so their points go through `toBoard` first.
 */
export function partsInBox(
  box: Box,
  pads: readonly PadInfo[],
  parts: readonly CourtyardPart[],
  toBoard: (p: Vec) => Vec,
): MovablePart[] {
  const rect = boxPolygon(box)
  const crossing = isCrossing(box)
  const found: MovablePart[] = []
  for (const { owner, courtyard } of parts) {
    if (!isMovablePart(owner)) continue
    const outlines = [...courtyard.front, ...courtyard.back].map((o) => o.map(toBoard))
    const centres = pads
      .filter((p) => p.placed.owner === owner)
      .map((p) => toBoard(p.placed.pad.at))
    let hit: boolean
    if (!outlines.length) {
      const inside = (q: Vec) => pointInPolygon(q, rect)
      hit = centres.length > 0 && (crossing ? centres.some(inside) : centres.every(inside))
    } else if (crossing) {
      hit = outlines.some(
        (o) =>
          o.some((q, i) => segmentPolygon(q, o[(i + 1) % o.length]!, rect).d === 0) ||
          pointInPolygon(rect[0]!, o),
      )
    } else {
      hit = outlines.every((o) => o.every((q) => pointInPolygon(q, rect)))
    }
    if (hit) found.push(owner)
  }
  return found
}
