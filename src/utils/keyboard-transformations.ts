/**
 * Keyboard Transformation Utilities
 *
 * Pure functions for geometric transformations of keyboard keys.
 * These functions modify Key objects to change their rotation origins and positions
 * while preserving their visual appearance on screen.
 *
 * Key concepts:
 * - Rotation origin: The point around which a key rotates
 * - Visual position: Where the key appears on screen after rotation transformation
 * - Coordinate transformation: Converting between rotated and screen coordinate systems
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
