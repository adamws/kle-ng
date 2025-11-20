import type { Key } from '@adamws/kle-serial'
import polygonClippingLib from 'polygon-clipping'
import type { MultiPolygon } from 'polygon-clipping'
import type { KeyRenderParams } from '../canvas-renderer'
import { isNonRectangular } from '../key-utils'

/**
 * Options for rendering a key
 */
export interface KeyRenderOptions {
  /** Unit size in pixels */
  unit: number
  /** Border stroke width (1 for normal, 2 for selected) */
  strokeWidth?: number
  /** Outer corner radius in pixels */
  roundOuter?: number
  /** Inner corner radius in pixels */
  roundInner?: number
  /** Bevel margin in pixels */
  bevelMargin?: number
  /** Key spacing in pixels */
  keySpacing?: number
  /** Bevel offset top in pixels */
  bevelOffsetTop?: number
  /** Bevel offset bottom in pixels */
  bevelOffsetBottom?: number
  /** Whether this key is selected */
  isSelected?: boolean
}

/**
 * Aligned rectangle coordinates and dimensions
 */
export interface AlignedRect {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Default sizes for key rendering
 */
interface DefaultSizes {
  keySpacing: number
  bevelMargin: number
  bevelOffsetTop: number
  bevelOffsetBottom: number
  padding: number
  roundOuter: number
  roundInner: number
}

const defaultSizes: DefaultSizes = {
  keySpacing: 0,
  bevelMargin: 6,
  bevelOffsetTop: 3,
  bevelOffsetBottom: 3,
  padding: 3,
  roundOuter: 5,
  roundInner: 3,
}

/**
 * KeyRenderer handles the rendering of keyboard key shapes.
 * Extracted from CanvasRenderer to improve modularity and maintainability.
 *
 * This class follows a functional approach where the canvas context is passed
 * as a parameter rather than stored, making it easier to test and reason about.
 *
 * @example
 * ```typescript
 * const renderer = new KeyRenderer()
 * renderer.drawKey(ctx, key, { unit: 54, isSelected: true })
 * ```
 */
export class KeyRenderer {
  // Visual constants
  private static readonly SELECTION_COLOR = '#dc3545' // Red color for selected keys
  private static readonly GHOST_OPACITY = 0.3 // Opacity for ghost keys
  private static readonly PIXEL_ALIGNMENT_OFFSET = 0.5 // Offset for crisp stroke rendering

  // Homing nub constants (matching original KLE)
  private static readonly HOMING_NUB_WIDTH = 10 // Width in pixels
  private static readonly HOMING_NUB_HEIGHT = 2 // Height in pixels
  private static readonly HOMING_NUB_POSITION_RATIO = 0.9 // Vertical position (90% down key)
  private static readonly HOMING_NUB_OPACITY = 0.3 // Opacity of the nub indicator

  // Color cache for performance optimization (Phase 2)
  private colorCache = new Map<string, string>()

