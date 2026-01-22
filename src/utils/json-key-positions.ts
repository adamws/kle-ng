import type { Key } from '@adamws/kle-serial'
import type { HighlightRange } from '@/composables/useJsonKeyHighlighting'

/**
 * Represents a parsed key's position info from JSON scanning
 */
interface JsonKeyPosition {
  /** Character index where this key's string starts (the opening quote) */
  stringStart: number
  /** Character index where this key's string ends (after the closing quote) */
  stringEnd: number
  /** The key's x position (computed from KLE format) */
  x: number
  /** The key's y position (row index) */
  y: number
  /** The key's labels as parsed */
  labels: string[]
}

/**
 * Scans a KLE JSON string and extracts position information for each key
 * This is a lightweight parser that tracks character positions without full JSON parsing
 */
function scanJsonForKeyPositions(jsonString: string): JsonKeyPosition[] {
  const positions: JsonKeyPosition[] = []

  let i = 0
  const len = jsonString.length

  // Helper to skip whitespace
  const skipWhitespace = () => {
    while (i < len && /\s/.test(jsonString[i]!)) i++
  }

  // Helper to parse a string and return its value (without quotes)
  // Also returns the start and end positions
  const parseStringWithPosition = (): { value: string; start: number; end: number } => {
    if (jsonString[i] !== '"') throw new Error('Expected string')
    const start = i
    i++ // skip opening quote
    let result = ''
    while (i < len && jsonString[i] !== '"') {
      if (jsonString[i] === '\\' && i + 1 < len) {
        i++ // skip backslash
        const escaped = jsonString[i]
        if (escaped === 'n') result += '\n'
        else if (escaped === 'r') result += '\r'
        else if (escaped === 't') result += '\t'
        else if (escaped === '"') result += '"'
        else if (escaped === '\\') result += '\\'
        else if (escaped === 'u' && i + 4 < len) {
          const hex = jsonString.substring(i + 1, i + 5)
          result += String.fromCharCode(parseInt(hex, 16))
          i += 4
        } else {
          result += escaped
        }
      } else {
        result += jsonString[i]
      }
      i++
    }
    i++ // skip closing quote
    return { value: result, start, end: i }
  }

  // Simple string parse without tracking position
  const parseString = (): string => {
    return parseStringWithPosition().value
  }

  // Helper to skip a JSON value (string, number, object, array, boolean, null)
  const skipValue = () => {
    skipWhitespace()
    const char = jsonString[i]

    if (char === '"') {
      parseString()
    } else if (char === '{') {
      skipObject()
    } else if (char === '[') {
      skipArray()
    } else if (char === 't') {
      i += 4 // true
    } else if (char === 'f') {
      i += 5 // false
    } else if (char === 'n') {
      i += 4 // null
    } else {
      // number
      while (i < len && /[0-9.\-+eE]/.test(jsonString[i]!)) i++
    }
  }

  const skipObject = () => {
    i++ // skip '{'
    skipWhitespace()
    while (i < len && jsonString[i] !== '}') {
      // key
      parseString()
      skipWhitespace()
      i++ // skip ':'
      skipValue()
      skipWhitespace()
      if (jsonString[i] === ',') i++
      skipWhitespace()
    }
    i++ // skip '}'
  }

  const skipArray = () => {
    i++ // skip '['
    skipWhitespace()
    while (i < len && jsonString[i] !== ']') {
      skipValue()
      skipWhitespace()
      if (jsonString[i] === ',') i++
      skipWhitespace()
    }
    i++ // skip ']'
  }

  // Start parsing - expect top-level array
  skipWhitespace()
  if (jsonString[i] !== '[') return positions
  i++ // skip '['

  let currentRow = 0
  let currentX = 0

  skipWhitespace()
  while (i < len && jsonString[i] !== ']') {
    skipWhitespace()
    const char = jsonString[i]

    if (char === '{') {
      // Metadata object at top level - skip it
      skipObject()
    } else if (char === '[') {
      // Row array
      i++ // skip '['

      currentX = 0
      let pendingWidth = 1

      skipWhitespace()
      while (i < len && jsonString[i] !== ']') {
        skipWhitespace()
        const elemChar = jsonString[i]

        if (elemChar === '{') {
          // Property object - parse to extract width/x adjustments
          i++ // skip '{'
          skipWhitespace()

          while (i < len && jsonString[i] !== '}') {
            const keyStr = parseString()
            skipWhitespace()
            i++ // skip ':'
            skipWhitespace()

            // Parse value based on key
            if (keyStr === 'x' || keyStr === 'w') {
              // Parse number
              const numStart = i
              while (i < len && /[0-9.\-+eE]/.test(jsonString[i]!)) i++
              const numVal = parseFloat(jsonString.substring(numStart, i))
              if (keyStr === 'x') currentX += numVal
              if (keyStr === 'w') pendingWidth = numVal
            } else if (keyStr === 'y') {
              // Parse number for y adjustment
              const numStart = i
              while (i < len && /[0-9.\-+eE]/.test(jsonString[i]!)) i++
              const numVal = parseFloat(jsonString.substring(numStart, i))
              currentRow += numVal
            } else {
              skipValue()
            }
            skipWhitespace()
            if (jsonString[i] === ',') i++
            skipWhitespace()
          }
          i++ // skip '}'
        } else if (elemChar === '"') {
          // String - this is a key! Track its position
          const { value, start, end } = parseStringWithPosition()
          const labels = value.split('\n')

          positions.push({
            stringStart: start,
            stringEnd: end,
            x: currentX,
            y: currentRow,
            labels,
          })

          currentX += pendingWidth
          pendingWidth = 1
        } else {
          // Something else - shouldn't happen in valid KLE, skip it
          skipValue()
        }

        skipWhitespace()
        if (jsonString[i] === ',') i++
        skipWhitespace()
      }

      i++ // skip ']'

      currentRow++
      currentX = 0
    } else {
      // Unexpected - skip
      skipValue()
    }

    skipWhitespace()
    if (jsonString[i] === ',') i++
    skipWhitespace()
  }

  return positions
}

