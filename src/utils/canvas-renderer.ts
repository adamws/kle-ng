import type { Key, KeyboardMetadata } from '@ijprest/kle-serial'
import { D } from './decimal-math'

export interface RenderOptions {
  unit: number
  background: string
  showGrid?: boolean
  scale?: number
}

export interface KeyRenderParams {
  // Overall dimensions
  capwidth: number
  capheight: number
  capx: number
  capy: number
  capwidth2?: number
  capheight2?: number
  capx2?: number
  capy2?: number

  // Outer border dimensions
  outercapwidth: number
  outercapheight: number
  outercapx: number
  outercapy: number
  outercapwidth2?: number
  outercapheight2?: number
  outercapx2?: number
  outercapy2?: number

  // Inner surface dimensions
  innercapwidth: number
  innercapheight: number
  innercapx: number
  innercapy: number
  innercapwidth2?: number
  innercapheight2?: number
  innercapx2?: number
  innercapy2?: number

  // Text area dimensions
  textcapwidth: number
  textcapheight: number
  textcapx: number
  textcapy: number

  // Colors
  darkColor: string
  lightColor: string

  // Flags
  jShaped: boolean

  // Origin for rotation
  origin_x: number
  origin_y: number
}

interface DefaultSizes {
  keySpacing: number
  bevelMargin: number
  bevelOffsetTop: number
  bevelOffsetBottom: number
  bevelOffsetLeft?: number
  bevelOffsetRight?: number
  padding: number
  roundOuter: number
  roundInner: number
  gradientType: string
}

const defaultSizes: DefaultSizes = {
  keySpacing: 0,
  bevelMargin: 6,
  bevelOffsetTop: 3,
  bevelOffsetBottom: 3,
  padding: 3,
  roundOuter: 5,
  roundInner: 3,
  gradientType: 'none',
}

export class CanvasRenderer {
  private ctx: CanvasRenderingContext2D
  private options: RenderOptions
  private isJShapedContext: boolean = false

  constructor(canvas: HTMLCanvasElement, options: RenderOptions) {
    this.ctx = canvas.getContext('2d')!
    this.options = options
  }

  public getContext(): CanvasRenderingContext2D {
    return this.ctx
  }

  public getOptions(): RenderOptions {
    return this.options
  }

