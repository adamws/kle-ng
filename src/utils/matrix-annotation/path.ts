import type { Key } from '@/stores/keyboard'
import { getKeyCenter } from '@/utils/keyboard-geometry'
import type {
  AnnotationAlgorithm,
  AnnotationResult,
  AnnotationWarning,
  RowColAssignment,
} from './types'

/** Minimum projection along the link's axis — filters out keys that are perpendicular to the link. */
const MIN_AXIS = 0.3
/** Max perpendicular drift along the local (per-key rotated) axis. Sized to admit
 *  on-axis neighbors at slight wedge angles but reject cross-row diagonal links on
 *  splayed layouts (atreus's inner-column keys drift ~0.35u along the local cross-axis). */
const PERP_BAND_LOCAL = 0.3
/** Max perpendicular drift along the world axis. Catches cross-rotation links without
 *  bridging staggered inner keys (lily58 inner-column drift can be ~0.25u). */
const PERP_BAND_WORLD = 0.3
/** Hard cap on link distance — no jumping across layout gaps. */
const MAX_LINK_DIST = 2.5

interface Vec2 {
  x: number
  y: number
}

interface KeyData {
  /** World center of the key. */
  center: Vec2
  /** Local "+X" (row direction) — `(cos θ, sin θ)` in screen coords. */
  rowAxis: Vec2
  /** Local "+Y" (col direction) — `(-sin θ, cos θ)` in screen coords. */
  colAxis: Vec2
  /** Whether the key has a noticeable rotation. */
  rotated: boolean
}

function isRegular(key: Key): boolean {
  return !key.ghost && !key.decal
}

function median(arr: number[]): number {
  const s = [...arr].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]!
}

function dot(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.y * b.y
}

