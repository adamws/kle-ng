/**
 * Border radius utilities for canvas rendering
 * Supports CSS border-radius syntax with separate corners and elliptical radii
 */

export interface BorderRadiusCorner {
  x: number
  y: number
}

export interface BorderRadiusCorners {
  topLeft: BorderRadiusCorner
  topRight: BorderRadiusCorner
  bottomRight: BorderRadiusCorner
  bottomLeft: BorderRadiusCorner
}

/**
 * Parse CSS border-radius values into individual corner specifications
 * @param radii CSS border-radius string (e.g., "10px", "5px 10px", "10px / 20px")
 * @param canvasWidth Canvas width for percentage calculations
 * @param canvasHeight Canvas height for percentage calculations
 * @returns Parsed corner specifications
 */
export function parseBorderRadius(
  radii: string,
  canvasWidth: number,
  canvasHeight: number,
): BorderRadiusCorners {
  // Remove extra whitespace and normalize
  const normalized = radii.trim().replace(/\s+/g, ' ')

  // Split by "/" to separate horizontal and vertical radii
  const parts = normalized.split('/')
  const horizontal = (parts[0] ?? '').trim().split(' ')
  const vertical = parts[1] ? parts[1].trim().split(' ') : horizontal

  // Parse individual values, supporting px, %, and unitless numbers
  const parseValue = (value: string, dimension: number): number => {
    if (value.endsWith('px')) {
      return parseFloat(value)
    } else if (value.endsWith('%')) {
      return (parseFloat(value) / 100) * dimension
    } else {
      return parseFloat(value) || 0
    }
  }

  // CSS border-radius follows: top-left, top-right, bottom-right, bottom-left
  // If fewer values, they're expanded according to CSS rules
  const expandValues = (values: string[]): [string, string, string, string] => {
    const defaultValue = values[0] ?? '0'
    switch (values.length) {
      case 1:
        return [defaultValue, defaultValue, defaultValue, defaultValue]
      case 2:
        return [values[0] ?? '0', values[1] ?? '0', values[0] ?? '0', values[1] ?? '0']
      case 3:
        return [values[0] ?? '0', values[1] ?? '0', values[2] ?? '0', values[1] ?? '0']
      case 4:
        return [values[0] ?? '0', values[1] ?? '0', values[2] ?? '0', values[3] ?? '0']
      default:
        return [values[0] ?? '0', values[1] ?? '0', values[2] ?? '0', values[3] ?? '0']
    }
  }

  const hValues = expandValues(horizontal)
  const vValues = expandValues(vertical)

  return {
    topLeft: {
      x: parseValue(hValues[0], canvasWidth),
      y: parseValue(vValues[0], canvasHeight),
    },
    topRight: {
      x: parseValue(hValues[1], canvasWidth),
      y: parseValue(vValues[1], canvasHeight),
    },
    bottomRight: {
      x: parseValue(hValues[2], canvasWidth),
      y: parseValue(vValues[2], canvasHeight),
    },
    bottomLeft: {
      x: parseValue(hValues[3], canvasWidth),
      y: parseValue(vValues[3], canvasHeight),
    },
  }
}

/**
 * Create a rounded rectangle path on a canvas context
 * @param ctx Canvas 2D context
 * @param x Rectangle x position
 * @param y Rectangle y position
 * @param width Rectangle width
 * @param height Rectangle height
 * @param corners Border radius corners specification
 */
export function createRoundedRectanglePath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  corners: BorderRadiusCorners,
): void {
  ctx.beginPath()

  // Start at top-left corner (after the curve)
  ctx.moveTo(x + corners.topLeft.x, y)

  // Top edge to top-right corner
  ctx.lineTo(x + width - corners.topRight.x, y)

  // Top-right corner (elliptical)
  if (corners.topRight.x > 0 || corners.topRight.y > 0) {
    if (typeof ctx.ellipse === 'function') {
      ctx.ellipse(
        x + width - corners.topRight.x,
        y + corners.topRight.y,
        corners.topRight.x,
        corners.topRight.y,
        0,
        -Math.PI / 2,
        0,
      )
    } else if (typeof ctx.arc === 'function') {
      // Fallback for limited environments - use arc for circular corners
      ctx.arc(
        x + width - corners.topRight.x,
        y + corners.topRight.y,
        Math.min(corners.topRight.x, corners.topRight.y),
        -Math.PI / 2,
        0,
      )
    }
    // Skip drawing curves in test environments that lack canvas curve support
  }

  // Right edge to bottom-right corner
  ctx.lineTo(x + width, y + height - corners.bottomRight.y)

  // Bottom-right corner (elliptical)
  if (corners.bottomRight.x > 0 || corners.bottomRight.y > 0) {
    if (typeof ctx.ellipse === 'function') {
      ctx.ellipse(
        x + width - corners.bottomRight.x,
        y + height - corners.bottomRight.y,
        corners.bottomRight.x,
        corners.bottomRight.y,
        0,
        0,
        Math.PI / 2,
      )
    } else if (typeof ctx.arc === 'function') {
      // Fallback for limited environments - use arc for circular corners
      ctx.arc(
        x + width - corners.bottomRight.x,
        y + height - corners.bottomRight.y,
        Math.min(corners.bottomRight.x, corners.bottomRight.y),
        0,
        Math.PI / 2,
      )
    }
    // Skip drawing curves in test environments that lack canvas curve support
  }

  // Bottom edge to bottom-left corner
  ctx.lineTo(x + corners.bottomLeft.x, y + height)

  // Bottom-left corner (elliptical)
  if (corners.bottomLeft.x > 0 || corners.bottomLeft.y > 0) {
    if (typeof ctx.ellipse === 'function') {
      ctx.ellipse(
        x + corners.bottomLeft.x,
        y + height - corners.bottomLeft.y,
        corners.bottomLeft.x,
        corners.bottomLeft.y,
        0,
        Math.PI / 2,
        Math.PI,
      )
    } else if (typeof ctx.arc === 'function') {
      // Fallback for limited environments - use arc for circular corners
      ctx.arc(
        x + corners.bottomLeft.x,
        y + height - corners.bottomLeft.y,
        Math.min(corners.bottomLeft.x, corners.bottomLeft.y),
        Math.PI / 2,
        Math.PI,
      )
    }
    // Skip drawing curves in test environments that lack canvas curve support
  }

  // Left edge to top-left corner
  ctx.lineTo(x, y + corners.topLeft.y)

  // Top-left corner (elliptical)
  if (corners.topLeft.x > 0 || corners.topLeft.y > 0) {
    if (typeof ctx.ellipse === 'function') {
      ctx.ellipse(
        x + corners.topLeft.x,
        y + corners.topLeft.y,
        corners.topLeft.x,
        corners.topLeft.y,
        0,
        Math.PI,
        -Math.PI / 2,
      )
    } else if (typeof ctx.arc === 'function') {
      // Fallback for limited environments - use arc for circular corners
      ctx.arc(
        x + corners.topLeft.x,
        y + corners.topLeft.y,
        Math.min(corners.topLeft.x, corners.topLeft.y),
        Math.PI,
        -Math.PI / 2,
      )
    }
    // Skip drawing curves in test environments that lack canvas curve support
  }

  ctx.closePath()
}
