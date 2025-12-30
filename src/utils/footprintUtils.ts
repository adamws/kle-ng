/**
 * Footprint Utility Functions
 *
 * Helper functions for handling PCB footprint SVGs in the preview component.
 * Includes filename mapping, URL generation, viewBox parsing, and positioning calculations.
 */

import type { ViewBox } from '@/types/footprint'
import { D } from './decimal-math'

/**
 * Maps switch footprint setting values to SVG filenames
 *
 * @param footprintValue - The switch footprint setting value (e.g., 'Switch_Keyboard_Cherry_MX:SW_Cherry_MX_PCB_{:.2f}u')
 * @returns SVG filename for the switch footprint
 *
 * @example
 * ```typescript
 * getSwitchFootprintFilename('Switch_Keyboard_Cherry_MX:SW_Cherry_MX_PCB_{:.2f}u')
 * // Returns: 'SW_Cherry_MX_PCB_1.00u.svg'
 * ```
 *
 * Note: Currently uses Cherry MX as fallback for Alps, Hybrid, and Hotswap
 * since those SVG files are not yet available.
 */
export function getSwitchFootprintFilename(footprintValue: string): string {
  const mapping: Record<string, string> = {
    'Switch_Keyboard_Cherry_MX:SW_Cherry_MX_PCB_{:.2f}u': 'SW_Cherry_MX_PCB_1.00u.svg',
    'Switch_Keyboard_Alps_Matias:SW_Alps_Matias_{:.2f}u': 'SW_Alps_Matias_1.00u.svg',
    'Switch_Keyboard_Hybrid:SW_Hybrid_Cherry_MX_Alps_{:.2f}u': 'SW_Hybrid_Cherry_MX_Alps_1.00u.svg',
    'Switch_Keyboard_Hotswap_Kailh:SW_Hotswap_Kailh_MX_{:.2f}u': 'SW_Hotswap_Kailh_MX_1.00u.svg',
    'Switch_Keyboard_Hotswap_Kailh:SW_Hotswap_Kailh_Choc_V1V2_{:.2f}u':
      'SW_Hotswap_Kailh_Choc_V1V2_1.00u.svg',
  }

  const filename = mapping[footprintValue]
  if (!filename) {
    console.warn(`Unknown switch footprint: ${footprintValue}, using Cherry MX fallback`)
    return 'SW_Cherry_MX_PCB_1.00u.svg'
  }
  return filename
}

/**
 * Extracts diode footprint filename from setting value
 *
 * @param footprintValue - The diode footprint setting value (e.g., 'Diode_SMD:D_SOD-123F')
 * @returns SVG filename for the diode footprint
 *
 * @example
 * ```typescript
 * getDiodeFootprintFilename('Diode_SMD:D_SOD-123F')
 * // Returns: 'D_SOD-123F.svg'
 * ```
 */
export function getDiodeFootprintFilename(footprintValue: string): string {
  const parts = footprintValue.split(':')
  if (parts.length === 2) {
    return `${parts[1]}.svg`
  }
  console.warn(`Invalid diode footprint format: ${footprintValue}, using SOD-123F fallback`)
  return 'D_SOD-123F.svg'
}

/**
 * Generates the public URL for a footprint SVG file
 *
 * @param filename - The SVG filename (e.g., 'SW_Cherry_MX_PCB_1.00u.svg')
 * @param side - The side of the PCB ('FRONT' or 'BACK')
 * @returns Public URL path for the SVG file
 *
 * @example
 * ```typescript
 * getFootprintSvgUrl('SW_Cherry_MX_PCB_1.00u.svg', 'FRONT')
 * // Returns: '/data/footprints/front/SW_Cherry_MX_PCB_1.00u.svg'
 * ```
 */
export function getFootprintSvgUrl(filename: string, side: 'FRONT' | 'BACK'): string {
  const sideDir = side.toLowerCase()
  return `/data/footprints/${sideDir}/${filename}`
}

/**
 * Parses the viewBox attribute from SVG content
 *
 * @param svgContent - The SVG content string (can be full SVG or inner content)
 * @returns ViewBox object with x, y, width, height in millimeters
 * @throws Error if viewBox attribute is missing or invalid
 *
 * @example
 * ```typescript
 * const vb = parseViewBox('<svg viewBox="0.0000 0.0000 19.4818 19.1262">...')
 * // Returns: { x: 0, y: 0, width: 19.4818, height: 19.1262 }
 * ```
 */
