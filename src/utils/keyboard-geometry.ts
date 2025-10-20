import { D } from '@/utils/decimal-math'
import type { Key } from '@/stores/keyboard'

/**
 * Calculate the center point of a key in layout coordinates (units).
 * Handles rotation transformations correctly.
 *
 * @param key - The key object with position, dimensions, and optional rotation
 * @returns Center point {x, y} in layout units
 *
 * @example
 * const key = { x: 0, y: 0, width: 2, height: 1 }
 * const center = getKeyCenter(key) // { x: 1, y: 0.5 }
 */
export function getKeyCenter(key: Key): { x: number; y: number } {
  // Calculate key center in key-local coordinates (in units)
  let centerX = D.add(key.x, D.div(key.width || 1, 2))
  let centerY = D.add(key.y, D.div(key.height || 1, 2))

  // Apply rotation transformation if key is rotated
  if (key.rotation_angle && key.rotation_angle !== 0) {
    const originX = key.rotation_x !== undefined ? key.rotation_x : centerX
    const originY = key.rotation_y !== undefined ? key.rotation_y : centerY
    const angleRad = D.degreesToRadians(key.rotation_angle)
    const cos = Math.cos(angleRad)
    const sin = Math.sin(angleRad)

    // Translate center relative to rotation origin
    const relativeX = D.sub(centerX, originX)
    const relativeY = D.sub(centerY, originY)

    // Apply rotation transformation
    const rotatedX = D.sub(D.mul(relativeX, cos), D.mul(relativeY, sin))
    const rotatedY = D.add(D.mul(relativeX, sin), D.mul(relativeY, cos))

    // Translate back to absolute coordinates
    centerX = D.add(originX, rotatedX)
    centerY = D.add(originY, rotatedY)
  }

  // Return center in layout units
  return {
    x: Number(centerX),
    y: Number(centerY),
  }
}

/**
 * Calculate the Euclidean distance between the centers of two keys in layout units.
 *
 * @param key1 - First key
 * @param key2 - Second key
 * @returns Distance between key centers in layout units
 *
 * @example
 * const key1 = { x: 0, y: 0, width: 1, height: 1 }
 * const key2 = { x: 1, y: 0, width: 1, height: 1 }
 * const distance = getKeyDistance(key1, key2) // 1.0 units
 */
export function getKeyDistance(key1: Key, key2: Key): number {
  const center1 = getKeyCenter(key1)
  const center2 = getKeyCenter(key2)
  return Math.sqrt(Math.pow(center2.x - center1.x, 2) + Math.pow(center2.y - center1.y, 2))
}
