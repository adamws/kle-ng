/**
 * Footprint Utility Functions
 *
 * Helper functions for handling PCB footprint SVGs in the preview component.
 * Includes filename mapping, URL generation, viewBox parsing, and positioning calculations.
 */

import type { ViewBox } from '@/types/footprint'
import { D } from './decimal-math'
import { rotateKicad } from './kicad/transform'

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
    'Switch_Keyboard_Kailh:SW_Kailh_Choc_V1_{:.2f}u': 'SW_Kailh_Choc_V1_1.00u.svg',
    'Switch_Keyboard_Kailh:SW_Kailh_Choc_V2_{:.2f}u': 'SW_Kailh_Choc_V2_1.00u.svg',
    'Switch_Keyboard_Kailh:SW_Kailh_Choc_V1V2_{:.2f}u': 'SW_Kailh_Choc_V1V2_1.00u.svg',
    'Switch_Keyboard_Kailh:SW_Kailh_Choc_Mini_{:.2f}u': 'SW_Kailh_Choc_Mini_1.00u.svg',
    'Switch_Keyboard_Hotswap_Kailh:SW_Hotswap_Kailh_Choc_V1_{:.2f}u':
      'SW_Hotswap_Kailh_Choc_V1_1.00u.svg',
    'Switch_Keyboard_Hotswap_Kailh:SW_Hotswap_Kailh_Choc_V2_{:.2f}u':
      'SW_Hotswap_Kailh_Choc_V2_1.00u.svg',
    'Switch_Keyboard_Hotswap_Kailh:SW_Hotswap_Kailh_Choc_V1V2_{:.2f}u':
      'SW_Hotswap_Kailh_Choc_V1V2_1.00u.svg',
    'Switch_Keyboard_Hotswap_Kailh:SW_Hotswap_Kailh_MX_{:.2f}u': 'SW_Hotswap_Kailh_MX_1.00u.svg',
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
 * Extracts the SVG filename from a `library:name` footprint setting value.
 *
 * @param footprintValue - The footprint setting value (e.g. 'Capacitor_SMD:C_0402_1005Metric')
 * @param label - Human-readable footprint kind, used only in the warning message
 * @param fallback - SVG filename returned when the value is malformed
 * @returns `${name}.svg`, or `fallback` when the value has no `library:name` form
 */
function getFootprintFilename(footprintValue: string, label: string, fallback: string): string {
  const parts = footprintValue.split(':')
  if (parts.length === 2) {
    return `${parts[1]}.svg`
  }
  console.warn(`Invalid ${label} footprint format: ${footprintValue}, using ${fallback} fallback`)
  return fallback
}

/**
 * Extracts the LED footprint filename from its setting value.
 *
 * @param footprintValue - The LED footprint setting value (e.g. 'LED_SMD:LED_SK6812MINI-E_3.2x2.8mm_P1.5mm_ReverseMount')
 * @returns SVG filename for the LED footprint (placeholder until real SVGs land)
 */
export function getLedFootprintFilename(footprintValue: string): string {
  return getFootprintFilename(
    footprintValue,
    'LED',
    'LED_SK6812MINI-E_3.2x2.8mm_P1.5mm_ReverseMount.svg',
  )
}

/**
 * Extracts the LED decoupling-capacitor footprint filename from its setting value.
 *
 * @param footprintValue - The capacitor footprint setting value (e.g. 'Capacitor_SMD:C_0402_1005Metric')
 * @returns SVG filename for the capacitor footprint (placeholder until real SVGs land)
 */
