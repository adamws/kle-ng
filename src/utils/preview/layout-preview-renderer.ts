import type { Key, KeyboardMetadata } from '@adamws/kle-serial'
import { CanvasRenderer } from '../canvas-renderer'
import { BoundsCalculator } from '../utils/BoundsCalculator'
import { LinkTracker } from '../renderers/LinkTracker'
import { parseBorderRadius, createRoundedRectanglePath } from '../border-radius'
import { DEFAULT_UNIT, LAYOUT_PADDING } from '../layout-export'

/**
 * Headless layout preview rendering.
 *
 * The layout editor drives `CanvasRenderer` from `KeyboardCanvas.vue`, where
 * all sizing, DPI and pan/zoom math lives inline and is entangled with the
 * keyboard store. This module provides the same rendering through the same
 * renderer, but against a detached canvas scaled to fit an arbitrary box —
 * for thumbnails, import previews, and anything else that needs to draw a
 * layout without mounting the editor.
 *
 * Differences from the editor path:
 * - no zoom / pan / grid / mirror axis / rotation handles / selection
 * - the content bounding box is translated to the origin, so leading empty
 *   space is cropped and the layout fills the available box
 * - each renderer owns a private `LinkTracker`, so rendering a preview never
 *   clobbers the link hit boxes the editor canvas depends on
 */

export interface LayoutPreviewOptions {
  /** Maximum width of the produced canvas, in CSS pixels */
  maxWidth: number
  /** Maximum height of the produced canvas, in CSS pixels */
  maxHeight: number
  /** Device pixel ratio; defaults to `window.devicePixelRatio` */
  dpr?: number
  /** Font family for labels; defaults to the renderer's own default */
  fontFamily?: string
  /** Padding around the layout, in unscaled pixels. Defaults to LAYOUT_PADDING (9) */
  padding?: number
  /**
   * Called after a repaint triggered by an asynchronously loaded label image.
   * Labels using `<img>`/external SVG paint blank on the first pass and appear
   * on a later frame; consumers that cache a bitmap should refresh on this.
   */
  onUpdate?: () => void
}

export interface LayoutPreviewResult {
  /** The rendered canvas. Owned by the renderer — do not resize it. */
  canvas: HTMLCanvasElement
  /** Canvas width in CSS pixels */
  cssWidth: number
  /** Canvas height in CSS pixels */
  cssHeight: number
  /** Applied fit scale; < 1 when the layout was shrunk to fit the box */
  scale: number
  /** Layout width in keyboard units */
  unitsWide: number
  /** Layout height in keyboard units */
  unitsTall: number
}

const MIN_CANVAS_SIZE = 1

/**
 * Renders keyboard layouts to a detached canvas, scaled to fit a target box.
 *
 * Instances are reusable: the canvas and the underlying `CanvasRenderer` are
 * allocated once and reused across renders, so scanning down a list of layouts
 * does not allocate a canvas per hover.
 */
export class LayoutPreviewRenderer {
  private canvas: HTMLCanvasElement | null = null
  private renderer: CanvasRenderer | null = null
  private readonly linkTracker = new LinkTracker()
  private readonly boundsCalculator = new BoundsCalculator(DEFAULT_UNIT)
  /** Repaints the last rendered layout; used by the async image callback */
  private repaint: (() => void) | null = null

