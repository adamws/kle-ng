import type { Key } from '@/stores/keyboard'
import { getKeyCenter } from '@/utils/keyboard-geometry'
import { clusterAnnotationAlgorithm } from './cluster'
import type {
  AnnotationAlgorithm,
  AnnotationResult,
  AnnotationWarning,
  RowColAssignment,
} from './types'

/** Position match tolerance for twin keys (keyboard units). */
const POS_TOL = 0.05
/** Rotation match tolerance for twin keys (degrees). */
const ROT_TOL = 0.5
/** A key is "on the axis" if |mirror_x - cx| is below this. */
const SELF_TOL = 0.05

interface Center {
  x: number
  y: number
}

interface SymmetryPair {
  /** Index into the regular-keys array; key with cx < axis. */
  leftIdx: number
  /** Index into the regular-keys array; key with cx > axis. */
  rightIdx: number
}

interface SymmetryInfo {
  axis: number
  /** Mirror pairs (leftIdx, rightIdx). */
  pairs: SymmetryPair[]
  /** Self-paired keys lying on the axis. */
  centerIdxs: number[]
}

function isRegular(key: Key): boolean {
  return !key.ghost && !key.decal
}

/**
 * Detect left-right mirror symmetry in `regulars` using the bounding-box
 * midline as the axis. Returns null unless every regular key has either a
 * mirror twin (within position + rotation tolerance) or sits on the axis
 * itself. Strict by design — partial symmetry is rejected.
 */
export function detectSymmetry(regulars: Key[], centers: Center[]): SymmetryInfo | null {
  const n = regulars.length
  if (n === 0) return null

  let xmin = Infinity
  let xmax = -Infinity
  for (const c of centers) {
    if (c.x < xmin) xmin = c.x
    if (c.x > xmax) xmax = c.x
  }
  const axis = (xmin + xmax) / 2

  const matched = new Array<boolean>(n).fill(false)
  const pairs: SymmetryPair[] = []
  const centerIdxs: number[] = []

  for (let i = 0; i < n; i++) {
    if (matched[i]) continue
    const ci = centers[i]!
    const ri = regulars[i]!.rotation_angle ?? 0
    const mirrorX = 2 * axis - ci.x

    if (Math.abs(mirrorX - ci.x) < SELF_TOL) {
      // Self-pair: key lies on the axis. Rotation must also be ~0 to mirror to itself.
      if (Math.abs(ri) > ROT_TOL) return null
      matched[i] = true
      centerIdxs.push(i)
      continue
    }

    let bestJ = -1
    let bestDist = Infinity
    for (let j = 0; j < n; j++) {
      if (j === i || matched[j]) continue
      const cj = centers[j]!
      const rj = regulars[j]!.rotation_angle ?? 0
      if (Math.abs(rj + ri) > ROT_TOL) continue
      const dx = cj.x - mirrorX
      const dy = cj.y - ci.y
      if (Math.abs(dx) > POS_TOL || Math.abs(dy) > POS_TOL) continue
      const d = Math.hypot(dx, dy)
      if (d < bestDist) {
        bestDist = d
        bestJ = j
      }
    }
    if (bestJ < 0) return null

    matched[i] = true
    matched[bestJ] = true
    const left = ci.x < centers[bestJ]!.x ? i : bestJ
    const right = left === i ? bestJ : i
    pairs.push({ leftIdx: left, rightIdx: right })
  }

  // Sanity: every regular key must be in matched.
  for (let i = 0; i < n; i++) {
    if (!matched[i]) return null
  }

  return { axis, pairs, centerIdxs }
}

interface BaseAssignments {
  /** Row index for regular key i (index into regulars[]). */
  rows: number[]
  /** Col index for regular key i. */
  cols: number[]
}

/**
 * Apply mirror symmetry to base assignments. Right-side keys are forced to
 * `(left.row, totalCols - 1 - left.col)`. Center keys are validated to sit on
 * the symmetry col `(totalCols - 1) / 2`; otherwise we bail out.
 *
 * Returns null if symmetry cannot be applied cleanly (caller should fall back
 * to the base assignments unchanged).
 */
