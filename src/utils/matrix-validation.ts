import type { Key } from '@/stores/keyboard'

/**
 * Parse matrix coordinates from a key's label
 * VIA format: "row,col" in labels[0]
 * Returns { row: number, col: number } or null if not assigned
 */
export function parseMatrixCoordinates(key: Key): { row: number | null; col: number | null } {
  if (!key.labels || key.labels.length === 0 || !key.labels[0]) {
    return { row: null, col: null }
  }

  const label = key.labels[0].trim()
  if (!label.includes(',')) {
    return { row: null, col: null }
  }

  const [rowStr, colStr] = label.split(',')

  const row = rowStr.trim() !== '' ? parseInt(rowStr, 10) : null
  const col = colStr.trim() !== '' ? parseInt(colStr, 10) : null

  return {
    row: row !== null && !isNaN(row) ? row : null,
    col: col !== null && !isNaN(col) ? col : null,
  }
}

/**
 * Check if a key already has a row assignment
 */
export function keyHasRowAssignment(key: Key): boolean {
  const coords = parseMatrixCoordinates(key)
  return coords.row !== null
}

/**
 * Check if a key already has a column assignment
 */
export function keyHasColumnAssignment(key: Key): boolean {
  const coords = parseMatrixCoordinates(key)
  return coords.col !== null
}

/**
 * Check if a specific matrix position (row, col) is already occupied by any key
 * @param row - The row index to check
 * @param col - The column index to check
 * @param keys - All keys to check against
 * @returns The key occupying this position, or null if free
 */
export function isMatrixPositionOccupied(row: number, col: number, keys: Key[]): Key | null {
  for (const key of keys) {
    if (key.ghost || key.decal) continue

    const coords = parseMatrixCoordinates(key)
    if (coords.row === row && coords.col === col) {
      return key
    }
  }
  return null
}

/**
 * Get all keys that already have a row assignment
 */
export function getKeysWithRowAssignments(keys: Key[]): Set<Key> {
  const keysWithRows = new Set<Key>()
  keys.forEach((key) => {
    if (key.ghost || key.decal) return
    if (keyHasRowAssignment(key)) {
      keysWithRows.add(key)
    }
  })
  return keysWithRows
}

/**
 * Get all keys that already have a column assignment
 */
export function getKeysWithColumnAssignments(keys: Key[]): Set<Key> {
  const keysWithCols = new Set<Key>()
  keys.forEach((key) => {
    if (key.ghost || key.decal) return
    if (keyHasColumnAssignment(key)) {
      keysWithCols.add(key)
    }
  })
  return keysWithCols
}
