/**
 * Footprint Preview Type Definitions
 *
 * Type definitions for the PCB footprint preview feature.
 * Used for displaying interactive switch and diode footprint overlays.
 */

/**
 * SVG ViewBox representation
 *
 * Represents the viewBox attribute of an SVG element, defining
 * the coordinate system and dimensions in millimeters.
 */
export interface ViewBox {
  /** Minimum X coordinate (left edge) in mm */
  x: number
  /** Minimum Y coordinate (top edge) in mm */
  y: number
  /** Width of the viewBox in mm */
  width: number
  /** Height of the viewBox in mm */
  height: number
}

/**
 * Footprint preview positioning settings
 *
 * Configuration for positioning the diode footprint relative
 * to the switch footprint center in the preview display.
 */
export interface FootprintPreviewSettings {
  /** Horizontal offset from switch center in mm (positive = right) */
  diodeOffsetX: number
  /** Vertical offset from switch center in mm (positive = down/below in SVG coordinates) */
  diodeOffsetY: number
  /** Padding around the composite viewBox in mm */
  containerPadding: number
}

/**
 * Hovered SVG element information
 *
 * Represents an SVG element (circle or path) that is currently being hovered
 * in the footprint preview, along with its calculated center coordinates in
 * world space (relative to switch center at origin).
 */
export interface HoveredFootprintElement {
  /** Element type - circle or path */
  type: 'circle' | 'path'
  /** Parent group - switch or diode */
  group: 'switch' | 'diode'
  /** Center X coordinate in world space (mm) */
  centerX: number
  /** Center Y coordinate in world space (mm) */
  centerY: number
  /** Reference to the DOM element */
  element: SVGCircleElement | SVGPathElement
}
