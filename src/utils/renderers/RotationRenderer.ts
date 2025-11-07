import type { Key } from '@adamws/kle-serial'
import { D } from '../decimal-math'

/**
 * Represents a rotation point for interactive rotation editing
 */
export interface RotationPoint {
  id: string
  x: number
  y: number
  keyX: number
  keyY: number
  type: 'corner' | 'center'
  canvasX: number
  canvasY: number
}

/**
 * RotationRenderer - Handles rendering of rotation-related UI elements
 *
 * This module provides functionality for:
 * - Drawing rotation origin indicators
 * - Drawing rotation control points (corners and centers)
 * - Hit testing for rotation points
 * - Calculating rotated positions using canvas transformations
 *
 * Usage:
 * ```typescript
 * const renderer = new RotationRenderer()
 *
 * // Draw rotation origin indicator
 * renderer.drawRotationOriginIndicator(ctx, key, unit)
 *
 * // Draw rotation control points
 * renderer.drawRotationPoints(ctx, selectedKeys, unit, hoveredPointId, selectedOrigin)
 *
 * // Hit test for rotation points
 * const point = renderer.getRotationPointAtPosition(canvasX, canvasY)
 * ```
 *
 * @class RotationRenderer
 */
export class RotationRenderer {
  private rotationPoints: RotationPoint[] = []

  /**
   * Draw a visual indicator at the rotation origin point
   *
   * Draws a crosshair with circles to indicate where the key will rotate around.
   * Uses orange color (#ff6b35) to distinguish from selection indicators.
   *
   * @param ctx - Canvas rendering context
   * @param key - The key whose rotation origin to draw
   * @param unit - Pixel size of one keyboard unit
   */
  public drawRotationOriginIndicator(ctx: CanvasRenderingContext2D, key: Key, unit: number): void {
    // Get the rotation origin in canvas coordinates
    const originX = D.mul(key.rotation_x || 0, unit)
    const originY = D.mul(key.rotation_y || 0, unit)

    ctx.save()

    // Draw a crosshair at the rotation origin
    ctx.strokeStyle = '#ff6b35' // Orange color to distinguish from selection
    ctx.lineWidth = 2
    ctx.setLineDash([])

    const crossSize = 8

    // Draw horizontal line
    ctx.beginPath()
    ctx.moveTo(originX - crossSize, originY)
    ctx.lineTo(originX + crossSize, originY)
    ctx.stroke()

    // Draw vertical line
    ctx.beginPath()
    ctx.moveTo(originX, originY - crossSize)
    ctx.lineTo(originX, originY + crossSize)
    ctx.stroke()

    // Draw a small circle at the center
    ctx.fillStyle = '#ff6b35'
    ctx.beginPath()
    ctx.arc(originX, originY, 3, 0, 2 * Math.PI)
    ctx.fill()

    // Draw a larger circle outline
    ctx.strokeStyle = '#ff6b35'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(originX, originY, 6, 0, 2 * Math.PI)
    ctx.stroke()

    ctx.restore()
  }

  /**
   * Calculate the rotated position of a point
   *
   * Uses canvas transformation matrix to calculate the exact same rotated position
   * that the renderer uses. This ensures UI elements align perfectly with rendered keys.
   *
   * @param x - X coordinate in key units
   * @param y - Y coordinate in key units
   * @param originX - Rotation origin X in key units
   * @param originY - Rotation origin Y in key units
   * @param angleRadians - Rotation angle in radians
   * @param unit - Pixel size of one keyboard unit
   * @returns Rotated point coordinates in key units
   */
  private calculateRotatedPoint(
    x: number,
    y: number,
    originX: number,
    originY: number,
    angleRadians: number,
    unit: number,
  ): { x: number; y: number } {
    // Use canvas transformation to get exact same result as renderer
    // Create a temporary canvas context for transformation calculation
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!

    // Save current transform
    ctx.save()

    // Apply same transformation as the key renderer
    const originCanvasX = originX * unit
    const originCanvasY = originY * unit
    ctx.translate(originCanvasX, originCanvasY)
    ctx.rotate(angleRadians)
    ctx.translate(-originCanvasX, -originCanvasY)

    // Transform the point
    const canvasX = x * unit
    const canvasY = y * unit
    const transform = ctx.getTransform()
    const transformedX = transform.a * canvasX + transform.c * canvasY + transform.e
    const transformedY = transform.b * canvasX + transform.d * canvasY + transform.f

    ctx.restore()

    // Convert back to key coordinates
    return {
      x: transformedX / unit,
      y: transformedY / unit,
    }
  }

