/**
 * Line intersection utilities for keyboard geometry.
 * All functions work in layout coordinates (units), not canvas pixels.
 */

import { getKeyCenter } from './keyboard-geometry'
import type { Key } from '@/stores/keyboard'

/**
 * Check if a line segment intersects (passes near) a key.
 * Uses perpendicular distance algorithm for non-rotated keys.
 *
 * @param lineStart - Start point {x, y} in layout units
 * @param lineEnd - End point {x, y} in layout units
 * @param key - The key to check intersection with
 * @param sensitivity - Optional sensitivity (0.0 = most permissive, 1.0 = strictest), default 0.0
 * @returns true if line intersects the key
 *
 * @example
 * const intersects = lineIntersectsKey(
 *   { x: 0, y: 0 },
 *   { x: 10, y: 0 },
 *   { x: 5, y: 0, width: 1, height: 1 },
 *   0.5
 * ) // true - horizontal line passes through key with medium sensitivity
 */
export function lineIntersectsKey(
  lineStart: { x: number; y: number },
  lineEnd: { x: number; y: number },
  key: Key,
  sensitivity: number = 0.0,
): boolean {
  // Get the key center in layout units
  const keyCenter = getKeyCenter(key)

  // Calculate line length in layout units
  const lineLength = Math.sqrt(
    Math.pow(lineEnd.x - lineStart.x, 2) + Math.pow(lineEnd.y - lineStart.y, 2),
  )

  if (lineLength < 0.0001) {
    // Line is basically a point, check distance to that point
    const distance = Math.sqrt(
      Math.pow(keyCenter.x - lineStart.x, 2) + Math.pow(keyCenter.y - lineStart.y, 2),
    )
    // Consider intersecting if within half the key's diagonal
    const keyWidth = key.width || 1
    const keyHeight = key.height || 1
    const keyDiagonal = Math.sqrt(Math.pow(keyWidth, 2) + Math.pow(keyHeight, 2))
    return distance <= keyDiagonal / 2
  }

  // Calculate parameter t for the closest point on the line to the key center
  const t = Math.max(
    0,
    Math.min(
      1,
      ((keyCenter.x - lineStart.x) * (lineEnd.x - lineStart.x) +
        (keyCenter.y - lineStart.y) * (lineEnd.y - lineStart.y)) /
        (lineLength * lineLength),
    ),
  )

  // Calculate the closest point on the line segment
  const closestX = lineStart.x + t * (lineEnd.x - lineStart.x)
  const closestY = lineStart.y + t * (lineEnd.y - lineStart.y)

  // Calculate distance from key center to closest point on line (in layout units)
  const distance = Math.sqrt(
    Math.pow(keyCenter.x - closestX, 2) + Math.pow(keyCenter.y - closestY, 2),
  )

  // Calculate the line direction to determine which dimension matters
  const lineDirX = (lineEnd.x - lineStart.x) / lineLength
  const lineDirY = (lineEnd.y - lineStart.y) / lineLength

  const keyWidth = key.width || 1
  const keyHeight = key.height || 1

  // For non-rotated keys, use the perpendicular dimension as threshold
  // For horizontal lines (dirY ≈ 0), use key height/2
  // For vertical lines (dirX ≈ 0), use key width/2
  // For diagonal lines, use a weighted average
  if (!key.rotation_angle || key.rotation_angle === 0) {
    // Non-rotated key - use perpendicular dimension
    const absLineDirX = Math.abs(lineDirX)
    const absLineDirY = Math.abs(lineDirY)

    // Weight by how perpendicular each dimension is to the line
    const baseThreshold =
      (absLineDirX * keyHeight) / 2 + // Horizontal line component uses height
      (absLineDirY * keyWidth) / 2 // Vertical line component uses width

    // Apply sensitivity: higher sensitivity = stricter = smaller threshold
    // sensitivity 0.0 = full threshold (most permissive)
    // sensitivity 1.0 = near-zero threshold (strictest, almost point-on-line)
    const effectiveThreshold = baseThreshold * (1 - sensitivity)

    return distance <= effectiveThreshold
  } else {
    // Rotated key - use diagonal for safety (conservative approach)
    const keyDiagonal = Math.sqrt(Math.pow(keyWidth, 2) + Math.pow(keyHeight, 2))
    const baseThreshold = keyDiagonal / 2

    // Apply sensitivity
    const effectiveThreshold = baseThreshold * (1 - sensitivity)

    return distance <= effectiveThreshold
  }
}

/**
 * Find all keys that intersect a line, sorted by distance from start.
 *
 * @param lineStart - Start point in layout units
 * @param lineEnd - End point in layout units
 * @param keys - Array of keys to check
 * @param sensitivity - Optional sensitivity (0.0 = most permissive, 1.0 = strictest), default 0.0
 * @returns Array of keys along the line, sorted by distance from start
 *
 * @example
 * const keysAlongLine = findKeysAlongLine(
 *   { x: 0, y: 0 },
 *   { x: 10, y: 0 },
 *   keyboardStore.keys,
 *   0.5
 * ) // Returns keys in order from left to right with medium sensitivity
 */
export function findKeysAlongLine(
  lineStart: { x: number; y: number },
  lineEnd: { x: number; y: number },
  keys: Key[],
  sensitivity: number = 0.0,
): Key[] {
  const intersectingKeys: Array<{ key: Key; distance: number }> = []

  for (const key of keys) {
    // Filter out ghost and decal keys
    if (key.decal || key.ghost) continue

    if (lineIntersectsKey(lineStart, lineEnd, key, sensitivity)) {
      const keyCenter = getKeyCenter(key)
      // Calculate distance from start point (in layout units)
      const distance = Math.sqrt(
        Math.pow(keyCenter.x - lineStart.x, 2) + Math.pow(keyCenter.y - lineStart.y, 2),
      )
      intersectingKeys.push({ key, distance })
    }
  }

  // Sort by distance from start point
  intersectingKeys.sort((a, b) => a.distance - b.distance)

  return intersectingKeys.map((item) => item.key)
}
