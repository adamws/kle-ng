import JSON5 from 'json5'

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