export function parseViewBox(svgContent: string): ViewBox {
  const viewBoxMatch = svgContent.match(/viewBox=["']([^"']+)["']/)

  if (!viewBoxMatch || !viewBoxMatch[1]) {
    throw new Error('SVG does not contain viewBox attribute')
  }

  const viewBoxString = viewBoxMatch[1]
  const values = viewBoxString.split(/\s+/).map(Number)

  if (values.length !== 4 || values.some(isNaN)) {
    throw new Error(`Invalid viewBox format: ${viewBoxString}`)
  }

  return {
    x: values[0] ?? 0,
    y: values[1] ?? 0,
    width: values[2] ?? 0,
    height: values[3] ?? 0,
  }
}

/**
 * Extracts inner SVG content by removing the outer <svg> wrapper
 *
 * Removes the outer <svg> tag, XML declaration, and DOCTYPE to prevent
 * coordinate system conflicts when injecting into a parent SVG.
 *
 * @param svgText - The complete SVG document as text
 * @returns Inner SVG content without wrapper tags
 * @throws Error if SVG structure is invalid
 *
 * @example
 * ```typescript
 * const content = extractSvgContent('<?xml version="1.0"?><svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>')
 * // Returns: '<circle cx="5" cy="5" r="4"/>'
 * ```
 */
export function extractSvgContent(svgText: string): string {
  // Remove XML declaration and DOCTYPE
  let cleaned = svgText.replace(/<\?xml[^>]*\?>/g, '')
  cleaned = cleaned.replace(/<!DOCTYPE[^>]*>/g, '')
  cleaned = cleaned.trim()

  // Extract content between <svg> and </svg>
  const match = cleaned.match(/<svg[^>]*>([\s\S]*)<\/svg>/i)

  if (!match || !match[1]) {
    throw new Error('Invalid SVG: Could not extract content')
  }

  return match[1].trim()
}

/**
 * Calculates composite viewBox optimized to minimize empty space
 *
 * Starts with the switch footprint as the base and only expands the viewBox
 * if the diode extends beyond the switch bounds. Handles both switch and diode rotation.
 *
 * IMPORTANT: Diode offsets AND rotation are in SWITCH-RELATIVE coordinates, not world coordinates.
 * The function rotates the offset vector by switchRotation and adds switchRotation to diodeRotation.
 *
 * @param switchVB - ViewBox of the switch footprint
 * @param diodeVB - ViewBox of the diode footprint
 * @param diodeOffsetX - Horizontal offset in SWITCH coordinates (positive = right in switch's frame)
 * @param diodeOffsetY - Vertical offset in SWITCH coordinates (positive = down in switch's frame)
 * @param diodeRotation - Diode rotation angle in degrees (0, 90, 180, 270)
 * @param switchRotation - Switch rotation angle in degrees (0, 90, 180, 270)
 * @param padding - Padding around the composite in mm
 * @returns ViewBox string in format "minX minY width height"
 *
 * @example
 * ```typescript
 * const switchVB = { x: 0, y: 0, width: 19.48, height: 19.13 }
 * const diodeVB = { x: 0, y: 0, width: 5.0, height: 3.0 }
 * // Switch at 180°, diode offset (5, 0) in switch coords
 * // Results in diode positioned 5mm to the LEFT in world coords
 * const composite = calculateCompositeViewBox(switchVB, diodeVB, 5.0, 0.0, 90, 180, 2.0)
 * // Returns optimized bounding box
 * ```
 */
