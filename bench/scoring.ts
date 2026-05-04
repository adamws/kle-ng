import type { Key } from '../src/stores/keyboard'
import type { AnnotationResult, AssignmentStatus } from '../src/utils/matrix-annotation'
import { getKeyCenter, getKeyDistance } from '../src/utils/keyboard-geometry'
import { parseOptionChoice } from '../src/utils/matrix-validation'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LayoutScore {
  algorithm: string
  layout: string
  status: AssignmentStatus
  qualified: boolean
  /** Number of unique row indices. */
  numRows: number
  /** Number of unique column indices. */
  numCols: number
  /** max(numRows, numCols) — primary compactness metric. */
  matrixMax: number
  /** numRows + numCols — tiebreaker. */
  matrixSum: number
  /** Total Euclidean wire length (row wires + col wires). */
  wireLength: number
  rowWireLength: number
  colWireLength: number
  /** Regular keys without a complete (row, col) assignment. */
  unassignedKeys: number
  durationMs: number
}

export interface BenchReport {
  scores: LayoutScore[]
  aggregate: {
    pareto: Record<string, { compactnessWins: number; wireLengthWins: number; qualified: number }>
    borda: Record<string, number>
    weighted: Record<string, number>
  }
}

// ---------------------------------------------------------------------------
// Connectivity filter (input-side — does not require labels to be set)
// ---------------------------------------------------------------------------

/**
 * Returns regular keys that participate in scoring.
 * Excludes ghost/decal and non-default layout variants (choice !== 0).
 */
export function getRegularKeysForScoring(keys: ReadonlyArray<Key>): Key[] {
  return keys.filter((k) => {
    if (k.ghost || k.decal) return false
    const oc = parseOptionChoice(k)
    return !oc || oc.choice === 0
  }) as Key[]
}

// ---------------------------------------------------------------------------
// Wire length
// ---------------------------------------------------------------------------

export function calculateWireLength(
  keys: ReadonlyArray<Key>,
  assignments: AnnotationResult['assignments'],
): { row: number; col: number; total: number } {
  const byRow = new Map<number, Key[]>()
  const byCol = new Map<number, Key[]>()

  keys.forEach((k, i) => {
    const a = assignments[i]
    if (!a || a.row === null || a.col === null) return
    if (!byRow.has(a.row)) byRow.set(a.row, [])
    if (!byCol.has(a.col)) byCol.set(a.col, [])
    byRow.get(a.row)!.push(k as Key)
    byCol.get(a.col)!.push(k as Key)
  })

  let rowTotal = 0
  for (const list of byRow.values()) {
    list.sort((a, b) => getKeyCenter(a).x - getKeyCenter(b).x)
    for (let i = 1; i < list.length; i++) rowTotal += getKeyDistance(list[i - 1]!, list[i]!)
  }

  let colTotal = 0
  for (const list of byCol.values()) {
    list.sort((a, b) => getKeyCenter(a).y - getKeyCenter(b).y)
    for (let i = 1; i < list.length; i++) colTotal += getKeyDistance(list[i - 1]!, list[i]!)
  }

  return { row: rowTotal, col: colTotal, total: rowTotal + colTotal }
}

// ---------------------------------------------------------------------------
// Score a single result
// ---------------------------------------------------------------------------