  /**
   * Calculate render parameters for a key, including all geometry calculations
   * for outer cap, inner cap, and text areas.
   *
   * @param key - The key to calculate parameters for
   * @param options - Rendering options
   * @returns Calculated render parameters
   */
  public getRenderParams(key: Key, options: KeyRenderOptions): KeyRenderParams {
    const sizes = {
      ...defaultSizes,
      ...(options.keySpacing !== undefined && { keySpacing: options.keySpacing }),
      ...(options.bevelMargin !== undefined && { bevelMargin: options.bevelMargin }),
      ...(options.bevelOffsetTop !== undefined && { bevelOffsetTop: options.bevelOffsetTop }),
      ...(options.bevelOffsetBottom !== undefined && {
        bevelOffsetBottom: options.bevelOffsetBottom,
      }),
      ...(options.roundOuter !== undefined && { roundOuter: options.roundOuter }),
      ...(options.roundInner !== undefined && { roundInner: options.roundInner }),
      unit: options.unit,
      strokeWidth: options.strokeWidth || 1,
    }

    const params: Partial<KeyRenderParams> = {}

    params.nonRectangular = isNonRectangular(key)

    params.capwidth = sizes.unit * key.width
    params.capheight = sizes.unit * key.height
    params.capx = sizes.unit * key.x
    params.capy = sizes.unit * key.y

    if (params.nonRectangular) {
      params.capwidth2 = sizes.unit * (key.width2 || key.width)
      params.capheight2 = sizes.unit * (key.height2 || key.height)
      params.capx2 = sizes.unit * (key.x + (key.x2 || 0))
      params.capy2 = sizes.unit * (key.y + (key.y2 || 0))
    }

    params.outercapwidth = Math.max(2, params.capwidth - sizes.keySpacing * 2)
    params.outercapheight = Math.max(2, params.capheight - sizes.keySpacing * 2)

    const actualKeySpacingX = Math.max(0, (params.capwidth - params.outercapwidth) / 2)
    const actualKeySpacingY = Math.max(0, (params.capheight - params.outercapheight) / 2)

    params.outercapx = params.capx + actualKeySpacingX
    params.outercapy = params.capy + actualKeySpacingY

    if (params.nonRectangular) {
      params.outercapwidth2 = Math.max(2, params.capwidth2! - sizes.keySpacing * 2)
      params.outercapheight2 = Math.max(2, params.capheight2! - sizes.keySpacing * 2)

      const actualKeySpacingX2 = Math.max(0, (params.capwidth2! - params.outercapwidth2) / 2)
      const actualKeySpacingY2 = Math.max(0, (params.capheight2! - params.outercapheight2) / 2)

      params.outercapx2 = params.capx2! + actualKeySpacingX2
      params.outercapy2 = params.capy2! + actualKeySpacingY2
    }

    params.innercapwidth = Math.max(1, params.outercapwidth - sizes.bevelMargin * 2)
    params.innercapheight = Math.max(
      1,
      params.outercapheight -
        (sizes.bevelMargin * 2 + (sizes.bevelOffsetBottom - sizes.bevelOffsetTop)),
    )

    const actualBevelMarginX = Math.max(0, (params.outercapwidth - params.innercapwidth) / 2)
    const actualBevelMarginY = Math.max(
      0,
      (params.outercapheight -
        (params.innercapheight + (sizes.bevelOffsetBottom - sizes.bevelOffsetTop))) /
        2,
    )

    params.innercapx = params.outercapx + actualBevelMarginX
    params.innercapy = params.outercapy + actualBevelMarginY - sizes.bevelOffsetTop

    if (params.nonRectangular) {
      params.innercapwidth2 = Math.max(1, params.outercapwidth2! - sizes.bevelMargin * 2)
      params.innercapheight2 = Math.max(1, params.outercapheight2! - sizes.bevelMargin * 2)

      const actualBevelMarginX2 = Math.max(0, (params.outercapwidth2! - params.innercapwidth2) / 2)
      const actualBevelMarginY2 = Math.max(
        0,
        (params.outercapheight2! - params.innercapheight2) / 2,
      )

      params.innercapx2 = params.outercapx2! + actualBevelMarginX2
      params.innercapy2 = params.outercapy2! + actualBevelMarginY2 - sizes.bevelOffsetTop
    }

    // Reduce text padding to match original KLE behavior for better text fit
    const textPadding = Math.max(1, sizes.padding - 1) // Reduce by 1 pixel on each side
    params.textcapwidth = Math.max(1, params.innercapwidth - textPadding * 2)
    params.textcapheight = Math.max(1, params.innercapheight - textPadding * 2)

    const actualPaddingX = Math.max(0, (params.innercapwidth - params.textcapwidth) / 2)
    const actualPaddingY = Math.max(0, (params.innercapheight - params.textcapheight) / 2)

    params.textcapx = params.innercapx + actualPaddingX
    params.textcapy = params.innercapy + actualPaddingY

    params.darkColor = key.color
    params.lightColor = this.lightenColor(key.color)

    params.origin_x = sizes.unit * (key.rotation_x || 0)
    params.origin_y = sizes.unit * (key.rotation_y || 0)

    return params as KeyRenderParams
  }

  /**
   * Align a rectangle to pixel boundaries for crisp rendering.
   * Ensures consistent edge thickness by aligning to pixel grid.
   *
   * @param x - X coordinate
   * @param y - Y coordinate
   * @param width - Width
   * @param height - Height
   * @returns Aligned rectangle coordinates
   */
  public alignRectToPixels(x: number, y: number, width: number, height: number): AlignedRect {
    // For stroke rendering, align to pixel boundaries for consistent edge thickness
    const alignedX = Math.round(x) + KeyRenderer.PIXEL_ALIGNMENT_OFFSET
    const alignedY = Math.round(y) + KeyRenderer.PIXEL_ALIGNMENT_OFFSET
    const alignedWidth = Math.round(x + width) - Math.round(x)
    const alignedHeight = Math.round(y + height) - Math.round(y)

    return { x: alignedX, y: alignedY, width: alignedWidth, height: alignedHeight }
  }

