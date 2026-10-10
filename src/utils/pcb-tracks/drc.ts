/**
 * Design rule check of a track preset against the placed pads.
 *
 * Rules are KiCad 9's defaults for a board built from scratch, which is what
 * kle-ng-api makes (netclass clearance 0.2 mm, hole clearance and hole to
 * hole 0.25 mm; vias at least 0.5 mm with a 0.3 mm drill and a 0.1 mm ring).
 * kbplacer itself checks pads (holes included) at the netclass
 * clearance, so passing these rules passes both. The editor is stricter by
 * CLEARANCE_MARGIN, so a preset it accepts exactly at a limit isn't rejected
 * after rounding to nanometres.
 *
 * Nets come from connectivity: an item takes the net of the pads its cluster
 * reaches. A cluster reaching pads of two nets (or an obstacle pad) is a short.
 */
import type { TrackItem } from '@/types/tracks'
import { boxesNear, shapeBounds, shapeGap, type Box, type Shape, type Vec } from './distance'
import {
  buildConnectivity,
  padInfos,
  ratsnest,
  type Connectivity,
  type PadInfo,
  type RatsnestLine,
} from './connectivity'
import type { NetName, PlacedPad } from './netlist'
import { padHoleShape, trackShape, viaHoleShape, viaShape } from './shapes'
import { FLOAT_EPS } from './units'

export interface DrcRules {
  /** Copper to copper of different nets, mm. */
  clearance: number
  /** Copper to a hole of a different net (or any NPTH), mm. */
  holeClearance: number
  /** Hole edge to hole edge, mm. */
  holeToHole: number
  /** Smallest via diameter, mm. */
  viaMinDiameter: number
  /** Smallest through-hole (via) drill, mm. */
  minThroughDrill: number
  /** Smallest via copper ring, (diameter - drill) / 2, mm. */
  viaMinAnnular: number
}

export const DEFAULT_DRC_RULES: DrcRules = {
  clearance: 0.2,
  holeClearance: 0.25,
  holeToHole: 0.25,
  // KiCad's board constraints for a new board (DEFAULT_VIASMINSIZE, DEFAULT_MINTHROUGHDRILL)
  viaMinDiameter: 0.5,
  minThroughDrill: 0.3,
  viaMinAnnular: 0.1,
}

/** Via placed while routing: KiCad's default netclass (0.6 mm, 0.3 mm drill), as on kle-ng-api boards. */
export const DEFAULT_VIA = { diameter: 0.6, drillDiameter: 0.3 }

/** Safety margin added to every limit, mm. */
export const CLEARANCE_MARGIN = 1e-3

export type ViolationKind = 'clearance' | 'hole-clearance' | 'hole-to-hole' | 'short' | 'via-size'

export interface Violation {
  kind: ViolationKind
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
  /** Net of each item (null when floating or shorted), by item index. */
  itemNets: (NetName | null)[]
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
  /** Bounds of the shape, to skip far-apart pairs. */
  box: Box
}

const copperOf = (ref: number, layers: string[], shape: Shape): Copper => ({
  ref,
  layers,
  shape,
  box: shapeBounds(shape),
})