function normalize(v: Vec2): Vec2 {
  const m = Math.hypot(v.x, v.y)
  if (m < 1e-9) return { x: 1, y: 0 }
  return { x: v.x / m, y: v.y / m }
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

function buildKeyData(keys: Key[]): KeyData[] {
  return keys.map((k) => {
    const c = getKeyCenter(k)
    const angle = k.rotation_angle ?? 0
    const rad = (angle * Math.PI) / 180
    const cos = Math.cos(rad)
    const sin = Math.sin(rad)
    return {
      center: c,
      rowAxis: { x: cos, y: sin },
      colAxis: { x: -sin, y: cos },
      rotated: Math.abs(angle) > 1e-6,
    }
  })
}

/**
 * Test whether vector `v` represents a directional neighbor link given an axis frame.
 *
 * @param axis  Unit vector along the link direction (e.g. row axis).
 * @param perp  Unit vector perpendicular to `axis` (used as the cross-axis).
 * @param positive  True for "next" (+axis), false for "previous" (-axis).
 * @param perpBand  Max allowed perpendicular drift.
 */
function passesAxisTest(
  v: Vec2,
  axis: Vec2,
  perp: Vec2,
  positive: boolean,
  perpBand: number,
): boolean {
  const ap = dot(v, axis)
  const pp = dot(v, perp)
  if (positive ? ap < MIN_AXIS : ap > -MIN_AXIS) return false
  if (Math.abs(pp) > perpBand) return false
  return true
}

const WORLD_X: Vec2 = { x: 1, y: 0 }
const WORLD_Y: Vec2 = { x: 0, y: 1 }

/**
 * Find the best "next" neighbor along the requested axis (row or col).
 *
 * A candidate passes if EITHER:
 *  - **Local frame** — `v` is "right" (or "down") in `i`'s local frame AND `-v` is
 *    "left" (or "up") in `j`'s local frame, with both perpendicular drifts within band.
 *  - **World frame** — `v` is "right" (or "down") in world coords with perpendicular
 *    drift within band.
 *
 * The OR captures both within-rotation-island links (along the local rotated axis) and
 * cross-rotation-island links (along world axes when a thumb cluster's first key meets
 * the main matrix, or when splayed columns share a row).
 *
 * Score is link distance; on near-tie, prefer the candidate that passed the local test
 * (cleaner geometry).
 */
function findBestNeighbor(
  i: number,
  data: KeyData[],
  axisField: 'rowAxis' | 'colAxis',
): number {
  const di = data[i]!
  const perpField: 'rowAxis' | 'colAxis' = axisField === 'rowAxis' ? 'colAxis' : 'rowAxis'
  const worldAxis = axisField === 'rowAxis' ? WORLD_X : WORLD_Y
  const worldPerp = axisField === 'rowAxis' ? WORLD_Y : WORLD_X
  let best = -1
  let bestScore = Infinity
  for (let j = 0; j < data.length; j++) {
    if (j === i) continue
    const dj = data[j]!
    const v: Vec2 = { x: dj.center.x - di.center.x, y: dj.center.y - di.center.y }
    const dist = Math.hypot(v.x, v.y)
    if (dist < 0.05 || dist > MAX_LINK_DIST) continue

    // Local frame test (symmetric: both i and j must agree). Only enabled when both keys
    // carry a meaningful rotation — otherwise the local axes equal the world axes and a
    // looser local band would just over-link adjacent rows on staggered ortho layouts.
    const vNeg: Vec2 = { x: -v.x, y: -v.y }
    const localApplicable = di.rotated && dj.rotated
    const localOk =
      localApplicable &&
      passesAxisTest(v, di[axisField], di[perpField], true, PERP_BAND_LOCAL) &&
      passesAxisTest(vNeg, dj[axisField], dj[perpField], false, PERP_BAND_LOCAL)

    // World frame test (tighter band — catches links between rotation islands and within
    // unrotated regions).
    const worldOk = passesAxisTest(v, worldAxis, worldPerp, true, PERP_BAND_WORLD)

    if (!localOk && !worldOk) continue

    // Prefer local-frame matches by a tiny epsilon — keeps within-column chains intact
    // when a slightly closer cross-frame candidate also exists.
    const score = dist + (localOk ? 0 : 0.05)
    if (score < bestScore) {
      bestScore = score
      best = j
    }
  }
  return best
}

/**
 * Snap each key's projection to the nearest integer, then re-index to dense `0..N-1`.
 */
function perKeySnappedBands(n: number, proj: (i: number) => number): number[] {
  const raw: number[] = []
  for (let i = 0; i < n; i++) raw.push(Math.round(proj(i)))
  const sorted = [...new Set(raw)].sort((a, b) => a - b)
  const remap = new Map<number, number>()
  sorted.forEach((v, i) => remap.set(v, i))
  return raw.map((v) => remap.get(v)!)
}

/**
 * For each chain, snap its members' median projection to the nearest integer to get a
 * raw band index. Then re-index those raw values to a dense `0..N-1` range.
 */
function chainsToSnappedBands(chainIds: number[], proj: (i: number) => number): number[] {
  const chains = new Map<number, number[]>()
  chainIds.forEach((cid, i) => {
    if (!chains.has(cid)) chains.set(cid, [])
    chains.get(cid)!.push(i)
  })

  const chainBand = new Map<number, number>()
  chains.forEach((members, cid) => {
    chainBand.set(cid, Math.round(median(members.map(proj))))
  })

  const sorted = [...new Set(chainBand.values())].sort((a, b) => a - b)
  const remap = new Map<number, number>()
  sorted.forEach((v, i) => remap.set(v, i))

  return chainIds.map((cid) => remap.get(chainBand.get(cid)!)!)
}

export const pathAnnotationAlgorithm: AnnotationAlgorithm = {
  name: 'path',
  description:
    'Rotation-aware pathfinding. Each key contributes a local row/col axis derived from ' +
    'its rotation; right/down neighbors pass if they fit the cone in either the local ' +
    'frame (catches a splayed column\'s within-column down-links) or the world frame ' +
    '(catches cross-rotation-island row links). Row/col chains form via union-find. ' +
    'Row index = per-key Math.round of projection along avgCol (chains may legitimately ' +
    'span multiple matrix rows on curved thumb clusters). Col index = per-chain median ' +
    'projection along avgRow, snapped, densified. Per-row collisions resolve by shifting ' +
    'to the next free col — no key is ever dropped.',

  annotate(keys: ReadonlyArray<Key>): AnnotationResult {
    const warnings: AnnotationWarning[] = []
    const assignments: (RowColAssignment | null)[] = keys.map((k) =>
      isRegular(k) ? { row: null, col: null } : null,
    )

    const origIdx: number[] = []
    const regular: Key[] = []
    keys.forEach((k, i) => {
      if (!isRegular(k)) return
      origIdx.push(i)
      regular.push(k as Key)
    })
    const n = regular.length
    if (n === 0) return { assignments, status: 'success', warnings }

    const data = buildKeyData(regular)

    // Step 1: build directional neighbor links and chain via union-find.
    const rowUF = new UnionFind(n)
    const colUF = new UnionFind(n)
    for (let i = 0; i < n; i++) {
      const r = findBestNeighbor(i, data, 'rowAxis')
      if (r >= 0) rowUF.union(i, r)
      const d = findBestNeighbor(i, data, 'colAxis')
      if (d >= 0) colUF.union(i, d)
    }

    const rowChainIds = Array.from({ length: n }, (_, i) => rowUF.find(i))
    const colChainIds = Array.from({ length: n }, (_, i) => colUF.find(i))

    // Step 2: pick projection axes. Mean rowAxis across all keys, snapped to world axes
    // when very close (a few rotated thumbs shouldn't tilt the projection enough to
    // push a 4.5 down to 4.496 and round wrong).
    let sumRX = 0
    let sumRY = 0
    for (const d of data) {
      sumRX += d.rowAxis.x
      sumRY += d.rowAxis.y
    }
    let avgRow = normalize({ x: sumRX, y: sumRY })
    if (Math.abs(avgRow.y) < 0.05 && avgRow.x > 0) avgRow = { x: 1, y: 0 }
    const avgCol: Vec2 = { x: -avgRow.y, y: avgRow.x }

    // Project onto cross-axis to get a 1D position for sorting:
    //  - row band is determined by projection along avgCol
    //  - col band is determined by projection along avgRow
    const projForRow = (i: number) => dot(data[i]!.center, avgCol)
    const projForCol = (i: number) => dot(data[i]!.center, avgRow)

    // Step 3: convert chains to dense band indices via median projection + integer snap.
    //
    // For *rows*, snap each KEY individually rather than each chain — a row chain may
    // span several matrix rows when keys are arranged on a curve (4x6's thumb cluster
    // links 8 keys across two thumb rows because each adjacent pair has ~0.13u drift).
    // Per-key snap matches what cluster/current compute via Math.round(world Y).
    //
    // For *cols*, snap by chain median — col chains are normally vertical streams of
    // 1u-spaced keys with no curving, so the chain-median snap correctly identifies
    // each column even when columns have non-integer X (e.g. column-splay layouts).
    const rowIdx = perKeySnappedBands(n, projForRow)
    const tentativeCol = chainsToSnappedBands(colChainIds, projForCol)

    // Step 4: per-row collision resolution. Two col-chains may have ended up in the same
    // row (e.g. a thumb cluster meeting the main matrix at a corner) — shift duplicates
    // along the column axis to the next free integer slot.
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
        return projForCol(a) - projForCol(b)
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