  public render(
    keys: Key[],
    metadata: KeyboardMetadata,
    options: LayoutPreviewOptions,
  ): LayoutPreviewResult {
    const dpr = options.dpr ?? (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1)
    const padding = options.padding ?? LAYOUT_PADDING
    const background = metadata?.backcolor || '#ffffff'
    const radii = metadata?.radii?.trim() || '6px'

    // Bounds are rotation-aware and returned in canvas pixels at DEFAULT_UNIT
    const bounds = this.boundsCalculator.calculateBounds(keys)
    const contentWidth = bounds.width + padding * 2
    const contentHeight = bounds.height + padding * 2

    // Never upscale: a 2-key macropad should stay small rather than being
    // blown up to fill the pane with a handful of enormous keys.
    const scale =
      contentWidth > 0 && contentHeight > 0
        ? Math.min(options.maxWidth / contentWidth, options.maxHeight / contentHeight, 1)
        : 1

    const cssWidth = Math.max(MIN_CANVAS_SIZE, Math.round(contentWidth * scale))
    const cssHeight = Math.max(MIN_CANVAS_SIZE, Math.round(contentHeight * scale))

    const canvas = this.ensureCanvas()
    canvas.width = Math.max(MIN_CANVAS_SIZE, Math.round(cssWidth * dpr))
    canvas.height = Math.max(MIN_CANVAS_SIZE, Math.round(cssHeight * dpr))
    canvas.style.width = `${cssWidth}px`
    canvas.style.height = `${cssHeight}px`

    const renderer = this.ensureRenderer(canvas)
    renderer.updateOptions({
      unit: DEFAULT_UNIT,
      background,
      fontFamily: options.fontFamily,
    })

    const paint = () => {
      const ctx = renderer.getContext()

      // Background pass runs in CSS-pixel space at identity + dpr scale.
      // CanvasRenderer's own `clearCanvas` branch fills using the backing
      // store size in device pixels, which is only correct at identity, so
      // the background is painted here and `clearCanvas: false` is passed.
      ctx.save()
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.scale(dpr, dpr)
      ctx.fillStyle = background
      const corners = parseBorderRadius(radii, cssWidth, cssHeight)
      createRoundedRectanglePath(ctx, 0, 0, cssWidth, cssHeight, corners)
      ctx.fill()
      ctx.restore()

      // Translate the content bounding box to (padding, padding), then scale
      // to fit. Mirrors getCoordinateSystemOffset() in KeyboardCanvas.vue,
      // except the full bounds offset is applied rather than only clamping
      // negative coordinates, so empty leading space is cropped.
      ctx.save()
      ctx.setTransform(
        scale * dpr,
        0,
        0,
        scale * dpr,
        (padding - bounds.x) * scale * dpr,
        (padding - bounds.y) * scale * dpr,
      )
      renderer.render(keys, [], metadata, false, false)
      ctx.restore()
    }

    this.repaint = paint
    paint()

    // Labels containing images resolve later; repaint when they land.
    renderer.setImageLoadCallback(() => {
      if (this.repaint !== paint) return // a newer layout is on screen
      paint()
      options.onUpdate?.()
    })

    return {
      canvas,
      cssWidth,
      cssHeight,
      scale,
      unitsWide: bounds.width / DEFAULT_UNIT,
      unitsTall: bounds.height / DEFAULT_UNIT,
    }
  }

  /**
   * Detach the canvas and stop responding to image-load callbacks.
   * Call from `onBeforeUnmount` in components that own a renderer.
   */
  public dispose(): void {
    this.repaint = null
    this.renderer?.setImageLoadCallback(() => {})
    this.canvas?.remove()
    this.canvas = null
    this.renderer = null
  }

  private ensureCanvas(): HTMLCanvasElement {
    if (!this.canvas) {
      this.canvas = document.createElement('canvas')
    }
    return this.canvas
  }

  private ensureRenderer(canvas: HTMLCanvasElement): CanvasRenderer {
    if (!this.renderer) {
      this.renderer = new CanvasRenderer(
        canvas,
        { unit: DEFAULT_UNIT, background: '#ffffff' },
        { linkTracker: this.linkTracker },
      )
    }
    return this.renderer
  }
}

/**
 * One-shot convenience wrapper. Prefer a long-lived `LayoutPreviewRenderer`
 * when rendering repeatedly (e.g. while hovering down a list).
 */
export function renderLayoutPreview(
  keys: Key[],
  metadata: KeyboardMetadata,
  options: LayoutPreviewOptions,
): LayoutPreviewResult {
  return new LayoutPreviewRenderer().render(keys, metadata, options)
}