/** Why a via's size breaks the board constraints, or null (no margin: sizes are set, not measured). */
export function viaSizeProblem(
  via: { diameter: number; drillDiameter: number },
  rules: DrcRules = DEFAULT_DRC_RULES,
): string | null {
  if (via.diameter < rules.viaMinDiameter - FLOAT_EPS)
    return `diameter ${fmt(via.diameter)} mm, needs ${fmt(rules.viaMinDiameter)} mm`
  if (via.drillDiameter < rules.minThroughDrill - FLOAT_EPS)
    return `drill ${fmt(via.drillDiameter)} mm, needs ${fmt(rules.minThroughDrill)} mm`
  const ring = (via.diameter - via.drillDiameter) / 2
  if (ring < rules.viaMinAnnular - FLOAT_EPS)
    return `ring ${fmt(ring)} mm, needs ${fmt(rules.viaMinAnnular)} mm`
  return null
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
      message: `Short: tracks connect ${named.join(', ')}`,
      at: { x: second.placed.pad.at.x, y: second.placed.pad.at.y },
      items: itemIdx,
      pads: padIdx.map((i) => infos[i]!.placed.key),
    })
  }

  // copper of items and pads per layer
  const copper: Copper[] = []
  items.forEach((item, i) => {
    if (item.type === 'track') copper.push(copperOf(i, [item.layer], trackShape(item)))
    else if (item.type === 'via') copper.push(copperOf(i, ['F.Cu', 'B.Cu'], viaShape(item)))
  })
  const padCopper: Copper[] = infos.flatMap((info, i) =>
    info.copper.map((shape) => copperOf(-1 - i, info.layers, shape)),
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
  const checkClearance = (a: Copper, aNet: ReturnType<typeof itemNet>, b: Copper) => {
    if (!boxesNear(a.box, b.box, limit(rules.clearance)) || !shareLayer(a, b)) return
    const bIsPad = b.ref < 0
    const bNet = bIsPad ? padNetRef(-1 - b.ref) : itemNet(b.ref)
    if (sameNet(aNet, bNet)) return
    const gap = shapeGap(a.shape, b.shape)
    if (gap.d >= limit(rules.clearance)) return
    const bName = bIsPad ? padName(infos[-1 - b.ref]!) : itemName(items[b.ref]!)
    report(`c:${a.ref}:${b.ref}`, {
      kind: 'clearance',
      message:
        `Clearance: ${itemName(items[a.ref]!)} to ${bName} is ${fmt(gap.d)} mm, ` +
        `needs ${fmt(rules.clearance)} mm`,
      at: mid(gap.a, gap.b),
      items: bIsPad ? [a.ref] : [a.ref, b.ref],
      pads: bIsPad ? [infos[-1 - b.ref]!.placed.key] : [],
    })
  }
  copper.forEach((a, i) => {
    const aNet = itemNet(a.ref)
    for (let j = i + 1; j < copper.length; j++) checkClearance(a, aNet, copper[j]!)
    for (const b of padCopper) checkClearance(a, aNet, b)
  })

  // holes: tracks and vias to NPTH (any net); via drills to every hole
  const holes = infos
    .map((info, i) => ({ info, i, shape: padHoleShape(info.placed.pad) }))
    .filter((h): h is { info: PadInfo; i: number; shape: Shape } => h.shape !== null)
  // a plated hole sits inside its pad's copper, whose clearance check covers it
  const npthHoles = holes.filter((h) => h.info.placed.pad.type === 'np_thru_hole')
  for (const { ref: i, shape } of copper) {
    const item = items[i]!
    for (const hole of npthHoles) {
      const gap = shapeGap(shape, hole.shape)
      if (gap.d >= limit(rules.holeClearance)) continue
      report(`h:${i}:${hole.i}`, {
        kind: 'hole-clearance',
        message:
          `Hole clearance: ${itemName(item)} to ${padName(hole.info)} is ${fmt(gap.d)} mm, ` +
          `needs ${fmt(rules.holeClearance)} mm`,
        at: mid(gap.a, gap.b),
        items: [i],
        pads: [hole.info.placed.key],
      })
    }
    if (item.type === 'via') {
      const size = viaSizeProblem(item, rules)
      if (size) {
        report(`vs:${i}`, {
          kind: 'via-size',
          message: `Via size: ${size}`,
          at: item.position,
          items: [i],
          pads: [],
        })
      }
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
          message: `Hole to hole: via to ${other.name} is ${fmt(gap.d)} mm, needs ${fmt(rules.holeToHole)} mm`,
          at: mid(gap.a, gap.b),
          items: other.item >= 0 ? [i, other.item] : [i],
          pads: other.pad ? [other.pad] : [],
        })
      }
    }
  }

  const itemNets = conn.itemCluster.map((root) => {
    const nets = conn.clusters.get(root)!.nets
    return nets.length === 1 ? nets[0]! : null
  })
  return { violations, ratsnest: ratsnest(infos, items, conn), connectivity: conn, itemNets }
}
