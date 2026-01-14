import type { Key } from '@/stores/keyboard'

/**
 * Parse matrix coordinates from a key's label
 * VIA format: "row,col" in labels[0]
 * Returns { row: number, col: number } or null if not assigned
 */
export function parseMatrixCoordinates(key: Key): { row: number | null; col: number | null } {
  // labels is always a 12-element array, just check if first label is empty
  if (!key.labels[0]) {
    return { row: null, col: null }
  }

  const label = key.labels[0].trim()
  if (!label.includes(',')) {
    return { row: null, col: null }
  }

  const [rowStr, colStr] = label.split(',')

  const row = rowStr && rowStr.trim() !== '' ? parseInt(rowStr, 10) : null
  const col = colStr && colStr.trim() !== '' ? parseInt(colStr, 10) : null

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

// ============================================================================
// VIA Option/Choice Support
// ============================================================================

/**
 * Interface for option,choice values
 */
export interface OptionChoice {
  option: number
  choice: number
}

/**
 * Result of duplicate matrix position validation
 */
export interface DuplicateValidationResult {
  /** True if all duplicate positions have valid option,choice labels */
  isValid: boolean
  /** Duplicate positions where keys lack option,choice labels (invalid per VIA spec) */
  duplicatesWithoutOption: Array<{
    position: string // "row,col"
    keys: Key[]
  }>
  /** Duplicate positions where all keys have valid option,choice labels (valid layout options) */
  validLayoutOptions: Array<{
    position: string // "row,col"
    keys: Key[]
  }>
}

/**
 * Parse option,choice format from labels[8] (bottom-right)
 * VIA format: "option,choice" where both are non-negative integers
 * @param key - The key to parse
 * @returns Object with option and choice numbers, or null if invalid/not present
 */
export function parseOptionChoice(key: Key): OptionChoice | null {
  const label = key.labels[8]
  if (!label || typeof label !== 'string') return null

  const trimmed = label.trim()
  if (!trimmed) return null

  // Must match "number,number" format exactly
  const pattern = /^(\d+),(\d+)$/
  const match = trimmed.match(pattern)

  if (!match) return null

  const option = parseInt(match[1] ?? '0', 10)
  const choice = parseInt(match[2] ?? '0', 10)

  // Validate parsed values (should always be valid due to regex, but be safe)
  if (isNaN(option) || isNaN(choice) || option < 0 || choice < 0) return null

  return { option, choice }
}

/**
 * Check if a key has a valid option,choice label
 * @param key - The key to check
 * @returns true if key has valid option,choice format in labels[8]
 */
export function hasOptionChoice(key: Key): boolean {
  return parseOptionChoice(key) !== null
}

/**
 * Get the option number for a key from its option,choice label
 * @param key - The key to check
 * @returns Option number, or null if key doesn't have valid option,choice
 */
export function getKeyOption(key: Key): number | null {
  const parsed = parseOptionChoice(key)
  return parsed?.option ?? null
}

/**
 * Get the choice number for a key from its option,choice label
 * @param key - The key to check
 * @returns Choice number, or null if key doesn't have valid option,choice
 */
export function getKeyChoice(key: Key): number | null {
  const parsed = parseOptionChoice(key)
  return parsed?.choice ?? null
}

/**
 * Validate that all duplicate matrix positions have proper option,choice labels
 * Per VIA spec, keys sharing a matrix position must have option,choice labels
 * to distinguish which layout variant they belong to.
 *
 * @param keys - Array of keys to validate
 * @returns Validation result with invalid duplicates and valid layout options
 */
export function validateMatrixDuplicates(keys: Key[]): DuplicateValidationResult {
  // Build map of matrix position -> keys (exclude ghost and decal)
  const positionMap = new Map<string, Key[]>()

  keys.forEach((key) => {
    if (key.ghost || key.decal) return

    const coords = parseMatrixCoordinates(key)
    // Only consider keys with complete matrix assignments
    if (coords.row === null || coords.col === null) return

    const position = `${coords.row},${coords.col}`
    if (!positionMap.has(position)) {
      positionMap.set(position, [])
    }
    positionMap.get(position)!.push(key)
  })

  // Check each position for duplicates
  const duplicatesWithoutOption: Array<{ position: string; keys: Key[] }> = []
  const validLayoutOptions: Array<{ position: string; keys: Key[] }> = []

  positionMap.forEach((keysAtPosition, position) => {
    // Only check positions with more than one key
    if (keysAtPosition.length <= 1) return

    // Check if ALL keys at this position have valid option,choice
    const allHaveOption = keysAtPosition.every((key) => hasOptionChoice(key))

    if (allHaveOption) {
      // Valid layout options - all keys have option,choice
      validLayoutOptions.push({ position, keys: keysAtPosition })
    } else {
      // Invalid - at least one key is missing option,choice
      duplicatesWithoutOption.push({ position, keys: keysAtPosition })
    }
  })

  return {
    isValid: duplicatesWithoutOption.length === 0,
    duplicatesWithoutOption,
    validLayoutOptions,
  }
}

/**
 * Get all keys belonging to the "default layout" per VIA spec
 * Default layout consists of:
 * - Keys without option,choice label (they are always shown)
 * - Keys with choice=0 (the default choice for each layout option)
 *
 * Note: Only considers keys with valid matrix annotations.
 * Ghost and decal keys are excluded.
 *
 * @param keys - Array of keys to filter
 * @returns Array of keys that belong to the default layout
 */
export function getDefaultLayoutKeys(keys: Key[]): Key[] {
  return keys.filter((key) => {
    // Exclude ghost and decal keys
    if (key.ghost || key.decal) return false

    // Only include keys with valid matrix annotations
    const coords = parseMatrixCoordinates(key)
    if (coords.row === null || coords.col === null) return false

    // Check option,choice
    const optionChoice = parseOptionChoice(key)

    // Include if no option,choice (part of base layout)
    if (!optionChoice) return true

    // Include if choice is 0 (default choice for this option)
    return optionChoice.choice === 0
  })
}