  /**
   * Align non-rectangular key parameters to ensure both rectangles align consistently.
   * Used for ISO Enter, Big-Ass Enter, and other L-shaped keys.
   *
   * @param params - Key render parameters to align
   * @returns Aligned render parameters
   */
  public alignNonRectangularKeyParams(params: KeyRenderParams): KeyRenderParams {
    // Create aligned versions of the key parameters that maintain consistent positioning
    // between the two rectangles of a non-rectangular key
    const alignedParams = { ...params }

    // Align the main rectangle
    const mainRect = this.alignRectToPixels(
      params.outercapx,
      params.outercapy,
      params.outercapwidth,
      params.outercapheight,
    )
    alignedParams.outercapx = mainRect.x
    alignedParams.outercapy = mainRect.y
    alignedParams.outercapwidth = mainRect.width
    alignedParams.outercapheight = mainRect.height

    // Align the second rectangle if it exists
    if (params.outercapx2 !== undefined && params.outercapy2 !== undefined) {
      const secondRect = this.alignRectToPixels(
        params.outercapx2,
        params.outercapy2,
        params.outercapwidth2!,
        params.outercapheight2!,
      )
      alignedParams.outercapx2 = secondRect.x
      alignedParams.outercapy2 = secondRect.y
      alignedParams.outercapwidth2 = secondRect.width
      alignedParams.outercapheight2 = secondRect.height
    }

    // Calculate inner rectangles relative to aligned outer rectangles
    // This ensures proper spacing and prevents border thickness variations
    const originalInnerOffsetX = params.innercapx - params.outercapx
    const originalInnerOffsetY = params.innercapy - params.outercapy
    const originalInnerMarginX = (params.outercapwidth - params.innercapwidth) / 2
    const originalInnerMarginY = (params.outercapheight - params.innercapheight) / 2

    alignedParams.innercapx = alignedParams.outercapx + originalInnerOffsetX
    alignedParams.innercapy = alignedParams.outercapy + originalInnerOffsetY
    alignedParams.innercapwidth = alignedParams.outercapwidth - originalInnerMarginX * 2
    alignedParams.innercapheight = alignedParams.outercapheight - originalInnerMarginY * 2

    if (params.innercapx2 !== undefined && params.innercapy2 !== undefined) {
      const originalInnerOffsetX2 = params.innercapx2 - params.outercapx2!
      const originalInnerOffsetY2 = params.innercapy2 - params.outercapy2!
      const originalInnerMarginX2 = (params.outercapwidth2! - params.innercapwidth2!) / 2
      const originalInnerMarginY2 = (params.outercapheight2! - params.innercapheight2!) / 2

      alignedParams.innercapx2 = alignedParams.outercapx2! + originalInnerOffsetX2
      alignedParams.innercapy2 = alignedParams.outercapy2! + originalInnerOffsetY2
      alignedParams.innercapwidth2 = alignedParams.outercapwidth2! - originalInnerMarginX2 * 2
      alignedParams.innercapheight2 = alignedParams.outercapheight2! - originalInnerMarginY2 * 2
    }

    return alignedParams
  }

  /**
   * Draw a rounded rectangle on the canvas.
   *
   * @param ctx - Canvas rendering context
   * @param x - X coordinate
   * @param y - Y coordinate
   * @param width - Width
   * @param height - Height
   * @param radius - Corner radius
   * @param fillStyle - Optional fill color
   * @param strokeStyle - Optional stroke color
   * @param lineWidth - Stroke width (default: 1)
   */
  public drawRoundedRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
    fillStyle?: string,
    strokeStyle?: string,
    lineWidth = 1,
  ): void {
    // Alignment is now handled consistently at the higher level (drawKey method)
    // No additional alignment needed here
    const drawX = x
    const drawY = y
    const drawWidth = width
    const drawHeight = height

    ctx.beginPath()
    ctx.moveTo(drawX + radius, drawY)
    ctx.lineTo(drawX + drawWidth - radius, drawY)
    ctx.quadraticCurveTo(drawX + drawWidth, drawY, drawX + drawWidth, drawY + radius)
    ctx.lineTo(drawX + drawWidth, drawY + drawHeight - radius)
    ctx.quadraticCurveTo(
      drawX + drawWidth,
      drawY + drawHeight,
      drawX + drawWidth - radius,
      drawY + drawHeight,
    )
    ctx.lineTo(drawX + radius, drawY + drawHeight)
    ctx.quadraticCurveTo(drawX, drawY + drawHeight, drawX, drawY + drawHeight - radius)
    ctx.lineTo(drawX, drawY + radius)
    ctx.quadraticCurveTo(drawX, drawY, drawX + radius, drawY)
    ctx.closePath()

    if (fillStyle) {
      ctx.fillStyle = fillStyle
      ctx.fill()
    }
    if (strokeStyle) {
      ctx.strokeStyle = strokeStyle
      ctx.lineWidth = lineWidth
      // Ensure consistent stroke rendering by setting line cap and join
      ctx.lineCap = 'square'
      ctx.lineJoin = 'miter'
      ctx.stroke()
    }
  }

  /**
   * Draw key rectangle layers (outer border and inner surface).
   * Handles both rectangular and non-rectangular keys using vector union.
   *
   * @param ctx - Canvas rendering context
   * @param rectangles - Array of rectangles to draw (outer and inner)
   * @param radius - Corner radius
   * @param borderColor - Border color
   * @param fillColor - Fill color for outer layer
   * @param innerColor - Fill color for inner layer
   * @param strokeWidth - Border stroke width
   */
  public drawKeyRectangleLayers(
    ctx: CanvasRenderingContext2D,
    rectangles: Array<{
      x: number
      y: number
      width: number
      height: number
      type: 'outer' | 'inner'
    }>,
    radius: number,
    borderColor: string,
    fillColor: string,
    innerColor: string,
    strokeWidth: number,
  ): void {
    // Vector union approach: Create single path that eliminates all alignment issues
    const outerRects = rectangles.filter((rect) => rect.type === 'outer')
    const innerRects = rectangles.filter((rect) => rect.type === 'inner')

    // Draw outer layer using vector union
    const outerPath = this.createVectorUnionPath(outerRects, radius)

    // Draw the unified outer path once - perfect alignment guaranteed
    if (fillColor) {
      ctx.fillStyle = fillColor
      ctx.fill(outerPath)
    }

    if (borderColor) {
      ctx.strokeStyle = borderColor
      ctx.lineWidth = strokeWidth
      ctx.stroke(outerPath)
    }

    // Draw inner surfaces using same vector union approach
    if (innerRects.length > 0 && innerColor) {
      const innerPath = this.createVectorUnionPath(innerRects, radius)
      ctx.fillStyle = innerColor
      ctx.fill(innerPath)
    }
  }

