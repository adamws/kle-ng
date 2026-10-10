/**
 * Where a routing click lands: a pad anchor (its centre), the end of an
 * existing track or a via (both kinds 'track-end'), or the nearest grid point. Pads and track ends are exempt
 * from the grid, like in KiCad.
 *
 * While routing, only anchors of the route's net attract the cursor, so the
 * route can't snap onto another net. When starting, or on a route that has no
 * net yet (started off-pad), any pad with a net or any track end does, and
 * the route takes its net.
 */
import type { CopperLayer, TrackItem } from '@/types/tracks'
import type { PadInfo } from './connectivity'
import { dist, shapeContains, type Vec } from './distance'
import type { NetName } from './netlist'
import { snapToGrid } from './posture'

export type SnapTarget =
  | { kind: 'pad'; point: Vec; padKey: string; net: NetName }
  | { kind: 'track-end'; point: Vec; item: number; net: NetName | null }
  | { kind: 'grid'; point: Vec }

export interface SnapContext {
  pads: readonly PadInfo[]
  items: readonly TrackItem[]
  /** Net of each item (from runDrc). */
  itemNets: readonly (NetName | null)[]
  layer: CopperLayer
  grid: number
  /** Attraction radius around anchors, mm (a few screen pixels). */
  radius: number
  /** The route's net: only its anchors snap. Unset or null: any anchor snaps. */
  net?: NetName | null
}

export function snapTarget(cursor: Vec, ctx: SnapContext): SnapTarget {
  const anyNet = !ctx.net

  const best: { d: number; target: SnapTarget | null } = { d: Infinity, target: null }
  const offer = (d: number, target: SnapTarget) => {
    if (d < best.d) Object.assign(best, { d, target })
  }

  for (const pad of ctx.pads) {
    if (!pad.net || !pad.layers.includes(ctx.layer)) continue
    if (!anyNet && pad.net !== ctx.net) continue
    const centre = { x: pad.placed.pad.at.x, y: pad.placed.pad.at.y }
    const d = dist(cursor, centre)
    if (d <= ctx.radius || pad.copper.some((s) => shapeContains(s, cursor))) {
      offer(d, { kind: 'pad', point: centre, padKey: pad.placed.key, net: pad.net })
    }
  }

  ctx.items.forEach((item, i) => {
    // a via is on both layers
    if (item.type === 'via') {
      const net = ctx.itemNets[i] ?? null
      if (!anyNet && net !== ctx.net) return
      const d = dist(cursor, item.position)
      if (d <= Math.max(ctx.radius, item.diameter / 2))
        offer(d - ctx.radius, { kind: 'track-end', point: item.position, item: i, net })
      return
    }
    if (item.type !== 'track' || item.layer !== ctx.layer) return
    const net = ctx.itemNets[i] ?? null
    if (!anyNet && net !== ctx.net) return
    for (const end of [item.start, item.end]) {
      const d = dist(cursor, end)
      // a track end beats a pad centre it sits next to
      if (d <= ctx.radius) offer(d - ctx.radius, { kind: 'track-end', point: end, item: i, net })
    }
  })

  return best.target ?? { kind: 'grid', point: snapToGrid(cursor, ctx.grid) }
}
