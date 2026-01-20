import type { Key } from '@adamws/kle-serial'
import type { KeyRenderParams } from '../canvas-renderer'

/**
 * HitTester - Determines which key (if any) is at a given canvas position
 *
 * This utility handles:
 * - Hit testing with rotation support
 * - Non-rectangular keys (ISO Enter, Big-Ass Enter)
 * - Proper z-order (last key in array is on top)
 * - Inverse rotation transformation for rotated keys
 *
 * Algorithm:
 * 1. Iterate keys from last to first (z-order)
 * 2. For each key:
 *    a. If rotated: apply inverse rotation to test coordinates
 *    b. Test if coordinates are inside key bounds
 *    c. For non-rectangular keys: test both rectangles
 * 3. Return first matching key (or null)
 *
 * Usage:
 * ```typescript
 * const tester = new HitTester(unit, getRenderParamsFn)
 *
 * // Test if a position hits a key
 * const key = tester.getKeyAtPosition(canvasX, canvasY, keys)
 *
 * // Get all keys at a position (for overlapping key disambiguation)
 * const allKeys = tester.getAllKeysAtPosition(canvasX, canvasY, keys)
 * ```
 *
 * @class HitTester
 */
export class HitTester {
  private unit: number
  private getRenderParamsFn: (key: Key, options: { unit: number }) => KeyRenderParams

  /**
   * Create a new HitTester
   *
   * @param unit - Pixel size of one keyboard unit
   * @param getRenderParamsFn - Function to get render parameters for a key
   */
  constructor(
    unit: number,
    getRenderParamsFn: (key: Key, options: { unit: number }) => KeyRenderParams,
  ) {
    this.unit = unit
    this.getRenderParamsFn = getRenderParamsFn
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
   * Test if a point is inside a key's bounds
   *
   * Handles rotation by applying inverse rotation to test coordinates.
   * For non-rectangular keys, tests both rectangles.
   *
   * @param x - X coordinate in canvas pixels
   * @param y - Y coordinate in canvas pixels
   * @param key - The key to test against
   * @param params - Pre-computed render parameters for the key
   * @returns True if the point is inside the key
   */
  private isPointInKey(x: number, y: number, key: Key, params: KeyRenderParams): boolean {
    let testX = x
    let testY = y

    // If key is rotated, apply inverse rotation to test coordinates
    if (key.rotation_angle) {
      const angle = (-key.rotation_angle * Math.PI) / 180 // Inverse rotation
      const originX = params.origin_x
      const originY = params.origin_y

      // Translate to origin
      const translatedX = x - originX
      const translatedY = y - originY

      // Apply rotation
      const cos = Math.cos(angle)
      const sin = Math.sin(angle)
      testX = translatedX * cos - translatedY * sin + originX
      testY = translatedX * sin + translatedY * cos + originY
    }

    // Test main key area
    if (
      testX >= params.outercapx &&
      testX <= params.outercapx + params.outercapwidth &&
      testY >= params.outercapy &&
      testY <= params.outercapy + params.outercapheight
    ) {
      return true
    }

    // Check second part for non-rectangular keys
    if (params.nonRectangular && params.outercapx2 !== undefined) {
      if (
        testX >= params.outercapx2 &&
        testX <= params.outercapx2 + params.outercapwidth2! &&
        testY >= params.outercapy2! &&
        testY <= params.outercapy2! + params.outercapheight2!
      ) {
        return true
      }
    }

    return false
  }

  /**
   * Get the key at a canvas position (topmost only)
   *
   * Tests each key's bounding box to determine if the position is inside.
   * Handles rotation by applying inverse rotation to the test coordinates.
   * Checks keys in reverse order (last key on top) for proper z-ordering.
   *
   * For rotated keys:
   * 1. Apply inverse rotation to test coordinates
   * 2. Test rotated coordinates against axis-aligned key bounds
   *
   * For non-rectangular keys:
   * 1. Test against primary rectangle
   * 2. If no hit, test against secondary rectangle
   *
   * @param x - X coordinate in canvas pixels
   * @param y - Y coordinate in canvas pixels
   * @param keys - Array of keys to test against
   * @returns The key at this position, or null if no key found
   */
  public getKeyAtPosition(x: number, y: number, keys: Key[]): Key | null {
    // Hit testing with rotation support - check each key's bounding box
    // Iterate from last to first for proper z-order (last key is on top)
    for (let i = keys.length - 1; i >= 0; i--) {
      const key = keys[i]
      if (!key) continue // Skip if key is undefined

      const params = this.getRenderParamsFn(key, { unit: this.unit })

      if (this.isPointInKey(x, y, key, params)) {
        return key
      }
    }

    return null
  }

  /**
   * Get all keys at a canvas position (for overlapping key disambiguation)
   *
   * Similar to getKeyAtPosition but returns ALL keys that contain the point,
   * not just the topmost one. Keys are returned in z-order (topmost first).
   *
   * Use this when you need to handle overlapping keys and allow the user
   * to choose which key to select.
   *
   * @param x - X coordinate in canvas pixels
   * @param y - Y coordinate in canvas pixels
   * @param keys - Array of keys to test against
   * @returns Array of keys at this position, ordered topmost first (empty if none)
   */
  public getAllKeysAtPosition(x: number, y: number, keys: Key[]): Key[] {
    const result: Key[] = []

    // Iterate from last to first for proper z-order (topmost first in result)
    for (let i = keys.length - 1; i >= 0; i--) {
      const key = keys[i]
      if (!key) continue // Skip if key is undefined

      const params = this.getRenderParamsFn(key, { unit: this.unit })

      if (this.isPointInKey(x, y, key, params)) {
        result.push(key)
      }
    }

    return result
  }
}

// Export factory function for convenience
export function createHitTester(
  unit: number,
  getRenderParamsFn: (key: Key, options: { unit: number }) => KeyRenderParams,
): HitTester {
  return new HitTester(unit, getRenderParamsFn)
}
