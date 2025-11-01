import type { Key, KeyboardMetadata } from '@adamws/kle-serial'
import { D } from './decimal-math'
import polygonClippingLib from 'polygon-clipping'
import { parseBorderRadius, createRoundedRectanglePath } from './border-radius'
import type { MultiPolygon } from 'polygon-clipping'

export interface RenderOptions {
  unit: number
  background: string
  showGrid?: boolean
  scale?: number
  fontFamily?: string
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
  nonRectangular: boolean

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

// Label positioning grid matching original KLE (12 positions)
const labelPositions = [
  // Top row
  { align: 'left', baseline: 'hanging' }, // 0: top-left
  { align: 'center', baseline: 'hanging' }, // 1: top-center
  { align: 'right', baseline: 'hanging' }, // 2: top-right

  // Center row
  { align: 'left', baseline: 'middle' }, // 3: center-left
  { align: 'center', baseline: 'middle' }, // 4: center
  { align: 'right', baseline: 'middle' }, // 5: center-right

  // Bottom row
  { align: 'left', baseline: 'alphabetic' }, // 6: bottom-left
  { align: 'center', baseline: 'alphabetic' }, // 7: bottom-center
  { align: 'right', baseline: 'alphabetic' }, // 8: bottom-right

  // Front legends (side print)
  { align: 'left', baseline: 'hanging' }, // 9: front-left
  { align: 'center', baseline: 'hanging' }, // 10: front-center
  { align: 'right', baseline: 'hanging' }, // 11: front-right
]

export class CanvasRenderer {
  private ctx: CanvasRenderingContext2D
  private options: RenderOptions
  private imageCache: Map<string, HTMLImageElement | 'loading' | 'error'>
  private imageLoadCallbacks: Map<string, (() => void)[]>
  private onImageLoadCallback?: () => void
  private onImageErrorCallback?: (url: string) => void

  constructor(canvas: HTMLCanvasElement, options: RenderOptions) {
    this.ctx = canvas.getContext('2d')!
    this.options = options
    this.imageCache = new Map()
    this.imageLoadCallbacks = new Map()
  }

  /**
   * Set a callback to be called when any image loads
   */
  public setImageLoadCallback(callback: () => void): void {
    this.onImageLoadCallback = callback
  }

  /**
   * Set a callback to be called when any image fails to load
   */
  public setImageErrorCallback(callback: (url: string) => void): void {
    this.onImageErrorCallback = callback
  }

  public getContext(): CanvasRenderingContext2D {
    return this.ctx
  }

  public getOptions(): RenderOptions {
    return this.options
  }

  public updateOptions(options: RenderOptions): void {
    this.options = options
  }

  /**
   * Check if a URL is likely an SVG file
   */
  private isSvgUrl(url: string): boolean {
    return url.toLowerCase().endsWith('.svg') || url.includes('image/svg+xml')
  }

  /**
   * Convert inline SVG string to a data URL that can be used as an image source
   */
  private svgToDataUrl(svgContent: string): string {
    // Encode the SVG content for use in a data URL
    // Using encodeURIComponent ensures special characters are properly handled
    const encoded = encodeURIComponent(svgContent)
    return `data:image/svg+xml;charset=utf-8,${encoded}`
  }

  /**
   * Load an image from a URL and cache it
   * Tested formats: PNG, SVG
   * Other formats may work but are not officially tested
   */
  private loadImage(url: string, onLoad?: () => void): void {
    // Check if already in cache
    const cached = this.imageCache.get(url)
    if (cached === 'loading') {
      // Already loading, add callback
      if (onLoad) {
        const callbacks = this.imageLoadCallbacks.get(url) || []
        callbacks.push(onLoad)
        this.imageLoadCallbacks.set(url, callbacks)
      }
      return
    } else if (cached instanceof HTMLImageElement || cached === 'error') {
      // Already loaded or failed, call callback immediately
      if (onLoad) {
        onLoad()
      }
      return
    }

    // Mark as loading
    this.imageCache.set(url, 'loading')

    // Create image element
    const img = new Image()
    // Set crossOrigin to 'anonymous' to allow canvas export (toBlob/toDataURL)
    // This works for same-origin images and cross-origin images with CORS headers
    // Without this, the canvas becomes "tainted" and cannot be exported
    img.crossOrigin = 'anonymous'

    img.onload = () => {
      // Validate SVG dimensions (required for proper rendering in Firefox)
      if (this.isSvgUrl(url)) {
        if (!img.naturalWidth || !img.naturalHeight) {
          console.warn(
            `SVG image at ${url} may not render correctly in all browsers. ` +
              `SVG files should have explicit width and height attributes (not percentages).`,
          )
        }
      }

      this.imageCache.set(url, img)

      // Call all callbacks
      const callbacks = this.imageLoadCallbacks.get(url) || []
      if (onLoad) callbacks.push(onLoad)
      callbacks.forEach((cb) => cb())
      this.imageLoadCallbacks.delete(url)
    }

    img.onerror = () => {
      this.imageCache.set(url, 'error')
      console.warn(`Failed to load image: ${url}`)

      // Call error callback
      if (this.onImageErrorCallback) {
        this.onImageErrorCallback(url)
      }

      // Call callbacks even on error to allow re-render
      const callbacks = this.imageLoadCallbacks.get(url) || []
      if (onLoad) callbacks.push(onLoad)
      callbacks.forEach((cb) => cb())
      this.imageLoadCallbacks.delete(url)
    }

    img.src = url
  }

  /**
   * Get a loaded image from cache
   */
  private getImage(url: string): HTMLImageElement | null {
    const cached = this.imageCache.get(url)
    if (cached instanceof HTMLImageElement) {
      return cached
    }
    return null
  }