export function calculateCompositeViewBox(
  switchVB: ViewBox,
  diodeVB: ViewBox,
  diodeOffsetX: number,
  diodeOffsetY: number,
  diodeRotation: number,
  switchRotation: number,
  padding: number,
): string {
  // Switch is centered at (0, 0) after its transform
  // Calculate switch bounds in the composite coordinate system
  const switchCenterX = switchVB.x + switchVB.width / 2
  const switchCenterY = switchVB.y + switchVB.height / 2

  // Switch corners after centering at origin
  const switchMinX = switchVB.x - switchCenterX
  const switchMinY = switchVB.y - switchCenterY
  const switchMaxX = switchMinX + switchVB.width
  const switchMaxY = switchMinY + switchVB.height

  // Diode center in its viewBox coordinate system
  const diodeCenterX = diodeVB.x + diodeVB.width / 2
  const diodeCenterY = diodeVB.y + diodeVB.height / 2

  // Diode corners in its original coordinate system
  const diodeCorners = [
    { x: diodeVB.x, y: diodeVB.y }, // top-left
    { x: diodeVB.x + diodeVB.width, y: diodeVB.y }, // top-right
    { x: diodeVB.x + diodeVB.width, y: diodeVB.y + diodeVB.height }, // bottom-right
    { x: diodeVB.x, y: diodeVB.y + diodeVB.height }, // bottom-left
  ]

  // CRITICAL: Diode offset must be rotated by switch rotation angle
  // to transform from switch-relative coordinates to world coordinates using decimal math
  const switchRotationRad = D.degreesToRadians(switchRotation)
  const rotatedOffset = D.rotatePoint(diodeOffsetX, diodeOffsetY, switchRotationRad)

  // CRITICAL: Diode rotation is also switch-relative
  // The diode maintains its orientation relative to the switch
  // Final rotation in world coords = diodeRotation + switchRotation
  const finalDiodeRotation = D.add(diodeRotation, switchRotation)

  // Apply the same transforms as in the component:
  // translate(rotatedOffset) rotate(finalDiodeRotation) translate(-center)
  const diodeRotationRad = D.degreesToRadians(finalDiodeRotation)

  const transformedCorners = diodeCorners.map((corner) => {
    // Step 1: Translate diode center to origin
    const x = D.sub(corner.x, diodeCenterX)
    const y = D.sub(corner.y, diodeCenterY)

    // Step 2: Rotate around origin by diode rotation using decimal math
    const rotated = D.rotatePoint(x, y, diodeRotationRad)

    // Step 3: Apply world-coordinate offset (already rotated by switch rotation)
    return {
      x: D.add(rotated.x, rotatedOffset.x),
      y: D.add(rotated.y, rotatedOffset.y),
    }
  })

  // Find bounding box of transformed diode using decimal math
  const diodeMinX = D.min(...transformedCorners.map((c) => c.x))
  const diodeMinY = D.min(...transformedCorners.map((c) => c.y))
  const diodeMaxX = D.max(...transformedCorners.map((c) => c.x))
  const diodeMaxY = D.max(...transformedCorners.map((c) => c.y))

  // Calculate composite bounds (start with switch, expand if diode extends beyond)
  const minX = D.sub(D.min(switchMinX, diodeMinX), padding)
  const minY = D.sub(D.min(switchMinY, diodeMinY), padding)
  const maxX = D.add(D.max(switchMaxX, diodeMaxX), padding)
  const maxY = D.add(D.max(switchMaxY, diodeMaxY), padding)

  const width = D.sub(maxX, minX)
  const height = D.sub(maxY, minY)

  return `${minX} ${minY} ${width} ${height}`
}

/**
 * Applies switch transform to convert local coordinates to world coordinates
 *
 * Applies the switch group's transform chain:
 * 1. translate(-centerX, -centerY) - center switch at origin
 * 2. rotate(switchRotation) - rotate around origin
 *
 * @param x - X coordinate in switch's original SVG space
 * @param y - Y coordinate in switch's original SVG space
 * @param switchVB - ViewBox of the switch footprint
 * @param switchRotation - Switch rotation angle in degrees (0, 90, 180, 270)
 * @returns Object with x, y coordinates in world space
 *
 * @example
 * ```typescript
 * // Switch center hole at (9.744, 9.575) in SVG, with 90° rotation
 * const world = applySwitchTransform(9.744, 9.575, switchVB, 90)
 * // Returns approximately (0, 0) since it's at the switch center
 * ```
 */
export function applySwitchTransform(
  x: number,
  y: number,
  switchVB: ViewBox,
  switchRotation: number,
): { x: number; y: number } {
  // Calculate switch center in its viewBox coordinate system using decimal math
  const centerX = D.add(switchVB.x, D.div(switchVB.width, 2))
  const centerY = D.add(switchVB.y, D.div(switchVB.height, 2))

  // Step 1: translate(-centerX, -centerY) - center at origin
  const x1 = D.sub(x, centerX)
  const y1 = D.sub(y, centerY)

  // Step 2: rotate(switchRotation) - rotate around origin using decimal math
  const rad = D.degreesToRadians(switchRotation)
  return D.rotatePoint(x1, y1, rad)
}

/**
 * Applies diode transform to convert local coordinates to world coordinates
 *
 * Applies the diode group's transform chain:
 * 1. translate(-centerX, -centerY) - center diode at origin
 * 2. rotate(finalRotation) - rotate around origin (diodeRotation + switchRotation)
 * 3. translate(rotatedOffset) - move to final position in world coords
 *
 * The offset is rotated by switchRotation to convert from switch-relative
 * coordinates to world coordinates.
 *
 * @param x - X coordinate in diode's original SVG space
 * @param y - Y coordinate in diode's original SVG space
 * @param diodeVB - ViewBox of the diode footprint
 * @param diodeOffsetX - Horizontal offset in SWITCH coordinates (positive = right in switch's frame)
 * @param diodeOffsetY - Vertical offset in SWITCH coordinates (positive = down in switch's frame)
 * @param diodeRotation - Diode rotation angle in degrees (switch-relative)
 * @param switchRotation - Switch rotation angle in degrees
 * @returns Object with x, y coordinates in world space
 *
 * @example
 * ```typescript
 * // Diode pad at (3.032, 2.453) in SVG, offset (5, 0) from switch, 90° diode rotation
 * const world = applyDiodeTransform(3.032, 2.453, diodeVB, 5.0, 0.0, 90, 0)
 * // Returns position relative to switch center (at origin)
 * ```
 */
