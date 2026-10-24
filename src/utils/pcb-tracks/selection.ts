/**
 * Box selection, KiCad style: dragging left to right selects tracks fully
 * inside the box, right to left also selects tracks the box touches. A via is
 * selected when its centre is in the box.
 *
 * The box is drawn in board axes (what the screen shows) while tracks are
 * switch-local, so track points go through `toBoard` first.
 */
import type { CopperLayer, TrackItem } from '@/types/tracks'
import type { PadInfo } from './connectivity'
import { pointInPolygon, segmentPolygon, shapeContains, type Vec } from './distance'
import { padHoleShape } from './shapes'

export interface Box {
  /** Where the drag started and where it is now, board axes. */
  from: Vec
  to: Vec
}

/** Right-to-left drags select by touching. */
export const isCrossing = (box: Box) => box.to.x < box.from.x

/** The box's corners, board axes. */
export function boxPolygon(box: Box): Vec[] {
  const minX = Math.min(box.from.x, box.to.x)
  const maxX = Math.max(box.from.x, box.to.x)
  const minY = Math.min(box.from.y, box.to.y)
  const maxY = Math.max(box.from.y, box.to.y)
  return [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY },
  ]
}

export function tracksInBox(
  items: readonly TrackItem[],
  box: Box,
  toBoard: (p: Vec) => Vec,
  visible: (item: TrackItem) => boolean = () => true,
): number[] {
  const rect = boxPolygon(box)
  const crossing = isCrossing(box)
  return items.flatMap((item, i) => {
    if (!visible(item)) return []
    if (item.type === 'via') return pointInPolygon(toBoard(item.position), rect) ? [i] : []
    if (item.type !== 'track') return []
    const a = toBoard(item.start)
    const b = toBoard(item.end)
    const hit = crossing
      ? segmentPolygon(a, b, rect).d === 0
      : pointInPolygon(a, rect) && pointInPolygon(b, rect)
    return hit ? [i] : []
  })
}

/**
 * The pad under `p` (switch-local): one whose copper on a shown layer, or
 * whose hole (NPTH), contains it; of several, the one with the nearest centre.
 */
export function padAt(
  pads: readonly PadInfo[],
  p: Vec,
  layers: readonly CopperLayer[],
): PadInfo | null {
  let best: { pad: PadInfo; d: number } | null = null
  for (const pad of pads) {
    const shown = pad.layers.some((l) => layers.includes(l))
    const hole = pad.layers.length ? null : padHoleShape(pad.placed.pad)
    const hit =
      (shown && pad.copper.some((s) => shapeContains(s, p))) || (!!hole && shapeContains(hole, p))
    if (!hit) continue
    const d = Math.hypot(p.x - pad.placed.pad.at.x, p.y - pad.placed.pad.at.y)
    if (!best || d < best.d) best = { pad, d }
  }
  return best?.pad ?? null
}
