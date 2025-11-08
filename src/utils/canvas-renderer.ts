import type { Key, KeyboardMetadata } from '@adamws/kle-serial'
import { D } from './decimal-math'
import { parseBorderRadius, createRoundedRectanglePath } from './border-radius'
import { svgCache } from './caches/SVGCache'
import { parseCache, type ParsedSegment } from './caches/ParseCache'
import { imageCache } from './caches/ImageCache'
import { labelParser } from './parsers/LabelParser'
import { keyRenderer } from './renderers/KeyRenderer'
import { labelRenderer } from './renderers/LabelRenderer'
import { rotationRenderer } from './renderers/RotationRenderer'
import { BoundsCalculator } from './utils/BoundsCalculator'
import { HitTester } from './utils/HitTester'

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

export class CanvasRenderer {
  private ctx: CanvasRenderingContext2D
  private options: RenderOptions
  private onImageLoadCallback?: () => void
  private onImageErrorCallback?: (url: string) => void
  private boundsCalculator: BoundsCalculator
  private hitTester: HitTester

  constructor(canvas: HTMLCanvasElement, options: RenderOptions) {
    this.ctx = canvas.getContext('2d')!
    this.options = options
    this.boundsCalculator = new BoundsCalculator(options.unit)
    this.hitTester = new HitTester(options.unit, (key, opts) =>
      keyRenderer.getRenderParams(key, opts),
    )
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
    this.boundsCalculator.setUnit(options.unit)
    this.hitTester.setUnit(options.unit)
    // Clear color cache when options change (Phase 2 optimization)
    keyRenderer.clearColorCache()
  }

  /**
   * Get SVG cache statistics (for performance monitoring)
   */
  public getSVGCacheStats() {
    return svgCache.getStats()
  }

  /**
   * Clear SVG cache (called on layout changes)
   */
  public clearSVGCache(): void {
    svgCache.clear()
  }

  /**
   * Get image cache statistics (for performance monitoring)
   */
  public getImageCacheStats() {
    return imageCache.getStats()
  }

  /**
   * Clear image cache (called on layout changes)
   */
  public clearImageCache(): void {
    imageCache.clear()
  }

  /**
   * Convert inline SVG string to a data URL that can be used as an image source
   * Uses SVGCache to avoid redundant encoding operations
   */
  private svgToDataUrl(svgContent: string): string {
    return svgCache.toDataUrl(svgContent)
  }

  /**
   * Load an image from a URL and cache it
   * Tested formats: PNG, SVG
   * Other formats may work but are not officially tested
   */
  private loadImage(url: string, onLoad?: () => void): void {
    imageCache.loadImage(url, onLoad, this.onImageErrorCallback)
  }

  /**
   * Get a loaded image from cache
   */
  private getImage(url: string): HTMLImageElement | null {
    return imageCache.getImage(url)
  }

  private getKeycapColor(params: KeyRenderParams): string {
    // Always return the light color - no gradients
    return params.lightColor
  }

  private alignToPixel(value: number): number {
    // Align to pixel boundary for crisp 1px strokes
    return Math.round(value) + 0.5
  }

  private drawRotationOriginIndicator(key: Key) {
    rotationRenderer.drawRotationOriginIndicator(this.ctx, key, this.options.unit)
  }

  private drawRotationPoints(
    selectedKeys: Key[],
    hoveredPointId?: string,
    selectedRotationOrigin?: { x: number; y: number } | null,
  ) {
    rotationRenderer.drawRotationPoints(
      this.ctx,
      selectedKeys,
      this.options.unit,
      hoveredPointId,
      selectedRotationOrigin,
    )
  }

  public getRotationPointAtPosition(
    canvasX: number,
    canvasY: number,
  ): { id: string; x: number; y: number; type: 'corner' | 'center' } | null {
    return rotationRenderer.getRotationPointAtPosition(canvasX, canvasY)
  }

  private drawKey(key: Key, isSelected = false) {
    // Use KeyRenderer for shape rendering
    keyRenderer.drawKey(this.ctx, key, {
      unit: this.options.unit,
      isSelected,
    })

    // Get params for label rendering
    const params = keyRenderer.getRenderParams(key, { unit: this.options.unit })
    const isRotaryEncoder = key.sm === 'rot_ec11'

    // Labels need same transformations
    this.ctx.save()
    if (key.rotation_angle) {
      this.ctx.translate(params.origin_x, params.origin_y)
      this.ctx.rotate(D.degreesToRadians(key.rotation_angle))
      this.ctx.translate(-params.origin_x, -params.origin_y)
    }
    if (key.ghost) {
      this.ctx.globalAlpha = 0.3
    }

    // Prepare label options and callbacks
    const labelOptions = {
      unit: this.options.unit,
      fontFamily: this.options.fontFamily,
    }

    const getImageFn = (url: string) => this.getImage(url)
    const loadImageFn = (url: string, onLoad?: () => void) => this.loadImage(url, onLoad)

    // Draw labels using LabelRenderer
    if (isRotaryEncoder) {
      labelRenderer.drawRotaryEncoderLabels(
        this.ctx,
        key,
        params,
        labelOptions,
        getImageFn,
        loadImageFn,
        this.onImageLoadCallback,
      )
    } else {
      labelRenderer.drawKeyLabels(
        this.ctx,
        key,
        params,
        labelOptions,
        getImageFn,
        loadImageFn,
        this.onImageLoadCallback,
      )
    }
    this.ctx.restore()
  }

  /**
   * Process label text to handle line breaks while preserving other content
   * Only <br> and <BR> tags are converted to line breaks; all other HTML is preserved
   */
  private processLabelText(label: string): string {
    return labelParser.processLabelText(label)
  }

  /**
   * Parse text with HTML formatting tags and extract text segments with their styles
   * Supports: <b>, <i>, <b><i> (nested), <img>, <svg>...</svg>
   *
   * Uses ParseCache to avoid redundant regex parsing for the same label content.
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
  private parseHtmlText(text: string): ParsedSegment[] {
    return labelParser.parseHtmlText(text)
  }

  /**
   * Get parse cache statistics (for performance monitoring)
   */
  public getParseCacheStats() {
    return parseCache.getStats()
  }

  /**
   * Clear parse cache (called on layout changes)
   */
  public clearParseCache(): void {
    parseCache.clear()
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
    return this.boundsCalculator.calculateBounds(keys)
  }

  public calculateRotatedKeyBounds(key: Key): {
    minX: number
    minY: number
    maxX: number
    maxY: number
  } {
    return this.boundsCalculator.calculateRotatedKeyBounds(key)
  }

  public getKeyAtPosition(x: number, y: number, keys: Key[]): Key | null {
    return this.hitTester.getKeyAtPosition(x, y, keys)
  }
}