  /**
   * Draw a circular key (used for rotary encoders).
   *
   * @param ctx - Canvas rendering context
   * @param params - Key render parameters
   * @param borderColor - Border color
   * @param fillColor - Fill color
   * @param innerColor - Inner circle color
   * @param strokeWidth - Border stroke width
   * @param bevelMargin - Bevel margin for inner circle
   */
  public drawCircularKey(
    ctx: CanvasRenderingContext2D,
    params: KeyRenderParams,
    borderColor: string,
    fillColor: string,
    innerColor: string,
    strokeWidth: number,
    bevelMargin: number,
  ): void {
    // Calculate circle dimensions based on width only (ignore height)
    const centerX = params.outercapx + params.outercapwidth / 2
    const centerY = params.outercapy + params.outercapwidth / 2
    const outerRadius = params.outercapwidth / 2
    const innerRadius = (params.outercapwidth - bevelMargin * 2) / 2

    // Draw outer circle (border and fill)
    ctx.beginPath()
    ctx.arc(centerX, centerY, outerRadius, 0, 2 * Math.PI)

    if (fillColor) {
      ctx.fillStyle = fillColor
      ctx.fill()
    }

    if (borderColor) {
      ctx.strokeStyle = borderColor
      ctx.lineWidth = strokeWidth
      ctx.stroke()
    }

    // Draw inner circle (key surface)
    if (innerColor && innerRadius > 0) {
      ctx.beginPath()
      ctx.arc(centerX, centerY, innerRadius + 1, 0, 2 * Math.PI)
      ctx.fillStyle = innerColor
      ctx.fill()
    }
  }

  /**
   * Draw a homing nub indicator (for F and J keys).
   *
   * @param ctx - Canvas rendering context
   * @param params - Key render parameters
   */
  public drawHomingNub(ctx: CanvasRenderingContext2D, params: KeyRenderParams): void {
    // Draw horizontal line for homing keys, matching original KLE
    const centerX = params.innercapx + params.innercapwidth / 2
    const centerY = params.innercapy + params.innercapheight * KeyRenderer.HOMING_NUB_POSITION_RATIO

    ctx.fillStyle = `rgba(0, 0, 0, ${KeyRenderer.HOMING_NUB_OPACITY})`
    ctx.fillRect(
      centerX - KeyRenderer.HOMING_NUB_WIDTH / 2,
      centerY - KeyRenderer.HOMING_NUB_HEIGHT / 2,
      KeyRenderer.HOMING_NUB_WIDTH,
      KeyRenderer.HOMING_NUB_HEIGHT,
    )
  }

