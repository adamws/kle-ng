/**
 * Connectivity of a track preset over the placed pads, KiCad style:
 * - a track or via end inside a pad's copper (on a shared layer) connects to it,
 * - tracks on one layer connect at shared ends or where an end lies on the
 *   other track (T junction),
 * - a track end inside a via connects to it (vias span both layers),
 * - overlapping pads of one net connect (e.g. the hybrid MX/Alps pin pairs).
 *
 * Clusters of connected pads and items get a net from their pads; the
 * ratsnest is a minimum spanning tree per net over its clusters.
 */
import type { TrackItem, TrackSegment, TrackVia, CopperLayer } from '@/types/tracks'
import { padCopperLayers } from '@/utils/kicad/footprint-pads'
import { pointSegment, shapeContains, shapeGap, type Shape, type Vec } from './distance'
import { placedPadNet, type NetName, type PlacedPad } from './netlist'
import { padCopperShapes, viaShape } from './shapes'

/** Tolerance for coincident points, mm (kbplacer matches ends in exact nm). */
export const POINT_EPSILON = 1e-6

export class UnionFind {
  private parent: number[]
  private rank: number[]

  constructor(n: number) {
    this.parent = Array.from({ length: n }, (_, i) => i)
    this.rank = new Array<number>(n).fill(0)
  }

  find(i: number): number {
    let root = i
    while (this.parent[root] !== root) root = this.parent[root]!
    // path compression
    while (this.parent[i] !== root) {
      const next = this.parent[i]!
      this.parent[i] = root
      i = next
    }
    return root
  }

  union(a: number, b: number): void {
    const ra = this.find(a)
    const rb = this.find(b)
    if (ra === rb) return
    const [hi, lo] = this.rank[ra]! >= this.rank[rb]! ? [ra, rb] : [rb, ra]
    this.parent[lo] = hi
    if (this.rank[hi] === this.rank[lo]) this.rank[hi]!++
  }
}

/** Pad copper prepared for connectivity and DRC. */
export interface PadInfo {
  placed: PlacedPad
  net: NetName | null
  layers: CopperLayer[]
  copper: Shape[]
}

export function padInfos(pads: readonly PlacedPad[]): PadInfo[] {
  return pads.map((placed) => ({
    placed,
    net: placedPadNet(placed),
    layers: placed.pad.type === 'np_thru_hole' ? [] : padCopperLayers(placed.pad),
    copper: padCopperShapes(placed.pad),
  }))
}

export interface Cluster {
  /** Node ids: pads are 0..P-1, items P..P+I-1. */
  nodes: number[]
  /** Distinct nets of the cluster's pads. */
  nets: NetName[]
}

export interface Connectivity {
  /** Cluster id (root node) of each pad, by pad index. */
  padCluster: number[]
  /** Cluster id of each item, by item index. */
  itemCluster: number[]
  clusters: Map<number, Cluster>
}

const ends = (t: TrackSegment): Vec[] => [t.start, t.end]
const near = (p: Vec, q: Vec) => Math.hypot(p.x - q.x, p.y - q.y) <= POINT_EPSILON

function inPad(p: Vec, pad: PadInfo): boolean {
  return pad.copper.some((s) => shapeContains(s, p))
}

export function buildConnectivity(
  pads: readonly PadInfo[],
  items: readonly TrackItem[],
): Connectivity {
  const P = pads.length
  const uf = new UnionFind(P + items.length)

  for (let i = 0; i < P; i++) {
    const a = pads[i]!
    for (let j = i + 1; j < P; j++) {
      const b = pads[j]!
      if (!a.net || a.net !== b.net || !a.layers.some((l) => b.layers.includes(l))) continue
      if (a.copper.some((s) => b.copper.some((t) => shapeGap(s, t).d === 0))) uf.union(i, j)
    }
  }

  items.forEach((item, i) => {
    const node = P + i
    if (item.type === 'track') {
      pads.forEach((pad, j) => {
        if (pad.layers.includes(item.layer) && ends(item).some((e) => inPad(e, pad))) {
          uf.union(node, j)
        }
      })
    } else if (item.type === 'via') {
      pads.forEach((pad, j) => {
        if (pad.layers.length && inPad(item.position, pad)) uf.union(node, j)
      })
    }
  })

  for (let i = 0; i < items.length; i++) {
    const a = items[i]!
    for (let j = i + 1; j < items.length; j++) {
      const b = items[j]!
      if (itemsConnect(a, b)) uf.union(P + i, P + j)
    }
  }

  const padCluster = pads.map((_, i) => uf.find(i))
  const itemCluster = items.map((_, i) => uf.find(P + i))
  const clusters = new Map<number, Cluster>()
  const clusterOf = (root: number) => {
    let c = clusters.get(root)
    if (!c) clusters.set(root, (c = { nodes: [], nets: [] }))
    return c
  }
  padCluster.forEach((root, i) => {
    const c = clusterOf(root)
    c.nodes.push(i)
    const net = pads[i]!.net
    if (net && !c.nets.includes(net)) c.nets.push(net)
  })
  itemCluster.forEach((root, i) => clusterOf(root).nodes.push(P + i))
  return { padCluster, itemCluster, clusters }
}

