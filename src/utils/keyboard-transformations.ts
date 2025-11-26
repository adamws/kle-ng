/**
 * Keyboard Transformation Utilities
 *
 * Pure functions for geometric transformations of keyboard keys.
 * These functions modify Key objects to change their rotation origins and positions
 * while preserving their visual appearance on screen, or create mirrored copies of keys.
 *
 * Key concepts:
 * - Rotation origin: The point around which a key rotates
 * - Visual position: Where the key appears on screen after rotation transformation
 * - Coordinate transformation: Converting between rotated and screen coordinate systems
 * - Mirroring: Creating copies of keys reflected across horizontal/vertical axes
 *
 * @module keyboard-transformations
 */

import type { Key } from '@adamws/kle-serial'
import { D } from './decimal-math'

/**
 * Transform rotation origin from current to target point without changing visual appearance.
 *
 * This function handles the complex geometry of moving a key's rotation origin while ensuring
 * the key continues to appear in the same screen position. For rotated keys, this requires
 * calculating the current rendered position, then applying inverse rotation mathematics to
 * determine the new key position that will render identically.
 *
 * Algorithm:
 * 1. For non-rotated keys (angle=0 or undefined): Simply set the new rotation origin
 * 2. For rotated keys:
 *    a. Calculate current rendered position using rotation matrix
 *    b. Determine new key position via inverse rotation
 *    c. Update key.x, key.y, key.rotation_x, key.rotation_y
 *
 * @param key - The key to transform (modified in place)
 * @param targetOriginX - Target rotation origin X coordinate
 * @param targetOriginY - Target rotation origin Y coordinate
 *
 * @example
 * ```typescript
 * const key = new Key()
 * key.x = 1
 * key.y = 1
 * key.rotation_angle = 45
 * key.rotation_x = 0.5
 * key.rotation_y = 0.5
 *
 * // Move rotation origin to (3, 3) while preserving visual position
 * transformRotationOrigin(key, 3, 3)
 *
 * // Key still appears in same position, but rotates around (3, 3) now
 * console.log(key.rotation_x) // 3
 * console.log(key.rotation_y) // 3
 * ```
 */
export function transformRotationOrigin(
  key: Key,
  targetOriginX: number,
  targetOriginY: number,
): void {
  // Only process keys that have rotation properties
  if (
    !key.rotation_angle ||
    key.rotation_angle === 0 ||
    key.rotation_x === undefined ||
    key.rotation_y === undefined
  ) {
    // For non-rotated keys, just set the new origin
    key.rotation_x = targetOriginX
    key.rotation_y = targetOriginY
    return
  }

  const currentOriginX = key.rotation_x
  const currentOriginY = key.rotation_y
  const angle = key.rotation_angle

  const angleRad = D.degreesToRadians(angle)
  const cos = Math.cos(angleRad)
  const sin = Math.sin(angleRad)

  // Step 1: Calculate current rendered position of key's top-left corner
  const dx_key = D.sub(key.x, currentOriginX)
  const dy_key = D.sub(key.y, currentOriginY)

  const renderedKeyX = D.add(currentOriginX, D.sub(D.mul(dx_key, cos), D.mul(dy_key, sin)))
  const renderedKeyY = D.add(currentOriginY, D.add(D.mul(dx_key, sin), D.mul(dy_key, cos)))

  // Step 2: Calculate new key position so that when rotated around target origin,
  // it produces the same rendered position
  const dx_rendered = D.sub(renderedKeyX, targetOriginX)
  const dy_rendered = D.sub(renderedKeyY, targetOriginY)

  // Apply inverse rotation to get new key position
  const newX = D.add(targetOriginX, D.add(D.mul(dx_rendered, cos), D.mul(dy_rendered, sin)))
  const newY = D.add(targetOriginY, D.sub(D.mul(dy_rendered, cos), D.mul(dx_rendered, sin)))

  // Update key properties
  key.x = newX
  key.y = newY
  key.rotation_x = targetOriginX
  key.rotation_y = targetOriginY
}

