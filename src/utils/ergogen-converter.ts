import { Key, Keyboard, Serial } from '@adamws/kle-serial'
import Decimal from 'decimal.js'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - ergogen is a JavaScript library without type definitions
import ergogen from 'ergogen'
import yaml from 'js-yaml'
import LZString from 'lz-string'

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
    spread?: number
    label?: string
    name?: string
    origin?: [number, number]
    zone?: {
      columns?: Record<string, { key?: { spread?: string | number }; name?: string }>
      rows?: Record<string, { padding?: string | number }>
      name?: string
    }
    col?: {
      key?: { spread?: string | number }
      name?: string
    }
    row?: string
  }
}

export type ErgogenPoints = Record<string, ErgogenPoint>

export async function ergogenGetPoints(config: unknown): Promise<ErgogenPoints> {
  if (!config || typeof config !== 'object' || !('points' in config)) {
    throw new Error("Config does not contain 'points'")
  }

  const configWithPoints = config as { points: unknown; units?: unknown }

  // ergogen used by ergogen.xyz (website) is patched and supports footprints
  // which are not supported on current ergogen upstream release
  // this means that layouts exported with ergogen.xyz may not be compatible
  // with ergogen package we use in kle-ng
  // For that reason, ignore everything except the 'points' and 'units'
  // (we do not need anything else anyway)

  // Process with ergogen - include units if defined
  const ergogenConfig: { points: unknown; units?: unknown } = { points: configWithPoints.points }
  if (configWithPoints.units !== undefined) {
    ergogenConfig.units = configWithPoints.units
  }

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore - ergogen.process() accepts second parameter but types are incomplete
  const results = await ergogen.process(ergogenConfig, { debug: true })

  if (!results.points) {
    throw new Error('Ergogen processing did not generate any points')
  }

  return results.points as ErgogenPoints
}

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

  // UNIT DETECTION
  // Ergogen allows custom unit configuration:
  // - $default_width: 'u-1' (typically 18)
  // - $default_height: 'u-1' (typically 18)
  // - $default_padding: 'u' (typically 19)
  // - $default_spread: 'u' (typically 19)
  //
  // We detect the actual values by finding the most common values in the data.

  const widths: number[] = []
  const heights: number[] = []

  for (const point of Object.values(points)) {
    if (point.meta) {
      if (point.meta.width !== undefined) widths.push(point.meta.width)
      if (point.meta.height !== undefined) heights.push(point.meta.height)
    }
  }

  // DETECT X AND Y SPACING FROM ZONE CONFIGURATION
  // Ergogen uses:
  // - spread: horizontal spacing between columns (X dimension)
  // - padding: vertical spacing between rows (Y dimension)
  // These are defined in the zone configuration and inherit through YAML anchors

  let spacingUnitX = 19 // default fallback
  let spacingUnitY = 19 // default fallback

  // Get zone configuration from the first point (all points in a zone share the same zone config)
  const firstPoint = Object.values(points)[0]
  if (firstPoint?.meta?.zone) {
    const zone = firstPoint.meta.zone

    // Collect spread values from columns that have explicit spread configured
    const explicitSpreads: number[] = []
    if (zone.columns) {
      for (const [colName, colConfig] of Object.entries(zone.columns)) {
        // If this column has an explicit spread value (not default)
        if (colConfig?.key?.spread !== undefined) {
          // Find a point in this column to get the resolved numeric spread value
          for (const point of Object.values(points)) {
            if (point.meta?.col?.name === colName && point.meta.spread !== undefined) {
              explicitSpreads.push(point.meta.spread)
              break // Only need one point per column
            }
          }
        }
      }
    }

    // Collect padding values from rows that have explicit padding configured
    const explicitPaddings: number[] = []
    if (zone.rows) {
      for (const [rowName, rowConfig] of Object.entries(zone.rows)) {
        // If this row has an explicit padding value (not default)
        if (rowConfig?.padding !== undefined) {
          // Find a point in this row to get the resolved numeric padding value
          for (const point of Object.values(points)) {
            if (point.meta?.row === rowName && point.meta.padding !== undefined) {
              explicitPaddings.push(point.meta.padding)
              break // Only need one point per row
            }
          }
        }
      }
    }

    // Use explicit values if available, otherwise keep defaults
    if (explicitSpreads.length > 0) {
      // Use the most common explicit spread (or smallest if tied)
      const spreadCounts: Record<number, number> = {}
      for (const s of explicitSpreads) {
        spreadCounts[s] = (spreadCounts[s] || 0) + 1
      }
      const maxCount = Math.max(...Object.values(spreadCounts))
      const mostCommonValues = Object.keys(spreadCounts)
        .filter((k) => spreadCounts[Number(k)] === maxCount)
        .map(Number)
      spacingUnitX = Math.min(...mostCommonValues)
    }

    if (explicitPaddings.length > 0) {
      // Use the most common explicit padding (or smallest if tied)
      const paddingCounts: Record<number, number> = {}
      for (const p of explicitPaddings) {
        paddingCounts[p] = (paddingCounts[p] || 0) + 1
      }
      const maxCount = Math.max(...Object.values(paddingCounts))
      const mostCommonValues = Object.keys(paddingCounts)
        .filter((k) => paddingCounts[Number(k)] === maxCount)
        .map(Number)
      spacingUnitY = Math.min(...mostCommonValues)
    }
  }

  // Find most common width (this is the standard key size)
  // For keyboards with few keys, default to (spacing - 1) which is ergogen's standard
  let standardWidth = spacingUnitX > 1 ? spacingUnitX - 1 : 18
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
  let standardHeight = spacingUnitY > 1 ? spacingUnitY - 1 : 18
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

  // Preserve spacing information for future use (e.g., calculating physical positions)
  keyboard.meta.spacing_x = spacingUnitX // Horizontal spacing in mm/U
  keyboard.meta.spacing_y = spacingUnitY // Vertical spacing in mm/U

  // KLE uses a unified "U" unit system:
  // - For POSITIONS: use spacing unit (the grid/padding)
  // - For WIDTH: use standard width (most common key width)
  // - For HEIGHT: use standard height (most common key height)

  const normalizeX = (value: number): number => new Decimal(value).div(spacingUnitX).toNumber()

  const normalizeY = (value: number): number => new Decimal(value).div(spacingUnitY).toNumber()

  const normalizeWidth = (value: number): number => new Decimal(value).div(standardWidth).toNumber()

  const normalizeHeight = (value: number): number =>
    new Decimal(value).div(standardHeight).toNumber()

  // STEP 1: CONVERT TO KLE UNITS AND FIND TOPMOST POINT
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
    const x = normalizeX(point.x)
    const y = normalizeY(point.y)

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

  // STEP 2: FLIP Y-AXIS AND CONVERT CENTER TO CORNER

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

  // STEP 3: NORMALIZE TO REMOVE NEGATIVE COORDINATES

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

  // STEP 4: SET ROTATION ORIGINS AND BUILD KEYBOARD

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

  // STEP 5: SORT KEYS IN KLE COORDINATE SPACE
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