  /**
   * Draw a complete key with all its visual elements.
   * This is the main entry point for rendering a key.
   *
   * @param ctx - Canvas rendering context
   * @param key - The key to render
   * @param options - Rendering options
   */
  public drawKey(ctx: CanvasRenderingContext2D, key: Key, options: KeyRenderOptions): void {
    let params = this.getRenderParams(key, options)
    const sizes = {
      ...defaultSizes,
      ...(options.keySpacing !== undefined && { keySpacing: options.keySpacing }),
      ...(options.bevelMargin !== undefined && { bevelMargin: options.bevelMargin }),
      ...(options.roundOuter !== undefined && { roundOuter: options.roundOuter }),
      ...(options.roundInner !== undefined && { roundInner: options.roundInner }),
      unit: options.unit,
      strokeWidth: options.strokeWidth || (options.isSelected ? 2 : 1),
    }

    ctx.save()

    // Check if this is an axis-aligned rotation (0°, 90°, 180°, 270°)
    const axisAlignedAngle = this.getAxisAlignedRotation(key.rotation_angle)

    // For axis-aligned rotations, rotate the rectangles first, THEN apply alignment
    // This ensures perfect pixel alignment for rotated keys
    if (axisAlignedAngle !== null && axisAlignedAngle !== 0) {
      // Rotate all rectangle corners around the origin
      const rotateRect = (x: number, y: number, width: number, height: number) => {
        // Get all 4 corners
        const corners = [
          this.rotatePoint(x, y, params.origin_x, params.origin_y, axisAlignedAngle),
          this.rotatePoint(x + width, y, params.origin_x, params.origin_y, axisAlignedAngle),
          this.rotatePoint(
            x + width,
            y + height,
            params.origin_x,
            params.origin_y,
            axisAlignedAngle,
          ),
          this.rotatePoint(x, y + height, params.origin_x, params.origin_y, axisAlignedAngle),
        ]

        // Find bounding box
        const minX = Math.min(...corners.map((c) => c.x))
        const minY = Math.min(...corners.map((c) => c.y))
        const newWidth = axisAlignedAngle === 90 || axisAlignedAngle === 270 ? height : width
        const newHeight = axisAlignedAngle === 90 || axisAlignedAngle === 270 ? width : height

        return { x: minX, y: minY, width: newWidth, height: newHeight }
      }

      // Rotate outer rectangle
      const outerRotated = rotateRect(
        params.outercapx,
        params.outercapy,
        params.outercapwidth,
        params.outercapheight,
      )
      params.outercapx = outerRotated.x
      params.outercapy = outerRotated.y
      params.outercapwidth = outerRotated.width
      params.outercapheight = outerRotated.height

      // Rotate inner rectangle
      const innerRotated = rotateRect(
        params.innercapx,
        params.innercapy,
        params.innercapwidth,
        params.innercapheight,
      )
      params.innercapx = innerRotated.x
      params.innercapy = innerRotated.y
      params.innercapwidth = innerRotated.width
      params.innercapheight = innerRotated.height

      // Rotate text rectangle
      const textRotated = rotateRect(
        params.textcapx,
        params.textcapy,
        params.textcapwidth,
        params.textcapheight,
      )
      params.textcapx = textRotated.x
      params.textcapy = textRotated.y
      params.textcapwidth = textRotated.width
      params.textcapheight = textRotated.height

      // For non-rectangular keys, rotate secondary rectangles
      if (params.nonRectangular && params.outercapx2 !== undefined) {
        const outer2Rotated = rotateRect(
          params.outercapx2,
          params.outercapy2!,
          params.outercapwidth2!,
          params.outercapheight2!,
        )
        params.outercapx2 = outer2Rotated.x
        params.outercapy2 = outer2Rotated.y
        params.outercapwidth2 = outer2Rotated.width
        params.outercapheight2 = outer2Rotated.height

        const inner2Rotated = rotateRect(
          params.innercapx2!,
          params.innercapy2!,
          params.innercapwidth2!,
          params.innercapheight2!,
        )
        params.innercapx2 = inner2Rotated.x
        params.innercapy2 = inner2Rotated.y
        params.innercapwidth2 = inner2Rotated.width
        params.innercapheight2 = inner2Rotated.height
      }
    }

    // For non-axis-aligned rotations, apply canvas rotation
    if (key.rotation_angle && axisAlignedAngle === null) {
      ctx.translate(params.origin_x, params.origin_y)
      ctx.rotate((key.rotation_angle * Math.PI) / 180)
      ctx.translate(-params.origin_x, -params.origin_y)
    }

    // Apply ghosting
    if (key.ghost) {
      ctx.globalAlpha = KeyRenderer.GHOST_OPACITY
    }

    // Unified rendering: same algorithm for all key types

    // Apply alignment for consistent pixel boundaries
    // Only apply alignment for non-rotated keys OR axis-aligned rotations (90°/180°/270°)
    // Skip alignment for arbitrary angles
    const shouldAlign = !key.rotation_angle || axisAlignedAngle !== null

    if (shouldAlign) {
      if (params.nonRectangular && params.outercapx2 !== undefined) {
        params = this.alignNonRectangularKeyParams(params)
      } else {
        // Apply same pixel alignment logic to rectangular keys
        const originalOuterX = params.outercapx
        const originalOuterY = params.outercapy

        const alignedOuter = this.alignRectToPixels(
          params.outercapx,
          params.outercapy,
          params.outercapwidth,
          params.outercapheight,
        )

        // Calculate how much the outer rectangle moved
        const deltaX = alignedOuter.x - originalOuterX
        const deltaY = alignedOuter.y - originalOuterY

        // Update outer rectangle
        params.outercapx = alignedOuter.x
        params.outercapy = alignedOuter.y
        params.outercapwidth = alignedOuter.width
        params.outercapheight = alignedOuter.height

        // Update inner rectangle by the same offset
        params.innercapx = params.innercapx + deltaX
        params.innercapy = params.innercapy + deltaY
        // Inner width/height don't change, just position
      }
    }

    // Build rectangles array - same structure for regular and non-rectangular keys
    const rectangles = []

    // Outer rectangles (always at least one)
    rectangles.push({
      x: params.outercapx,
      y: params.outercapy,
      width: params.outercapwidth,
      height: params.outercapheight,
      type: 'outer' as const,
    })

    // Second outer rectangle for non-rectangular keys
    if (params.nonRectangular && params.outercapx2 !== undefined) {
      rectangles.push({
        x: params.outercapx2,
        y: params.outercapy2!,
        width: params.outercapwidth2!,
        height: params.outercapheight2!,
        type: 'outer' as const,
      })
    }

    // Inner rectangles (if not ghosted)
    if (!key.ghost) {
      rectangles.push({
        x: params.innercapx,
        y: params.innercapy,
        width: params.innercapwidth,
        height: params.innercapheight,
        type: 'inner' as const,
      })

      // Second inner rectangle for non-rectangular keys
      if (params.nonRectangular && !key.stepped && params.innercapx2 !== undefined) {
        rectangles.push({
          x: params.innercapx2,
          y: params.innercapy2!,
          width: params.innercapwidth2!,
          height: params.innercapheight2!,
          type: 'inner' as const,
        })
      }
    }

    // Check if this is a rotary encoder key
    // (check if 'switch mount' property equal 'rot_ec11')
    const isRotaryEncoder = key.sm === 'rot_ec11'

    // Render using unified vector union approach for all keys
    if (!key.decal) {
      if (isRotaryEncoder) {
        // Render as circle for rotary encoders (uses 'w' only, ignores 'h')
        this.drawCircularKey(
          ctx,
          params,
          options.isSelected ? KeyRenderer.SELECTION_COLOR : '#000000', // border color
          params.darkColor, // fill color
          params.lightColor, // inner color
          sizes.strokeWidth,
          sizes.bevelMargin,
        )
      } else {
        // Render as rectangle for normal keys
        this.drawKeyRectangleLayers(
          ctx,
          rectangles,
          sizes.roundOuter,
          options.isSelected ? KeyRenderer.SELECTION_COLOR : '#000000', // border color
          params.darkColor, // fill color
          params.lightColor, // inner color
          sizes.strokeWidth,
        )
      }
    }

    // For decal keys, only draw selection outline if selected
    if (key.decal && options.isSelected) {
      if (isRotaryEncoder) {
        // Draw circular outline for rotary encoder decals
        const centerX = params.outercapx + params.outercapwidth / 2
        const centerY = params.outercapy + params.outercapheight / 2
        const radius = params.outercapwidth / 2

        ctx.beginPath()
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI)
        ctx.strokeStyle = KeyRenderer.SELECTION_COLOR
        ctx.lineWidth = sizes.strokeWidth
        ctx.stroke()
      } else {
        // Draw rectangular outline for normal decals
        const outerRectangles = rectangles.filter((rect) => rect.type === 'outer')
        outerRectangles.forEach((rect) => {
          this.drawRoundedRect(
            ctx,
            rect.x,
            rect.y,
            rect.width,
            rect.height,
            sizes.roundOuter,
            undefined,
            KeyRenderer.SELECTION_COLOR,
            sizes.strokeWidth,
          )
        })
      }
    }

