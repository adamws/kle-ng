import JSON5 from 'json5'
import { Key, Keyboard, Serial } from '@adamws/kle-serial'
import { D } from './decimal-math'
import { shrinkArray } from './array-helpers'

/**
 * Sort keys for optimal serialization (matches keyboard-layout-editor approach).
 * Groups keys by rotation cluster first (rotation_angle, rotation_x, rotation_y),
 * then sorts by y/x within each cluster. This produces more compact serialization
 * because rotation properties can be set once per cluster.
 *
 * @param keys - Array of keys to sort (will be sorted in place)
 */
export function sortKeysForSerialization(keys: Key[]): void {
  keys.sort((a, b) => {
    // Normalize rotation angles to 0-360 range for comparison
    const aAngle = ((a.rotation_angle || 0) + 360) % 360
    const bAngle = ((b.rotation_angle || 0) + 360) % 360

    // First: sort by rotation angle
    if (aAngle !== bAngle) return aAngle - bAngle

    // Second: sort by rotation origin X
    const aRotX = a.rotation_x || 0
    const bRotX = b.rotation_x || 0
    if (aRotX !== bRotX) return aRotX - bRotX

    // Third: sort by rotation origin Y
    const aRotY = a.rotation_y || 0
    const bRotY = b.rotation_y || 0
    if (aRotY !== bRotY) return aRotY - bRotY

    // Fourth: sort by y coordinate (topmost first)
    if (a.y !== b.y) return a.y - b.y

    // Fifth: sort by x coordinate (leftmost first)
    return a.x - b.x
  })
}

/**
 * Parse JSON string with fallback to JSON5 and smart bracket handling
 * for compatibility with original KLE format (which omits outer brackets)
 */
export function parseJsonString(jsonString: string): unknown {
  const trimmed = jsonString.trim()

  try {
    // Try standard JSON first
    return JSON.parse(trimmed)
  } catch {
    try {
      // Fallback to JSON5 for lenient parsing (matches original KLE behavior)
      return JSON5.parse(trimmed)
    } catch {
      // If both fail, check if it looks like KLE format without brackets
      if (isLikelyKleArrayWithoutBrackets(trimmed)) {
        try {
          // Try wrapping in brackets for original KLE compatibility
          const withBrackets = `[${trimmed}]`
          return JSON.parse(withBrackets)
        } catch {
          try {
            // Last resort: JSON5 with brackets
            const withBrackets = `[${trimmed}]`
            return JSON5.parse(withBrackets)
          } catch (finalError) {
            throw new Error(`Invalid JSON format: ${finalError}`)
          }
        }
      } else {
        throw new Error(`Invalid JSON format: Unable to parse input`)
      }
    }
  }
}

/**
 * Detect if the input looks like a KLE array format without outer brackets
 */