export function applyDiodeTransform(
  x: number,
  y: number,
  diodeVB: ViewBox,
  diodeOffsetX: number,
  diodeOffsetY: number,
  diodeRotation: number,
  switchRotation: number,
): { x: number; y: number } {
  // Calculate diode center in its viewBox coordinate system using decimal math
  const centerX = D.add(diodeVB.x, D.div(diodeVB.width, 2))
  const centerY = D.add(diodeVB.y, D.div(diodeVB.height, 2))

  // Step 1: translate(-centerX, -centerY) - center diode at origin
  const x1 = D.sub(x, centerX)
  const y1 = D.sub(y, centerY)

  // Step 2: rotate by final rotation (diodeRotation + switchRotation) using decimal math
  const finalRotation = D.add(diodeRotation, switchRotation)
  const rad = D.degreesToRadians(finalRotation)
  const rotated = D.rotatePoint(x1, y1, rad)

  // Step 3: translate by rotated offset
  // Rotate the offset vector by switch rotation to convert from switch-relative to world coords
  const switchRotationRad = D.degreesToRadians(switchRotation)
  const rotatedOffset = D.rotatePoint(diodeOffsetX, diodeOffsetY, switchRotationRad)

  return {
    x: D.add(rotated.x, rotatedOffset.x),
    y: D.add(rotated.y, rotatedOffset.y),
  }
}

/**
 * Calculates the center of an SVG element in world coordinates
 *
 * Handles both circles and paths, accounting for:
 * - Element's own transform attribute if present
 * - Parent group transform (switch or diode)
 * - All rotation and positioning settings
 *
 * @param element - The SVG circle or path element
 * @param groupType - Which group the element belongs to ('switch' or 'diode')
 * @param switchVB - ViewBox of the switch footprint
 * @param diodeVB - ViewBox of the diode footprint
 * @param settings - PCB generator settings (rotation, positioning)
 * @returns Object with x, y coordinates in world space (mm)
 *
 * @example
 * ```typescript
 * const circle = document.querySelector('circle')
 * const center = calculateElementCenter(circle, 'switch', switchVB, diodeVB, settings)
 * // Returns: { x: 0.123, y: -2.456 } (world coordinates in mm)
 * ```
 */
export function calculateElementCenter(
  element: SVGCircleElement | SVGPathElement,
  groupType: 'switch' | 'diode',
  switchVB: ViewBox | null,
  diodeVB: ViewBox | null,
  settings: {
    switchRotation: number
    diodeRotation: number
    diodePositionX: number
    diodePositionY: number
  },
): { x: number; y: number } {
  // Extract local coordinates based on element type
  let localX: number, localY: number

  if (element.tagName === 'circle') {
    // Circle: use cx, cy attributes
    localX = parseFloat(element.getAttribute('cx') || '0')
    localY = parseFloat(element.getAttribute('cy') || '0')
  } else {
    // Path: use bounding box to calculate center
    const bbox = element.getBBox()
    localX = bbox.x + bbox.width / 2
    localY = bbox.y + bbox.height / 2
  }

  // Apply element's own transform if it has one
  const elementTransform = element.transform.baseVal
  if (elementTransform.numberOfItems > 0) {
    const matrix = elementTransform.consolidate()?.matrix
    if (matrix) {
      const transformedX = matrix.a * localX + matrix.c * localY + matrix.e
      const transformedY = matrix.b * localX + matrix.d * localY + matrix.f
      localX = transformedX
      localY = transformedY
    }
  }

  // Apply parent group transform based on group type
  if (groupType === 'switch') {
    if (!switchVB) return { x: 0, y: 0 }
    return applySwitchTransform(localX, localY, switchVB, settings.switchRotation)
  } else {
    if (!diodeVB) return { x: 0, y: 0 }
    return applyDiodeTransform(
      localX,
      localY,
      diodeVB,
      settings.diodePositionX,
      settings.diodePositionY,
      settings.diodeRotation,
      settings.switchRotation,
    )
  }
}