/**
 * Rounds a number to avoid floating point comparison issues
 */
function roundPosition(n: number): number {
  return Math.round(n * 1000) / 1000
}

/**
 * Checks if two keys match based on position
 * Uses rounded position comparison to handle floating point issues
 */
function keysMatch(jsonKey: JsonKeyPosition, storeKey: Key): boolean {
  const xMatch = roundPosition(jsonKey.x) === roundPosition(storeKey.x)
  const yMatch = roundPosition(jsonKey.y) === roundPosition(storeKey.y)
  return xMatch && yMatch
}

/**
 * Finds the character ranges in a JSON string that correspond to selected keys
 *
 * @param jsonString - The formatted KLE JSON string
 * @param storeKeys - All keys in the store (used for position matching)
 * @param selectedKeys - The currently selected keys to highlight
 * @returns Array of character ranges to highlight
 */
export function findKeyRangesInJson(
  jsonString: string,
  storeKeys: Key[],
  selectedKeys: Key[],
): HighlightRange[] {
  if (!jsonString || selectedKeys.length === 0) {
    return []
  }

  try {
    // Scan JSON to find key positions
    const jsonKeyPositions = scanJsonForKeyPositions(jsonString)

    // For each selected key, find matching JSON position
    const ranges: HighlightRange[] = []

    for (const selectedKey of selectedKeys) {
      // Find matching JSON key by position
      const matchingJsonKey = jsonKeyPositions.find((jk) => keysMatch(jk, selectedKey))

      if (matchingJsonKey) {
        // Highlight only the specific key string element
        ranges.push({
          from: matchingJsonKey.stringStart,
          to: matchingJsonKey.stringEnd,
        })
      }
    }

    return ranges
  } catch (error) {
    console.warn('Error finding key ranges in JSON:', error)
    return []
  }
}
