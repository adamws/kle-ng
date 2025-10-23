/**
 * Utility functions for extracting and working with matrix assignments from VIA-annotated layouts.
 */

import type { Key } from '@/stores/keyboard'

/**
 * Parse VIA label to extract row and column numbers
 * VIA format: "row,col" where row and col are integers (e.g., "0,0", "1,5", "2,10")
 * @param label - The label string from key.labels[0]
 * @returns Object with row and col numbers, or null if invalid format
 */
function parseViaLabel(label: string | undefined): { row: number; col: number } | null {
  if (!label || typeof label !== 'string') return null

  const viaPattern = /^(\d+),(\d+)$/
  const match = label.trim().match(viaPattern)

  if (!match) return null

  return {
    row: parseInt(match[1], 10),
    col: parseInt(match[2], 10),
  }
}

/**
 * Extract row and column assignments from VIA-annotated keys
 * @param keys - Array of keys with VIA labels (format: "row,col" in labels[0])
 * @returns Object with rows and cols Maps, where the key is the row/col number
 */
export function extractMatrixAssignments(keys: Key[]): {
  rows: Map<number, Key[]>
  cols: Map<number, Key[]>
} {
  const rows = new Map<number, Key[]>()
  const cols = new Map<number, Key[]>()

  // Filter out decal and ghost keys
  const regularKeys = keys.filter((key) => !key.decal && !key.ghost)

  regularKeys.forEach((key) => {
    // VIA annotations are in labels[0] (top-left position)
    const label = key.labels?.[0]
    const parsed = parseViaLabel(label)

    if (!parsed) return // Skip keys without valid VIA labels

    const { row, col } = parsed

    // Add key to row map
    if (!rows.has(row)) {
      rows.set(row, [])
    }
    rows.get(row)!.push(key)

    // Add key to column map
    if (!cols.has(col)) {
      cols.set(col, [])
    }
    cols.get(col)!.push(key)
  })

  // Sort keys within each row/column by their position
  // For rows: sort by X position (left to right)
  // For columns: sort by Y position (top to bottom)
  rows.forEach((keyList) => {
    keyList.sort((a, b) => a.x - b.x)
  })

  cols.forEach((keyList) => {
    keyList.sort((a, b) => a.y - b.y)
  })

  return { rows, cols }
}

/**
 * Check if two keys share the same row based on VIA labels
 * @param key1 - First key
 * @param key2 - Second key
 * @returns true if both keys have valid VIA labels with the same row number
 */
export function keysShareRow(key1: Key, key2: Key): boolean {
  const label1 = parseViaLabel(key1.labels?.[0])
  const label2 = parseViaLabel(key2.labels?.[0])

  if (!label1 || !label2) return false

  return label1.row === label2.row
}

/**
 * Check if two keys share the same column based on VIA labels
 * @param key1 - First key
 * @param key2 - Second key
 * @returns true if both keys have valid VIA labels with the same column number
 */
export function keysShareColumn(key1: Key, key2: Key): boolean {
  const label1 = parseViaLabel(key1.labels?.[0])
  const label2 = parseViaLabel(key2.labels?.[0])

  if (!label1 || !label2) return false

  return label1.col === label2.col
}

/**
 * Get the row number for a key from its VIA label
 * @param key - The key to check
 * @returns Row number, or undefined if key doesn't have a valid VIA label
 */
export function getKeyRow(key: Key): number | undefined {
  const parsed = parseViaLabel(key.labels?.[0])
  return parsed?.row
}

/**
 * Get the column number for a key from its VIA label
 * @param key - The key to check
 * @returns Column number, or undefined if key doesn't have a valid VIA label
 */
export function getKeyColumn(key: Key): number | undefined {
  const parsed = parseViaLabel(key.labels?.[0])
  return parsed?.col
}