function itemsConnect(a: TrackItem, b: TrackItem): boolean {
  if (a.type === 'track' && b.type === 'track') {
    if (a.layer !== b.layer) return false
    return (
      ends(a).some((e) => pointSegment(e, b.start, b.end).d <= POINT_EPSILON) ||
      ends(b).some((e) => pointSegment(e, a.start, a.end).d <= POINT_EPSILON)
    )
  }
  if (a.type === 'via' && b.type === 'via') return near(a.position, b.position)
  const via = (a.type === 'via' ? a : b) as TrackVia
  const other = a.type === 'via' ? b : a
  return other.type === 'track' && ends(other).some((e) => shapeContains(viaShape(via), e))
}

export interface RatsnestLine {
  net: NetName
  from: Vec
  to: Vec
}

/** Points a ratsnest line of `net` may attach to: its pads' centres, track ends, vias. */
function anchors(
  net: NetName,
  nodes: readonly number[],
  pads: readonly PadInfo[],
  items: readonly TrackItem[],
): Vec[] {
  const out: Vec[] = []
  for (const n of nodes) {
    if (n < pads.length) {
      const pad = pads[n]!
      if (pad.net === net) out.push({ x: pad.placed.pad.at.x, y: pad.placed.pad.at.y })
      continue
    }
    const item = items[n - pads.length]!
    if (item.type === 'track') out.push(item.start, item.end)
    else if (item.type === 'via') out.push(item.position)
  }
  return out
}

/**
 * Unrouted connections: for every net with pads in several clusters, the
 * shortest lines joining those clusters (Prim's minimum spanning tree).
 */
export function ratsnest(
  pads: readonly PadInfo[],
  items: readonly TrackItem[],
  conn: Connectivity,
): RatsnestLine[] {
  const lines: RatsnestLine[] = []
  const nets = [...new Set(pads.map((p) => p.net).filter((n): n is NetName => n !== null))]
  for (const net of nets) {
    // clusters holding pads of this net (a shorted cluster still counts)
    const roots = [
      ...new Set(
        pads.map((p, i) => (p.net === net ? conn.padCluster[i]! : -1)).filter((r) => r >= 0),
      ),
    ]
    if (roots.length < 2) continue
    const groups = roots.map((r) => anchors(net, conn.clusters.get(r)!.nodes, pads, items))
    const closest = (g: Vec[], h: Vec[]) => {
      let best = { d: Infinity, from: g[0]!, to: h[0]! }
      for (const p of g)
        for (const q of h) {
          const d = Math.hypot(p.x - q.x, p.y - q.y)
          if (d < best.d) best = { d, from: p, to: q }
        }
      return best
    }
    const inTree = [0]
    const rest = groups.map((_, i) => i).slice(1)
    while (rest.length) {
      let best: { d: number; from: Vec; to: Vec; k: number } | null = null
      for (const t of inTree)
        for (let k = 0; k < rest.length; k++) {
          const c = closest(groups[t]!, groups[rest[k]!]!)
          if (!best || c.d < best.d) best = { ...c, k }
        }
      inTree.push(rest[best!.k]!)
      rest.splice(best!.k, 1)
      lines.push({ net, from: best!.from, to: best!.to })
    }
  }
  return lines
}