  /**
   * Draw rotation control points for selected keys
   *
   * Draws interactive control points at the corners and center of each selected key.
   * These points can be used to set the rotation origin.
   *
   * Features:
   * - 4 corner points (blue) + 1 center point (darker blue) per key
   * - Hover effect (larger, red)
   * - Selection effect (red, indicates current rotation origin)
   * - Accounts for existing rotation when positioning points
   * - Stores points for hit testing
   *
   * @param ctx - Canvas rendering context
   * @param selectedKeys - Array of selected keys
   * @param unit - Pixel size of one keyboard unit
   * @param hoveredPointId - ID of currently hovered point (optional)
   * @param selectedRotationOrigin - Currently selected rotation origin coordinates (optional)
   */
  public drawRotationPoints(
    ctx: CanvasRenderingContext2D,
    selectedKeys: Key[],
    unit: number,
    hoveredPointId?: string,
    selectedRotationOrigin?: { x: number; y: number } | null,
  ): void {
    if (selectedKeys.length === 0) return

    // Clear previous rotation points
    this.rotationPoints = []

    ctx.save()

    selectedKeys.forEach((key, keyIndex) => {
      // Calculate rotation parameters
      const hasRotation = key.rotation_angle && key.rotation_angle !== 0
      const angleRadians = hasRotation ? D.degreesToRadians(key.rotation_angle) : 0
      // Use the actual rotation origin from key properties (not defaulting to center)
      const originX = key.rotation_x !== undefined ? key.rotation_x : key.x + key.width / 2
      const originY = key.rotation_y !== undefined ? key.rotation_y : key.y + key.height / 2

      // Draw key corners (4 points per key) - use actual rotated positions
      const corners = [
        { x: key.x, y: key.y, corner: 'top-left' },
        { x: key.x + key.width, y: key.y, corner: 'top-right' },
        { x: key.x, y: key.y + key.height, corner: 'bottom-left' },
        { x: key.x + key.width, y: key.y + key.height, corner: 'bottom-right' },
      ]

      corners.forEach((corner, cornerIndex) => {
        // Calculate rotated corner position if key is rotated
        const rotatedCorner = hasRotation
          ? this.calculateRotatedPoint(corner.x, corner.y, originX, originY, angleRadians, unit)
          : { x: corner.x, y: corner.y }

        const canvasX = rotatedCorner.x * unit
        const canvasY = rotatedCorner.y * unit
        const pointId = `corner-${keyIndex}-${cornerIndex}`

        // Store rotation point for hit testing (use rotated positions)
        this.rotationPoints.push({
          id: pointId,
          x: rotatedCorner.x,
          y: rotatedCorner.y,
          keyX: rotatedCorner.x,
          keyY: rotatedCorner.y,
          type: 'corner',
          canvasX,
          canvasY,
        })

        // Draw corner point as circle with hover/selection effect
        const isHovered = hoveredPointId === pointId
        const isSelected =
          selectedRotationOrigin &&
          Math.abs(rotatedCorner.x - selectedRotationOrigin.x) < 0.01 &&
          Math.abs(rotatedCorner.y - selectedRotationOrigin.y) < 0.01
        const isHighlighted = isHovered || isSelected
        ctx.fillStyle = isHighlighted ? '#dc3545' : '#007bff'
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = isHighlighted ? 3 : 2
        ctx.beginPath()
        ctx.arc(canvasX, canvasY, isHighlighted ? 8 : 6, 0, 2 * Math.PI)
        ctx.fill()
        ctx.stroke()
      })

      // Draw key center (1 point per key) - also account for rotation
      const centerX = key.x + key.width / 2
      const centerY = key.y + key.height / 2

      // Calculate rotated center position if key is rotated
      const rotatedCenter = hasRotation
        ? this.calculateRotatedPoint(centerX, centerY, originX, originY, angleRadians, unit)
        : { x: centerX, y: centerY }

      const canvasCenterX = rotatedCenter.x * unit
      const canvasCenterY = rotatedCenter.y * unit
      const centerPointId = `center-${keyIndex}`

      // Store center rotation point for hit testing (use rotated positions)
      this.rotationPoints.push({
        id: centerPointId,
        x: rotatedCenter.x,
        y: rotatedCenter.y,
        keyX: rotatedCenter.x,
        keyY: rotatedCenter.y,
        type: 'center',
        canvasX: canvasCenterX,
        canvasY: canvasCenterY,
      })

      // Draw center point as circle with hover/selection effect
      const isCenterHovered = hoveredPointId === centerPointId
      const isCenterSelected =
        selectedRotationOrigin &&
        Math.abs(rotatedCenter.x - selectedRotationOrigin.x) < 0.01 &&
        Math.abs(rotatedCenter.y - selectedRotationOrigin.y) < 0.01
      const isCenterHighlighted = isCenterHovered || isCenterSelected
      ctx.fillStyle = isCenterHighlighted ? '#dc3545' : '#0056b3'
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = isCenterHighlighted ? 3 : 2
      ctx.beginPath()
      ctx.arc(canvasCenterX, canvasCenterY, isCenterHighlighted ? 8 : 6, 0, 2 * Math.PI)
      ctx.fill()
      ctx.stroke()
    })

    ctx.restore()
  }

  /**
   * Get rotation point at canvas position (hit testing)
   *
   * Tests if a canvas coordinate hits any rotation control point.
   * Uses slightly larger hit radius than visual radius for better usability.
   *
   * @param canvasX - X coordinate in canvas pixels
   * @param canvasY - Y coordinate in canvas pixels
   * @returns Rotation point if hit, null otherwise
   */
  public getRotationPointAtPosition(
    canvasX: number,
    canvasY: number,
  ): { id: string; x: number; y: number; type: 'corner' | 'center' } | null {
    for (const point of this.rotationPoints) {
      const distance = Math.sqrt(
        Math.pow(canvasX - point.canvasX, 2) + Math.pow(canvasY - point.canvasY, 2),
      )

      // Hit radius - slightly larger than visual radius
      const hitRadius = point.type === 'corner' ? 10 : 12

      if (distance <= hitRadius) {
        return {
          id: point.id,
          x: point.keyX,
          y: point.keyY,
          type: point.type,
        }
      }
    }

    return null
  }

  /**
   * Get all current rotation points
   *
   * Returns the array of rotation points that were created by the last
   * drawRotationPoints() call. Useful for debugging or advanced hit testing.
   *
   * @returns Array of rotation points
   */
  public getRotationPoints(): RotationPoint[] {
    return this.rotationPoints
  }

  /**
   * Clear all rotation points
   *
   * Clears the internal rotation points array. Called automatically by
   * drawRotationPoints(), but can be called manually if needed.
   */
  public clearRotationPoints(): void {
    this.rotationPoints = []
  }
}

// Export singleton instance for convenience
export const rotationRenderer = new RotationRenderer()