function enforceSymmetry(
  base: BaseAssignments,
  info: SymmetryInfo,
): { rows: number[]; cols: number[] } | null {
  let totalCols = 0
  for (const c of base.cols) {
    if (c + 1 > totalCols) totalCols = c + 1
  }

  // Validate center keys: their col must equal its own mirror.
  for (const ci of info.centerIdxs) {
    const c = base.cols[ci]!
    const mirror = totalCols - 1 - c
    if (mirror !== c) return null
  }

  const rows = base.rows.slice()
  const cols = base.cols.slice()

  for (const { leftIdx, rightIdx } of info.pairs) {
    const lr = base.rows[leftIdx]!
    const lc = base.cols[leftIdx]!
    rows[rightIdx] = lr
    cols[rightIdx] = totalCols - 1 - lc
  }

  // Densify rows and cols (gaps may have appeared after rewriting).
  const denseRows = densify(rows)
  const denseCols = densify(cols)
  return { rows: denseRows, cols: denseCols }
}

function densify(values: number[]): number[] {
  const unique = [...new Set(values)].sort((a, b) => a - b)
  const remap = new Map<number, number>()
  unique.forEach((v, i) => remap.set(v, i))
  return values.map((v) => remap.get(v)!)
}

export const clusterSymmetryAnnotationAlgorithm: AnnotationAlgorithm = {
  name: 'cluster-sym',
  description:
    'Cluster algorithm followed by a symmetry-enforcement pass: when the layout ' +
    'is left-right mirror symmetric (every regular key has a twin or sits on the ' +
    'bounding-box midline), each right-side key is forced to (left.row, ' +
    'totalCols-1-left.col). Falls back to plain cluster output when symmetry is ' +
    'not detected.',

  annotate(keys: ReadonlyArray<Key>): AnnotationResult {
    const base = clusterAnnotationAlgorithm.annotate(keys)
    if (base.status !== 'success') {
      return {
        ...base,
        meta: {
          ...(base.meta ?? {}),
          symmetry: 'fallback',
          symmetryFallbackReason: 'base-not-success',
        },
      }
    }

    // Build regular-keys index and corresponding base assignments.
    const origIdx: number[] = []
    const regulars: Key[] = []
    const centers: Center[] = []
    const baseRows: number[] = []
    const baseCols: number[] = []
    keys.forEach((k, i) => {
      if (!isRegular(k)) return
      const a = base.assignments[i]
      if (!a || a.row == null || a.col == null) return
      origIdx.push(i)
      regulars.push(k as Key)
      centers.push(getKeyCenter(k as Key))
      baseRows.push(a.row)
      baseCols.push(a.col)
    })
    if (regulars.length === 0) {
      return {
        ...base,
        meta: {
          ...(base.meta ?? {}),
          symmetry: 'fallback',
          symmetryFallbackReason: 'no-regular-keys',
        },
      }
    }

    const info = detectSymmetry(regulars, centers)
    const warnings: AnnotationWarning[] = [...base.warnings]

    if (!info) {
      warnings.push({
        kind: 'algorithm-specific',
        message: 'Layout is not left-right mirror symmetric; using cluster output unchanged.',
      })
      return {
        ...base,
        warnings,
        meta: {
          ...(base.meta ?? {}),
          symmetry: 'fallback',
          symmetryFallbackReason: 'unpaired-key',
        },
      }
    }

    const enforced = enforceSymmetry({ rows: baseRows, cols: baseCols }, info)
    if (!enforced) {
      warnings.push({
        kind: 'algorithm-specific',
        message:
          `Layout has center key(s) that don't sit on the symmetry column ` +
          `(even total-cols around the axis); using cluster output unchanged.`,
      })
      return {
        ...base,
        warnings,
        meta: {
          ...(base.meta ?? {}),
          symmetry: 'fallback',
          symmetryFallbackReason: 'center-conflict',
        },
      }
    }

    // Build output assignments index-aligned with input keys.
    const assignments: (RowColAssignment | null)[] = keys.map((k) =>
      isRegular(k) ? { row: null, col: null } : null,
    )
    for (let i = 0; i < origIdx.length; i++) {
      const a = assignments[origIdx[i]!]
      if (!a) continue
      a.row = enforced.rows[i]!
      a.col = enforced.cols[i]!
    }

    warnings.push({
      kind: 'algorithm-specific',
      message: `Enforced mirror symmetry on ${info.pairs.length} pair(s) around x = ${info.axis.toFixed(3)}.`,
    })

    return {
      assignments,
      status: 'success',
      warnings,
      meta: {
        ...(base.meta ?? {}),
        symmetry: 'enforced',
        symmetryAxis: info.axis,
        symmetryPairs: info.pairs.length,
        symmetryCenterKeys: info.centerIdxs.length,
      },
    }
  },
}
