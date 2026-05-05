import type { Key } from '@/stores/keyboard'
import { getKeyCenter } from '@/utils/keyboard-geometry'
import type {
  AnnotationAlgorithm,
  AnnotationResult,
  AnnotationWarning,
  RowColAssignment,
} from './types'

/** Maximum Y deviation a "right neighbor" can have from the source key. */
const ROW_AXIS_TOLERANCE = 0.55
/** Maximum X deviation a "down neighbor" can have from the source key. */
const COL_AXIS_TOLERANCE = 0.55
/** Hard cap on neighbor link distance — prevents jumping across a layout gap. */
const MAX_LINK_DIST = 2.5
/** Threshold for fusing two chains into the same global row/col by median coord. */
const MERGE_THRESHOLD = 0.55

function isRegular(key: Key): boolean {
  return !key.ghost && !key.decal
}

function median(arr: number[]): number {
  const s = [...arr].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]!
}

class UnionFind {
  parent: number[]
  constructor(n: number) {
    this.parent = Array.from({ length: n }, (_, i) => i)
  }
  find(x: number): number {
    while (this.parent[x] !== x) {
      this.parent[x] = this.parent[this.parent[x]!]!
      x = this.parent[x]!
    }
    return x
  }
  union(a: number, b: number): void {
    const ra = this.find(a)
    const rb = this.find(b)
    if (ra !== rb) this.parent[ra] = rb
  }
}

interface Center {
  x: number
  y: number
}

/**
 * For key `i`, find the nearest "right neighbor" — the closest key whose center
 * is to the right (dx > 0), within ROW_AXIS_TOLERANCE on Y, and within
 * MAX_LINK_DIST overall. Returns -1 if none.
 */
function findRightNeighbor(i: number, centers: Center[]): number {
  const ci = centers[i]!
  let best = -1
  let bestScore = Infinity
  for (let j = 0; j < centers.length; j++) {
    if (j === i) continue
    const cj = centers[j]!
    const dx = cj.x - ci.x
    const dy = cj.y - ci.y
    if (dx <= 0) continue
    if (Math.abs(dy) > ROW_AXIS_TOLERANCE) continue
    const dist = Math.hypot(dx, dy)
    if (dist > MAX_LINK_DIST) continue
    // Prefer the neighbor closest in X, with a small tax on cross-axis drift.
    const score = dx + Math.abs(dy) * 0.5
    if (score < bestScore) {
      bestScore = score
      best = j
    }
  }
  return best
}

/** Symmetric down-neighbor — closest key with dy > 0, |dx| < tol, total dist ≤ cap. */
function findDownNeighbor(i: number, centers: Center[]): number {
  const ci = centers[i]!
  let best = -1
  let bestScore = Infinity
  for (let j = 0; j < centers.length; j++) {
    if (j === i) continue
    const cj = centers[j]!
    const dx = cj.x - ci.x
    const dy = cj.y - ci.y
    if (dy <= 0) continue
    if (Math.abs(dx) > COL_AXIS_TOLERANCE) continue
    const dist = Math.hypot(dx, dy)
    if (dist > MAX_LINK_DIST) continue
    const score = dy + Math.abs(dx) * 0.5
    if (score < bestScore) {
      bestScore = score
      best = j
    }
  }
  return best
}

/**
 * Take an array of chain IDs, group keys by chain, compute each chain's median
 * coordinate, then merge chains whose medians fall within `mergeThreshold`.
 * Returns key→global-band-index, dense and sorted by world coord.
 */
function chainsToBands(
  chainIds: number[],
  centers: Center[],
  axis: 'x' | 'y',
  mergeThreshold: number,
): number[] {
  const chains = new Map<number, number[]>()
  chainIds.forEach((cid, i) => {
    if (!chains.has(cid)) chains.set(cid, [])
    chains.get(cid)!.push(i)
  })

  const chainList = [...chains.entries()].map(([cid, members]) => ({
    cid,
    members,
    medianAxis: median(members.map((i) => centers[i]![axis])),
  }))

  // Sort chains by median axis coord, then merge adjacent chains that fall
  // within mergeThreshold (handles split keyboards / multiple chains per row).
  chainList.sort((a, b) => a.medianAxis - b.medianAxis)
  const chainToGlobal = new Map<number, number>()
  let global = -1
  let prev = -Infinity
  for (const c of chainList) {
    if (c.medianAxis - prev > mergeThreshold) global++
    chainToGlobal.set(c.cid, global)
    prev = c.medianAxis
  }

  return chainIds.map((cid) => chainToGlobal.get(cid)!)
}