/**
 * Move rotation origins to a specific position or key centers without changing visual appearance.
 *
 * This function supports two operational modes:
 *
 * **Mode 1 (position=null)**: Move each key's rotation origin to its visual center
 * - For rotated keys: Calculates the visual (rendered) center using rotation transformation
 * - For non-rotated keys: Uses geometric center (x + width/2, y + height/2)
 * - Each key gets its own rotation origin at its center
 *
 * **Mode 2 (position={x,y})**: Move all keys to share a common rotation origin
 * - All keys will rotate around the specified point
 * - Useful for creating rotation clusters (e.g., ErgoDox thumb clusters)
 *
 * @param keys - All keys in the layout (used for context)
 * @param position - Target position for rotation origin, or null to use key centers
 * @param targetKeys - Specific keys to modify (defaults to all keys)
 * @returns Count of keys that were modified
 *
 * @example
 * ```typescript
 * // Mode 1: Move each key to its own center
 * const count1 = moveRotationOriginsToPosition(allKeys, null, selectedKeys)
 * console.log(`Moved ${count1} keys to their centers`)
 *
 * // Mode 2: Move all keys to shared position
 * const count2 = moveRotationOriginsToPosition(allKeys, { x: 5, y: 5 }, selectedKeys)
 * console.log(`Moved ${count2} keys to shared origin at (5, 5)`)
 * ```
 */
export function moveRotationOriginsToPosition(
  keys: Key[],
  position: { x: number; y: number } | null,
  targetKeys?: Key[],
): number {
  const keysToModify = targetKeys || keys
  let modifiedCount = 0

  keysToModify.forEach((key) => {
    if (position === null) {
      // Mode 1: Move to key centers (each key uses its own center)
      if (key.rotation_angle && key.rotation_angle !== 0) {
        // Calculate visual center of the rotated key
        const currentOriginX = key.rotation_x!
        const currentOriginY = key.rotation_y!
        const angle = key.rotation_angle

        const angleRad = D.degreesToRadians(angle)
        const cos = Math.cos(angleRad)
        const sin = Math.sin(angleRad)

        // Get unrotated center and transform it to visual center
        const unrotatedCenterX = D.add(key.x, D.div(key.width || 1, 2))
        const unrotatedCenterY = D.add(key.y, D.div(key.height || 1, 2))

        const dx_center = D.sub(unrotatedCenterX, currentOriginX)
        const dy_center = D.sub(unrotatedCenterY, currentOriginY)

        const visualCenterX = D.add(
          currentOriginX,
          D.sub(D.mul(dx_center, cos), D.mul(dy_center, sin)),
        )
        const visualCenterY = D.add(
          currentOriginY,
          D.add(D.mul(dx_center, sin), D.mul(dy_center, cos)),
        )

        // Use generalized function to transform rotation origin
        transformRotationOrigin(key, visualCenterX, visualCenterY)
        modifiedCount++
      } else {
        // For non-rotated keys, set rotation origin to their center
        const centerX = D.add(key.x, D.div(key.width || 1, 2))
        const centerY = D.add(key.y, D.div(key.height || 1, 2))
        key.rotation_x = centerX
        key.rotation_y = centerY
        modifiedCount++
      }
    } else {
      // Mode 2: Move to specified position (all keys share this origin)
      transformRotationOrigin(key, position.x, position.y)
      modifiedCount++
    }
  })

  return modifiedCount
}

/**
 * Mirror axis configuration for key mirroring operations.
 *
 * Defines a line across which keys will be mirrored:
 * - Horizontal axis (direction='horizontal'): Line parallel to X-axis at specified Y coordinate
 * - Vertical axis (direction='vertical'): Line parallel to Y-axis at specified X coordinate
 */
export type MirrorAxis = {
  /** X coordinate of the mirror line (used for vertical mirroring) */
  x: number
  /** Y coordinate of the mirror line (used for horizontal mirroring) */
  y: number
  /** Direction of the mirror axis */
  direction: 'horizontal' | 'vertical'
}

