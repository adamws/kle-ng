/**
 * Design rule check of a track preset against the placed pads.
 *
 * Rules are KiCad 9's defaults for a board built from scratch, which is what
 * kle-ng-api makes (netclass clearance 0.2 mm, hole clearance and hole to
 * hole 0.25 mm). kbplacer itself checks pads (holes included) at the netclass
 * clearance, so passing these rules passes both. The editor is stricter by
 * CLEARANCE_MARGIN, so a preset it accepts exactly at a limit isn't rejected
 * after rounding to nanometres.
 *
 * Nets come from connectivity: an item takes the net of the pads its cluster
 * reaches. A cluster reaching pads of two nets (or an obstacle pad) is a short.
 */
import type { TrackItem } from '@/types/tracks'
import { shapeBounds, shapeGap, type Shape, type Vec } from './distance'
import {
  buildConnectivity,
  padInfos,
  ratsnest,
  type Connectivity,
  type PadInfo,
  type RatsnestLine,
} from './connectivity'
import type { PlacedPad } from './netlist'
import { padHoleShape, trackShape, viaHoleShape, viaShape } from './shapes'

export interface DrcRules {
  /** Copper to copper of different nets, mm. */
  clearance: number
  /** Copper to a hole of a different net (or any NPTH), mm. */
  holeClearance: number
  /** Hole edge to hole edge, mm. */
  holeToHole: number
  /** Key cell size (1u pitch), mm; items beyond it reach into the neighbour key. */
  cellSize: number
}

export const DEFAULT_DRC_RULES: DrcRules = {
  clearance: 0.2,
  holeClearance: 0.25,
  holeToHole: 0.25,
  cellSize: 19.05,
}

/** Safety margin added to every limit, mm. */
export const CLEARANCE_MARGIN = 1e-3

export type ViolationKind =
  'clearance' | 'hole-clearance' | 'hole-to-hole' | 'short' | 'out-of-cell'

export interface Violation {
  kind: ViolationKind
  severity: 'error' | 'warning'
  message: string
  /** Where to draw the marker, switch-local mm. */
  at: Vec
  /** Indexes into the preset items involved. */
  items: number[]
  /** Keys of the pads involved. */
  pads: string[]
}

export interface DrcResult {
  violations: Violation[]
  ratsnest: RatsnestLine[]
  connectivity: Connectivity
}

const mid = (a: Vec, b: Vec): Vec => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
const fmt = (v: number) => v.toFixed(3)

function padName(p: PadInfo): string {
  const pad = p.placed.pad
  return pad.type === 'np_thru_hole'
    ? `${p.placed.owner} hole`
    : `${p.placed.owner} pad ${pad.number}`
}

function itemName(item: TrackItem): string {
  return item.type === 'via' ? 'via' : `${item.type} (${item.layer})`
}

interface Copper {
  /** Item index, or pad index encoded as -1 - index. */
  ref: number
  layers: string[]
  shape: Shape
}