  private getRenderParams(key: Key): KeyRenderParams {
    const sizes = {
      ...defaultSizes,
      unit: this.options.unit,
      strokeWidth: 1,
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const params: any = {}

    params.jShaped = key.width !== key.width2 || key.height !== key.height2 || key.x2 || key.y2

    params.capwidth = D.mul(sizes.unit, key.width)
    params.capheight = D.mul(sizes.unit, key.height)
    params.capx = D.mul(sizes.unit, key.x)
    params.capy = D.mul(sizes.unit, key.y)

    if (params.jShaped) {
      params.capwidth2 = D.mul(sizes.unit, key.width2 || key.width)
      params.capheight2 = D.mul(sizes.unit, key.height2 || key.height)
      params.capx2 = D.mul(sizes.unit, D.add(key.x, key.x2 || 0))
      params.capy2 = D.mul(sizes.unit, D.add(key.y, key.y2 || 0))
    }

    params.outercapwidth = D.max(2, D.sub(params.capwidth, D.mul(sizes.keySpacing, 2)))
    params.outercapheight = D.max(2, D.sub(params.capheight, D.mul(sizes.keySpacing, 2)))

    const actualKeySpacingX = D.max(0, D.div(D.sub(params.capwidth, params.outercapwidth), 2))
    const actualKeySpacingY = D.max(0, D.div(D.sub(params.capheight, params.outercapheight), 2))

    params.outercapx = D.add(params.capx, actualKeySpacingX)
    params.outercapy = D.add(params.capy, actualKeySpacingY)

    if (params.jShaped) {
      params.outercapwidth2 = D.max(2, D.sub(params.capwidth2, D.mul(sizes.keySpacing, 2)))
      params.outercapheight2 = D.max(2, D.sub(params.capheight2, D.mul(sizes.keySpacing, 2)))

      const actualKeySpacingX2 = D.max(0, D.div(D.sub(params.capwidth2, params.outercapwidth2), 2))
      const actualKeySpacingY2 = D.max(
        0,
        D.div(D.sub(params.capheight2, params.outercapheight2), 2),
      )

      params.outercapx2 = D.add(params.capx2, actualKeySpacingX2)
      params.outercapy2 = D.add(params.capy2, actualKeySpacingY2)
    }

    params.innercapwidth = D.max(1, D.sub(params.outercapwidth, D.mul(sizes.bevelMargin, 2)))
    params.innercapheight = D.max(
      1,
      D.sub(
        params.outercapheight,
        D.add(D.mul(sizes.bevelMargin, 2), D.sub(sizes.bevelOffsetBottom, sizes.bevelOffsetTop)),
      ),
    )

    const actualBevelMarginX = D.max(0, D.div(D.sub(params.outercapwidth, params.innercapwidth), 2))
    const actualBevelMarginY = D.max(
      0,
      D.div(
        D.sub(
          params.outercapheight,
          D.add(params.innercapheight, D.sub(sizes.bevelOffsetBottom, sizes.bevelOffsetTop)),
        ),
        2,
      ),
    )

    params.innercapx = D.add(params.outercapx, actualBevelMarginX)
    params.innercapy = D.sub(D.add(params.outercapy, actualBevelMarginY), sizes.bevelOffsetTop)

    if (params.jShaped) {
      params.innercapwidth2 = D.max(1, D.sub(params.outercapwidth2, D.mul(sizes.bevelMargin, 2)))
      params.innercapheight2 = D.max(1, D.sub(params.outercapheight2, D.mul(sizes.bevelMargin, 2)))

      const actualBevelMarginX2 = D.max(
        0,
        D.div(D.sub(params.outercapwidth2, params.innercapwidth2), 2),
      )
      const actualBevelMarginY2 = D.max(
        0,
        D.div(D.sub(params.outercapheight2, params.innercapheight2), 2),
      )

      params.innercapx2 = D.add(params.outercapx2, actualBevelMarginX2)
      params.innercapy2 = D.sub(D.add(params.outercapy2, actualBevelMarginY2), sizes.bevelOffsetTop)
    }

    params.textcapwidth = D.max(1, D.sub(params.innercapwidth, D.mul(sizes.padding, 2)))
    params.textcapheight = D.max(1, D.sub(params.innercapheight, D.mul(sizes.padding, 2)))

    const actualPaddingX = D.max(0, D.div(D.sub(params.innercapwidth, params.textcapwidth), 2))
    const actualPaddingY = D.max(0, D.div(D.sub(params.innercapheight, params.textcapheight), 2))

    params.textcapx = D.add(params.innercapx, actualPaddingX)
    params.textcapy = D.add(params.innercapy, actualPaddingY)

    params.darkColor = key.color
    params.lightColor = this.lightenColor(key.color)

    params.origin_x = D.mul(sizes.unit, key.rotation_x || 0)
    params.origin_y = D.mul(sizes.unit, key.rotation_y || 0)

    return params as KeyRenderParams
  }

  private lightenColor(color: string, factor: number = 1.2): string {
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

  private getKeycapColor(params: KeyRenderParams): string {
    // Always return the light color - no gradients
    return params.lightColor
  }

  private alignToPixel(value: number): number {
    // Align to pixel boundary for crisp 1px strokes
    return Math.round(value) + 0.5
  }

  private alignRectToPixels(x: number, y: number, width: number, height: number) {
    // For stroke rendering, align to pixel boundaries for consistent edge thickness
    const alignedX = Math.round(x) + 0.5
    const alignedY = Math.round(y) + 0.5
    const alignedWidth = Math.round(x + width) - Math.round(x)
    const alignedHeight = Math.round(y + height) - Math.round(y)

    return { x: alignedX, y: alignedY, width: alignedWidth, height: alignedHeight }
  }

  // Specialized alignment for J-shaped keys to ensure both rectangles align consistently
  private alignJShapedKeyParams(params: KeyRenderParams) {
    // Create aligned versions of the key parameters that maintain consistent positioning
    // between the two rectangles of a J-shaped key
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

  private drawRoundedRect(
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
    fillStyle?: string,
    strokeStyle?: string,
    lineWidth = 1,
  ) {
    // For J-shaped keys, alignment is handled at a higher level to ensure consistency
    // For regular keys, align strokes to pixel boundaries
    let drawX = x
    let drawY = y
    let drawWidth = width
    let drawHeight = height

    // Only apply individual rectangle alignment for regular (non-J-shaped) keys with strokes
    // J-shaped keys get aligned at the parameter level to maintain layer consistency
    if (strokeStyle && !this.isJShapedContext) {
      const aligned = this.alignRectToPixels(x, y, width, height)
      drawX = aligned.x
      drawY = aligned.y
      drawWidth = aligned.width
      drawHeight = aligned.height
    }

    this.ctx.beginPath()
    this.ctx.moveTo(drawX + radius, drawY)
    this.ctx.lineTo(drawX + drawWidth - radius, drawY)
    this.ctx.quadraticCurveTo(drawX + drawWidth, drawY, drawX + drawWidth, drawY + radius)
    this.ctx.lineTo(drawX + drawWidth, drawY + drawHeight - radius)
    this.ctx.quadraticCurveTo(
      drawX + drawWidth,
      drawY + drawHeight,
      drawX + drawWidth - radius,
      drawY + drawHeight,
    )
    this.ctx.lineTo(drawX + radius, drawY + drawHeight)
    this.ctx.quadraticCurveTo(drawX, drawY + drawHeight, drawX, drawY + drawHeight - radius)
    this.ctx.lineTo(drawX, drawY + radius)
    this.ctx.quadraticCurveTo(drawX, drawY, drawX + radius, drawY)
    this.ctx.closePath()

    if (fillStyle) {
      this.ctx.fillStyle = fillStyle
      this.ctx.fill()
    }
    if (strokeStyle) {
      this.ctx.strokeStyle = strokeStyle
      this.ctx.lineWidth = lineWidth
      // Ensure consistent stroke rendering by setting line cap and join
      this.ctx.lineCap = 'square'
      this.ctx.lineJoin = 'miter'
      this.ctx.stroke()
    }
  }

  private drawJShapedKeyOuterBorders(
    params: KeyRenderParams,
    radius: number,
    strokeStyle: string,
    lineWidth = 1,
  ) {
    // Draw ONLY the outer borders of both rectangles
    // This is the first layer to avoid overlapping edge artifacts

    if (params.outercapx2 === undefined) return

    // Draw first rectangle border only
    this.drawRoundedRect(
      params.outercapx,
      params.outercapy,
      params.outercapwidth,
      params.outercapheight,
      radius,
      undefined, // No fill
      strokeStyle,
      lineWidth,
    )

    // Draw second rectangle border only
    this.drawRoundedRect(
      params.outercapx2,
      params.outercapy2!,
      params.outercapwidth2!,
      params.outercapheight2!,
      radius,
      undefined, // No fill
      strokeStyle,
      lineWidth,
    )
  }

  private drawJShapedKeyFills(params: KeyRenderParams, radius: number, fillStyle: string) {
    // Draw ONLY the fills of both rectangles
    // This is the second layer - color areas without borders

    if (params.outercapx2 === undefined) return

    // Draw first rectangle fill only
    this.drawRoundedRect(
      params.outercapx,
      params.outercapy,
      params.outercapwidth,
      params.outercapheight,
      radius,
      fillStyle,
      undefined, // No stroke
    )

    // Draw second rectangle fill only
    this.drawRoundedRect(
      params.outercapx2,
      params.outercapy2!,
      params.outercapwidth2!,
      params.outercapheight2!,
      radius,
      fillStyle,
      undefined, // No stroke
    )
  }

  private drawJShapedInnerLayer(params: KeyRenderParams, radius: number, fillStyle: string) {
    // Draw both inner rectangles (lightened surfaces) as fill-only
    // This is the third layer - lightened top surfaces

    if (params.innercapx2 === undefined) return

    // Draw first inner rectangle (fill only)
    this.drawRoundedRect(
      params.innercapx,
      params.innercapy,
      params.innercapwidth,
      params.innercapheight,
      radius,
      fillStyle,
      undefined, // No stroke to avoid edge artifacts
    )

    // Draw second inner rectangle (fill only)
    this.drawRoundedRect(
      params.innercapx2,
      params.innercapy2!,
      params.innercapwidth2!,
      params.innercapheight2!,
      radius,
      fillStyle,
      undefined, // No stroke to avoid edge artifacts
    )
  }

  private drawRotationOriginIndicator(key: Key) {
    // Get the rotation origin in canvas coordinates (same calculation as in getRenderParams)
    const originX = D.mul(key.rotation_x || 0, this.options.unit)
    const originY = D.mul(key.rotation_y || 0, this.options.unit)

    this.ctx.save()

    // Draw a crosshair at the rotation origin
    this.ctx.strokeStyle = '#ff6b35' // Orange color to distinguish from selection
    this.ctx.lineWidth = 2
    this.ctx.setLineDash([])

    const crossSize = 8

    // Draw horizontal line
    this.ctx.beginPath()
    this.ctx.moveTo(originX - crossSize, originY)
    this.ctx.lineTo(originX + crossSize, originY)
    this.ctx.stroke()

    // Draw vertical line
    this.ctx.beginPath()
    this.ctx.moveTo(originX, originY - crossSize)
    this.ctx.lineTo(originX, originY + crossSize)
    this.ctx.stroke()

    // Draw a small circle at the center
    this.ctx.fillStyle = '#ff6b35'
    this.ctx.beginPath()
    this.ctx.arc(originX, originY, 3, 0, 2 * Math.PI)
    this.ctx.fill()

    // Draw a larger circle outline
    this.ctx.strokeStyle = '#ff6b35'
    this.ctx.lineWidth = 1
    this.ctx.beginPath()
    this.ctx.arc(originX, originY, 6, 0, 2 * Math.PI)
    this.ctx.stroke()

    this.ctx.restore()
  }

  private drawKey(key: Key, isSelected = false) {
    let params = this.getRenderParams(key)
    const sizes = {
      ...defaultSizes,
      unit: this.options.unit,
      strokeWidth: isSelected ? 2 : 1,
    }

    this.ctx.save()

    // Apply rotation if needed
    if (key.rotation_angle) {
      this.ctx.translate(params.origin_x, params.origin_y)
      this.ctx.rotate(D.degreesToRadians(key.rotation_angle))
      this.ctx.translate(-params.origin_x, -params.origin_y)
    }

    // Apply ghosting
    if (key.ghost) {
      this.ctx.globalAlpha = 0.3
    }

    // Don't draw background for decals
    if (!key.decal) {
      // Draw outer layer - handle J-shaped keys with proper 3-layer approach
      if (params.jShaped && params.outercapx2 !== undefined) {
        // For J-shaped keys, align all parameters together for consistency across layers
        const alignedParams = this.alignJShapedKeyParams(params)
        this.isJShapedContext = true

        // Layer 1: Draw outer borders first (stroke only) - prevents overlapping edges
        this.drawJShapedKeyOuterBorders(
          alignedParams,
          sizes.roundOuter,
          isSelected ? '#dc3545' : '#000000',
          sizes.strokeWidth,
        )

        // Layer 2: Draw dark color fill for both rectangles (fill only)
        this.drawJShapedKeyFills(alignedParams, sizes.roundOuter, params.darkColor)

        // Use aligned params for subsequent layers
        params = alignedParams
      } else {
        // Regular rectangular key - draw both fill and stroke
        this.drawRoundedRect(
          params.outercapx,
          params.outercapy,
          params.outercapwidth,
          params.outercapheight,
          sizes.roundOuter,
          params.darkColor,
          isSelected ? '#dc3545' : '#000000',
          sizes.strokeWidth,
        )
      }

      // Draw inner surface (lighter) if not ghosted
      if (!key.ghost) {
        // Layer 3: Draw inner surface (lightened top) - handle J-shaped keys properly
        if (params.jShaped && !key.stepped && params.innercapx2 !== undefined) {
          // Draw lightened surface for both rectangles (fill only)
          this.drawJShapedInnerLayer(params, sizes.roundInner, params.lightColor)
        } else {
          // Regular rectangular key inner surface
          this.drawRoundedRect(
            params.innercapx,
            params.innercapy,
            params.innercapwidth,
            params.innercapheight,
            sizes.roundInner,
            params.lightColor,
            'rgba(0,0,0,0.1)',
          )
        }
      }

      // Draw homing nub
      if (key.nub) {
        this.drawHomingNub(params)
      }

      // For J-shaped keys, borders are already drawn with the outer layer
      // For regular keys, draw the outline border (red if selected, black otherwise)
      if (!params.jShaped) {
        this.drawRoundedRect(
          params.outercapx,
          params.outercapy,
          params.outercapwidth,
          params.outercapheight,
          sizes.roundOuter,
          undefined,
          isSelected ? '#dc3545' : '#000000',
          sizes.strokeWidth,
        )
      }
    }

    // For decal keys, draw selection outline if selected (since they skip background rendering)
    if (key.decal && isSelected) {
      if (params.jShaped && params.outercapx2 !== undefined) {
        // Handle J-shaped decal selection
        this.drawJShapedKeyOuterBorders(params, sizes.roundOuter, '#dc3545', sizes.strokeWidth)
      } else {
        // Regular decal key selection outline
        this.drawRoundedRect(
          params.outercapx,
          params.outercapy,
          params.outercapwidth,
          params.outercapheight,
          sizes.roundOuter,
          undefined,
          '#dc3545',
          sizes.strokeWidth,
        )
      }
    }

    // Draw text labels
    this.drawKeyLabels(key, params)

    // Reset J-shaped context flag
    this.isJShapedContext = false

    this.ctx.restore()
  }

  private drawHomingNub(params: KeyRenderParams) {
    // Draw small dot or bar for homing keys (F and J)
    const centerX = params.innercapx + params.innercapwidth / 2
    const centerY = params.innercapy + params.innercapheight * 0.7

    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'
    this.ctx.beginPath()
    this.ctx.arc(centerX, centerY, 2, 0, 2 * Math.PI)
    this.ctx.fill()
  }

  private drawKeyLabels(key: Key, params: KeyRenderParams) {
    // Label positioning grid matching original KLE (12 positions)
    const labelPositions = [
      // Top row
      { align: 'left', baseline: 'top' }, // 0: top-left
      { align: 'center', baseline: 'top' }, // 1: top-center
      { align: 'right', baseline: 'top' }, // 2: top-right

      // Center row
      { align: 'left', baseline: 'middle' }, // 3: center-left
      { align: 'center', baseline: 'middle' }, // 4: center
      { align: 'right', baseline: 'middle' }, // 5: center-right

      // Bottom row
      { align: 'left', baseline: 'bottom' }, // 6: bottom-left
      { align: 'center', baseline: 'bottom' }, // 7: bottom-center
      { align: 'right', baseline: 'bottom' }, // 8: bottom-right

      // Front legends (side print)
      { align: 'left', baseline: 'top' }, // 9: front-left
      { align: 'center', baseline: 'top' }, // 10: front-center
      { align: 'right', baseline: 'top' }, // 11: front-right
    ]

    key.labels.forEach((label, index) => {
      if (!label || index >= labelPositions.length) return

      const pos = labelPositions[index]
      const textColor = key.textColor[index] || key.default.textColor
      const textSize = key.textSize[index] || key.default.textSize

      // Calculate actual position with smart edge distances to prevent overlap
      let x: number
      let y: number

      // Fixed margin for left/right labels - should be consistent regardless of key size
      const fixedEdgeMargin = 1 // Fixed distance from edges for left/right/top/bottom labels

      if (pos.align === 'left') {
        // Left-aligned labels use fixed distance from left edge
        x = params.textcapx + fixedEdgeMargin
      } else if (pos.align === 'right') {
        // Right-aligned labels use fixed distance from right edge
        x = params.textcapx + params.textcapwidth - fixedEdgeMargin
      } else {
        // Center-aligned labels move proportionally with key width (no smartMargin needed)
        x = params.textcapx + params.textcapwidth * 0.5
      }

      if (pos.baseline === 'top') {
        // top labels use fixed distance from top edge
        y = params.textcapy + fixedEdgeMargin
      } else if (pos.baseline === 'bottom') {
        // bottom labels use fixed distance from bottom edge
        y = params.textcapy + params.textcapheight - fixedEdgeMargin
      } else {
        // middle labels move proportionally with key width (no smartMargin needed)
        y = params.textcapy + params.textcapheight * 0.5
      }

      // For front legends, position them on the front face
      if (index >= 9) {
        y = params.innercapy + params.innercapheight + 1
      }

      // Font size calculation matching original KLE
      let fontSize = Math.max(6, textSize * 4)

      // Front labels (indices 9-11) use smaller font size like in original KLE
      if (index >= 9) {
        fontSize = Math.min(10, fontSize * 0.8) // Front labels are smaller
      }

      // Use more web-safe fonts that match original better
      this.ctx.font = `${fontSize}px "Helvetica Neue", Helvetica, Arial, sans-serif`
      this.ctx.fillStyle = textColor
      this.ctx.textAlign = pos.align as CanvasTextAlign
      this.ctx.textBaseline = pos.baseline as CanvasTextBaseline

      // Enhanced text rendering with HTML entity support
      const text = this.processLabelText(label)

      // Calculate available space for this label
      const availableWidth = this.calculateAvailableWidth(params)
      const availableHeight = this.calculateAvailableHeight(params)

      // Add text shadow for better readability on light keys
      if (this.isLightColor(key.color)) {
        this.ctx.shadowColor = 'rgba(0, 0, 0, 0.1)'
        this.ctx.shadowOffsetX = 0.5
        this.ctx.shadowOffsetY = 0.5
        this.ctx.shadowBlur = 1
      }

      // Draw text with wrapping and bounds checking
      this.drawWrappedText(text, x, y, availableWidth, availableHeight, pos)

      // Clear shadow
      this.ctx.shadowColor = 'transparent'
      this.ctx.shadowOffsetX = 0
      this.ctx.shadowOffsetY = 0
      this.ctx.shadowBlur = 0
    })
  }

  private calculateAvailableWidth(params: KeyRenderParams): number {
    // Calculate available width - conservative approach with margins for readability
    const margin = 2
    return Math.max(0, params.textcapwidth - margin * 2)
  }

  private calculateAvailableHeight(params: KeyRenderParams): number {
    // Calculate available height - conservative approach with margins for readability
    const margin = 2
    return Math.max(0, params.textcapheight - margin * 2)
  }

  private drawWrappedText(
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    maxHeight: number,
    pos: { align: string; baseline: string },
  ): void {
    // First, try to draw the text as-is if it fits
    const textWidth = this.ctx.measureText(text).width

    if (textWidth <= maxWidth) {
      // Text fits on one line
      this.ctx.fillText(text, x, y)
      return
    }

    // Text is too long - attempt to wrap it
    const words = text.split(' ')
    if (words.length === 1) {
      // Single word that's too long - try to fit by reducing font size or truncating
      this.drawOverflowText(text, x, y, maxWidth)
      return
    }

    // Multiple words - wrap them
    const lineHeight = parseInt(this.ctx.font.match(/\d+/)?.[0] || '12') * 1.2
    const maxLines = Math.floor(maxHeight / lineHeight)

    if (maxLines < 1) {
      // Not enough vertical space for even one line
      return
    }

    const lines: string[] = []
    let currentLine = ''

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word
      const testWidth = this.ctx.measureText(testLine).width

      if (testWidth <= maxWidth) {
        currentLine = testLine
      } else {
        if (currentLine) {
          lines.push(currentLine)
          currentLine = word
        } else {
          // Single word too long for line
          lines.push(word)
        }

        if (lines.length >= maxLines) {
          break
        }
      }
    }

    if (currentLine && lines.length < maxLines) {
      lines.push(currentLine)
    }

    // Draw the wrapped lines
    this.drawMultiLineText(lines, x, y, lineHeight, pos)
  }

  private drawOverflowText(text: string, x: number, y: number, maxWidth: number): void {
    // For single words that are too long, try to truncate with ellipsis
    let truncatedText = text

    while (truncatedText.length > 1) {
      const testText = truncatedText + '…'
      if (this.ctx.measureText(testText).width <= maxWidth) {
        this.ctx.fillText(testText, x, y)
        return
      }
      truncatedText = truncatedText.slice(0, -1)
    }

    // If even one character is too wide, just draw it (let it overflow slightly)
    this.ctx.fillText(text, x, y)
  }

  private drawMultiLineText(
    lines: string[],
    x: number,
    y: number,
    lineHeight: number,
    pos: { align: string; baseline: string },
  ): void {
    // Adjust starting Y position based on baseline and number of lines
    let startY = y

    if (pos.baseline === 'middle') {
      // Center the block of text vertically
      const totalHeight = (lines.length - 1) * lineHeight
      startY = y - totalHeight / 2
    } else if (pos.baseline === 'bottom') {
      // Position so the last line is at y
      const totalHeight = (lines.length - 1) * lineHeight
      startY = y - totalHeight
    }

    // Draw each line
    lines.forEach((line, index) => {
      const lineY = startY + index * lineHeight
      this.ctx.fillText(line, x, lineY)
    })
  }

  private processLabelText(label: string): string {
    // Process HTML entities and basic formatting
    return label
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&larr;/g, '←')
      .replace(/&darr;/g, '↓')
      .replace(/&uarr;/g, '↑')
      .replace(/&rarr;/g, '→')
      .replace(/&lArr;/g, '⇐')
      .replace(/&dArr;/g, '⇓')
      .replace(/&uArr;/g, '⇑')
      .replace(/&rArr;/g, '⇒')
      .replace(/&nbsp;/g, ' ')
      .replace(/<[^>]*>/g, '') // Strip HTML tags
      .trim()
  }

  private isLightColor(color: string): boolean {
    const hex = color.replace('#', '')
    if (hex.length !== 6) return false

    const r = parseInt(hex.substr(0, 2), 16)
    const g = parseInt(hex.substr(2, 2), 16)
    const b = parseInt(hex.substr(4, 2), 16)

    // Calculate relative luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    return luminance > 0.5
  }

  public render(
    keys: Key[],
    selectedKeys: Key[],
    metadata: KeyboardMetadata,
    clearCanvas: boolean = true,
  ) {
    // Clear canvas if requested
    if (clearCanvas) {
      this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height)
    }

    this.ctx.save()

    // Skip background rendering - render keys only

    // Create sets for efficient lookup
    const selectedKeySet = new Set(selectedKeys)

    // Separate keys into selected and non-selected
    const nonSelectedKeys = keys.filter((key) => !selectedKeySet.has(key))

    // Sort both groups by row/column for proper rendering order within each group
    const sortedNonSelectedKeys = [...nonSelectedKeys].sort((a, b) => {
      return (
        (a.rotation_angle || 0) - (b.rotation_angle || 0) ||
        (a.rotation_x || 0) - (b.rotation_x || 0) ||
        (a.rotation_y || 0) - (b.rotation_y || 0) ||
        a.y - b.y ||
        a.x - b.x
      )
    })

    const sortedSelectedKeys = [...selectedKeys].sort((a, b) => {
      return (
        (a.rotation_angle || 0) - (b.rotation_angle || 0) ||
        (a.rotation_x || 0) - (b.rotation_x || 0) ||
        (a.rotation_y || 0) - (b.rotation_y || 0) ||
        a.y - b.y ||
        a.x - b.x
      )
    })

    // Draw non-selected keys first (bottom layer)
    sortedNonSelectedKeys.forEach((key) => {
      this.drawKey(key, false)
    })

    // Draw selected keys on top of non-selected keys (with red selection stroke)
    sortedSelectedKeys.forEach((key) => {
      this.drawKey(key, true)
    })

    // Draw rotation origin indicators on top of all keys for selected keys
    selectedKeys.forEach((key) => {
      if (key.rotation_angle && key.rotation_angle !== 0) {
        this.drawRotationOriginIndicator(key)
      }
    })

    this.ctx.restore()
  }

