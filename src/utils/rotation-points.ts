import { D } from './decimal-math'
import type { Key } from '@/stores/keyboard'

export interface Point {
  x: number
  y: number
}

export interface RotationPoint extends Point {
  type: 'corner' | 'center'
  id: string
}

/**
 * Get the four corners of a key in key units
 */
const getKeyCorners = (key: Key): Point[] => {
  return [
    { x: key.x, y: key.y }, // top-left
    { x: D.add(key.x, key.width), y: key.y }, // top-right
    { x: D.add(key.x, key.width), y: D.add(key.y, key.height) }, // bottom-right
    { x: key.x, y: D.add(key.y, key.height) }, // bottom-left
  ]
}

/**
 * Get the center point of a key in key units
 */
const getKeyCenter = (key: Key): Point => {
  return {
    x: D.add(key.x, D.div(key.width, 2)),
    y: D.add(key.y, D.div(key.height, 2)),
  }
}

/**
 * Snap a point to the grid based on move step
 */
const snapToGrid = (point: Point, moveStep: number): Point => {
  return {
    x: D.roundToStep(point.x, moveStep),
    y: D.roundToStep(point.y, moveStep),
  }
}

/**
 * Create a unique string key for a point for deduplication
 */
const pointToKey = (point: Point): string => {
  // Use fixed precision to avoid floating point issues
  return `${D.format(point.x, 4)},${D.format(point.y, 4)}`
}

/**
 * Parse a point from a string key
 */
const parsePointFromKey = (key: string, type: 'corner' | 'center'): RotationPoint => {
  const [x, y] = key.split(',').map(Number)
  return {
    x,
    y,
    type,
    id: `${type}-${key}`,
  }
}

/**
 * Calculate all available rotation points for the selected keys
 * Only uses key corners and key centers, with smart deduplication
 */
export const calculateRotationPoints = (selectedKeys: Key[], moveStep: number): RotationPoint[] => {
  if (selectedKeys.length === 0) {
    return []
  }

  const cornerPoints = new Set<string>()
  const centerPoints = new Set<string>()

  selectedKeys.forEach((key) => {
    // Add 4 corners
    const corners = getKeyCorners(key)
    corners.forEach((corner) => {
      const snapped = snapToGrid(corner, moveStep)
      cornerPoints.add(pointToKey(snapped))
    })

    // Add center point
    const center = getKeyCenter(key)
    const snapped = snapToGrid(center, moveStep)
    centerPoints.add(pointToKey(snapped))
  })

  const rotationPoints: RotationPoint[] = []

  // Add corner points
  cornerPoints.forEach((pointKey) => {
    rotationPoints.push(parsePointFromKey(pointKey, 'corner'))
  })

  // Add center points
  centerPoints.forEach((pointKey) => {
    rotationPoints.push(parsePointFromKey(pointKey, 'center'))
  })

  // Sort points for consistent ordering (top-to-bottom, left-to-right)
  return rotationPoints.sort((a, b) => {
    const yDiff = D.sub(a.y, b.y)
    if (Math.abs(yDiff) > 0.0001) {
      return yDiff
    }
    return D.sub(a.x, b.x)
  })
}

/**
 * Check if two points are approximately equal (within floating point tolerance)
 */
export const pointsEqual = (a: Point, b: Point, tolerance = 0.0001): boolean => {
  return Math.abs(a.x - b.x) < tolerance && Math.abs(a.y - b.y) < tolerance
}

/**
 * Find the closest rotation point to a given position
 */
export const findClosestRotationPoint = (
  position: Point,
  rotationPoints: RotationPoint[],
  maxDistance = 0.5,
): RotationPoint | null => {
  let closest: RotationPoint | null = null
  let closestDistance = Infinity

  rotationPoints.forEach((point) => {
    const distance = D.sqrt(
      D.add(D.pow(D.sub(position.x, point.x), 2), D.pow(D.sub(position.y, point.y), 2)),
    )

    if (distance < closestDistance && distance <= maxDistance) {
      closest = point
      closestDistance = distance
    }
  })

  return closest
}