    // Draw homing nub
    if (key.nub) {
      this.drawHomingNub(ctx, params)
    }

    // Note: Label rendering is handled separately in canvas-renderer
    // This allows KeyRenderer to focus only on key shapes

    ctx.restore()
  }

  // ========== Private Helper Methods ==========
  // These will be added in Phase 3 and 4

  /**
   * Lighten a color using Lab color space for better perceptual results.
   * Uses caching for performance optimization.
   *
   * @param color - Hex color string
   * @param factor - Lightening factor (default: 1.2)
   * @returns Lightened hex color
   */
  private lightenColor(color: string, factor: number = 1.2): string {
    // Check cache first
    const cacheKey = `${color}-${factor}`
    const cached = this.colorCache.get(cacheKey)
    if (cached) {
      return cached
    }

    // Compute and cache result
    const result = this.computeLightenColor(color, factor)
    this.colorCache.set(cacheKey, result)
    return result
  }

  /**
   * Compute lightened color using Lab color space for better perceptual results.
   * This is the actual computation extracted from lightenColor for caching.
   *
   * @param color - Hex color string
   * @param factor - Lightening factor
   * @returns Lightened hex color
   */
  private computeLightenColor(color: string, factor: number): string {
    // Simplified Lab-based lightening to match original KLE behavior more closely
    const hex = color.replace('#', '')
    if (hex.length !== 6) return color

    const r = parseInt(hex.substr(0, 2), 16)
    const g = parseInt(hex.substr(2, 2), 16)
    const b = parseInt(hex.substr(4, 2), 16)

    // Convert sRGB to linear RGB for proper color math
    const toLinear = (c: number) => {
      const sRGB = c / 255
      return sRGB <= 0.03928 ? sRGB / 12.92 : Math.pow((sRGB + 0.055) / 1.055, 2.4)
    }

    const fromLinear = (c: number) => {
      if (c <= 0.0031308) {
        return c * 12.92 * 255
      }
      return (1.055 * Math.pow(c, 1 / 2.4) - 0.055) * 255
    }

    // Convert to CIE XYZ then to Lab
    const rLinear = toLinear(r)
    const gLinear = toLinear(g)
    const bLinear = toLinear(b)

    // D65 illuminant, sRGB primaries
    const x = rLinear * 0.4124564 + gLinear * 0.3575761 + bLinear * 0.1804375
    const y = rLinear * 0.2126729 + gLinear * 0.7151522 + bLinear * 0.072175
    const z = rLinear * 0.0193339 + gLinear * 0.119192 + bLinear * 0.9503041

    // Normalize to D65 white point
    const xn = x / 0.95047
    const yn = y / 1.0
    const zn = z / 1.08883

    // Convert to Lab
    const fx = xn > 0.008856 ? Math.pow(xn, 1 / 3) : 7.787 * xn + 16 / 116
    const fy = yn > 0.008856 ? Math.pow(yn, 1 / 3) : 7.787 * yn + 16 / 116
    const fz = zn > 0.008856 ? Math.pow(zn, 1 / 3) : 7.787 * zn + 16 / 116

    let lStar = 116 * fy - 16
    const aStar = 500 * (fx - fy)
    const bStar = 200 * (fy - fz)

    // Apply lightening to L* component
    lStar = Math.min(100, lStar * factor)

    // Convert back to XYZ
    const fyNew = (lStar + 16) / 116
    const fxNew = aStar / 500 + fyNew
    const fzNew = fyNew - bStar / 200

    const xNew = (fxNew > 0.206893 ? Math.pow(fxNew, 3) : (fxNew * 116 - 16) / 903.3) * 0.95047
    const yNew = lStar > 8 ? Math.pow(fyNew, 3) : lStar / 903.3
    const zNew = (fzNew > 0.206893 ? Math.pow(fzNew, 3) : (fzNew * 116 - 16) / 903.3) * 1.08883

    // Convert back to sRGB
    const rNew = xNew * 3.2404542 + yNew * -1.5371385 + zNew * -0.4985314
    const gNew = xNew * -0.969266 + yNew * 1.8760108 + zNew * 0.041556
    const bNew = xNew * 0.0556434 + yNew * -0.2040259 + zNew * 1.0572252

    // Convert back to 8-bit values
    const rFinal = Math.min(255, Math.max(0, Math.round(fromLinear(rNew))))
    const gFinal = Math.min(255, Math.max(0, Math.round(fromLinear(gNew))))
    const bFinal = Math.min(255, Math.max(0, Math.round(fromLinear(bNew))))

    return `#${rFinal.toString(16).padStart(2, '0')}${gFinal.toString(16).padStart(2, '0')}${bFinal.toString(16).padStart(2, '0')}`
  }

  /**
   * Check if rotation angle is axis-aligned (0°, 90°, 180°, 270°).
   */
  private getAxisAlignedRotation(rotationAngle: number | undefined): number | null {
    if (!rotationAngle) return 0

    const normalized = ((rotationAngle % 360) + 360) % 360
    const tolerance = 0.01

    if (Math.abs(normalized) < tolerance || Math.abs(normalized - 360) < tolerance) return 0
    if (Math.abs(normalized - 90) < tolerance) return 90
    if (Math.abs(normalized - 180) < tolerance) return 180
    if (Math.abs(normalized - 270) < tolerance) return 270

    return null
  }

  /**
   * Rotate a point around an origin.
   */
  private rotatePoint(
    x: number,
    y: number,
    originX: number,
    originY: number,
    angleDegrees: number,
  ): { x: number; y: number } {
    const angleRad = (angleDegrees * Math.PI) / 180
    const cos = Math.cos(angleRad)
    const sin = Math.sin(angleRad)

    const dx = x - originX
    const dy = y - originY

    return {
      x: originX + dx * cos - dy * sin,
      y: originY + dx * sin + dy * cos,
    }
  }

  /**
   * Clear the color cache. Called when render options change (e.g., zoom, DPI).
   * This ensures cached colors are recalculated with new rendering parameters.
   */
  public clearColorCache(): void {
    this.colorCache.clear()
  }

  /**
   * Get the keycap color (always returns light color, no gradients).
   *
   * @param params - Key render parameters
   * @returns Color string
   */
  private getKeycapColor(params: KeyRenderParams): string {
    return params.lightColor
  }

  /**
   * Create a rounded rectangle polygon for vector operations.
   *
   * @param x - X coordinate
   * @param y - Y coordinate
   * @param w - Width
   * @param h - Height
   * @param r - Corner radius
   * @param segmentsPerQuarter - Number of segments per quarter circle
   * @returns Array of polygon points
   */
  private makeRoundedRectPolygon(
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
    segmentsPerQuarter = 8,
  ): Array<[number, number]> {
    // Create polygon approximation of rounded rectangle for vector union
    const pts: Array<[number, number]> = []
    const seg = Math.max(2, Math.floor(segmentsPerQuarter))
    r = Math.min(r, w / 2, h / 2) // Clamp radius

    // Helper for arc points between angles a0..a1 (radians)
    const arc = (cx: number, cy: number, rr: number, a0: number, a1: number, segments: number) => {
      const out: Array<[number, number]> = []
      for (let i = 0; i <= segments; i++) {
        const t = i / segments
        const a = a0 + t * (a1 - a0)
        out.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr])
      }
      return out
    }

    // Build rounded rectangle polygon clockwise
    // Top-left corner arc (180deg to 270deg)
    pts.push(...arc(x + r, y + r, r, Math.PI, 1.5 * Math.PI, seg))
    // Top edge to top-right corner
    pts.push([x + w - r, y])
    // Top-right arc (270deg to 360deg)
    pts.push(...arc(x + w - r, y + r, r, 1.5 * Math.PI, 2 * Math.PI, seg))
    // Right edge to bottom-right corner
    pts.push([x + w, y + h - r])
    // Bottom-right arc (0deg to 90deg)
    pts.push(...arc(x + w - r, y + h - r, r, 0, 0.5 * Math.PI, seg))
    // Bottom edge to bottom-left
    pts.push([x + r, y + h])
    // Bottom-left arc (90deg to 180deg)
    pts.push(...arc(x + r, y + h - r, r, 0.5 * Math.PI, Math.PI, seg))
    // Left edge back to start
    pts.push([x, y + r])

    return pts
  }

  /**
   * Convert polygon-clipping result to Path2D.
   *
   * @param polygons - MultiPolygon from polygon-clipping
   * @param scale - Scale factor to undo precision scaling
   * @returns Path2D object
   */
  private polygonToPath2D(polygons: MultiPolygon, scale = 1): Path2D {
    // Convert polygon-clipping result to Path2D
    const path = new Path2D()

    const drawRing = (ring: Array<[number, number]>) => {
      if (ring.length === 0) return
      const first = ring[0]
      if (!first) return
      path.moveTo(first[0] / scale, first[1] / scale)
      for (let i = 1; i < ring.length; i++) {
        const point = ring[i]
        if (!point) continue
        path.lineTo(point[0] / scale, point[1] / scale)
      }
      path.closePath()
    }

    // Handle polygon-clipping result structure
    if (Array.isArray(polygons)) {
      for (const polygon of polygons) {
        if (Array.isArray(polygon)) {
          for (const ring of polygon) {
            if (Array.isArray(ring) && ring.length > 0) {
              drawRing(ring)
            }
          }
        }
      }
    }

    return path
  }

  /**
   * Create a unified Path2D using vector union for multiple rectangles.
   * Eliminates alignment issues for non-rectangular keys.
   *
   * @param rectangles - Array of rectangles to union
   * @param radius - Corner radius
   * @returns Unified Path2D
   */
  private createVectorUnionPath(
    rectangles: Array<{ x: number; y: number; width: number; height: number }>,
    radius: number,
  ): Path2D {
    // Use vector union to create single non-rectangular path - eliminates all alignment issues
    if (rectangles.length === 1) {
      // Single rectangle - use regular path
      const rect = rectangles[0]
      if (!rect) return new Path2D() // Return empty path if rect is undefined
      const path = new Path2D()
      path.moveTo(rect.x + radius, rect.y)
      path.lineTo(rect.x + rect.width - radius, rect.y)
      path.quadraticCurveTo(rect.x + rect.width, rect.y, rect.x + rect.width, rect.y + radius)
      path.lineTo(rect.x + rect.width, rect.y + rect.height - radius)
      path.quadraticCurveTo(
        rect.x + rect.width,
        rect.y + rect.height,
        rect.x + rect.width - radius,
        rect.y + rect.height,
      )
      path.lineTo(rect.x + radius, rect.y + rect.height)
      path.quadraticCurveTo(rect.x, rect.y + rect.height, rect.x, rect.y + rect.height - radius)
      path.lineTo(rect.x, rect.y + radius)
      path.quadraticCurveTo(rect.x, rect.y, rect.x + radius, rect.y)
      path.closePath()
      return path
    }

    // Multiple rectangles - compute vector union
    const scale = 1000 // Scale for integer precision in polygon ops
    const polygons = rectangles.map((rect) =>
      this.makeRoundedRectPolygon(
        rect.x * scale,
        rect.y * scale,
        rect.width * scale,
        rect.height * scale,
        radius * scale,
        Math.max(6, Math.ceil(radius / 2)), // Arc segments based on radius
      ),
    )

    try {
      const firstPolygon = polygons[0]
      if (!firstPolygon) return new Path2D() // Return empty path if first polygon is undefined

      // Compute union of all polygons using the default import
      let result: MultiPolygon = [[firstPolygon]] // Start with first polygon as MultiPolygon format - wrap Ring in Polygon in MultiPolygon
      for (let i = 1; i < polygons.length; i++) {
        const polygon = polygons[i]
        if (!polygon) continue // Skip undefined polygons
        result = polygonClippingLib.union(result, [[polygon]]) // union returns MultiPolygon - wrap Ring in Polygon
      }

      return this.polygonToPath2D(result, scale)
    } catch (error) {
      console.warn('Vector union calculation failed, using fallback rendering:', error)
      // Fallback: render each rectangle individually
      const path = new Path2D()
      rectangles.forEach((rect) => {
        path.moveTo(rect.x + radius, rect.y)
        path.lineTo(rect.x + rect.width - radius, rect.y)
        path.quadraticCurveTo(rect.x + rect.width, rect.y, rect.x + rect.width, rect.y + radius)
        path.lineTo(rect.x + rect.width, rect.y + rect.height - radius)
        path.quadraticCurveTo(
          rect.x + rect.width,
          rect.y + rect.height,
          rect.x + rect.width - radius,
          rect.y + rect.height,
        )
        path.lineTo(rect.x + radius, rect.y + rect.height)
        path.quadraticCurveTo(rect.x, rect.y + rect.height, rect.x, rect.y + rect.height - radius)
        path.lineTo(rect.x, rect.y + radius)
        path.quadraticCurveTo(rect.x, rect.y, rect.x + radius, rect.y)
        path.closePath()
      })
      return path
    }
  }
}

/**
 * Singleton instance of KeyRenderer for convenient usage
 */
export const keyRenderer = new KeyRenderer()