  public calculateBounds(keys: Key[]) {
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

  public calculateRotatedKeyBounds(key: Key): {
    minX: number
    minY: number
    maxX: number
    maxY: number
  } {
    // Include stroke width in bounds calculation (keys use 1px stroke)
    const strokeWidth = 1

    // If key has no rotation, use simple bounds
    if (!key.rotation_angle || key.rotation_angle === 0) {
      const unit = this.options.unit

      // Primary rectangle bounds
      const x1 = key.x * unit
      const y1 = key.y * unit
      const x2 = x1 + key.width * unit
      const y2 = y1 + key.height * unit

      let minX = x1
      let minY = y1
      let maxX = x2
      let maxY = y2

      // For J-shaped keys, include secondary rectangle bounds
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
    const unit = this.options.unit
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

    // For J-shaped keys, add the second rectangle corners
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

  public getKeyAtPosition(x: number, y: number, keys: Key[]): Key | null {
    // Hit testing with rotation support - check each key's bounding box
    // Use a copy to avoid mutating the original array and iterate from last to first for proper z-order
    for (let i = keys.length - 1; i >= 0; i--) {
      const key = keys[i]
      // Check from top to bottom
      const params = this.getRenderParams(key)

      let testX = x
      let testY = y

      // If key is rotated, apply inverse rotation to test coordinates
      if (key.rotation_angle) {
        const angle = D.degreesToRadians(-key.rotation_angle) // Inverse rotation
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
        return key
      }

      // Check second part for J-shaped keys
      if (params.jShaped && params.outercapx2 !== undefined) {
        if (
          testX >= params.outercapx2 &&
          testX <= params.outercapx2 + params.outercapwidth2! &&
          testY >= params.outercapy2! &&
          testY <= params.outercapy2! + params.outercapheight2!
        ) {
          return key
        }
      }
    }

    return null
  }
}
