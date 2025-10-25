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
 * Parse VIA matrix label with support for partial annotations
 * @param label - The label string from key.labels[0]
 * @returns Object with row and col numbers (can be null for partial assignments)
 */
function parseViaLabelWithPartial(
  label: string | undefined,
): { row: number | null; col: number | null } | null {
  if (!label || typeof label !== 'string') return null

  const trimmed = label.trim()

  // Handle complete "row,col" format
  const completePattern = /^(\d+),(\d+)$/
  const completeMatch = trimmed.match(completePattern)
  if (completeMatch) {
    return {
      row: parseInt(completeMatch[1], 10),
      col: parseInt(completeMatch[2], 10),
    }
  }

  // Handle row-only format "row,"
  const rowOnlyPattern = /^(\d+),$/
  const rowOnlyMatch = trimmed.match(rowOnlyPattern)
  if (rowOnlyMatch) {
    return {
      row: parseInt(rowOnlyMatch[1], 10),
      col: null,
    }
  }

  // Handle column-only format ",col"
  const colOnlyPattern = /^,(\d+)$/
  const colOnlyMatch = trimmed.match(colOnlyPattern)
  if (colOnlyMatch) {
    return {
      row: null,
      col: parseInt(colOnlyMatch[1], 10),
    }
  }

  return null
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
 * Extract row and column assignments from VIA-annotated keys with support for partial annotations
 * @param keys - Array of keys with VIA labels (can be "row,col", "row,", or ",col")
 * @returns Object with rows and cols Maps, where the key is the row/col number
 */
export function extractMatrixAssignmentsWithPartial(keys: Key[]): {
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
    const parsed = parseViaLabelWithPartial(label)

    if (!parsed) return // Skip keys without valid VIA labels

    const { row, col } = parsed

    // Add key to row map if row is assigned
    if (row !== null) {
      if (!rows.has(row)) {
        rows.set(row, [])
      }
      rows.get(row)!.push(key)
    }

    // Add key to column map if column is assigned
    if (col !== null) {
      if (!cols.has(col)) {
        cols.set(col, [])
      }
      cols.get(col)!.push(key)
    }
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

/**
 * Interface for rotation group information
 */
export interface RotationGroup {
  rotationAngle: number
  rotationX: number | undefined
  rotationY: number | undefined
  keys: Key[]
}

/**
 * Split layout into groups with same rotation value and rotation reference point
 * @param keys - Array of keys to process
 * @returns Array of rotation groups
 */
export function splitLayoutByRotation(keys: Key[]): RotationGroup[] {
  const groups: RotationGroup[] = []
  const processedKeys = new Set<Key>()

  for (const key of keys) {
    if (processedKeys.has(key)) continue

    const rotationAngle = key.rotation_angle || 0
    const rotationX = key.rotation_x
    const rotationY = key.rotation_y

    // Find all keys with the same rotation properties
    const groupKeys = keys.filter((otherKey) => {
      if (processedKeys.has(otherKey)) return false

      const otherRotationAngle = otherKey.rotation_angle || 0
      const otherRotationX = otherKey.rotation_x
      const otherRotationY = otherKey.rotation_y

      // Compare rotation angles (handle floating point precision)
      const angleMatch = Math.abs(rotationAngle - otherRotationAngle) < 1e-6

      // Compare rotation origins (handle undefined values)
      const xMatch =
        (rotationX === undefined && otherRotationX === undefined) ||
        (rotationX !== undefined &&
          otherRotationX !== undefined &&
          Math.abs(rotationX - otherRotationX) < 1e-6)
      const yMatch =
        (rotationY === undefined && otherRotationY === undefined) ||
        (rotationY !== undefined &&
          otherRotationY !== undefined &&
          Math.abs(rotationY - otherRotationY) < 1e-6)

      return angleMatch && xMatch && yMatch
    })

    // Add group if we found any keys
    if (groupKeys.length > 0) {
      groups.push({
        rotationAngle,
        rotationX,
        rotationY,
        keys: groupKeys,
      })

      // Mark keys as processed
      groupKeys.forEach((k) => processedKeys.add(k))
    }
  }

  return groups
}

/**
 * De-rotate layout groups by setting rotation to 0 for each group with non-zero rotation
 * This function stores the original rotation angle in the middle key label (index 6)
 * for proper restoration later.
 * @param groups - Array of rotation groups to process
 * @returns Array of processed keys with rotation set to 0
 */
export function deRotateLayoutGroups(groups: RotationGroup[]): Key[] {
  const processedKeys: Key[] = []

  for (const group of groups) {
    const { rotationAngle, keys } = group

    // Only process groups with non-zero rotation
    if (Math.abs(rotationAngle) < 1e-6) {
      processedKeys.push(...keys)
      continue
    }

    for (const key of keys) {
      // Store original rotation angle in middle key label (index 6) with a marker
      // Format: "DEROTATE:<angle>" to distinguish from other uses of label[6]
      const originalRotationAngle = `DEROTATE:${rotationAngle}`

      // Ensure labels array exists and has at least 7 elements
      if (!key.labels) {
        key.labels = Array(12).fill('')
      } else if (key.labels.length < 7) {
        // Extend labels array to have at least 7 elements
        key.labels = [...key.labels, ...Array(12 - key.labels.length).fill('')]
      }

      key.labels[6] = originalRotationAngle

      // Simply set rotation_angle to 0, keep all other properties unchanged
      key.rotation_angle = 0

      processedKeys.push(key)
    }
  }

  return processedKeys
}

/**
 * Restore original rotation from stored information in middle key label (index 6)
 * This function reads the stored rotation angle and restores the key to its original state
 * @param keys - Array of keys to restore
 * @returns Array of restored keys with original rotation
 */
export function restoreOriginalRotation(keys: Key[]): Key[] {
  const restoredKeys: Key[] = []

  for (const key of keys) {
    // Check if the key has stored rotation information in label[6]
    const storedRotationInfo = key.labels?.[6]

    if (!storedRotationInfo || typeof storedRotationInfo !== 'string') {
      // No stored rotation information, keep key as-is
      restoredKeys.push(key)
      continue
    }

    // Only process keys that have the DEROTATE marker
    // This prevents modifying keys that had label[6] already populated for other purposes
    if (!storedRotationInfo.startsWith('DEROTATE:')) {
      // Not a de-rotation marker, keep key as-is
      restoredKeys.push(key)
      continue
    }

    // Extract the angle from the marker format "DEROTATE:<angle>"
    const angleStr = storedRotationInfo.substring('DEROTATE:'.length)
    const angle = parseFloat(angleStr)

    // If we have valid rotation information, restore the key
    if (!isNaN(angle)) {
      // Simply restore the rotation angle
      key.rotation_angle = angle

      // Clear the stored rotation information
      if (key.labels && key.labels.length > 6) {
        key.labels[6] = ''
      }
    }

    restoredKeys.push(key)
  }

  return restoredKeys
}

// Export the parsing functions
export { parseViaLabel, parseViaLabelWithPartial }
