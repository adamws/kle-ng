import { BoundsCalculator } from './utils/BoundsCalculator'
import type { Key } from '@adamws/kle-serial'

/**
 * Represents keyboard layout dimensions in units (U)
 */
export interface KeyboardDimensions {
  width: number // Width in units
  height: number // Height in units
  widthFormatted: string // e.g., "12.1"
  heightFormatted: string // e.g., "4.5"
}

/**
 * Calculate the bounding box dimensions of a keyboard layout in units (U).
 *
 * Filters out decorative keys (decal, ghost) and calculates the minimal
 * bounding box that contains all physical keys, accounting for rotations.
 *
 * @param keys - Array of keys in the keyboard layout
 * @returns Keyboard dimensions in units, or null if no physical keys
 *
 * @example
 * ```typescript
 * import { calculateKeyboardDimensions } from '@/utils/keyboard-dimensions'
 * import { useKeyboardStore } from '@/stores/keyboard'
 *
 * const store = useKeyboardStore()
 * const dimensions = calculateKeyboardDimensions(store.keys)
 *
 * if (dimensions) {
 *   console.log(`Width: ${dimensions.width}U`)
 *   console.log(`Height: ${dimensions.height}U`)
 * } else {
 *   console.log('No physical keys in layout')
 * }
 * ```
 */
export function calculateKeyboardDimensions(keys: Key[]): KeyboardDimensions | null {
  // Filter out decorative keys - only consider physical switches
  const physicalKeys = keys.filter((key) => !key.decal && !key.ghost)

  if (physicalKeys.length === 0) {
    return null
  }

  // Create bounds calculator with normalized unit size
  const calculator = new BoundsCalculator(1)

  // Calculate bounding box in pixels
  const bounds = calculator.calculateBounds(physicalKeys)

  const widthFormatted = bounds.width.toFixed(6).replace(/\.?0+$/, '')
  const heightFormatted = bounds.height.toFixed(6).replace(/\.?0+$/, '')

  return {
    width: bounds.width,
    height: bounds.height,
    widthFormatted,
    heightFormatted,
  }
}
