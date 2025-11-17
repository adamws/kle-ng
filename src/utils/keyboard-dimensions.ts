import { BoundsCalculator } from './utils/BoundsCalculator'
import { D } from './decimal-math'
import type { Key } from '@adamws/kle-serial'

/**
 * Represents keyboard layout dimensions in units (U) and millimeters
 */
export interface KeyboardDimensions {
  width: number // Width in units
  height: number // Height in units
  widthFormatted: string // e.g., "12.1"
  heightFormatted: string // e.g., "4.5"
  widthMm: number // Width in mm
  heightMm: number // Height in mm
  widthMmFormatted: string // e.g., "231.405"
  heightMmFormatted: string // e.g., "85.725"
}

/**
 * Calculate the bounding box dimensions of a keyboard layout in units (U) and millimeters.
 *
 * Filters out decorative keys (decal, ghost) and calculates the minimal
 * bounding box that contains all physical keys, accounting for rotations.
 *
 * @param keys - Array of keys in the keyboard layout
 * @param spacing - Spacing values for unit-to-mm conversion (default: 19.05x19.05)
 * @returns Keyboard dimensions in units and mm, or null if no physical keys
 *
 * @example
 * ```typescript
 * import { calculateKeyboardDimensions } from '@/utils/keyboard-dimensions'
 * import { useKeyboardStore } from '@/stores/keyboard'
 *
 * const store = useKeyboardStore()
 * const spacing = { x: 19.05, y: 19.05 }
 * const dimensions = calculateKeyboardDimensions(store.keys, spacing)
 *
 * if (dimensions) {
 *   console.log(`Width: ${dimensions.width}U (${dimensions.widthMm}mm)`)
 *   console.log(`Height: ${dimensions.height}U (${dimensions.heightMm}mm)`)
 * } else {
 *   console.log('No physical keys in layout')
 * }
 * ```
 */
export function calculateKeyboardDimensions(
  keys: Key[],
  spacing: { x: number; y: number } = { x: 19.05, y: 19.05 },
): KeyboardDimensions | null {
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

  // Calculate dimensions in millimeters using decimal.js for precision
  const widthMm = Number(D.mul(bounds.width, spacing.x))
  const heightMm = Number(D.mul(bounds.height, spacing.y))
  const widthMmFormatted = widthMm.toFixed(6).replace(/\.?0+$/, '')
  const heightMmFormatted = heightMm.toFixed(6).replace(/\.?0+$/, '')

  return {
    width: bounds.width,
    height: bounds.height,
    widthFormatted,
    heightFormatted,
    widthMm,
    heightMm,
    widthMmFormatted,
    heightMmFormatted,
  }
}