export function scoreResult(
  algorithmName: string,
  layoutName: string,
  keys: ReadonlyArray<Key>,
  result: AnnotationResult,
  durationMs: number,
): LayoutScore {
  const regular = getRegularKeysForScoring(keys)

  const unassignedKeys = regular.filter((k, _) => {
    const i = (keys as Key[]).indexOf(k)
    const a = result.assignments[i]
    return !a || a.row === null || a.col === null
  }).length

  const qualified = unassignedKeys === 0 && result.status !== 'disqualified'

  if (!qualified) {
    return {
      algorithm: algorithmName,
      layout: layoutName,
      status: result.status,
      qualified: false,
      numRows: 0,
      numCols: 0,
      matrixMax: Infinity,
      matrixSum: Infinity,
      wireLength: Infinity,
      rowWireLength: Infinity,
      colWireLength: Infinity,
      unassignedKeys,
      durationMs,
    }
  }

  const rowIndices = new Set<number>()
  const colIndices = new Set<number>()
  result.assignments.forEach((a) => {
    if (!a || a.row === null || a.col === null) return
    rowIndices.add(a.row)
    colIndices.add(a.col)
  })

  const numRows = rowIndices.size
  const numCols = colIndices.size
  const { row: rowWireLength, col: colWireLength, total: wireLength } = calculateWireLength(
    keys,
    result.assignments,
  )

  return {
    algorithm: algorithmName,
    layout: layoutName,
    status: result.status,
    qualified: true,
    numRows,
    numCols,
    matrixMax: Math.max(numRows, numCols),
    matrixSum: numRows + numCols,
    wireLength,
    rowWireLength,
    colWireLength,
    unassignedKeys: 0,
    durationMs,
  }
}

// ---------------------------------------------------------------------------
// Aggregate ranking
// ---------------------------------------------------------------------------

export function computeAggregate(scores: LayoutScore[]): BenchReport['aggregate'] {
  const layouts = [...new Set(scores.map((s) => s.layout))]
  const algos = [...new Set(scores.map((s) => s.algorithm))]

  const pareto: BenchReport['aggregate']['pareto'] = {}
  const borda: Record<string, number> = {}
  const weighted: Record<string, number> = {}

  algos.forEach((a) => {
    pareto[a] = { compactnessWins: 0, wireLengthWins: 0, qualified: 0 }
    borda[a] = 0
    weighted[a] = 0
  })

  for (const layout of layouts) {
    const layoutScores = scores.filter((s) => s.layout === layout)
    const qualified = layoutScores.filter((s) => s.qualified)

    // Count qualified layouts per algo
    layoutScores.forEach((s) => {
      if (s.qualified) pareto[s.algorithm]!.qualified++
    })

    if (qualified.length === 0) continue

    // Pareto wins — per criterion
    const minMax = Math.min(...qualified.map((s) => s.matrixMax))
    const minWire = Math.min(...qualified.map((s) => s.wireLength))

    qualified
      .filter((s) => s.matrixMax === minMax)
      .forEach((s) => pareto[s.algorithm]!.compactnessWins++)
    qualified
      .filter((s) => Math.abs(s.wireLength - minWire) < 0.001)
      .forEach((s) => pareto[s.algorithm]!.wireLengthWins++)

    // Borda — rank by (matrixMax asc, matrixSum asc, wireLength asc)
    const ranked = [...qualified].sort(
      (a, b) =>
        a.matrixMax - b.matrixMax ||
        a.matrixSum - b.matrixSum ||
        a.wireLength - b.wireLength,
    )
    ranked.forEach((s, rank) => {
      borda[s.algorithm]! += ranked.length - rank
    })
    // Disqualified get 0 points
    layoutScores
      .filter((s) => !s.qualified)
      .forEach((s) => {
        borda[s.algorithm] ??= 0
      })

    // Weighted normalized (0.5 compactness + 0.5 wire length)
    const maxForNorm = (arr: number[]) => Math.max(...arr.filter(isFinite)) || 1
    const maxMax = maxForNorm(layoutScores.map((s) => s.matrixMax))
    const maxWire = maxForNorm(layoutScores.map((s) => s.wireLength))

    layoutScores.forEach((s) => {
      const maxNorm = s.qualified ? s.matrixMax / maxMax : 1
      const wireNorm = s.qualified ? s.wireLength / maxWire : 1
      weighted[s.algorithm]! += 0.5 * maxNorm + 0.5 * wireNorm
    })
  }

  return { pareto, borda, weighted }
}