/**
 * Parses ergogen config and converts it to a keyboard layout
 * @param config - The YAML config string from ergogen
 * @returns Keyboard layout
 */
export async function parseErgogenConfig(config: string): Promise<Keyboard> {
  try {
    // Parse YAML config
    const parsedConfig = yaml.load(config)

    const points = await ergogenGetPoints(parsedConfig)

    if (!points || Object.keys(points).length === 0) {
      throw new Error('No points generated from Ergogen config')
    }

    // Convert to Keyboard
    return ergogenPointsToKeyboard(points)
  } catch (error) {
    console.error('Error parsing Ergogen config:', error)
    throw error instanceof Error ? error : new Error('Failed to parse Ergogen config')
  }
}

/**
 * Encodes a keyboard layout to an ergogen.xyz URL
 * Similar to encodeConfig from ergogen-gui, but without injections
 * Uses KLE JSON format in the config property
 * @param keyboard - The keyboard layout to encode
 * @returns URL string for ergogen.xyz
 */
export function encodeKeyboardToErgogenUrl(keyboard: Keyboard): string {
  try {
    // Get KLE JSON format (array-based serialization)
    const kleData = Serial.serialize(keyboard)
    const kleJson = JSON.stringify(kleData)

    // Create ShareableConfig object (without injections)
    const shareableConfig = {
      config: kleJson,
    }

    // JSON stringify and compress
    const jsonString = JSON.stringify(shareableConfig)
    const compressed = LZString.compressToEncodedURIComponent(jsonString)

    // Create ergogen.xyz URL
    return `https://ergogen.xyz#${compressed}`
  } catch (error) {
    console.error('Error encoding keyboard to ergogen URL:', error)
    throw error instanceof Error ? error : new Error('Failed to encode keyboard to ergogen URL')
  }
}