export const graphAnnotationAlgorithm: AnnotationAlgorithm = {
  name: 'graph',
  description:
    'Neighbor-chain row/col detection. Each key links to its nearest right/down ' +
    'neighbor within a narrow cross-axis cone; row chains are connected components ' +
    'via right-edges, col chains via down-edges. Chains whose median world ' +
    'coordinate is within 0.55u get fused (handles split halves and rotation islands). ' +
    'Per-row collisions are resolved by shifting to the next free column slot.',

  annotate(keys: ReadonlyArray<Key>): AnnotationResult {
    const warnings: AnnotationWarning[] = []
    const assignments: (RowColAssignment | null)[] = keys.map((k) =>
      isRegular(k) ? { row: null, col: null } : null,
    )

    // Map regular keys → their original indices and world centers.
    const origIdx: number[] = []
    const centers: Center[] = []
    keys.forEach((k, i) => {
      if (!isRegular(k)) return
      origIdx.push(i)
      centers.push(getKeyCenter(k as Key))
    })
    const n = centers.length
    if (n === 0) return { assignments, status: 'success', warnings }

    // Build right-neighbor + down-neighbor chains via union-find.
    const rowUF = new UnionFind(n)
    const colUF = new UnionFind(n)
    for (let i = 0; i < n; i++) {
      const r = findRightNeighbor(i, centers)
      if (r >= 0) rowUF.union(i, r)
      const d = findDownNeighbor(i, centers)
      if (d >= 0) colUF.union(i, d)
    }

    const rowChainIds = Array.from({ length: n }, (_, i) => rowUF.find(i))
    const colChainIds = Array.from({ length: n }, (_, i) => colUF.find(i))

    // Merge chains by world median to handle split halves and rotation islands.
    const rowIdx = chainsToBands(rowChainIds, centers, 'y', MERGE_THRESHOLD)
    const tentativeCol = chainsToBands(colChainIds, centers, 'x', MERGE_THRESHOLD)

    // Per-row collision resolution — shift duplicates to next free col slot.
    const byRow = new Map<number, number[]>()
    for (let i = 0; i < n; i++) {
      const r = rowIdx[i]!
      if (!byRow.has(r)) byRow.set(r, [])
      byRow.get(r)!.push(i)
    }
    const finalCol = new Array<number>(n)
    let collisions = 0
    byRow.forEach((indices) => {
      const sorted = indices.slice().sort((a, b) => {
        const ca = tentativeCol[a]!
        const cb = tentativeCol[b]!
        if (ca !== cb) return ca - cb
        return centers[a]!.x - centers[b]!.x
      })
      const used = new Set<number>()
      sorted.forEach((i) => {
        let c = tentativeCol[i]!
        if (used.has(c)) {
          collisions++
          while (used.has(c)) c++
        }
        used.add(c)
        finalCol[i] = c
      })
    })

    // Densify col indices.
    const sortedCols = [...new Set(finalCol)].sort((a, b) => a - b)
    const colRemap = new Map<number, number>()
    sortedCols.forEach((c, i) => colRemap.set(c, i))

    for (let i = 0; i < n; i++) {
      const a = assignments[origIdx[i]!]
      if (!a) continue
      a.row = rowIdx[i]!
      a.col = colRemap.get(finalCol[i]!)!
    }

    if (collisions > 0) {
      warnings.push({
        kind: 'algorithm-specific',
        message: `Resolved ${collisions} per-row column collision(s) by shifting to next free slot.`,
      })
    }

    return { assignments, status: 'success', warnings }
  },
}
