/**
 * Utilities for working with Array12 (fixed-length 12-element arrays)
 * used by kle-serial for key labels, text colors, and text sizes.
 */

import type { Array12 } from '@adamws/kle-serial'

/**
 * Type guard to check if an array is a valid Array12.
 * @param arr - The array to check
 * @returns True if the array has exactly 12 elements
 */
export function isArray12<T>(arr: T[]): arr is Array12<T> {
  return arr.length === 12
}

/**
 * Ensures an array has exactly 12 elements by padding with default values
 * or truncating if necessary.
 * @param arr - The input array
 * @param defaultValue - The value to use for padding
 * @returns A new Array12 with exactly 12 elements
 */
export function ensureArray12<T>(arr: T[], defaultValue: T): Array12<T> {
  if (arr.length === 12) return arr as Array12<T>
  const result = [...arr]
  while (result.length < 12) result.push(defaultValue)
  return result.slice(0, 12) as Array12<T>
}

/**
 * Creates an empty Array12 filled with empty strings.
 * Used for initializing key label arrays.
 * @returns A new Array12<string> filled with empty strings
 */
export function createEmptyLabels(): Array12<string> {
  return Array(12).fill('') as Array12<string>
}

/**
 * Creates an empty Array12 filled with empty strings.
 * Used for initializing key text color arrays.
 * @returns A new Array12<string> filled with empty strings
 */
export function createEmptyTextColors(): Array12<string> {
  return Array(12).fill('') as Array12<string>
}

/**
 * Creates an empty Array12 filled with zeros.
 * Used for initializing key text size arrays.
 * @returns A new Array12<number> filled with zeros
 */
export function createEmptyTextSizes(): Array12<number> {
  return Array(12).fill(0) as Array12<number>
}

/**
 * Shrinks an array by removing trailing "empty" values.
 * Empty is defined as: -1, empty string, 0, null, or undefined.
 * Useful for minimizing JSON output when serializing keys.
 * @param arr - The array to shrink
 * @returns A new array with trailing empty values removed
 */
export function shrinkArray<T>(arr: readonly T[]): T[] {
  let last = -1
  for (let i = 0; i < arr.length; i++) {
    const value = arr[i]
    // Check for meaningful values (not -1, not '', and not 0, not null, not undefined)
    if (value !== -1 && value !== '' && value !== 0 && value !== null && value !== undefined) {
      last = i
    }
  }
  return last === -1 ? [] : arr.slice(0, last + 1)
}

/**
 * Clones an Array12, ensuring the result is also typed as Array12.
 * @param arr - The Array12 to clone
 * @returns A new Array12 with the same values
 */
export function cloneArray12<T>(arr: Array12<T>): Array12<T> {
  return [...arr] as Array12<T>
}