export function getCapacitorFootprintFilename(footprintValue: string): string {
  return getFootprintFilename(footprintValue, 'capacitor', 'C_0402_1005Metric.svg')
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
 * An offset footprint (diode, LED, capacitor, …) positioned relative to the
 * switch center. Offsets and rotation are in SWITCH-RELATIVE coordinates,
 * matching the diode convention.
 */
export interface OffsetFootprint {
  vb: ViewBox
  offsetX: number
  offsetY: number
  rotation: number
  /** Board side, BACK mirrors the footprint top to bottom. Defaults to FRONT. */
  side?: BoardSide
}

export type BoardSide = 'FRONT' | 'BACK'

/*
 * Coordinate contract with kbplacer (the PCB generator backend).
 *
 * All coordinates are mm with +Y down, like KiCad. Rotations are KiCad
 * orientations: positive angles turn COUNTER-CLOCKWISE on screen, while SVG
 * `rotate()` turns clockwise, so SVG transforms use the negated angle.
 *
 * kbplacer places an element relative to its switch as follows:
 * 1. a BACK element is mirrored top to bottom (y -> -y) in its own frame,
 * 2. it is rotated by its switch-relative orientation,
 * 3. it is moved by its switch-relative offset.
 * The switch-local result is then rotated by the switch orientation.
 *
 * Footprint SVGs are drawn in footprint coordinates as seen from the front
 * (back side SVGs differ only in layer colours), with the footprint origin at
 * the viewBox centre.
 */

/** Converts a switch-local point to board axes (relative to the switch origin). */
export function switchLocalToBoard(
  p: { x: number; y: number },
  switchRotation: number,
): { x: number; y: number } {
  return rotateKicad(p, switchRotation)
}

/** Converts a point in board axes (relative to the switch origin) to switch-local. */
export function boardToSwitchLocal(
  p: { x: number; y: number },
  switchRotation: number,
): { x: number; y: number } {
  return rotateKicad(p, -switchRotation)
}

/** SVG transform drawing a switch SVG centred at the origin of board axes. */
export function switchSvgTransform(vb: ViewBox, switchRotation: number, side: BoardSide): string {
  const centerX = vb.x + vb.width / 2
  const centerY = vb.y + vb.height / 2
  const mirror = side === 'BACK' ? ' scale(1, -1)' : ''
  return `rotate(${-switchRotation})${mirror} translate(${-centerX}, ${-centerY})`
}

/** SVG transform drawing switch-local items (track preset) in board axes. */
export function switchLocalSvgTransform(switchRotation: number): string {
  return `rotate(${-switchRotation})`
}

/** SVG transform drawing an offset footprint SVG (diode, LED, …) in board axes. */
export function offsetSvgTransform(fp: OffsetFootprint, switchRotation: number): string {
  const centerX = fp.vb.x + fp.vb.width / 2
  const centerY = fp.vb.y + fp.vb.height / 2
  const mirror = fp.side === 'BACK' ? ' scale(1, -1)' : ''
  return (
    `rotate(${-switchRotation}) translate(${fp.offsetX}, ${fp.offsetY}) ` +
    `rotate(${-fp.rotation})${mirror} translate(${-centerX}, ${-centerY})`
  )
}

/**
 * Calculates the composite viewBox for the switch plus an arbitrary number of
 * offset footprints (diode, LED, decoupling capacitor, …).
 *
 * Reuses {@link applySwitchTransform} / {@link applyDiodeTransform} so the
 * computed bounds exactly match how each group is rendered (including switch
 * rotation, which is reflected in the switch's own bounds).
 *
 * @param switchVB - ViewBox of the switch footprint (centered at origin)
 * @param offsets - Offset footprints to include in the bounds
 * @param switchRotation - Switch rotation angle in degrees
 * @param padding - Padding around the composite in mm
 * @param switchSide - Switch board side
 * @returns ViewBox string in format "minX minY width height"
 */
export function calculateCompositeViewBoxMulti(
  switchVB: ViewBox,
  offsets: OffsetFootprint[],
  switchRotation: number,
  padding: number,
  switchSide: BoardSide = 'FRONT',
): string {
  const xs: number[] = []
  const ys: number[] = []

  // Switch corners (centered at origin, then rotated) via the shared transform.
  const switchCorners = [
    { x: switchVB.x, y: switchVB.y },
    { x: switchVB.x + switchVB.width, y: switchVB.y },
    { x: switchVB.x + switchVB.width, y: switchVB.y + switchVB.height },
    { x: switchVB.x, y: switchVB.y + switchVB.height },
  ]
  for (const corner of switchCorners) {
    const world = applySwitchTransform(corner.x, corner.y, switchVB, switchRotation, switchSide)
    xs.push(world.x)
    ys.push(world.y)
  }

  // Each offset footprint's corners via the same transform used to render it.
  for (const fp of offsets) {
    const corners = [
      { x: fp.vb.x, y: fp.vb.y },
      { x: fp.vb.x + fp.vb.width, y: fp.vb.y },
      { x: fp.vb.x + fp.vb.width, y: fp.vb.y + fp.vb.height },
      { x: fp.vb.x, y: fp.vb.y + fp.vb.height },
    ]
    for (const corner of corners) {
      const world = applyDiodeTransform(
        corner.x,
        corner.y,
        fp.vb,
        fp.offsetX,
        fp.offsetY,
        fp.rotation,
        switchRotation,
        fp.side,
      )
      xs.push(world.x)
      ys.push(world.y)
    }
  }

  const minX = D.sub(D.min(...xs), padding)
  const minY = D.sub(D.min(...ys), padding)
  const maxX = D.add(D.max(...xs), padding)
  const maxY = D.add(D.max(...ys), padding)

  return `${minX} ${minY} ${D.sub(maxX, minX)} ${D.sub(maxY, minY)}`
}

/**
 * Applies switch transform to convert local coordinates to world coordinates
 *
 * Matches {@link switchSvgTransform}:
 * 1. translate(-centerX, -centerY) - center switch at origin
 * 2. mirror top to bottom when the switch is on the BACK side
 * 3. rotate by the switch orientation (KiCad, counter-clockwise on screen)
 *
 * @param x - X coordinate in switch's original SVG space
 * @param y - Y coordinate in switch's original SVG space
 * @param switchVB - ViewBox of the switch footprint
 * @param switchRotation - Switch orientation in degrees
 * @param switchSide - Switch board side
 * @returns Object with x, y coordinates in world space
 */
export function applySwitchTransform(
  x: number,
  y: number,
  switchVB: ViewBox,
  switchRotation: number,
  switchSide: BoardSide = 'FRONT',
): { x: number; y: number } {
  // Calculate switch center in its viewBox coordinate system using decimal math
  const centerX = D.add(switchVB.x, D.div(switchVB.width, 2))
  const centerY = D.add(switchVB.y, D.div(switchVB.height, 2))

  // Step 1: translate(-centerX, -centerY) - center at origin
  const x1 = D.sub(x, centerX)
  let y1 = D.sub(y, centerY)

  // Step 2: mirror BACK side footprints top to bottom
  if (switchSide === 'BACK') y1 = -y1

  // Step 3: rotate counter-clockwise on screen (D.rotatePoint turns clockwise)
  const rad = D.degreesToRadians(-switchRotation)
  return D.rotatePoint(x1, y1, rad)
}

/**
 * Applies diode transform to convert local coordinates to world coordinates
 *
 * Matches {@link offsetSvgTransform} and kbplacer's placement:
 * 1. translate(-centerX, -centerY) - center diode at origin
 * 2. mirror top to bottom when the diode is on the BACK side
 * 3. rotate by the diode orientation, then translate by the offset
 *    (both switch-relative)
 * 4. rotate by the switch orientation
 * Rotations are KiCad orientations, counter-clockwise on screen.
 *
 * @param x - X coordinate in diode's original SVG space
 * @param y - Y coordinate in diode's original SVG space
 * @param diodeVB - ViewBox of the diode footprint
 * @param diodeOffsetX - Horizontal offset in SWITCH coordinates (positive = right in switch's frame)
 * @param diodeOffsetY - Vertical offset in SWITCH coordinates (positive = down in switch's frame)
 * @param diodeRotation - Diode orientation in degrees (switch-relative)
 * @param switchRotation - Switch orientation in degrees
 * @param diodeSide - Diode board side
 * @returns Object with x, y coordinates in world space
 */
export function applyDiodeTransform(
  x: number,
  y: number,
  diodeVB: ViewBox,
  diodeOffsetX: number,
  diodeOffsetY: number,
  diodeRotation: number,
  switchRotation: number,
  diodeSide: BoardSide = 'FRONT',
): { x: number; y: number } {
  // Calculate diode center in its viewBox coordinate system using decimal math
  const centerX = D.add(diodeVB.x, D.div(diodeVB.width, 2))
  const centerY = D.add(diodeVB.y, D.div(diodeVB.height, 2))

  // Step 1: translate(-centerX, -centerY) - center diode at origin
  const x1 = D.sub(x, centerX)
  let y1 = D.sub(y, centerY)

  // Step 2: mirror BACK side footprints top to bottom
  if (diodeSide === 'BACK') y1 = -y1

  // Step 3: switch-local position (D.rotatePoint turns clockwise, so negate)
  const rotated = D.rotatePoint(x1, y1, D.degreesToRadians(-diodeRotation))
  const local = { x: D.add(rotated.x, diodeOffsetX), y: D.add(rotated.y, diodeOffsetY) }

  // Step 4: rotate the switch-local position by the switch orientation
  return D.rotatePoint(local.x, local.y, D.degreesToRadians(-switchRotation))
}
