import type { Key } from '@adamws/kle-serial'
import { D } from '../decimal-math'

/**
 * Represents the bounding box of a key or group of keys
 */
export interface Bounds {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Represents the min/max coordinates of a bounding box
 */
export interface MinMaxBounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

/**
 * BoundsCalculator - Calculates bounding boxes for keys and keyboard layouts
 *
 * This utility handles:
 * - Calculating bounds for single keys (with rotation support)
 * - Calculating aggregate bounds for multiple keys
 * - Accounting for stroke width in bounds
 * - Handling non-rectangular keys (ISO Enter, Big-Ass Enter)
 *
 * All calculations use decimal-math for precision to match the renderer.
 *
 * Usage:
 * ```typescript
 * const calculator = new BoundsCalculator(unit)
 *
 * // Get bounds for a single key
 * const keyBounds = calculator.calculateRotatedKeyBounds(key)
 *
 * // Get bounds for entire layout
 * const layoutBounds = calculator.calculateBounds(keys)
 * ```
 *
 * @class BoundsCalculator
 */
export class BoundsCalculator {
  private unit: number

  /**
   * Create a new BoundsCalculator
   *
   * @param unit - Pixel size of one keyboard unit
   */
  constructor(unit: number) {
    this.unit = unit
  }

  /**
   * Update the unit size
   *
   * @param unit - New pixel size of one keyboard unit
   */
  public setUnit(unit: number): void {
    this.unit = unit
  }

  /**
   * Calculate bounding box for multiple keys
   *
   * Returns the smallest axis-aligned bounding box that contains all keys.
   * Takes rotation into account for each key.
   *
   * @param keys - Array of keys to calculate bounds for
   * @returns Bounding box in canvas coordinates (pixels)
   */
  public calculateBounds(keys: Key[]): Bounds {
    if (keys.length === 0) {
      return { x: 0, y: 0, width: 0, height: 0 }
    }

    let minX = Infinity,
      minY = Infinity
    let maxX = -Infinity,
      maxY = -Infinity

    keys.forEach((key) => {
      const bounds = this.calculateRotatedKeyBounds(key)

      minX = Math.min(minX, bounds.minX)
      minY = Math.min(minY, bounds.minY)
      maxX = Math.max(maxX, bounds.maxX)
      maxY = Math.max(maxY, bounds.maxY)
    })

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    }
  }

  /**
   * Calculate bounding box for a single key with rotation support
   *
   * Returns the axis-aligned bounding box that contains the rotated key.
   * For non-rectangular keys (ISO Enter, Big-Ass Enter), includes both rectangles.
   * Includes stroke width in calculations (1px).
   *
   * Algorithm:
   * 1. If no rotation: simple rectangle bounds
   * 2. If rotated:
   *    a. Get all corner points (4 or 8 for non-rectangular)
   *    b. Apply rotation transformation to each corner
   *    c. Find min/max of rotated corners
   *
   * @param key - Key to calculate bounds for
   * @returns Min/max bounds in canvas coordinates (pixels)
   */
  public calculateRotatedKeyBounds(key: Key): MinMaxBounds {
    // Include stroke width in bounds calculation (keys use 1px stroke)
    const strokeWidth = 1

    // If key has no rotation, use simple bounds
    if (!key.rotation_angle || key.rotation_angle === 0) {
      const unit = this.unit

      // Primary rectangle bounds
      const x1 = key.x * unit
      const y1 = key.y * unit
      const x2 = x1 + key.width * unit
      const y2 = y1 + key.height * unit

      let minX = x1
      let minY = y1
      let maxX = x2
      let maxY = y2

      // For non-rectangular keys, include secondary rectangle bounds
      if (key.width2 && key.height2) {
        const x2_1 = (key.x + (key.x2 || 0)) * unit
        const y2_1 = (key.y + (key.y2 || 0)) * unit
        const x2_2 = x2_1 + key.width2 * unit
        const y2_2 = y2_1 + key.height2 * unit

        minX = Math.min(minX, x2_1)
        minY = Math.min(minY, y2_1)
        maxX = Math.max(maxX, x2_2)
        maxY = Math.max(maxY, y2_2)
      }

      return {
        minX,
        minY,
        maxX: maxX + strokeWidth,
        maxY: maxY + strokeWidth,
      }
    }

    // Calculate rotation transformation matrix
    const unit = this.unit
    const originX = D.mul(key.rotation_x || 0, unit)
    const originY = D.mul(key.rotation_y || 0, unit)

    // Convert rotation angle to radians
    const rad = D.degreesToRadians(key.rotation_angle)
    const cos = D.cos(rad)
    const sin = D.sin(rad)

    // Calculate key bounds in canvas coordinates
    const keyX = D.mul(key.x, unit)
    const keyY = D.mul(key.y, unit)
    const keyWidth = D.mul(key.width, unit)
    const keyHeight = D.mul(key.height, unit)

    // Get all corner points of the key
    const corners = [
      { x: keyX, y: keyY }, // top-left
      { x: D.add(keyX, keyWidth), y: keyY }, // top-right
      { x: keyX, y: D.add(keyY, keyHeight) }, // bottom-left
      { x: D.add(keyX, keyWidth), y: D.add(keyY, keyHeight) }, // bottom-right
    ]

    // For non-rectangular keys, add the second rectangle corners
    if (key.width2 && key.height2) {
      const keyX2 = D.mul(D.add(key.x, key.x2 || 0), unit)
      const keyY2 = D.mul(D.add(key.y, key.y2 || 0), unit)
      const keyWidth2 = D.mul(key.width2, unit)
      const keyHeight2 = D.mul(key.height2, unit)

      corners.push(
        { x: keyX2, y: keyY2 }, // second rect top-left
        { x: D.add(keyX2, keyWidth2), y: keyY2 }, // second rect top-right
        { x: keyX2, y: D.add(keyY2, keyHeight2) }, // second rect bottom-left
        { x: D.add(keyX2, keyWidth2), y: D.add(keyY2, keyHeight2) }, // second rect bottom-right
      )
    }

    // Transform all corners and find bounding box
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity

    corners.forEach((corner) => {
      // Translate to origin, rotate, then translate back
      const translatedX = D.sub(corner.x, originX)
      const translatedY = D.sub(corner.y, originY)
      const rotatedX = D.sub(D.mul(cos, translatedX), D.mul(sin, translatedY))
      const rotatedY = D.add(D.mul(sin, translatedX), D.mul(cos, translatedY))
      const finalX = D.add(rotatedX, originX)
      const finalY = D.add(rotatedY, originY)

      minX = D.min(minX, finalX)
      minY = D.min(minY, finalY)
      maxX = D.max(maxX, finalX)
      maxY = D.max(maxY, finalY)
    })

    // Add stroke width to rotated bounds
    return {
      minX,
      minY,
      maxX: maxX + strokeWidth,
      maxY: maxY + strokeWidth,
    }
  }
}

// Export singleton-style factory for convenience
export function createBoundsCalculator(unit: number): BoundsCalculator {
  return new BoundsCalculator(unit)
}