  private getRenderParams(key: Key): KeyRenderParams {
    const sizes = {
      ...defaultSizes,
      unit: this.options.unit,
      strokeWidth: 1,
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const params: any = {}

    params.nonRectangular =
      key.width !== key.width2 || key.height !== key.height2 || key.x2 || key.y2

    params.capwidth = D.mul(sizes.unit, key.width)
    params.capheight = D.mul(sizes.unit, key.height)
    params.capx = D.mul(sizes.unit, key.x)
    params.capy = D.mul(sizes.unit, key.y)

    if (params.nonRectangular) {
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

    if (params.nonRectangular) {
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

    if (params.nonRectangular) {
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

    // Reduce text padding to match original KLE behavior for better text fit
    const textPadding = Math.max(1, sizes.padding - 1) // Reduce by 1 pixel on each side
    params.textcapwidth = D.max(1, D.sub(params.innercapwidth, D.mul(textPadding, 2)))
    params.textcapheight = D.max(1, D.sub(params.innercapheight, D.mul(textPadding, 2)))

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

  // Specialized alignment for non-rectangular keys to ensure both rectangles align consistently
  private alignNonRectangularKeyParams(params: KeyRenderParams) {
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
    // Alignment is now handled consistently at the higher level (drawKey method)
    // No additional alignment needed here
    const drawX = x
    const drawY = y
    const drawWidth = width
    const drawHeight = height

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

  private polygonToPath2D(polygons: MultiPolygon, scale = 1): Path2D {
    // Convert polygon-clipping result to Path2D
    const path = new Path2D()

    const drawRing = (ring: Array<[number, number]>) => {
      if (ring.length === 0) return
      path.moveTo(ring[0][0] / scale, ring[0][1] / scale)
      for (let i = 1; i < ring.length; i++) {
        path.lineTo(ring[i][0] / scale, ring[i][1] / scale)
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

  private createVectorUnionPath(
    rectangles: Array<{ x: number; y: number; width: number; height: number }>,
    radius: number,
  ): Path2D {
    // Use vector union to create single non-rectangular path - eliminates all alignment issues
    if (rectangles.length === 1) {
      // Single rectangle - use regular path
      const rect = rectangles[0]
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
      // Compute union of all polygons using the default import
      let result: MultiPolygon = [[polygons[0]]] // Start with first polygon as MultiPolygon format - wrap Ring in Polygon in MultiPolygon
      for (let i = 1; i < polygons.length; i++) {
        result = polygonClippingLib.union(result, [[polygons[i]]]) // union returns MultiPolygon - wrap Ring in Polygon
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

  private drawKeyRectangleLayers(
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
  ) {
    // Vector union approach: Create single path that eliminates all alignment issues
    const outerRects = rectangles.filter((rect) => rect.type === 'outer')
    const innerRects = rectangles.filter((rect) => rect.type === 'inner')

    // Draw outer layer using vector union
    const outerPath = this.createVectorUnionPath(outerRects, radius)

    // Draw the unified outer path once - perfect alignment guaranteed
    if (fillColor) {
      this.ctx.fillStyle = fillColor
      this.ctx.fill(outerPath)
    }

    if (borderColor) {
      this.ctx.strokeStyle = borderColor
      this.ctx.lineWidth = strokeWidth
      this.ctx.stroke(outerPath)
    }

    // Draw inner surfaces using same vector union approach
    if (innerRects.length > 0 && innerColor) {
      const innerPath = this.createVectorUnionPath(innerRects, radius)
      this.ctx.fillStyle = innerColor
      this.ctx.fill(innerPath)
    }
  }

  private drawCircularKey(
    params: KeyRenderParams,
    borderColor: string,
    fillColor: string,
    innerColor: string,
    strokeWidth: number,
    bevelMargin: number,
  ) {
    // Calculate circle dimensions based on width only (ignore height)
    const centerX = params.outercapx + params.outercapwidth / 2
    const centerY = params.outercapy + params.outercapwidth / 2
    const outerRadius = params.outercapwidth / 2
    const innerRadius = (params.outercapwidth - bevelMargin * 2) / 2

    // Draw outer circle (border and fill)
    this.ctx.beginPath()
    this.ctx.arc(centerX, centerY, outerRadius, 0, 2 * Math.PI)

    if (fillColor) {
      this.ctx.fillStyle = fillColor
      this.ctx.fill()
    }

    if (borderColor) {
      this.ctx.strokeStyle = borderColor
      this.ctx.lineWidth = strokeWidth
      this.ctx.stroke()
    }

    // Draw inner circle (key surface)
    if (innerColor && innerRadius > 0) {
      this.ctx.beginPath()
      this.ctx.arc(centerX, centerY, innerRadius + 1, 0, 2 * Math.PI)
      this.ctx.fillStyle = innerColor
      this.ctx.fill()
    }
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

  private rotationPoints: Array<{
    id: string
    x: number
    y: number
    keyX: number
    keyY: number
    type: 'corner' | 'center'
    canvasX: number
    canvasY: number
  }> = []

  private calculateRotatedPoint(
    x: number,
    y: number,
    originX: number,
    originY: number,
    angleRadians: number,
  ): { x: number; y: number } {
    // Use canvas transformation to get exact same result as renderer
    // Create a temporary canvas context for transformation calculation
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!

    // Save current transform
    ctx.save()

    // Apply same transformation as the key renderer
    const originCanvasX = originX * this.options.unit
    const originCanvasY = originY * this.options.unit
    ctx.translate(originCanvasX, originCanvasY)
    ctx.rotate(angleRadians)
    ctx.translate(-originCanvasX, -originCanvasY)

    // Transform the point
    const canvasX = x * this.options.unit
    const canvasY = y * this.options.unit
    const transform = ctx.getTransform()
    const transformedX = transform.a * canvasX + transform.c * canvasY + transform.e
    const transformedY = transform.b * canvasX + transform.d * canvasY + transform.f

    ctx.restore()

    // Convert back to key coordinates
    return {
      x: transformedX / this.options.unit,
      y: transformedY / this.options.unit,
    }
  }

  private drawRotationPoints(
    selectedKeys: Key[],
    hoveredPointId?: string,
    selectedRotationOrigin?: { x: number; y: number } | null,
  ) {
    if (selectedKeys.length === 0) return

    // Clear previous rotation points
    this.rotationPoints = []

    this.ctx.save()

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
          ? this.calculateRotatedPoint(corner.x, corner.y, originX, originY, angleRadians)
          : { x: corner.x, y: corner.y }

        const canvasX = rotatedCorner.x * this.options.unit
        const canvasY = rotatedCorner.y * this.options.unit
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
        this.ctx.fillStyle = isHighlighted ? '#dc3545' : '#007bff'
        this.ctx.strokeStyle = '#ffffff'
        this.ctx.lineWidth = isHighlighted ? 3 : 2
        this.ctx.beginPath()
        this.ctx.arc(canvasX, canvasY, isHighlighted ? 8 : 6, 0, 2 * Math.PI)
        this.ctx.fill()
        this.ctx.stroke()
      })

      // Draw key center (1 point per key) - also account for rotation
      const centerX = key.x + key.width / 2
      const centerY = key.y + key.height / 2

      // Calculate rotated center position if key is rotated
      const rotatedCenter = hasRotation
        ? this.calculateRotatedPoint(centerX, centerY, originX, originY, angleRadians)
        : { x: centerX, y: centerY }

      const canvasCenterX = rotatedCenter.x * this.options.unit
      const canvasCenterY = rotatedCenter.y * this.options.unit
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
      this.ctx.fillStyle = isCenterHighlighted ? '#dc3545' : '#0056b3'
      this.ctx.strokeStyle = '#ffffff'
      this.ctx.lineWidth = isCenterHighlighted ? 3 : 2
      this.ctx.beginPath()
      this.ctx.arc(canvasCenterX, canvasCenterY, isCenterHighlighted ? 8 : 6, 0, 2 * Math.PI)
      this.ctx.fill()
      this.ctx.stroke()
    })

    this.ctx.restore()
  }

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

    // Unified rendering: same algorithm for all key types

    // Apply alignment for consistent pixel boundaries
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
          params,
          isSelected ? '#dc3545' : '#000000', // border color
          params.darkColor, // fill color
          params.lightColor, // inner color
          sizes.strokeWidth,
          sizes.bevelMargin,
        )
      } else {
        // Render as rectangle for normal keys
        this.drawKeyRectangleLayers(
          rectangles,
          sizes.roundOuter,
          isSelected ? '#dc3545' : '#000000', // border color
          params.darkColor, // fill color
          params.lightColor, // inner color
          sizes.strokeWidth,
        )
      }
    }

    // For decal keys, only draw selection outline if selected
    if (key.decal && isSelected) {
      if (isRotaryEncoder) {
        // Draw circular outline for rotary encoder decals
        const centerX = params.outercapx + params.outercapwidth / 2
        const centerY = params.outercapy + params.outercapheight / 2
        const radius = params.outercapwidth / 2

        this.ctx.beginPath()
        this.ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI)
        this.ctx.strokeStyle = '#dc3545'
        this.ctx.lineWidth = sizes.strokeWidth
        this.ctx.stroke()
      } else {
        // Draw rectangular outline for normal decals
        const outerRectangles = rectangles.filter((rect) => rect.type === 'outer')
        outerRectangles.forEach((rect) => {
          this.drawRoundedRect(
            rect.x,
            rect.y,
            rect.width,
            rect.height,
            sizes.roundOuter,
            undefined,
            '#dc3545',
            sizes.strokeWidth,
          )
        })
      }
    }

    // Draw homing nub
    if (key.nub) {
      this.drawHomingNub(params)
    }

    // Draw text labels
    if (isRotaryEncoder) {
      this.drawRotaryEncoderLabels(key, params)
    } else {
      this.drawKeyLabels(key, params)
    }

    this.ctx.restore()
  }

  private drawHomingNub(params: KeyRenderParams) {
    // Draw horizontal line for homing keys, matching original KLE
    // Original KLE uses a 10x2 pixel image positioned at center 90%
    const centerX = params.innercapx + params.innercapwidth / 2
    const centerY = params.innercapy + params.innercapheight * 0.9

    // Draw a horizontal line (10 pixels wide, 2 pixels tall)
    const lineWidth = 10
    const lineHeight = 2

    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'
    this.ctx.fillRect(centerX - lineWidth / 2, centerY - lineHeight / 2, lineWidth, lineHeight)
  }

  private calculateFontSize(key: Key, index: number) {
    const ts = key.textSize[index]
    const textSize = typeof ts === 'number' && ts > 0 ? ts : key.default.textSize
    // Font size calculation using linear formula: 6 + (2 * textSize)
    let fontSize = 6 + 2 * textSize
    // Front labels (indices 9-11) use smaller font size like in original KLE
    if (index >= 9) {
      fontSize = Math.min(10, fontSize * 0.8) // Front labels are smaller
    }
    return fontSize
  }

  private drawRotaryEncoderLabels(key: Key, params: KeyRenderParams) {
    key.labels.forEach((label, index) => {
      if (!label || index >= labelPositions.length) return

      const pos = labelPositions[index]
      const textColor = key.textColor[index] || key.default.textColor

      // Calculate actual position with smart edge distances to prevent overlap
      let x: number
      let y: number

      // Fixed margins for labels - should be consistent regardless of key size
      const fixedHorizontalMargin = 4 // Fixed distance from left/right edges
      const fixedVerticalMargin = 12 // Fixed distance from top/bottom edges

      if (pos.align === 'left') {
        // Left-aligned labels use fixed distance from left edge
        x = params.textcapx + fixedHorizontalMargin
      } else if (pos.align === 'right') {
        // Right-aligned labels use fixed distance from right edge
        x = params.textcapx + params.textcapwidth - fixedHorizontalMargin
      } else {
        // Center-aligned labels move proportionally with key width
        x = params.textcapx + params.textcapwidth * 0.5
      }

      const fontSize = this.calculateFontSize(key, index)

      // Use font from options or fall back to default
      const fontFamily = this.options.fontFamily || '"Helvetica Neue", Helvetica, Arial, sans-serif'
      this.ctx.font = `${fontSize}px ${fontFamily}`

      // Render only top labels (0-8) - rotary encoder has no front face, front labels not supported
      if (index >= 9) {
        return // Skip front labels for rotary encoders
      }

      // Calculate three fixed lines on the key surface
      const topLine = params.outercapy + fixedVerticalMargin
      // +1 is a workaround (looks better)
      const middleLine = params.outercapy + params.outercapwidth * 0.5 + 1
      const bottomLine = params.outercapy + params.outercapwidth - fixedVerticalMargin

      // Top labels (0-8): Use the appropriate fixed line
      if (index >= 0 && index <= 2) {
        y = topLine
      } else if (index >= 3 && index <= 5) {
        y = middleLine
      } else if (index >= 6 && index <= 8) {
        y = bottomLine
      } else {
        // Fallback: middle line
        y = middleLine
      }

      this.ctx.fillStyle = textColor
      this.ctx.textAlign = pos.align as CanvasTextAlign
      this.ctx.textBaseline = pos.baseline as CanvasTextBaseline

      // Calculate available space for this label
      const availableWidth = params.innercapwidth
      const availableHeight = availableWidth

      // Check if label is image-only or SVG-only
      const isImageOnly = /^<img\s+[^>]+>\s*$/.test(label)
      const isSvgOnly = /^<svg[^>]*>[\s\S]*?<\/svg>\s*$/.test(label)

      if (isImageOnly || isSvgOnly) {
        // Image-only label: position based on alignment
        this.drawImageLabel(label, params, pos, index)
      } else {
        // Text or mixed content: use normal text rendering
        const processedLabel = this.processLabelText(label)
        this.drawWrappedText(processedLabel, x, y, availableWidth, availableHeight, pos)
      }
    })
  }

  private drawKeyLabels(key: Key, params: KeyRenderParams) {
    key.labels.forEach((label, index) => {
      if (!label || index >= labelPositions.length) return

      const pos = labelPositions[index]
      const textColor = key.textColor[index] || key.default.textColor

      // Calculate actual position with smart edge distances to prevent overlap
      let x: number
      let y: number

      // Fixed margins for labels - should be consistent regardless of key size
      const fixedHorizontalMargin = 1 // Fixed distance from left/right edges
      const fixedVerticalMargin = 3 // Fixed distance from top/bottom edges

      if (pos.align === 'left') {
        // Left-aligned labels use fixed distance from left edge
        x = params.textcapx + fixedHorizontalMargin
      } else if (pos.align === 'right') {
        // Right-aligned labels use fixed distance from right edge
        x = params.textcapx + params.textcapwidth - fixedHorizontalMargin
      } else {
        // Center-aligned labels move proportionally with key width
        x = params.textcapx + params.textcapwidth * 0.5
      }

      const fontSize = this.calculateFontSize(key, index)

      // Use font from options or fall back to default
      const fontFamily = this.options.fontFamily || '"Helvetica Neue", Helvetica, Arial, sans-serif'
      this.ctx.font = `${fontSize}px ${fontFamily}`

      // Apply new baseline positioning only to top labels (0-8), keep original for front labels (9-11)
      if (index >= 9) {
        // For front legends, position them on the front face
        y = params.innercapy + params.innercapheight + 1
      } else {
        // Calculate three fixed lines on the key surface
        const topLine = params.textcapy + fixedVerticalMargin
        // +1 is a workaround (looks better)
        const middleLine = params.textcapy + params.textcapheight * 0.5 + 1
        const bottomLine = params.textcapy + params.textcapheight - fixedVerticalMargin

        // Top labels (0-8): Use the appropriate fixed line
        if (index >= 0 && index <= 2) {
          y = topLine
        } else if (index >= 3 && index <= 5) {
          y = middleLine
        } else if (index >= 6 && index <= 8) {
          y = bottomLine
        } else {
          // Fallback: middle line
          y = middleLine
        }
      }

      this.ctx.fillStyle = textColor
      this.ctx.textAlign = pos.align as CanvasTextAlign
      this.ctx.textBaseline = pos.baseline as CanvasTextBaseline

      // Calculate available space for this label
      const availableWidth = params.textcapwidth
      const availableHeight = params.textcapheight - 2

      // Check if label is image-only or SVG-only
      const isImageOnly = /^<img\s+[^>]+>\s*$/.test(label)
      const isSvgOnly = /^<svg[^>]*>[\s\S]*?<\/svg>\s*$/.test(label)

      if (isImageOnly || isSvgOnly) {
        // Image-only label: position based on alignment
        this.drawImageLabel(label, params, pos, index)
      } else {
        // Text or mixed content: use normal text rendering
        const processedLabel = this.processLabelText(label)
        this.drawWrappedText(processedLabel, x, y, availableWidth, availableHeight, pos)
      }
    })
  }

  /**
   * Draw image-only label with alignment-based positioning
   * Supports both external images (<img src="...">) and inline SVG (<svg>...</svg>)
   */
  private drawImageLabel(
    label: string,
    params: KeyRenderParams,
    pos: { align: string; baseline: string },
    index: number,
  ): void {
    // Parse the image or SVG tag
    const segments = this.parseHtmlText(label)
    const imageSegment = segments.find((s) => s.type === 'image' || s.type === 'svg')

    if (!imageSegment) {
      return
    }

    let img: HTMLImageElement | null = null
    let width: number
    let height: number

    if (imageSegment.type === 'svg' && imageSegment.svgContent) {
      // Inline SVG: convert to data URL and load
      const dataUrl = this.svgToDataUrl(imageSegment.svgContent)
      img = this.getImage(dataUrl)
      if (!img) {
        // Image not loaded yet, trigger loading
        this.loadImage(dataUrl, this.onImageLoadCallback)
        return
      }
      // Use dimensions from SVG attributes or natural dimensions
      width = imageSegment.width || img.naturalWidth || 32
      height = imageSegment.height || img.naturalHeight || 32
    } else if (imageSegment.type === 'image' && imageSegment.src) {
      // External image
      img = this.getImage(imageSegment.src)
      if (!img) {
        // Image not loaded yet, trigger loading
        this.loadImage(imageSegment.src, this.onImageLoadCallback)
        return
      }
      width = imageSegment.width || img.naturalWidth
      height = imageSegment.height || img.naturalHeight
    } else {
      return
    }

    let imgX: number
    let imgY: number

    // Horizontal alignment based on column (left/center/right)
    // Using inner cap surface (without text padding) for precise alignment
    if (pos.align === 'left') {
      // Left column: image's left edge at inner cap's left edge
      imgX = params.innercapx
    } else if (pos.align === 'center') {
      // Center column: image's center at inner cap's center
      imgX = params.innercapx + params.innercapwidth / 2 - width / 2
    } else {
      // Right column: image's right edge at inner cap's right edge
      imgX = params.innercapx + params.innercapwidth - width
    }

    // Vertical alignment based on row (top/middle/bottom)
    // Using inner cap surface (without text padding) for precise alignment
    if (index >= 0 && index <= 2) {
      // Top row: image's top edge at inner cap's top edge
      imgY = params.innercapy
    } else if (index >= 3 && index <= 5) {
      // Middle row: image's center at inner cap's center
      imgY = params.innercapy + params.innercapheight / 2 - height / 2
    } else if (index >= 6 && index <= 8) {
      // Bottom row: image's bottom edge at inner cap's bottom edge
      imgY = params.innercapy + params.innercapheight - height
    } else if (index >= 9) {
      // Front legends (9-11): position on front face
      imgY = params.capy + params.capheight + 1
    } else {
      // Fallback
      imgY = params.innercapy
    }

    // Draw the image
    this.ctx.drawImage(img, imgX, imgY, width, height)
  }

  /**
   * Process label text to handle line breaks while preserving other content
   * Only <br> and <BR> tags are converted to line breaks; all other HTML is preserved
   */
  private processLabelText(label: string): string {
    // Convert <br> and <BR> tags (with optional attributes) to newlines
    return label.replace(/<br\s*\/?>/gi, '\n')
  }

  /**
   * Parse text with HTML formatting tags and extract text segments with their styles
   * Supports: <b>, <i>, <b><i> (nested), <img>, <svg>...</svg>
   *
   * Image formats:
   * - External images: <img src="path/to/image.png"> or <img src="path/to/image.svg">
   * - Inline SVG: <svg width="32" height="32">...</svg>
   *
   * Tested formats: PNG (external), SVG (external and inline)
   * Other raster formats (JPG, GIF, WebP) may work but are not officially tested
   *
   * SVG Requirements (both external and inline):
   * - Must have explicit width and height attributes (not percentages)
   * - External resources (CSS, images) must be inlined as data URLs
   * - Server must support CORS for cross-origin SVG files (external only)
   */
  private parseHtmlText(text: string): Array<{
    type: 'text' | 'image' | 'svg'
    text?: string
    bold?: boolean
    italic?: boolean
    src?: string
    svgContent?: string
    width?: number
    height?: number
  }> {
    const segments: Array<{
      type: 'text' | 'image' | 'svg'
      text?: string
      bold?: boolean
      italic?: boolean
      src?: string
      svgContent?: string
      width?: number
      height?: number
    }> = []
    let currentBold = false
    let currentItalic = false
    let currentText = ''

    // Regular expression to match HTML tags and text
    // Updated to handle <img> tags, inline <svg> tags, and formatting tags
    const regex = /<\s*(\/?)([bi])\s*>|<img\s+([^>]+)>|<svg[^>]*>([\s\S]*?)<\/svg>|([^<]+)/gi
    let match: RegExpExecArray | null

    while ((match = regex.exec(text)) !== null) {
      if (match[5]) {
        // Plain text segment
        currentText += match[5]
      } else if (match[4] !== undefined) {
        // Inline <svg> tag
        // Save any accumulated text first
        if (currentText) {
          segments.push({
            type: 'text',
            text: currentText,
            bold: currentBold,
            italic: currentItalic,
          })
          currentText = ''
        }

        // Extract SVG content (match[0] is the full <svg>...</svg>)
        const svgContent = match[0]

        // Try to extract width and height from SVG attributes
        const widthMatch = svgContent.match(/width\s*=\s*["']?(\d+)["']?/i)
        const heightMatch = svgContent.match(/height\s*=\s*["']?(\d+)["']?/i)

        segments.push({
          type: 'svg',
          svgContent,
          width: widthMatch ? parseInt(widthMatch[1]) : undefined,
          height: heightMatch ? parseInt(heightMatch[1]) : undefined,
        })
      } else if (match[3]) {
        // <img> tag with attributes
        // Save any accumulated text first
        if (currentText) {
          segments.push({
            type: 'text',
            text: currentText,
            bold: currentBold,
            italic: currentItalic,
          })
          currentText = ''
        }

        // Parse img attributes
        const attrs = match[3]
        const srcMatch = attrs.match(/src\s*=\s*["']([^"']+)["']/i)
        const widthMatch = attrs.match(/width\s*=\s*["']?(\d+)["']?/i)
        const heightMatch = attrs.match(/height\s*=\s*["']?(\d+)["']?/i)

        if (srcMatch) {
          segments.push({
            type: 'image',
            src: srcMatch[1],
            width: widthMatch ? parseInt(widthMatch[1]) : undefined,
            height: heightMatch ? parseInt(heightMatch[1]) : undefined,
          })
        }
      } else if (match[2]) {
        // HTML tag (opening or closing)
        const isClosing = match[1] === '/'
        const tagName = match[2].toLowerCase()

        // If we have accumulated text, save it with current styles
        if (currentText) {
          segments.push({
            type: 'text',
            text: currentText,
            bold: currentBold,
            italic: currentItalic,
          })
          currentText = ''
        }

        // Update current style state
        if (tagName === 'b') {
          currentBold = !isClosing
        } else if (tagName === 'i') {
          currentItalic = !isClosing
        }
      }
    }

    // Add any remaining text
    if (currentText) {
      segments.push({ type: 'text', text: currentText, bold: currentBold, italic: currentItalic })
    }

    // If no segments were created (no valid HTML), return the original text as plain
    if (segments.length === 0) {
      segments.push({ type: 'text', text, bold: false, italic: false })
    }

    return segments
  }

  /**
   * Check if text contains HTML formatting tags or inline SVG
   */
  private hasHtmlFormatting(text: string): boolean {
    return /<\s*[bi]\s*>|<\s*\/\s*[bi]\s*>|<img\s+|<svg[^>]*>/i.test(text)
  }

  /**
   * Strip HTML formatting tags from text (but not img tags)
   */
  private stripHtmlTags(text: string): string {
    // Only strip <b>, </b>, <i>, </i> tags, not <img>
    return text.replace(/<\s*\/?[bi]\s*>/gi, '')
  }

  /**
   * Measure the width of text with HTML formatting
   */
  private measureHtmlText(text: string): number {
    const segments = this.parseHtmlText(text)
    let totalWidth = 0

    // Save current font
    const originalFont = this.ctx.font

    segments.forEach((segment) => {
      if (segment.type === 'text') {
        // Apply font style for this segment
        const fontStyle = this.buildFontStyle(segment.bold!, segment.italic!)
        this.ctx.font = fontStyle

        // Measure this segment
        totalWidth += this.ctx.measureText(segment.text!).width
      } else if (segment.type === 'image') {
        // Images contribute their width (or a default if not loaded)
        const img = this.getImage(segment.src!)
        if (img) {
          const width = segment.width || img.naturalWidth
          totalWidth += width
        } else {
          // Default placeholder width
          totalWidth += segment.width || 16
        }
      }
    })

    // Restore original font
    this.ctx.font = originalFont

    return totalWidth
  }

  /**
   * Build font style string based on bold and italic flags
   */
  private buildFontStyle(bold: boolean, italic: boolean): string {
    const baseFontSize = parseInt(this.ctx.font.match(/\d+/)?.[0] || '12')
    const fontFamily = this.options.fontFamily || '"Helvetica Neue", Helvetica, Arial, sans-serif'

    const stylePrefix = `${italic ? 'italic ' : ''}${bold ? 'bold ' : ''}`
    return `${stylePrefix}${baseFontSize}px ${fontFamily}`
  }

  /**
   * Draw text with HTML formatting support (for text with inline formatting, not image-only)
   */
  private drawHtmlText(text: string, x: number, y: number): void {
    const segments = this.parseHtmlText(text)

    // Save context state
    const originalFont = this.ctx.font
    const originalTextAlign = this.ctx.textAlign
    const originalTextBaseline = this.ctx.textBaseline

    // For center/right alignment, we need to calculate total width first
    let totalWidth = 0
    if (originalTextAlign === 'center' || originalTextAlign === 'right') {
      totalWidth = this.measureHtmlText(text)
    }

    // Calculate starting x position based on alignment
    let currentX = x
    if (originalTextAlign === 'center') {
      currentX = x - totalWidth / 2
    } else if (originalTextAlign === 'right') {
      currentX = x - totalWidth
    }

    // Temporarily set text align to left for segment-by-segment rendering
    this.ctx.textAlign = 'left'

    // Draw each segment
    segments.forEach((segment) => {
      if (segment.type === 'text') {
        // Apply font style for this segment
        const fontStyle = this.buildFontStyle(segment.bold!, segment.italic!)
        this.ctx.font = fontStyle

        // Draw the text segment
        this.ctx.fillText(segment.text!, currentX, y)

        // Move x position for next segment
        currentX += this.ctx.measureText(segment.text!).width
      } else if (segment.type === 'image' && segment.src) {
        // For mixed text+image content (not supported)
        // Just skip images in mixed content - they should use image-only labels
        const img = this.getImage(segment.src)
        if (!img) {
          // Trigger loading for next render
          this.loadImage(segment.src, this.onImageLoadCallback)

          // Draw placeholder rectangle
          const width = segment.width || 16
          const height = segment.height || 16

          let imgY = y
          if (originalTextBaseline === 'middle') {
            imgY = y - height / 2
          } else if (originalTextBaseline === 'alphabetic') {
            imgY = y - height
          }

          // Draw a simple rectangle placeholder
          this.ctx.save()
          this.ctx.strokeStyle = '#ccc'
          this.ctx.strokeRect(currentX, imgY, width, height)
          this.ctx.restore()

          currentX += width
        }
      }
    })

    // Restore original font and text align
    this.ctx.font = originalFont
    this.ctx.textAlign = originalTextAlign
    this.ctx.textBaseline = originalTextBaseline
  }

  /**
   * Wrap HTML text across multiple lines while preserving formatting
   */
  private wrapHtmlText(text: string, maxWidth: number, maxLines: number): string[] {
    const segments = this.parseHtmlText(text)
    const lines: string[] = []
    let currentLine: Array<{ text: string; bold: boolean; italic: boolean }> = []
    let currentLineWidth = 0

    // Save current font
    const originalFont = this.ctx.font

    for (const segment of segments) {
      // Skip image segments - they don't wrap
      if (segment.type === 'image') {
        continue
      }

      // Split text segment by words
      const words = segment.text!.split(' ')

      for (let i = 0; i < words.length; i++) {
        const word = words[i]

        // Apply font style to measure this word
        const fontStyle = this.buildFontStyle(segment.bold!, segment.italic!)
        this.ctx.font = fontStyle

        // Measure word with space (unless it's the first word on the line)
        const wordText = currentLine.length === 0 ? word : ' ' + word
        const wordWidth = this.ctx.measureText(wordText).width

        if (currentLineWidth + wordWidth <= maxWidth) {
          // Word fits on current line
          currentLine.push({
            text: wordText,
            bold: segment.bold!,
            italic: segment.italic!,
          })
          currentLineWidth += wordWidth
        } else {
          // Word doesn't fit, start new line
          if (currentLine.length > 0) {
            // Save current line
            lines.push(this.reconstructHtmlLine(currentLine))
            if (lines.length >= maxLines) {
              break
            }
            // Start new line with this word
            currentLine = [{ text: word, bold: segment.bold!, italic: segment.italic! }]
            currentLineWidth = this.ctx.measureText(word).width
          } else {
            // Even a single word doesn't fit, add it anyway
            currentLine.push({ text: word, bold: segment.bold!, italic: segment.italic! })
            lines.push(this.reconstructHtmlLine(currentLine))
            if (lines.length >= maxLines) {
              break
            }
            currentLine = []
            currentLineWidth = 0
          }
        }

        // If we've reached max lines, stop
        if (lines.length >= maxLines) {
          break
        }
      }

      // If we've reached max lines, stop
      if (lines.length >= maxLines) {
        break
      }
    }

    // Add any remaining line
    if (currentLine.length > 0 && lines.length < maxLines) {
      lines.push(this.reconstructHtmlLine(currentLine))
    }

    // Restore original font
    this.ctx.font = originalFont

    return lines
  }

  /**
   * Reconstruct HTML line from segments
   */
  private reconstructHtmlLine(
    segments: Array<{ text: string; bold: boolean; italic: boolean }>,
  ): string {
    let html = ''
    let currentBold = false
    let currentItalic = false

    segments.forEach((segment) => {
      // Close tags if style changed
      if (currentBold && !segment.bold) {
        html += '</b>'
        currentBold = false
      }
      if (currentItalic && !segment.italic) {
        html += '</i>'
        currentItalic = false
      }

      // Open tags if style changed
      if (!currentBold && segment.bold) {
        html += '<b>'
        currentBold = true
      }
      if (!currentItalic && segment.italic) {
        html += '<i>'
        currentItalic = true
      }

      // Add text
      html += segment.text
    })

    // Close any remaining tags
    if (currentItalic) {
      html += '</i>'
    }
    if (currentBold) {
      html += '</b>'
    }

    return html
  }

  /**
   * Draw multiple lines of HTML text
   */
  private drawMultiLineHtmlText(
    lines: string[],
    x: number,
    y: number,
    lineHeight: number,
    pos: { align: string; baseline: string },
  ): void {
    let startY = y

    // Adjust starting Y based on baseline
    if (pos.baseline === 'middle') {
      // Center the block of text vertically around the provided Y
      const totalHeight = (lines.length - 1) * lineHeight
      startY = y - totalHeight / 2
    } else if (pos.baseline === 'alphabetic') {
      // Position so the last line ends at the provided Y
      const totalHeight = (lines.length - 1) * lineHeight
      startY = y - totalHeight
    }

    // Draw each line with HTML formatting
    lines.forEach((line, index) => {
      const lineY = startY + index * lineHeight
      // Don't pass labelBounds for multi-line text - it would position each line incorrectly
      this.drawHtmlText(line, x, lineY)
    })
  }

  private drawWrappedText(
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    maxHeight: number,
    pos: { align: string; baseline: string },
  ): void {
    const lineHeight = parseInt(this.ctx.font.match(/\d+/)?.[0] || '12') * 1.2
    const maxLines = Math.floor(maxHeight / lineHeight)

    if (maxLines < 1) {
      // Not enough vertical space for even one line
      return
    }

    // Check if text contains HTML formatting tags
    const hasHtml = this.hasHtmlFormatting(text)

    // Check if text contains explicit line breaks from <br> tags
    const hasLineBreaks = text.includes('\n')

    if (!hasLineBreaks && !hasHtml) {
      // No line breaks and no HTML - use original simple logic
      const textWidth = this.ctx.measureText(text).width
      if (textWidth <= maxWidth) {
        // Text fits on one line
        this.ctx.fillText(text, x, y)
        return
      }

      // Text is too long - wrap by words
      const words = text.split(' ')
      if (words.length === 1) {
        // Single word too long
        this.drawOverflowText(text, x, y, maxWidth)
        return
      }

      // Multiple words - wrap them using original logic
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

      this.drawMultiLineText(lines, x, y, lineHeight, pos)
      return
    } else if (hasHtml && !hasLineBreaks) {
      // Has HTML formatting but no line breaks - render with formatting
      const textWidth = this.measureHtmlText(text)
      if (textWidth <= maxWidth) {
        // Text fits on one line with HTML formatting
        this.drawHtmlText(text, x, y)
        return
      }

      // HTML text is too long - wrap with formatting preserved
      const wrappedLines = this.wrapHtmlText(text, maxWidth, maxLines)
      if (wrappedLines.length === 0) {
        return
      }

      // Draw each line with HTML formatting
      this.drawMultiLineHtmlText(wrappedLines, x, y, lineHeight, pos)
      return
    }

    // Handle text with explicit line breaks
    const explicitLines = text.split('\n')
    const finalLines: string[] = []

    for (const line of explicitLines) {
      const trimmedLine = line.trim()

      if (!trimmedLine) {
        // Empty line from line break - add it
        finalLines.push('')
        if (finalLines.length >= maxLines) break
        continue
      }

      // Check if this line fits as-is
      const lineWidth = this.ctx.measureText(trimmedLine).width

      if (lineWidth <= maxWidth) {
        // Line fits, add it directly
        finalLines.push(trimmedLine)
      } else {
        // Line is too long, need to wrap words within this line
        const words = trimmedLine.split(' ')

        if (words.length === 1) {
          // Single word that's too long - add it and let rendering handle overflow
          finalLines.push(trimmedLine)
        } else {
          // Multiple words - wrap them
          let currentLine = ''

          for (const word of words) {
            const testLine = currentLine ? `${currentLine} ${word}` : word
            const testWidth = this.ctx.measureText(testLine).width

            if (testWidth <= maxWidth) {
              currentLine = testLine
            } else {
              if (currentLine) {
                finalLines.push(currentLine)
                currentLine = word
                if (finalLines.length >= maxLines) break
              } else {
                // Single word too long for line
                finalLines.push(word)
                break
              }
            }
          }

          if (currentLine && finalLines.length < maxLines) {
            finalLines.push(currentLine)
          }
        }
      }

      // Stop if we've reached max lines
      if (finalLines.length >= maxLines) break
    }

    // If we only have one line and it fits, use simple rendering
    if (finalLines.length === 1 && this.ctx.measureText(finalLines[0]).width <= maxWidth) {
      this.ctx.fillText(finalLines[0], x, y)
      return
    }

    // Use multi-line rendering for multiple lines or overflow cases
    this.drawMultiLineText(finalLines.slice(0, maxLines), x, y, lineHeight, pos)
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
    let startY = y

    // Note: Y position has already been calculated considering the baseline,
    // so we don't need to adjust further for baseline - just handle multi-line spacing
    if (pos.baseline === 'middle') {
      // Center the block of text vertically around the provided Y
      const totalHeight = (lines.length - 1) * lineHeight
      startY = y - totalHeight / 2
    } else if (pos.baseline === 'alphabetic') {
      // Position so the last line ends at the provided Y
      const totalHeight = (lines.length - 1) * lineHeight
      startY = y - totalHeight
    }
    // For 'top' baseline, startY = y is correct

    // Draw each line
    lines.forEach((line, index) => {
      const lineY = startY + index * lineHeight
      this.ctx.fillText(line, x, lineY)
    })
  }

  public render(
    keys: Key[],
    selectedKeys: Key[],
    metadata: KeyboardMetadata,
    clearCanvas: boolean = true,
    showRotationPoints: boolean = false,
    hoveredRotationPointId?: string,
    selectedRotationOrigin?: { x: number; y: number } | null,
  ) {
    // Clear canvas if requested
    if (clearCanvas) {
      this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height)

      // Fill with background color, applying border radius (default 6px like original KLE)
      this.ctx.fillStyle = this.options.background

      const radiiValue = metadata.radii?.trim() || '6px'
      const corners = parseBorderRadius(radiiValue, this.ctx.canvas.width, this.ctx.canvas.height)
      createRoundedRectanglePath(
        this.ctx,
        0,
        0,
        this.ctx.canvas.width,
        this.ctx.canvas.height,
        corners,
      )
      this.ctx.fill()
    }

    this.ctx.save()

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

    // Draw rotation points if requested
    if (showRotationPoints && selectedKeys.length > 0) {
      this.drawRotationPoints(selectedKeys, hoveredRotationPointId, selectedRotationOrigin)
    }

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

      // For non-rectangular keys, include secondary rectangle bounds
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

    // For non-rectangular keys, add the second rectangle corners
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

      // Check second part for non-rectangular keys
      if (params.nonRectangular && params.outercapx2 !== undefined) {
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