/**
 * Mirror keys across an axis, creating new mirrored copies.
 *
 * This function creates deep clones of the input keys and mirrors them across
 * the specified axis. The mirroring handles both position and rotation:
 *
 * **Horizontal Mirror (across Y-axis)**:
 * - Mirrors Y position: `new_y = 2 * lineY - keyY - keyHeight`
 * - Negates rotation angle: `new_angle = -angle`
 * - Mirrors rotation_y origin
 * - Preserves rotation_x origin
 *
 * **Vertical Mirror (across X-axis)**:
 * - Mirrors X position: `new_x = 2 * lineX - keyX - keyWidth`
 * - Negates rotation angle: `new_angle = -angle`
 * - Mirrors rotation_x origin
 * - Preserves rotation_y origin
 *
 * @param keys - Keys to mirror (originals are not modified)
 * @param axis - Mirror axis configuration
 * @returns Array of new mirrored key copies
 *
 * @example
 * ```typescript
 * const originalKeys = [key1, key2, key3]
 * const axis: MirrorAxis = {
 *   x: 7,
 *   y: 4,
 *   direction: 'horizontal'
 * }
 *
 * const mirroredKeys = mirrorKeys(originalKeys, axis)
 * console.log(mirroredKeys.length) // 3 new keys
 * console.log(originalKeys[0] === mirroredKeys[0]) // false (deep clones)
 * ```
 */
export function mirrorKeys(keys: Key[], axis: MirrorAxis): Key[] {
  return keys.map((key) => {
    // Deep clone to avoid mutations of originals
    const newKey = JSON.parse(JSON.stringify(key)) as Key

    if (axis.direction === 'horizontal') {
      // Horizontal line mirrors keys vertically (across Y-axis)
      const keyY = key.y
      const lineY = axis.y
      newKey.y = D.mirrorPoint(keyY, lineY, key.height)

      // Handle rotation for horizontal mirror
      if (key.rotation_angle !== undefined && key.rotation_angle !== 0) {
        // Mirror the rotation angle - for horizontal mirror, negate the angle
        newKey.rotation_angle = -key.rotation_angle

        // Mirror the rotation origin Y coordinate
        if (key.rotation_y !== undefined) {
          newKey.rotation_y = D.mirrorPoint(key.rotation_y, lineY)
        }

        // Keep rotation origin X coordinate unchanged for horizontal mirror
        if (key.rotation_x !== undefined) {
          newKey.rotation_x = key.rotation_x
        }
      }
    } else {
      // Vertical line mirrors keys horizontally (across X-axis)
      const keyX = key.x
      const lineX = axis.x
      newKey.x = D.mirrorPoint(keyX, lineX, key.width)

      // Handle rotation for vertical mirror
      if (key.rotation_angle !== undefined && key.rotation_angle !== 0) {
        // Mirror the rotation angle - for vertical mirror, negate the angle
        newKey.rotation_angle = -key.rotation_angle

        // Mirror the rotation origin X coordinate
        if (key.rotation_x !== undefined) {
          newKey.rotation_x = D.mirrorPoint(key.rotation_x, lineX)
        }

        // Keep rotation origin Y coordinate unchanged for vertical mirror
        if (key.rotation_y !== undefined) {
          newKey.rotation_y = key.rotation_y
        }
      }
    }

    return newKey
  })
}

/**
 * Calculate mirror axis position from canvas coordinates.
 *
 * Converts canvas pixel coordinates to key unit coordinates and snaps to grid.
 * This is typically called when the user clicks on the canvas to set the mirror axis.
 *
 * @param canvasPos - Position in canvas pixels (from mouse event)
 * @param direction - Mirror direction (horizontal or vertical)
 * @param renderUnit - Canvas rendering unit (pixels per key unit, typically 54)
 * @param snapStep - Grid snapping step size in key units (e.g., 0.25)
 * @returns Mirror axis configuration with snapped coordinates
 *
 * @example
 * ```typescript
 * // User clicks at canvas position (270, 162) pixels
 * const axis = calculateMirrorAxis(
 *   { x: 270, y: 162 },
 *   'horizontal',
 *   54,  // renderUnit
 *   0.25 // snapStep
 * )
 * // Returns: { x: 5, y: 3, direction: 'horizontal' }
 * // (270/54 = 5.0, 162/54 = 3.0, both snap to themselves)
 * ```
 */
export function calculateMirrorAxis(
  canvasPos: { x: number; y: number },
  direction: 'horizontal' | 'vertical',
  renderUnit: number,
  snapStep: number,
): MirrorAxis {
  // Convert canvas pixels to key units
  const rawX = D.div(canvasPos.x, renderUnit)
  const rawY = D.div(canvasPos.y, renderUnit)

  // Snap to grid
  const snapX = D.roundToStep(rawX, snapStep)
  const snapY = D.roundToStep(rawY, snapStep)

  return {
    x: snapX,
    y: snapY,
    direction,
  }
}