export function runDrc(
  pads: readonly PlacedPad[],
  items: readonly TrackItem[],
  rules: DrcRules = DEFAULT_DRC_RULES,
): DrcResult {
  const infos = padInfos(pads)
  const conn = buildConnectivity(infos, items)
  const violations: Violation[] = []

  // net identity of a cluster: its pad net, or the cluster itself when floating or shorted
  const netKey = (cluster: number) => {
    const nets = conn.clusters.get(cluster)!.nets
    return nets.length === 1 ? nets[0]! : `cluster:${cluster}`
  }
  const padKey = (i: number) => {
    const info = infos[i]!
    // an obstacle pad is never the same net as anything else
    return info.net ? netKey(conn.padCluster[i]!) : `pad:${info.placed.key}`
  }
  const sameNet = (a: { cluster: number; key: string }, b: { cluster: number; key: string }) =>
    a.cluster === b.cluster || a.key === b.key

  const itemNet = (i: number) => ({
    cluster: conn.itemCluster[i]!,
    key: netKey(conn.itemCluster[i]!),
  })
  const padNetRef = (i: number) => ({ cluster: conn.padCluster[i]!, key: padKey(i) })

  // shorts: a cluster with items reaching pads of several nets or an obstacle
  for (const cluster of conn.clusters.values()) {
    const padIdx = cluster.nodes.filter((n) => n < infos.length)
    const itemIdx = cluster.nodes.filter((n) => n >= infos.length).map((n) => n - infos.length)
    if (!itemIdx.length) continue
    const obstacles = padIdx.filter((i) => infos[i]!.net === null)
    if (cluster.nets.length < 2 && !obstacles.length) continue
    const named = padIdx.map((i) => `${padName(infos[i]!)} (${infos[i]!.net ?? 'no net'})`)
    const second = infos[obstacles[0] ?? padIdx.find((i) => infos[i]!.net !== cluster.nets[0])!]!
    violations.push({
      kind: 'short',
      severity: 'error',
      message: `Short: tracks connect ${named.join(', ')}`,
      at: { x: second.placed.pad.at.x, y: second.placed.pad.at.y },
      items: itemIdx,
      pads: padIdx.map((i) => infos[i]!.placed.key),
    })
  }

  // copper of items and pads per layer
  const copper: Copper[] = []
  items.forEach((item, i) => {
    if (item.type === 'track')
      copper.push({ ref: i, layers: [item.layer], shape: trackShape(item) })
    else if (item.type === 'via')
      copper.push({ ref: i, layers: ['F.Cu', 'B.Cu'], shape: viaShape(item) })
  })
  const padCopper: Copper[] = infos.flatMap((info, i) =>
    info.copper.map((shape) => ({ ref: -1 - i, layers: info.layers, shape })),
  )

  const limit = (v: number) => v + CLEARANCE_MARGIN
  const shareLayer = (a: Copper, b: Copper) => a.layers.some((l) => b.layers.includes(l))
  const reported = new Set<string>()
  const report = (key: string, v: Violation) => {
    if (reported.has(key)) return
    reported.add(key)
    violations.push(v)
  }

  // item to item and item to pad copper
  for (let i = 0; i < copper.length; i++) {
    const a = copper[i]!
    const aNet = itemNet(a.ref)
    for (const b of [...copper.slice(i + 1), ...padCopper]) {
      if (!shareLayer(a, b)) continue
      const bIsPad = b.ref < 0
      const bNet = bIsPad ? padNetRef(-1 - b.ref) : itemNet(b.ref)
      if (sameNet(aNet, bNet)) continue
      const gap = shapeGap(a.shape, b.shape)
      if (gap.d >= limit(rules.clearance)) continue
      const bName = bIsPad ? padName(infos[-1 - b.ref]!) : itemName(items[b.ref]!)
      report(`c:${a.ref}:${b.ref}`, {
        kind: 'clearance',
        severity: 'error',
        message:
          `Clearance: ${itemName(items[a.ref]!)} to ${bName} is ${fmt(gap.d)} mm, ` +
          `needs ${fmt(rules.clearance)} mm`,
        at: mid(gap.a, gap.b),
        items: bIsPad ? [a.ref] : [a.ref, b.ref],
        pads: bIsPad ? [infos[-1 - b.ref]!.placed.key] : [],
      })
    }
  }

  // holes: items to NPTH (any net) and to plated holes of other nets; via holes to holes
  const holes = infos
    .map((info, i) => ({ info, i, shape: padHoleShape(info.placed.pad) }))
    .filter((h): h is { info: PadInfo; i: number; shape: Shape } => h.shape !== null)
  items.forEach((item, i) => {
    if (item.type !== 'track' && item.type !== 'via') return
    const shape = item.type === 'track' ? trackShape(item) : viaShape(item)
    for (const hole of holes) {
      const npth = hole.info.placed.pad.type === 'np_thru_hole'
      // a plated hole sits inside its pad's copper, whose clearance check covers it
      if (!npth) continue
      const gap = shapeGap(shape, hole.shape)
      if (gap.d >= limit(rules.holeClearance)) continue
      report(`h:${i}:${hole.i}`, {
        kind: 'hole-clearance',
        severity: 'error',
        message:
          `Hole clearance: ${itemName(item)} to ${padName(hole.info)} is ${fmt(gap.d)} mm, ` +
          `needs ${fmt(rules.holeClearance)} mm`,
        at: mid(gap.a, gap.b),
        items: [i],
        pads: [hole.info.placed.key],
      })
    }
    if (item.type === 'via') {
      const drill = viaHoleShape(item)
      const others = [
        ...holes.map((h) => ({
          shape: h.shape,
          name: padName(h.info),
          pad: h.info.placed.key,
          item: -1,
        })),
        ...items.flatMap((o, j) =>
          o.type === 'via' && j > i
            ? [{ shape: viaHoleShape(o), name: 'via', pad: '', item: j }]
            : [],
        ),
      ]
      for (const other of others) {
        const gap = shapeGap(drill, other.shape)
        if (gap.d >= limit(rules.holeToHole)) continue
        report(`hh:${i}:${other.pad || other.item}`, {
          kind: 'hole-to-hole',
          severity: 'error',
          message: `Hole to hole: via to ${other.name} is ${fmt(gap.d)} mm, needs ${fmt(rules.holeToHole)} mm`,
          at: mid(gap.a, gap.b),
          items: other.item >= 0 ? [i, other.item] : [i],
          pads: other.pad ? [other.pad] : [],
        })
      }
    }
  })

  // out of the key cell: reaches into the neighbouring key
  const half = rules.cellSize / 2
  copper.forEach(({ ref, shape }) => {
    const b = shapeBounds(shape)
    if (b.minX >= -half && b.maxX <= half && b.minY >= -half && b.maxY <= half) return
    const item = items[ref]!
    violations.push({
      kind: 'out-of-cell',
      severity: 'warning',
      message: `${itemName(item)} leaves the ${rules.cellSize} mm key cell and may hit the neighbouring key`,
      at: {
        x: Math.max(-half, Math.min(half, (b.minX + b.maxX) / 2)),
        y: Math.max(-half, Math.min(half, (b.minY + b.maxY) / 2)),
      },
      items: [ref],
      pads: [],
    })
  })

  return { violations, ratsnest: ratsnest(infos, items, conn), connectivity: conn }
}
