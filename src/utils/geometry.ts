import { D } from './decimal-math'
import type { Key } from '@/stores/keyboard'

export interface Point {
  x: number
  y: number
}

export interface Rectangle {
  x: number
  y: number
  width: number
  height: number
}

export interface OrientedRectangle extends Rectangle {
  rotation?: number
  originX?: number
  originY?: number
}

/**
 * Convert degrees to radians
 */
const degreesToRadians = (degrees: number): number => D.degreesToRadians(degrees)

/**
 * Rotate a point around an origin
 */
const rotatePoint = (point: Point, origin: Point, angle: number): Point => {
  const rad = degreesToRadians(angle)
  const cos = D.cos(rad)
  const sin = D.sin(rad)

  const translatedX = D.sub(point.x, origin.x)
  const translatedY = D.sub(point.y, origin.y)

  const rotatedX = D.sub(D.mul(cos, translatedX), D.mul(sin, translatedY))
  const rotatedY = D.add(D.mul(sin, translatedX), D.mul(cos, translatedY))

  return {
    x: D.add(rotatedX, origin.x),
    y: D.add(rotatedY, origin.y),
  }
}

/**
 * Get the four corners of a rectangle
 */
const getRectangleCorners = (rect: Rectangle): Point[] => {
  return [
    { x: rect.x, y: rect.y }, // top-left
    { x: D.add(rect.x, rect.width), y: rect.y }, // top-right
    { x: D.add(rect.x, rect.width), y: D.add(rect.y, rect.height) }, // bottom-right
    { x: rect.x, y: D.add(rect.y, rect.height) }, // bottom-left
  ]
}

/**
 * Get the four corners of an oriented rectangle (with rotation)
 */
const getOrientedRectangleCorners = (rect: OrientedRectangle): Point[] => {
  const corners = getRectangleCorners(rect)

  if (!rect.rotation || rect.rotation === 0) {
    return corners
  }

  const origin = {
    x: rect.originX ?? D.add(rect.x, D.div(rect.width, 2)),
    y: rect.originY ?? D.add(rect.y, D.div(rect.height, 2)),
  }

  return corners.map((corner) => rotatePoint(corner, origin, rect.rotation!))
}

/**
 * Project a polygon onto an axis and return min/max values
 */
const projectPolygonOntoAxis = (corners: Point[], axis: Point): { min: number; max: number } => {
  let min = Infinity
  let max = -Infinity

  corners.forEach((corner) => {
    const dotProduct = D.add(D.mul(corner.x, axis.x), D.mul(corner.y, axis.y))
    min = D.min(min, dotProduct)
    max = D.max(max, dotProduct)
  })

  return { min, max }
}

/**
 * Get the perpendicular axes for Separated Axis Theorem (SAT)
 */
const getPerpendicularAxes = (corners: Point[]): Point[] => {
  const axes: Point[] = []

  for (let i = 0; i < corners.length; i++) {
    const current = corners[i]
    const next = corners[(i + 1) % corners.length]

    // Skip if corners are undefined (should never happen in practice)
    if (!current || !next) continue

    const edge = {
      x: D.sub(next.x, current.x),
      y: D.sub(next.y, current.y),
    }

    const perpendicular = { x: -edge.y, y: edge.x }

    const length = D.sqrt(
      D.add(D.mul(perpendicular.x, perpendicular.x), D.mul(perpendicular.y, perpendicular.y)),
    )
    if (length > 0) {
      axes.push({
        x: D.div(perpendicular.x, length),
        y: D.div(perpendicular.y, length),
      })
    }
  }

  return axes
}

/**
 * Check if two oriented rectangles intersect using Separated Axis Theorem (SAT)
 * This properly handles rotated rectangles, unlike simple AABB collision
 */
export const orientedRectanglesIntersect = (
  rect1: OrientedRectangle,
  rect2: OrientedRectangle,
): boolean => {
  const corners1 = getOrientedRectangleCorners(rect1)
  const corners2 = getOrientedRectangleCorners(rect2)

  // Get all possible separation axes
  const axes1 = getPerpendicularAxes(corners1)
  const axes2 = getPerpendicularAxes(corners2)
  const allAxes = [...axes1, ...axes2]

  // Test each axis for separation
  for (const axis of allAxes) {
    const projection1 = projectPolygonOntoAxis(corners1, axis)
    const projection2 = projectPolygonOntoAxis(corners2, axis)

    // If projections don't overlap on any axis, rectangles are separated
    if (projection1.max < projection2.min || projection2.max < projection1.min) {
      return false
    }
  }

  // No separation found on any axis, rectangles intersect
  return true
}

/**
 * Convert a Key to an OrientedRectangle for collision detection
 */
export const keyToOrientedRectangle = (key: Key, unit: number): OrientedRectangle => {
  return {
    x: D.mul(key.x, unit),
    y: D.mul(key.y, unit),
    width: D.mul(key.width, unit),
    height: D.mul(key.height, unit),
    rotation: key.rotation_angle || 0,
    originX: key.rotation_x ? D.mul(key.rotation_x, unit) : undefined,
    originY: key.rotation_y ? D.mul(key.rotation_y, unit) : undefined,
  }
}

/**
 * Create a selection rectangle from two points
 */
export const createSelectionRectangle = (start: Point, end: Point): Rectangle => {
  const minX = Math.min(start.x, end.x)
  const maxX = Math.max(start.x, end.x)
  const minY = Math.min(start.y, end.y)
  const maxY = Math.max(start.y, end.y)

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  }
}

/**
 * Check if a key intersects with a selection rectangle
 * Uses proper oriented bounding box collision for rotated keys
 */
export const keyIntersectsSelection = (
  key: Key,
  selectionStart: Point,
  selectionEnd: Point,
  unit: number,
): boolean => {
  const keyRect = keyToOrientedRectangle(key, unit)
  const selectionRect = createSelectionRectangle(selectionStart, selectionEnd)

  return orientedRectanglesIntersect(keyRect, selectionRect)
}
