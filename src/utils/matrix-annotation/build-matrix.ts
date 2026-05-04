import type { Key } from '@/stores/keyboard'
import type { AnnotationResult, MatrixItem } from './types'

/**
 * Pure port of the MatrixCoordinatesModal's buildMatrixFromMap.
 * Converts a Map<"row,col", Key[]> into sequential MatrixItem arrays.
 * The raw row/col numbers in the map keys get re-indexed to 0,1,2,...
 */
export function computeRowsAndCols(matrixMap: Map<string, Key[]>): {
  rows: MatrixItem[]
  cols: MatrixItem[]
} {
  const rowIndices = new Set<number>()
  const colIndices = new Set<number>()

  matrixMap.forEach((_, matrixKey) => {
    const parts = matrixKey.split(',').map(Number)
    if (parts[0] !== undefined && !isNaN(parts[0])) rowIndices.add(parts[0])
    if (parts[1] !== undefined && !isNaN(parts[1])) colIndices.add(parts[1])
  })

  const sortedRows = Array.from(rowIndices).sort((a, b) => a - b)
  const sortedCols = Array.from(colIndices).sort((a, b) => a - b)

  const ts = Date.now()

  const rows: MatrixItem[] = sortedRows.map((rowIndex, idx) => {
    const keysInRow: Key[] = []
    matrixMap.forEach((keys, matrixKey) => {
      const [row] = matrixKey.split(',').map(Number)
      if (row === rowIndex) keysInRow.push(...keys)
    })
    keysInRow.sort((a, b) => a.x - b.x)
    return { id: `row-${idx}-${ts}`, index: idx, keySequence: keysInRow }
  })

  const cols: MatrixItem[] = sortedCols.map((colIndex, idx) => {
    const keysInCol: Key[] = []
    matrixMap.forEach((keys, matrixKey) => {
      const [, col] = matrixKey.split(',').map(Number)
      if (col === colIndex) keysInCol.push(...keys)
    })
    keysInCol.sort((a, b) => a.y - b.y)
    return { id: `col-${idx}-${ts}`, index: idx, keySequence: keysInCol }
  })

  return { rows, cols }
}

/**
 * Build MatrixItem rows/cols from an AnnotationResult, referencing original key objects.
 * Used by the Vue component's adapter so the drawing store receives the live key references.
 */
export function buildRowsColsFromResult(
  result: AnnotationResult,
  keys: ReadonlyArray<Key>,
): { rows: MatrixItem[]; cols: MatrixItem[] } {
  const rowMap = new Map<number, Key[]>()
  const colMap = new Map<number, Key[]>()

  result.assignments.forEach((a, i) => {
    if (!a || a.row === null || a.col === null) return
    const key = keys[i]!
    if (!rowMap.has(a.row)) rowMap.set(a.row, [])
    if (!colMap.has(a.col)) colMap.set(a.col, [])
    rowMap.get(a.row)!.push(key)
    colMap.get(a.col)!.push(key)
  })

  rowMap.forEach((list) => list.sort((a, b) => a.x - b.x))
  colMap.forEach((list) => list.sort((a, b) => a.y - b.y))

  const ts = Date.now()

  const sortedRowNums = Array.from(rowMap.keys()).sort((a, b) => a - b)
  const rows: MatrixItem[] = sortedRowNums.map((rowNum, idx) => ({
    id: `row-${idx}-${ts}`,
    index: idx,
    keySequence: rowMap.get(rowNum)!,
  }))

  const sortedColNums = Array.from(colMap.keys()).sort((a, b) => a - b)
  const cols: MatrixItem[] = sortedColNums.map((colNum, idx) => ({
    id: `col-${idx}-${ts}`,
    index: idx,
    keySequence: colMap.get(colNum)!,
  }))

  return { rows, cols }
}
