import { Key, Keyboard } from '@adamws/kle-serial'
import Decimal from 'decimal.js'

/**
 * TypeScript interfaces for Ergogen data structures
 */
export interface ErgogenPoint {
  x: number
  y: number
  r?: number
  meta?: {
    width?: number
    height?: number
    padding?: number
    label?: string
    name?: string
    origin?: [number, number]
  }
}

export type ErgogenPoints = Record<string, ErgogenPoint>

/**
 * Convert ergogen points to a Keyboard object
 *
 * This function is ported from adamws/ergogen fork's src/kle.js serialize() function.
 * It handles:
 * - Auto-detection of ergogen's unit system (spacing, width, height)
 * - Conversion to KLE's unified "U" unit system
 * - Proper handling of rotated keys
 * - Position normalization (offset to origin)
 *
 * @param points - Ergogen points object (from ergogen.process().points)
 * @returns Keyboard object with converted keys (caller can serialize as needed)
 */
export function ergogenPointsToKeyboard(points: ErgogenPoints): Keyboard {
  const keyboard = new Keyboard()

  // ========================================================================
  // UNIT DETECTION
  // ========================================================================
  // Ergogen allows custom unit configuration:
  // - $default_width: 'u-1' (typically 18)
  // - $default_height: 'u-1' (typically 18)
  // - $default_padding: 'u' (typically 19)
  // - $default_spread: 'u' (typically 19)
  //
  // We detect the actual values by finding the most common values in the data.

  const widths: number[] = []
  const heights: number[] = []
  const paddings: number[] = []

  for (const point of Object.values(points)) {
    if (point.meta) {
      if (point.meta.width !== undefined) widths.push(point.meta.width)
      if (point.meta.height !== undefined) heights.push(point.meta.height)
      if (point.meta.padding !== undefined) paddings.push(point.meta.padding)
    }
  }

  // Find most common padding (this is the spacing unit) - do this FIRST
  let spacingUnit = 19 // default fallback
  if (paddings.length > 0) {
    const paddingCounts: Record<number, number> = {}
    for (const p of paddings) {
      paddingCounts[p] = (paddingCounts[p] || 0) + 1
    }
    const mostCommon = Object.keys(paddingCounts).reduce((a, b) =>
      paddingCounts[Number(a)]! > paddingCounts[Number(b)]! ? a : b,
    )
    spacingUnit = Number(mostCommon)
  }

  // Find most common width (this is the standard key size)
  // For keyboards with few keys, default to (spacing - 1) which is ergogen's standard
  let standardWidth = spacingUnit > 1 ? spacingUnit - 1 : 18
  if (widths.length >= 2) {
    // Need at least 2 keys to reliably determine standard
    const widthCounts: Record<number, number> = {}
    for (const w of widths) {
      widthCounts[w] = (widthCounts[w] || 0) + 1
    }
    const mostCommonWidth = Object.keys(widthCounts).reduce((a, b) =>
      widthCounts[Number(a)]! > widthCounts[Number(b)]! ? a : b,
    )
    standardWidth = Number(mostCommonWidth)
  }

  // Find most common height (this is the standard key height)
  let standardHeight = spacingUnit > 1 ? spacingUnit - 1 : 18
  if (heights.length >= 2) {
    const heightCounts: Record<number, number> = {}
    for (const h of heights) {
      heightCounts[h] = (heightCounts[h] || 0) + 1
    }
    const mostCommonHeight = Object.keys(heightCounts).reduce((a, b) =>
      heightCounts[Number(a)]! > heightCounts[Number(b)]! ? a : b,
    )
    standardHeight = Number(mostCommonHeight)
  }

  // ========================================================================
  // NORMALIZATION FUNCTIONS
  // ========================================================================
  // KLE uses a unified "U" unit system:
  // - For POSITIONS: use spacing unit (the grid/padding)
  // - For WIDTH: use standard width (most common key width)
  // - For HEIGHT: use standard height (most common key height)

  const normalizePosition = (value: number): number =>
    new Decimal(value).div(spacingUnit).toNumber()

  const normalizeWidth = (value: number): number => new Decimal(value).div(standardWidth).toNumber()

  const normalizeHeight = (value: number): number =>
    new Decimal(value).div(standardHeight).toNumber()

  // ========================================================================
  // STEP 1: CONVERT TO KLE UNITS AND FIND TOPMOST POINT
  // ========================================================================
  // Following the Python reference implementation from kle_serial.py

  const keys: Array<{
    key: Key
    name: string
    x: number
    y: number
    width: number
    height: number
    rotation: number
  }> = []

  let topmostY = new Decimal(-Infinity)
  let topmostX = new Decimal(0)

  for (const [name, point] of Object.entries(points)) {
    const keyWidth = point.meta?.width !== undefined ? point.meta.width : standardWidth
    const keyHeight = point.meta?.height !== undefined ? point.meta.height : standardHeight

    const width = normalizeWidth(keyWidth)
    const height = normalizeHeight(keyHeight)

    // Convert ergogen coordinates (center-based, in mm) to KLE units
    const x = normalizePosition(point.x)
    const y = normalizePosition(point.y)

    // Track topmost (highest Y in ergogen = bottom in KLE before flip)
    const yDecimal = new Decimal(y)
    if (
      yDecimal.greaterThan(topmostY) ||
      (yDecimal.equals(topmostY) && new Decimal(x).lessThanOrEqualTo(topmostX))
    ) {
      topmostY = yDecimal
      topmostX = new Decimal(x)
    }

    keys.push({
      key: new Key(),
      name,
      x,
      y,
      width,
      height,
      rotation: point.r || 0,
    })
  }

  // ========================================================================
  // STEP 2: FLIP Y-AXIS AND CONVERT CENTER TO CORNER
  // ========================================================================

  for (const item of keys) {
    // Flip Y-axis using topmost reference (ergogen Y-up → KLE Y-down)
    item.y = new Decimal(item.y).minus(topmostY.toNumber()).abs().toNumber()

    // Convert from center-based to top-left corner
    item.x = new Decimal(item.x).minus(new Decimal(item.width).div(2)).toNumber()
    item.y = new Decimal(item.y).minus(new Decimal(item.height).div(2)).toNumber()

    // Set rotation angle (KLE and ergogen rotate in opposite directions)
    if (item.rotation !== 0) {
      item.key.rotation_angle = -item.rotation
    }

    // Set dimensions
    item.key.width = item.width
    item.key.height = item.height

    // Set label
    item.key.labels[0] = item.name
  }

  // ========================================================================
  // STEP 3: NORMALIZE TO REMOVE NEGATIVE COORDINATES
  // ========================================================================

  if (keys.length > 0) {
    // Find minimum x and y
    let minX = new Decimal(Infinity)
    let minY = new Decimal(Infinity)

    for (const item of keys) {
      const xDecimal = new Decimal(item.x)
      const yDecimal = new Decimal(item.y)

      if (xDecimal.lessThan(minX)) minX = xDecimal
      if (yDecimal.lessThan(minY)) minY = yDecimal
    }

    // Ensure we include 0 in the range (don't offset if already positive)
    if (minX.greaterThan(0)) minX = new Decimal(0)
    if (minY.greaterThan(0)) minY = new Decimal(0)

    // Offset all keys
    for (const item of keys) {
      item.x = new Decimal(item.x).minus(minX.toNumber()).toNumber()
      item.y = new Decimal(item.y).minus(minY.toNumber()).toNumber()
    }
  }

  // ========================================================================
  // STEP 4: SET ROTATION ORIGINS AND BUILD KEYBOARD
  // ========================================================================

  for (const item of keys) {
    // Set final x, y positions
    item.key.x = item.x
    item.key.y = item.y

    // Set rotation origin to key center (only for rotated keys)
    if (item.rotation !== 0) {
      item.key.rotation_x = new Decimal(item.x).plus(new Decimal(item.width).div(2)).toNumber()
      item.key.rotation_y = new Decimal(item.y).plus(new Decimal(item.height).div(2)).toNumber()
    }

    keyboard.keys.push(item.key)
  }

  // ========================================================================
  // SORT KEYS IN KLE COORDINATE SPACE
  // ========================================================================
  // Sort keys by their final KLE positions (top-to-bottom, left-to-right)
  // This must be done AFTER coordinate conversion and normalization
  // to ensure proper ordering in the serialized output

  keyboard.keys.sort((a, b) => {
    // For rotated keys, use rotation origin as the sorting position
    const aY = a.rotation_angle !== 0 ? a.rotation_y || 0 : a.y
    const bY = b.rotation_angle !== 0 ? b.rotation_y || 0 : b.y
    const aX = a.rotation_angle !== 0 ? a.rotation_x || 0 : a.x
    const bX = b.rotation_angle !== 0 ? b.rotation_x || 0 : b.x

    // Sort by y first (top to bottom)
    const yDiff = new Decimal(aY).minus(bY)
    const epsilon = new Decimal(1e-10) // Very small tolerance for comparison

    if (yDiff.abs().greaterThan(epsilon)) {
      return yDiff.toNumber()
    }

    // If y values are equal, sort by x (left to right)
    return new Decimal(aX).minus(bX).toNumber()
  })

  // Return the Keyboard object - caller can serialize as needed
  return keyboard
}