function isLikelyKleArrayWithoutBrackets(input: string): boolean {
  const trimmed = input.trim()

  // Check if it's a complete JSON array or object already
  try {
    JSON.parse(trimmed)
    return false // If it parses as valid JSON, don't try to wrap it
  } catch {
    // Continue with pattern detection
  }

  try {
    JSON5.parse(trimmed)
    return false // If it parses as valid JSON5, don't try to wrap it
  } catch {
    // Continue with pattern detection
  }

  // Look for patterns typical of KLE arrays without outer brackets:
  const klePatterns = [
    /^\s*\[.*\]\s*,\s*\[/, // Multiple rows: [row], [row]
    /^\s*\{.*\}\s*,/, // Starts with properties object
    /^\s*["'][^"']*["']\s*,/, // Starts with string key
    /\]\s*,\s*\[/, // Contains row separators anywhere
    /\{\s*["']?[whxyab]\d?["']?\s*:/, // Contains key properties
  ]

  return klePatterns.some((pattern) => pattern.test(trimmed))
}

/**
 * Round all numeric properties of a keyboard to 6 decimal places
 * for consistent serialization output.
 *
 * @param keyboard - The keyboard to round
 * @returns A new keyboard with rounded numeric values
 */
export function getRoundedKeyboard(keyboard: Keyboard): Keyboard {
  const roundToSixDecimals = (value: number): number => {
    return D.round(value, 6)
  }

  const roundedKeys = keyboard.keys.map((key) => {
    const roundedKey = { ...key }

    // Round all numeric properties to 6 decimal places
    if (typeof roundedKey.x === 'number') roundedKey.x = roundToSixDecimals(roundedKey.x)
    if (typeof roundedKey.y === 'number') roundedKey.y = roundToSixDecimals(roundedKey.y)
    if (typeof roundedKey.width === 'number')
      roundedKey.width = roundToSixDecimals(roundedKey.width)
    if (typeof roundedKey.height === 'number')
      roundedKey.height = roundToSixDecimals(roundedKey.height)
    if (typeof roundedKey.x2 === 'number') roundedKey.x2 = roundToSixDecimals(roundedKey.x2)
    if (typeof roundedKey.y2 === 'number') roundedKey.y2 = roundToSixDecimals(roundedKey.y2)
    if (typeof roundedKey.width2 === 'number')
      roundedKey.width2 = roundToSixDecimals(roundedKey.width2)
    if (typeof roundedKey.height2 === 'number')
      roundedKey.height2 = roundToSixDecimals(roundedKey.height2)
    if (typeof roundedKey.rotation_x === 'number')
      roundedKey.rotation_x = roundToSixDecimals(roundedKey.rotation_x)
    if (typeof roundedKey.rotation_y === 'number')
      roundedKey.rotation_y = roundToSixDecimals(roundedKey.rotation_y)
    if (typeof roundedKey.rotation_angle === 'number')
      roundedKey.rotation_angle = roundToSixDecimals(roundedKey.rotation_angle)

    return roundedKey
  })

  return {
    meta: keyboard.meta,
    keys: roundedKeys,
  }
}

/**
 * Get KLE internal format with proper property ordering for JSON export.
 * This ensures that when stringified, properties appear in the correct order
 * (matching keyboard-layout-editor behavior).
 *
 * Note: This is necessary because Key instances, when JSON.stringified, have
 * their array properties (labels, textColor, textSize) appearing last
 * due to constructor initialization, which doesn't match the expected order.
 *
 * @param keyboard - The keyboard to serialize
 * @returns Serialized keyboard with shrunk arrays and proper property order
 */
export function getKleInternalFormatForExport(keyboard: Keyboard) {
  const roundedKeyboard = getRoundedKeyboard(keyboard)

  // Create plain objects with shrunk arrays
  return {
    meta: roundedKeyboard.meta,
    keys: roundedKeyboard.keys.map((key) => ({
      color: key.color,
      labels: shrinkArray(key.labels),
      textColor: shrinkArray(key.textColor),
      textSize: shrinkArray(key.textSize),
      default: key.default,
      x: key.x,
      y: key.y,
      width: key.width,
      height: key.height,
      x2: key.x2,
      y2: key.y2,
      width2: key.width2,
      height2: key.height2,
      rotation_x: key.rotation_x,
      rotation_y: key.rotation_y,
      rotation_angle: key.rotation_angle,
      decal: key.decal,
      ghost: key.ghost,
      stepped: key.stepped,
      nub: key.nub,
      profile: key.profile,
      sm: key.sm,
      sb: key.sb,
      st: key.st,
    })),
  }
}

/**
 * Serialize a keyboard to the specified format.
 *
 * @param keyboard - The keyboard to serialize
 * @param format - The output format:
 *   - 'internal': Returns the Keyboard object directly (no serialization)
 *   - 'kle': Returns KLE compact format (array-based)
 *   - 'kle-internal': Returns object format with proper property ordering for JSON export
 * @returns The serialized keyboard data
 */

export function getSerializedData(
  keyboard: Keyboard,
  format: 'kle' | 'kle-internal' | 'internal' = 'internal',
): unknown[] | Keyboard | ReturnType<typeof getKleInternalFormatForExport> {
  // Clone the keyboard to avoid modifying the original
  const clonedKeyboard = new Keyboard()
  clonedKeyboard.keys = JSON.parse(JSON.stringify(keyboard.keys))
  clonedKeyboard.meta = JSON.parse(JSON.stringify(keyboard.meta))

  // Sort keys for optimal serialization
  sortKeysForSerialization(clonedKeyboard.keys)

  if (format === 'kle') {
    // Apply rounding to 6 decimal places for consistent JSON export
    const roundedKeyboard = getRoundedKeyboard(clonedKeyboard)
    return Serial.serialize(roundedKeyboard)
  }

  if (format === 'kle-internal') {
    return getKleInternalFormatForExport(clonedKeyboard)
  }

  return clonedKeyboard
}

/**
 * Stringify JSON data with 6 decimal places rounding for numeric values
 * to match the JSON Editor display behavior.
 *
 * @param data - The data to stringify
 * @param space - Number of spaces for indentation (default: 2)
 * @returns JSON string with rounded numeric values
 */
export function stringifyWithRounding(data: unknown, space = 2): string {
  const replacer = (key: string, value: unknown): unknown => {
    if (typeof value === 'number') {
      // Round to 6 decimal places maximum for consistent precision
      return D.format(value, 6)
    }
    return value
  }

  return JSON.stringify(data, replacer, space)
}
