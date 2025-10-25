import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type { Key } from './keyboard'
import {
  keyHasRowAssignment,
  keyHasColumnAssignment,
  getKeysWithRowAssignments,
  getKeysWithColumnAssignments,
  parseMatrixCoordinates,
} from '@/utils/matrix-validation'

export const useMatrixDrawingStore = defineStore('matrix-drawing', () => {
  // Drawing state
  const drawingType = ref<'row' | 'column' | null>(null)
  const currentSequence = ref<Key[]>([])
  const completedRows = ref<Map<number, Key[]>>(new Map())
  const completedColumns = ref<Map<number, Key[]>>(new Map())

  // Track if we're continuing an existing row/column (index of the row/column being continued)
  const continuingRowIndex = ref<number | null>(null)
  const continuingColumnIndex = ref<number | null>(null)

  // Sensitivity for line intersection (0.0 = most permissive, 1.0 = strictest)
  // Default 0.3 provides good balance between catching intended keys and avoiding "barely touched" keys
  const sensitivity = ref<number>(0.3)

  // Flag to skip coordinate re-application after context menu removal
  const skipNextSync = ref<boolean>(false)

  // Computed
  const isDrawing = computed(() => drawingType.value !== null)
  const hasDrawings = computed(
    () => completedRows.value.size > 0 || completedColumns.value.size > 0,
  )

  /**
   * Find the next free (unused) row number
   * Searches from 0 upward to find the first number not in use
   * This ensures gaps are filled when rows are removed
   */
  const findNextFreeRowNumber = (): number => {
    let num = 0
    while (completedRows.value.has(num)) {
      num++
    }
    return num
  }

  /**
   * Find the next free (unused) column number
   * Searches from 0 upward to find the first number not in use
   * This ensures gaps are filled when columns are removed
   */
  const findNextFreeColumnNumber = (): number => {
    let num = 0
    while (completedColumns.value.has(num)) {
      num++
    }
    return num
  }

  // Actions
  const enableDrawing = (type: 'row' | 'column') => {
    drawingType.value = type
    currentSequence.value = []
  }

  const disableDrawing = () => {
    drawingType.value = null
    currentSequence.value = []
    continuingRowIndex.value = null
    continuingColumnIndex.value = null
  }

  const addKeyToSequence = (key: Key) => {
    currentSequence.value.push(key)
  }

  const completeSequence = () => {
    if (currentSequence.value.length === 0) return

    if (drawingType.value === 'row') {
      if (continuingRowIndex.value !== null) {
        // Merge with existing row - add only new keys that aren't already in the row
        const existingRow = completedRows.value.get(continuingRowIndex.value)
        if (existingRow) {
          const newKeys = currentSequence.value.filter((key) => !existingRow.includes(key))
          completedRows.value.set(continuingRowIndex.value, [...existingRow, ...newKeys])
        }
        continuingRowIndex.value = null // Reset continuation state
      } else {
        // Create new row with next free number (fills gaps from removed rows)
        completedRows.value.set(findNextFreeRowNumber(), [...currentSequence.value])
      }
    } else if (drawingType.value === 'column') {
      if (continuingColumnIndex.value !== null) {
        // Merge with existing column - add only new keys that aren't already in the column
        const existingCol = completedColumns.value.get(continuingColumnIndex.value)
        if (existingCol) {
          const newKeys = currentSequence.value.filter((key) => !existingCol.includes(key))
          completedColumns.value.set(continuingColumnIndex.value, [...existingCol, ...newKeys])
        }
        continuingColumnIndex.value = null // Reset continuation state
      } else {
        // Create new column with next free number (fills gaps from removed columns)
        completedColumns.value.set(findNextFreeColumnNumber(), [...currentSequence.value])
      }
    }

    currentSequence.value = []
  }

  const clearCurrentSequence = () => {
    currentSequence.value = []
    continuingRowIndex.value = null
    continuingColumnIndex.value = null
  }

  const clearDrawings = () => {
    completedRows.value.clear()
    completedColumns.value.clear()
    currentSequence.value = []
    continuingRowIndex.value = null
    continuingColumnIndex.value = null
  }

  const getCompletedDrawings = () => {
    return {
      rows: completedRows.value,
      columns: completedColumns.value,
    }
  }

  const setSensitivity = (value: number) => {
    // Clamp between 0 and 1
    sensitivity.value = Math.max(0, Math.min(1, value))
  }

  /**
   * Check if a key can be added to the current sequence without violating matrix rules
   * @param key - The key to check
   * @param allKeys - All keyboard keys (to check for existing assignments)
   * @returns true if the key can be added, false if it would create a conflict
   */
  const canAddKeyToSequence = (key: Key, allKeys: Key[]): boolean => {
    // Keys already in current sequence can always be "re-added" (they'll be filtered out by caller)
    if (currentSequence.value.includes(key)) {
      return true
    }

    const coords = parseMatrixCoordinates(key)

    // Check based on drawing type
    if (drawingType.value === 'row') {
      // If key already has a row assignment, check if we can continue that row
      if (keyHasRowAssignment(key)) {
        // If this is the first key in the sequence, we're starting to continue an existing row
        if (currentSequence.value.length === 0) {
          // Find which completed row this key belongs to
          let foundRowIndex: number | null = null
          completedRows.value.forEach((row, rowIndex) => {
            if (row.includes(key)) {
              foundRowIndex = rowIndex
            }
          })
          if (foundRowIndex !== null) {
            // Mark that we're continuing this row
            continuingRowIndex.value = foundRowIndex
            return true
          }
          // Key has a row but not in our completed rows (shouldn't happen, but reject to be safe)
          return false
        }

        // If we're already continuing a row, check if this key belongs to the same row
        if (continuingRowIndex.value !== null) {
          const continueRow = completedRows.value.get(continuingRowIndex.value)
          if (continueRow && continueRow.includes(key)) {
            return true // Allow adding keys from the same row we're continuing
          }
          // Key belongs to a different row - reject
          return false
        }

        // Not continuing any row yet, but key has a row - reject
        return false
      }

      // If this key already has a column assignment, check if adding a row would create a duplicate
      // The new row index depends on whether we're continuing an existing row
      if (coords.col !== null) {
        const newRowIndex =
          continuingRowIndex.value !== null ? continuingRowIndex.value : findNextFreeRowNumber()

        // Check against already completed assignments
        for (const otherKey of allKeys) {
          if (otherKey === key || otherKey.ghost || otherKey.decal) continue
          const otherCoords = parseMatrixCoordinates(otherKey)
          if (otherCoords.row === newRowIndex && otherCoords.col === coords.col) {
            return false // Would create duplicate matrix position
          }
        }

        // Also check against keys in current sequence (they'll all get the same row index)
        for (const seqKey of currentSequence.value) {
          if (seqKey === key) continue
          const seqCoords = parseMatrixCoordinates(seqKey)
          if (seqCoords.col !== null && seqCoords.col === coords.col) {
            return false // Would create duplicate when sequence completes
          }
        }
      }
    } else if (drawingType.value === 'column') {
      // If key already has a column assignment, check if we can continue that column
      if (keyHasColumnAssignment(key)) {
        // If this is the first key in the sequence, we're starting to continue an existing column
        if (currentSequence.value.length === 0) {
          // Find which completed column this key belongs to
          let foundColIndex: number | null = null
          completedColumns.value.forEach((col, colIndex) => {
            if (col.includes(key)) {
              foundColIndex = colIndex
            }
          })
          if (foundColIndex !== null) {
            // Mark that we're continuing this column
            continuingColumnIndex.value = foundColIndex
            return true
          }
          // Key has a column but not in our completed columns (shouldn't happen, but reject to be safe)
          return false
        }

        // If we're already continuing a column, check if this key belongs to the same column
        if (continuingColumnIndex.value !== null) {
          const continueCol = completedColumns.value.get(continuingColumnIndex.value)
          if (continueCol && continueCol.includes(key)) {
            return true // Allow adding keys from the same column we're continuing
          }
          // Key belongs to a different column - reject
          return false
        }

        // Not continuing any column yet, but key has a column - reject
        return false
      }

      // If this key already has a row assignment, check if adding a column would create a duplicate
      // The new column index depends on whether we're continuing an existing column
      if (coords.row !== null) {
        const newColIndex =
          continuingColumnIndex.value !== null
            ? continuingColumnIndex.value
            : findNextFreeColumnNumber()

        // Check against already completed assignments
        for (const otherKey of allKeys) {
          if (otherKey === key || otherKey.ghost || otherKey.decal) continue
          const otherCoords = parseMatrixCoordinates(otherKey)
          if (otherCoords.row === coords.row && otherCoords.col === newColIndex) {
            return false // Would create duplicate matrix position
          }
        }

        // Also check against keys in current sequence (they'll all get the same column index)
        for (const seqKey of currentSequence.value) {
          if (seqKey === key) continue
          const seqCoords = parseMatrixCoordinates(seqKey)
          if (seqCoords.row !== null && seqCoords.row === coords.row) {
            return false // Would create duplicate when sequence completes
          }
        }
      }
    }

    return true
  }

  /**
   * Get all keys that are already assigned (have row or column based on current drawing type)
   * @param allKeys - All keyboard keys
   * @returns Set of keys that are unavailable for the current drawing type
   */
  const getUnavailableKeys = (allKeys: Key[]): Set<Key> => {
    if (drawingType.value === 'row') {
      return getKeysWithRowAssignments(allKeys)
    } else if (drawingType.value === 'column') {
      return getKeysWithColumnAssignments(allKeys)
    }
    return new Set()
  }

  /**
   * Remove a specific key from a row
   * @param rowIndex - The row number to remove from
   * @param key - The key to remove
   * @param skipSync - If true, skip the next coordinate sync (for context menu removals)
   */
  const removeKeyFromRow = (rowIndex: number, key: Key, skipSync = false) => {
    const row = completedRows.value.get(rowIndex)
    if (!row) return

    const keyIndex = row.indexOf(key)
    if (keyIndex !== -1) {
      row.splice(keyIndex, 1)
      // If row is now empty, remove the row entirely
      if (row.length === 0) {
        completedRows.value.delete(rowIndex)
      }
      if (skipSync) {
        skipNextSync.value = true
      }
    }
  }

  /**
   * Remove a specific key from a column
   * @param colIndex - The column number to remove from
   * @param key - The key to remove
   * @param skipSync - If true, skip the next coordinate sync (for context menu removals)
   */
  const removeKeyFromColumn = (colIndex: number, key: Key, skipSync = false) => {
    const col = completedColumns.value.get(colIndex)
    if (!col) return

    const keyIndex = col.indexOf(key)
    if (keyIndex !== -1) {
      col.splice(keyIndex, 1)
      // If column is now empty, remove the column entirely
      if (col.length === 0) {
        completedColumns.value.delete(colIndex)
      }
      if (skipSync) {
        skipNextSync.value = true
      }
    }
  }

  /**
   * Remove an entire row by row number
   * @param rowIndex - The row number to remove
   * @param skipSync - If true, skip the next coordinate sync (for context menu removals)
   */
  const removeRow = (rowIndex: number, skipSync = false) => {
    completedRows.value.delete(rowIndex)
    if (skipSync) {
      skipNextSync.value = true
    }
  }

  /**
   * Remove an entire column by column number
   * @param colIndex - The column number to remove
   * @param skipSync - If true, skip the next coordinate sync (for context menu removals)
   */
  const removeColumn = (colIndex: number, skipSync = false) => {
    completedColumns.value.delete(colIndex)
    if (skipSync) {
      skipNextSync.value = true
    }
  }

  return {
    // State
    drawingType,
    currentSequence,
    completedRows,
    completedColumns,
    sensitivity,
    skipNextSync,

    // Computed
    isDrawing,
    hasDrawings,

    // Actions
    enableDrawing,
    disableDrawing,
    addKeyToSequence,
    completeSequence,
    clearCurrentSequence,
    clearDrawings,
    getCompletedDrawings,
    setSensitivity,
    canAddKeyToSequence,
    getUnavailableKeys,
    removeKeyFromRow,
    removeKeyFromColumn,
    removeRow,
    removeColumn,
  }
})
