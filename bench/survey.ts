/**
 * Survey: For each layout, run cluster and report sparse rows/cols that might
 * benefit from a post-processing optimization pass.
 */
import { algorithms } from '../src/utils/matrix-annotation'
import { loadCorpus } from './corpus'
import { getKeyCenter } from '../src/utils/keyboard-geometry'

const cluster = algorithms.find((a) => a.name === 'cluster')!
const corpus = loadCorpus()

interface Issue {
  layout: string
  numRows: number
  numCols: number
  rowFill: number[]
  colFill: number[]
  sparseRowMin: number
  sparseColMin: number
  sparseRowKeyCount: number
  sparseColKeyCount: number
}

const issues: Issue[] = []

for (const { name, keys } of corpus) {
  const result = cluster.annotate(keys)
  if (result.status !== 'success') continue

  const rowSet = new Map<number, number>()
  const colSet = new Map<number, number>()
  result.assignments.forEach((a) => {
    if (!a || a.row == null || a.col == null) return
    rowSet.set(a.row, (rowSet.get(a.row) ?? 0) + 1)
    colSet.set(a.col, (colSet.get(a.col) ?? 0) + 1)
  })

  const numRows = rowSet.size
  const numCols = colSet.size
  const rowFill = [...rowSet.entries()].sort((a, b) => a[0] - b[0]).map((e) => e[1])
  const colFill = [...colSet.entries()].sort((a, b) => a[0] - b[0]).map((e) => e[1])
  const sparseRowMin = Math.min(...rowFill)
  const sparseColMin = Math.min(...colFill)
  const sparseRowKeyCount = rowFill.filter((c) => c <= 3).length
  const sparseColKeyCount = colFill.filter((c) => c <= 3).length

  issues.push({
    layout: name,
    numRows,
    numCols,
    rowFill,
    colFill,
    sparseRowMin,
    sparseColMin,
    sparseRowKeyCount,
    sparseColKeyCount,
  })
}

// Sort by sparseness — most "abnormal" first
issues.sort((a, b) => {
  // sparse row/col minimum (1-2 keys is most concerning)
  const aMin = Math.min(a.sparseRowMin, a.sparseColMin)
  const bMin = Math.min(b.sparseRowMin, b.sparseColMin)
  if (aMin !== bMin) return aMin - bMin
  // then number of sparse rows/cols (more = worse)
  const aSparse = a.sparseRowKeyCount + a.sparseColKeyCount
  const bSparse = b.sparseRowKeyCount + b.sparseColKeyCount
  return bSparse - aSparse
})

console.log('Layouts with sparse rows/cols (potential optimization candidates):')
console.log('layout                              | matrix | rowFill                           | colFill')
for (const issue of issues) {
  if (issue.sparseRowMin > 2 && issue.sparseColMin > 2) continue
  console.log(
    `${issue.layout.padEnd(35)} | ${String(issue.numRows).padStart(2)}×${String(issue.numCols).padEnd(3)} | ${JSON.stringify(issue.rowFill).padEnd(33)} | ${JSON.stringify(issue.colFill)}`,
  )
}
