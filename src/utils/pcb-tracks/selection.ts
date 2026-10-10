/**
 * Box selection, KiCad style: dragging left to right selects tracks fully
 * inside the box, right to left also selects tracks the box touches.
 *
 * The box is drawn in board axes (what the screen shows) while tracks are
 * switch-local, so track points go through `toBoard` first.
 */
import type { TrackItem } from '@/types/tracks'
import { pointInPolygon, segmentPolygon, type Vec } from './distance'

export interface Box {
  /** Where the drag started and where it is now, board axes. */
  from: Vec
  to: Vec
}

/** Right-to-left drags select by touching. */
export const isCrossing = (box: Box) => box.to.x < box.from.x

export function tracksInBox(
  items: readonly TrackItem[],
  box: Box,
  toBoard: (p: Vec) => Vec,
  visible: (item: TrackItem) => boolean = () => true,
): number[] {
  const minX = Math.min(box.from.x, box.to.x)
  const maxX = Math.max(box.from.x, box.to.x)
  const minY = Math.min(box.from.y, box.to.y)
  const maxY = Math.max(box.from.y, box.to.y)
  const rect = [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY },
  ]
  const crossing = isCrossing(box)
  return items.flatMap((item, i) => {
    if (item.type !== 'track' || !visible(item)) return []
    const a = toBoard(item.start)
    const b = toBoard(item.end)
    const hit = crossing
      ? segmentPolygon(a, b, rect).d === 0
      : pointInPolygon(a, rect) && pointInPolygon(b, rect)
    return hit ? [i] : []
  })
}
