import type { Key } from '@adamws/kle-serial'
import type { KeyRenderParams } from '../canvas-renderer'
import type { LabelNode, TextStyle } from '../parsers/LabelAST'
import { labelParser } from '../parsers/LabelParser'
import { svgCache } from '../caches/SVGCache'
import { linkTracker } from './LinkTracker'

/**
 * Rotation context for link hit testing
 */
interface RotationContext {
  angle: number
  originX: number
  originY: number
}

// Link styling constants
const LINK_COLOR = '#0066cc'
const LINK_UNDERLINE_OFFSET = -1

/**
 * Options for label rendering
 */
export interface LabelRenderOptions {
  /** Unit size in pixels */
  unit: number
  /** Font family to use for rendering text labels */
  fontFamily?: string
}

/**
 * Label position configuration for alignment
 */
export interface LabelPosition {
  /** Horizontal alignment (left, center, right) */
  align: string
  /** Vertical baseline (hanging, middle, alphabetic) */
  baseline: string
}

/**
 * Label positioning grid matching original KLE (12 positions)
 * Defines how labels are aligned and positioned in the 3x3 grid on key top
 * plus the 3 front legend positions.
 */
export const labelPositions: LabelPosition[] = [
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

/**
 * LabelRenderer handles the rendering of keyboard key labels.
 * Extracted from CanvasRenderer to improve modularity and maintainability.
 *
 * This class handles all aspects of label rendering including:
 * - Text rendering with wrapping and overflow
 * - HTML formatted text with bold, italic, and mixed styles
 * - Image and SVG labels
 * - Multi-line text with proper baseline alignment
 * - Font size calculation based on key properties
 *
 * This class follows a functional approach where the canvas context is passed
 * as a parameter rather than stored, making it easier to test and reason about.
 *
 * @example
 * ```typescript
 * const renderer = new LabelRenderer()
 * const getImage = (url: string) => imageCache.getImage(url)
 * const loadImage = (url: string, onLoad?: () => void) => imageCache.loadImage(url, onLoad)
 *
 * renderer.drawKeyLabels(
 *   ctx,
 *   key,
 *   params,
 *   { unit: 54, fontFamily: 'Arial' },
 *   getImage,
 *   loadImage,
 *   onLoadCallback
 * )
 * ```
 */
export class LabelRenderer {
  /**
   * Draw all labels for a standard keyboard key.
   * Handles positioning of up to 12 labels in a 3x3 grid pattern plus front legends.
   *
   * @param ctx - Canvas rendering context
   * @param key - Key object containing label data
   * @param params - Calculated render parameters for the key
   * @param options - Rendering options (unit size, font family)
   * @param getImageFn - Function to get cached image
   * @param loadImageFn - Function to load image if not cached
   * @param onLoadCallback - Optional callback when image loads
   * @param hoveredLinkHref - Optional href of currently hovered link (for underline)
   */
  public drawKeyLabels(
    ctx: CanvasRenderingContext2D,
    key: Key,
    params: KeyRenderParams,
    options: LabelRenderOptions,
    getImageFn: (url: string) => HTMLImageElement | null,
    loadImageFn: (url: string, onLoad?: () => void) => void,
    onLoadCallback?: () => void,
    hoveredLinkHref?: string | null,
  ): void {
    key.labels.forEach((label, index) => {
      if (!label || index >= labelPositions.length) return

      const pos = labelPositions[index]
      if (!pos) return // Skip if position is undefined
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
      const fontFamily = options.fontFamily || '"Helvetica Neue", Helvetica, Arial, sans-serif'
      ctx.font = `${fontSize}px ${fontFamily}`

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

      ctx.fillStyle = textColor
      ctx.textAlign = pos.align as CanvasTextAlign
      ctx.textBaseline = pos.baseline as CanvasTextBaseline

      // Calculate available space for this label
      const availableWidth = params.textcapwidth
      const availableHeight = params.textcapheight - 2

      // Check if label is image-only or SVG-only
      const isImageOnly = /^<img\s+[^>]+>\s*$/.test(label)
      const isSvgOnly = /^<svg[^>]*>[\s\S]*?<\/svg>\s*$/.test(label)

      if (isImageOnly || isSvgOnly) {
        // Image-only label: position based on alignment
        this.drawImageLabel(ctx, label, params, pos, index, getImageFn, loadImageFn, onLoadCallback)
      } else {
        // Text or mixed content: parse once and render with pre-parsed nodes
        const nodes = labelParser.parse(label)
        const plainText = labelParser.getPlainText(nodes)

        // Build rotation context for link tracking (if key is rotated)
        const rotationContext = key.rotation_angle
          ? {
              angle: key.rotation_angle,
              originX: params.origin_x,
              originY: params.origin_y,
            }
          : undefined

        this.drawWrappedNodes(
          ctx,
          nodes,
          plainText,
          x,
          y,
          availableWidth,
          availableHeight,
          pos,
          fontFamily,
          getImageFn,
          loadImageFn,
          onLoadCallback,
          rotationContext,
          hoveredLinkHref,
        )
      }
    })
  }

  /**
   * Draw labels for a rotary encoder key.
   * Similar to drawKeyLabels but adapted for circular positioning and no front legends.
   *
   * @param ctx - Canvas rendering context
   * @param key - Key object containing label data
   * @param params - Calculated render parameters for the key
   * @param options - Rendering options (unit size, font family)
   * @param getImageFn - Function to get cached image
   * @param loadImageFn - Function to load image if not cached
   * @param onLoadCallback - Optional callback when image loads
   * @param hoveredLinkHref - Optional href of currently hovered link (for underline)
   */
  public drawRotaryEncoderLabels(
    ctx: CanvasRenderingContext2D,
    key: Key,
    params: KeyRenderParams,
    options: LabelRenderOptions,
    getImageFn: (url: string) => HTMLImageElement | null,
    loadImageFn: (url: string, onLoad?: () => void) => void,
    onLoadCallback?: () => void,
    hoveredLinkHref?: string | null,
  ): void {
    key.labels.forEach((label, index) => {
      if (!label || index >= labelPositions.length) return

      const pos = labelPositions[index]
      if (!pos) return // Skip if position is undefined
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
      const fontFamily = options.fontFamily || '"Helvetica Neue", Helvetica, Arial, sans-serif'
      ctx.font = `${fontSize}px ${fontFamily}`

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

      ctx.fillStyle = textColor
      ctx.textAlign = pos.align as CanvasTextAlign
      ctx.textBaseline = pos.baseline as CanvasTextBaseline

      // Calculate available space for this label
      const availableWidth = params.innercapwidth
      const availableHeight = availableWidth

      // Check if label is image-only or SVG-only
      const isImageOnly = /^<img\s+[^>]+>\s*$/.test(label)
      const isSvgOnly = /^<svg[^>]*>[\s\S]*?<\/svg>\s*$/.test(label)

      if (isImageOnly || isSvgOnly) {
        // Image-only label: position based on alignment
        this.drawImageLabel(ctx, label, params, pos, index, getImageFn, loadImageFn, onLoadCallback)
      } else {
        // Text or mixed content: parse once and render with pre-parsed nodes
        const nodes = labelParser.parse(label)
        const plainText = labelParser.getPlainText(nodes)

        // Build rotation context for link tracking (if key is rotated)
        const rotationContext = key.rotation_angle
          ? {
              angle: key.rotation_angle,
              originX: params.origin_x,
              originY: params.origin_y,
            }
          : undefined

        this.drawWrappedNodes(
          ctx,
          nodes,
          plainText,
          x,
          y,
          availableWidth,
          availableHeight,
          pos,
          fontFamily,
          getImageFn,
          loadImageFn,
          onLoadCallback,
          rotationContext,
          hoveredLinkHref,
        )
      }
    })
  }

  /**
   * Calculate font size for a label based on key text size properties.
   * Uses linear formula: 6 + (2 * textSize)
   * Front labels (indices 9-11) use smaller font size (80% of calculated, max 10px).
   *
   * @param key - Key object with textSize properties
   * @param index - Label index (0-11)
   * @returns Calculated font size in pixels
   */
  public calculateFontSize(key: Key, index: number): number {
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

  /**
   * Draw an image label (external URL or inline SVG).
   * Handles both <img> tags with src attributes and inline <svg> elements.
   *
   * @param ctx - Canvas rendering context
   * @param label - Label text containing image markup
   * @param params - Calculated render parameters
   * @param pos - Label position (alignment and baseline)
   * @param index - Label index for positioning
   * @param getImageFn - Function to get cached image
   * @param loadImageFn - Function to load image if not cached
   * @param onLoadCallback - Optional callback when image loads
   */
  public drawImageLabel(
    ctx: CanvasRenderingContext2D,
    label: string,
    params: KeyRenderParams,
    pos: LabelPosition,
    index: number,
    getImageFn: (url: string) => HTMLImageElement | null,
    loadImageFn: (url: string, onLoad?: () => void) => void,
    onLoadCallback?: () => void,
  ): void {
    // Parse the image or SVG tag
    const nodes = labelParser.parse(label)
    const imageNode = nodes.find((n) => n.type === 'image' || n.type === 'svg')

    if (!imageNode) {
      return
    }

    let img: HTMLImageElement | null = null
    let width: number
    let height: number

    if (imageNode.type === 'svg') {
      // Inline SVG: convert to data URL and load
      const dataUrl = svgCache.toDataUrl(imageNode.content)
      img = getImageFn(dataUrl)
      if (!img) {
        // Image not loaded yet, trigger loading
        loadImageFn(dataUrl, onLoadCallback)
        return
      }
      // Use dimensions from SVG attributes or natural dimensions
      width = imageNode.width || img.naturalWidth || 32
      height = imageNode.height || img.naturalHeight || 32
    } else if (imageNode.type === 'image') {
      // External image
      img = getImageFn(imageNode.src)
      if (!img) {
        // Image not loaded yet, trigger loading
        loadImageFn(imageNode.src, onLoadCallback)
        return
      }
      width = imageNode.width || img.naturalWidth
      height = imageNode.height || img.naturalHeight
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
    ctx.drawImage(img, imgX, imgY, width, height)
  }

  /**
   * Check if parsed nodes contain any HTML formatting (links, images, SVG, or styled text).
   * Use this instead of hasHtmlFormatting() when you have pre-parsed nodes.
   *
   * @param nodes - Parsed label nodes
   * @returns True if nodes contain HTML formatting
   */
  public nodesHaveFormatting(nodes: LabelNode[]): boolean {
    for (const node of nodes) {
      // Links, images, and SVGs are always considered "formatted"
      if (node.type === 'link' || node.type === 'image' || node.type === 'svg') {
        return true
      }
      // Text nodes with bold or italic styling are "formatted"
      if (node.type === 'text' && (node.style.bold || node.style.italic)) {
        return true
      }
    }
    return false
  }

  /**
   * Measure the width of HTML formatted text.
   *
   * @param ctx - Canvas rendering context
   * @param text - HTML formatted text to measure
   * @param fontFamily - Font family to use
   * @param getImageFn - Function to get cached image for measuring
   * @returns Width in pixels
   */
  public measureHtmlText(
    ctx: CanvasRenderingContext2D,
    text: string,
    fontFamily: string,
    getImageFn: (url: string) => HTMLImageElement | null,
  ): number {
    return labelParser.measureHtmlText(
      text,
      ctx,
      (bold, italic) => this.buildFontStyle(ctx, bold, italic, fontFamily),
      (url) => getImageFn(url),
    )
  }

  /**
   * Build a CSS font style string from context and formatting flags.
   *
   * @param ctx - Canvas rendering context (to extract current font size)
   * @param bold - Whether to apply bold weight
   * @param italic - Whether to apply italic style
   * @param fontFamily - Font family to use
   * @returns CSS font string (e.g., "bold italic 12px Arial")
   */
  public buildFontStyle(
    ctx: CanvasRenderingContext2D,
    bold: boolean,
    italic: boolean,
    fontFamily: string,
  ): string {
    const baseFontSize = parseInt(ctx.font.match(/\d+/)?.[0] || '12')

    const stylePrefix = `${italic ? 'italic ' : ''}${bold ? 'bold ' : ''}`
    return `${stylePrefix}${baseFontSize}px ${fontFamily}`
  }

  /**
   * Render AST nodes at a specific position.
   *
   * @param ctx - Canvas rendering context
   * @param nodes - AST nodes to render
   * @param x - X coordinate
   * @param y - Y coordinate
   * @param fontFamily - Font family to use
   * @param getImageFn - Function to get cached image
   * @param loadImageFn - Function to load image if not cached
   * @param onLoadCallback - Optional callback when image loads
   * @param rotationContext - Optional rotation context for link tracking
   * @param hoveredLinkHref - Optional href of currently hovered link (for underline)
   * @returns Width of rendered content
   */
  public renderNodes(
    ctx: CanvasRenderingContext2D,
    nodes: LabelNode[],
    x: number,
    y: number,
    fontFamily: string,
    getImageFn: (url: string) => HTMLImageElement | null,
    loadImageFn: (url: string, onLoad?: () => void) => void,
    onLoadCallback?: () => void,
    rotationContext?: { angle: number; originX: number; originY: number },
    hoveredLinkHref?: string | null,
  ): number {
    let currentX = x

    for (const node of nodes) {
      currentX += this.renderInlineNode(
        ctx,
        node,
        currentX,
        y,
        fontFamily,
        getImageFn,
        loadImageFn,
        onLoadCallback,
        rotationContext,
        hoveredLinkHref,
      )
    }

    return currentX - x
  }

  /**
   * Render an inline node (text, link, image, or SVG).
   *
   * @param ctx - Canvas rendering context
   * @param node - Node to render
   * @param x - X coordinate
   * @param y - Y coordinate
   * @param fontFamily - Font family to use
   * @param getImageFn - Function to get cached image
   * @param loadImageFn - Function to load image if not cached
   * @param onLoadCallback - Optional callback when image loads
   * @param rotationContext - Optional rotation context for link tracking
   * @param hoveredLinkHref - Optional href of currently hovered link (for underline)
   * @returns Width of rendered content
   */
  private renderInlineNode(
    ctx: CanvasRenderingContext2D,
    node: LabelNode,
    x: number,
    y: number,
    fontFamily: string,
    getImageFn: (url: string) => HTMLImageElement | null,
    loadImageFn: (url: string, onLoad?: () => void) => void,
    onLoadCallback?: () => void,
    rotationContext?: { angle: number; originX: number; originY: number },
    hoveredLinkHref?: string | null,
  ): number {
    const originalFont = ctx.font
    const originalFillStyle = ctx.fillStyle
    const originalTextBaseline = ctx.textBaseline
    const fontSize = parseInt(ctx.font.match(/\d+/)?.[0] || '12')

    if (node.type === 'text') {
      const fontStyle = this.buildFontStyle(
        ctx,
        node.style.bold ?? false,
        node.style.italic ?? false,
        fontFamily,
      )
      ctx.font = fontStyle
      ctx.fillText(node.text, x, y)
      const width = ctx.measureText(node.text).width
      ctx.font = originalFont
      return width
    }

    if (node.type === 'link') {
      const linkWidth = this.renderLinkNode(
        ctx,
        node,
        x,
        y,
        fontFamily,
        fontSize,
        originalTextBaseline,
        rotationContext,
        hoveredLinkHref,
      )
      ctx.font = originalFont
      ctx.fillStyle = originalFillStyle
      return linkWidth
    }

    if (node.type === 'image') {
      const img = getImageFn(node.src)
      if (!img) {
        loadImageFn(node.src, onLoadCallback)
        const width = node.width || 16
        const height = node.height || 16
        ctx.save()
        ctx.strokeStyle = '#ccc'
        ctx.strokeRect(x, y, width, height)
        ctx.restore()
        return width
      }
      const width = node.width || img.naturalWidth
      const height = node.height || img.naturalHeight
      ctx.drawImage(img, x, y, width, height)
      return width
    }

    if (node.type === 'svg') {
      const dataUrl = svgCache.toDataUrl(node.content)
      const img = getImageFn(dataUrl)
      if (!img) {
        loadImageFn(dataUrl, onLoadCallback)
        return node.width || 16
      }
      const width = node.width || img.naturalWidth || 32
      const height = node.height || img.naturalHeight || 32
      ctx.drawImage(img, x, y, width, height)
      return width
    }

    return 0
  }

  /**
   * Render a link node with styling, underline on hover, and hit testing registration.
   *
   * @param ctx - Canvas rendering context
   * @param node - Link node to render
   * @param x - X coordinate
   * @param y - Y coordinate
   * @param fontFamily - Font family to use
   * @param fontSize - Font size in pixels
   * @param textBaseline - Current text baseline for bounding box calculation
   * @param rotationContext - Optional rotation context for link tracking
   * @param hoveredLinkHref - Optional href of currently hovered link (for underline)
   * @returns Width of rendered link
   */
  private renderLinkNode(
    ctx: CanvasRenderingContext2D,
    node: { type: 'link'; href: string; text: string; style: TextStyle },
    x: number,
    y: number,
    fontFamily: string,
    fontSize: number,
    textBaseline: CanvasTextBaseline,
    rotationContext?: RotationContext,
    hoveredLinkHref?: string | null,
  ): number {
    const originalFillStyle = ctx.fillStyle

    // Build and apply font style
    const fontStyle = this.buildFontStyle(
      ctx,
      node.style.bold ?? false,
      node.style.italic ?? false,
      fontFamily,
    )
    ctx.font = fontStyle

    const linkWidth = ctx.measureText(node.text).width

    // Calculate bounding box Y based on baseline
    let boundingY = y
    if (textBaseline === 'middle') {
      boundingY = y - fontSize / 2
    } else if (textBaseline === 'alphabetic') {
      boundingY = y - fontSize
    }

    // Apply link color and draw text
    ctx.fillStyle = LINK_COLOR
    ctx.fillText(node.text, x, y)

    // Draw underline only when this link is hovered
    if (hoveredLinkHref === node.href) {
      const metrics = ctx.measureText(node.text)
      const underlineY = y + metrics.actualBoundingBoxDescent + LINK_UNDERLINE_OFFSET

      ctx.beginPath()
      ctx.strokeStyle = LINK_COLOR
      ctx.lineWidth = 1
      ctx.moveTo(x, underlineY)
      ctx.lineTo(x + linkWidth, underlineY)
      ctx.stroke()
    }

    // Register link bounding box for hit testing
    linkTracker.registerLink(
      node.href,
      node.text,
      x,
      boundingY,
      linkWidth,
      fontSize,
      rotationContext?.angle || 0,
      rotationContext?.originX || 0,
      rotationContext?.originY || 0,
    )

    // Restore fill style
    ctx.fillStyle = originalFillStyle

    return linkWidth
  }

  /**
   * Draw pre-parsed label nodes at a specific position.
   * Handles mixed bold, italic, and plain text segments with images and links.
   *
   * @param ctx - Canvas rendering context
   * @param nodes - Pre-parsed label nodes to draw
   * @param x - X coordinate
   * @param y - Y coordinate
   * @param fontFamily - Font family to use
   * @param getImageFn - Function to get cached image
   * @param loadImageFn - Function to load image if not cached
   * @param onLoadCallback - Optional callback when image loads
   * @param rotationContext - Optional rotation context for link tracking
   * @param hoveredLinkHref - Optional href of currently hovered link (for underline)
   * @returns The final Y position after rendering (useful for content after block elements)
   */
  public drawParsedNodes(
    ctx: CanvasRenderingContext2D,
    nodes: LabelNode[],
    x: number,
    y: number,
    fontFamily: string,
    getImageFn: (url: string) => HTMLImageElement | null,
    loadImageFn: (url: string, onLoad?: () => void) => void,
    onLoadCallback?: () => void,
    rotationContext?: RotationContext,
    hoveredLinkHref?: string | null,
  ): number {
    // Save context state
    const originalFont = ctx.font
    const originalTextAlign = ctx.textAlign
    const originalTextBaseline = ctx.textBaseline
    const originalFillStyle = ctx.fillStyle

    // Get font size for calculations
    const fontSize = parseInt(ctx.font.match(/\d+/)?.[0] || '12')

    // Temporarily set text align to left for node-by-node rendering
    ctx.textAlign = 'left'

    // Track current position
    let currentX = x
    const currentY = y

    // For center/right alignment of inline content, we need to adjust starting X
    if (originalTextAlign === 'center' || originalTextAlign === 'right') {
      // Calculate width of all inline content
      let totalWidth = 0
      for (const node of nodes) {
        totalWidth += this.measureNodeWidth(ctx, node, fontFamily, getImageFn)
      }
      if (originalTextAlign === 'center') {
        currentX = x - totalWidth / 2
      } else {
        currentX = x - totalWidth
      }
    }

    // Draw each node
    for (const node of nodes) {
      if (node.type === 'text') {
        const fontStyle = this.buildFontStyle(
          ctx,
          node.style.bold ?? false,
          node.style.italic ?? false,
          fontFamily,
        )
        ctx.font = fontStyle
        ctx.fillText(node.text, currentX, currentY)
        currentX += ctx.measureText(node.text).width
      } else if (node.type === 'link') {
        currentX += this.renderLinkNode(
          ctx,
          node,
          currentX,
          currentY,
          fontFamily,
          fontSize,
          originalTextBaseline,
          rotationContext,
          hoveredLinkHref,
        )
      } else if (node.type === 'image') {
        const img = getImageFn(node.src)
        if (!img) {
          loadImageFn(node.src, onLoadCallback)

          const width = node.width || 16
          const height = node.height || 16

          let imgY = currentY
          if (originalTextBaseline === 'middle') {
            imgY = currentY - height / 2
          } else if (originalTextBaseline === 'alphabetic') {
            imgY = currentY - height
          }

          ctx.save()
          ctx.strokeStyle = '#ccc'
          ctx.strokeRect(currentX, imgY, width, height)
          ctx.restore()

          currentX += width
        } else {
          const width = node.width || img.naturalWidth
          const height = node.height || img.naturalHeight

          let imgY = currentY
          if (originalTextBaseline === 'middle') {
            imgY = currentY - height / 2
          } else if (originalTextBaseline === 'alphabetic') {
            imgY = currentY - height
          }

          ctx.drawImage(img, currentX, imgY, width, height)
          currentX += width
        }
      } else if (node.type === 'svg') {
        const dataUrl = svgCache.toDataUrl(node.content)
        const img = getImageFn(dataUrl)
        if (!img) {
          loadImageFn(dataUrl, onLoadCallback)
          currentX += node.width || 16
        } else {
          const width = node.width || img.naturalWidth || 32
          const height = node.height || img.naturalHeight || 32

          let imgY = currentY
          if (originalTextBaseline === 'middle') {
            imgY = currentY - height / 2
          } else if (originalTextBaseline === 'alphabetic') {
            imgY = currentY - height
          }

          ctx.drawImage(img, currentX, imgY, width, height)
          currentX += width
        }
      }
    }

    // Restore original context state
    ctx.font = originalFont
    ctx.textAlign = originalTextAlign
    ctx.textBaseline = originalTextBaseline
    ctx.fillStyle = originalFillStyle

    return currentY
  }

  /**
   * Draw HTML formatted text at a specific position.
   * Convenience wrapper that parses the text and delegates to drawParsedNodes.
   * For better performance with repeated renders, use drawParsedNodes() directly with pre-parsed nodes.
   *
   * @param ctx - Canvas rendering context
   * @param text - HTML formatted text to draw
   * @param x - X coordinate
   * @param y - Y coordinate
   * @param fontFamily - Font family to use
   * @param getImageFn - Function to get cached image
   * @param loadImageFn - Function to load image if not cached
   * @param onLoadCallback - Optional callback when image loads
   * @param rotationContext - Optional rotation context for link tracking
   * @param hoveredLinkHref - Optional href of currently hovered link (for underline)
   * @returns The final Y position after rendering (useful for content after block elements)
   */
  public drawHtmlText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    fontFamily: string,
    getImageFn: (url: string) => HTMLImageElement | null,
    loadImageFn: (url: string, onLoad?: () => void) => void,
    onLoadCallback?: () => void,
    rotationContext?: RotationContext,
    hoveredLinkHref?: string | null,
  ): number {
    const nodes = labelParser.parse(text)
    return this.drawParsedNodes(
      ctx,
      nodes,
      x,
      y,
      fontFamily,
      getImageFn,
      loadImageFn,
      onLoadCallback,
      rotationContext,
      hoveredLinkHref,
    )
  }

  /**
   * Measure the width of a single node.
   *
   * @param ctx - Canvas rendering context
   * @param node - Node to measure
   * @param fontFamily - Font family to use
   * @param getImageFn - Function to get cached image
   * @returns Width of the node in pixels
   */
  private measureNodeWidth(
    ctx: CanvasRenderingContext2D,
    node: LabelNode,
    fontFamily: string,
    getImageFn: (url: string) => HTMLImageElement | null,
  ): number {
    const originalFont = ctx.font

    if (node.type === 'text') {
      const fontStyle = this.buildFontStyle(
        ctx,
        node.style.bold ?? false,
        node.style.italic ?? false,
        fontFamily,
      )
      ctx.font = fontStyle
      const width = ctx.measureText(node.text).width
      ctx.font = originalFont
      return width
    }

    if (node.type === 'link') {
      const fontStyle = this.buildFontStyle(
        ctx,
        node.style.bold ?? false,
        node.style.italic ?? false,
        fontFamily,
      )
      ctx.font = fontStyle
      const width = ctx.measureText(node.text).width
      ctx.font = originalFont
      return width
    }

    if (node.type === 'image') {
      const img = getImageFn(node.src)
      return node.width || (img ? img.naturalWidth : 16)
    }

    if (node.type === 'svg') {
      return node.width || 16
    }

    return 0
  }

  /**
   * Measure the total width of pre-parsed nodes.
   *
   * @param ctx - Canvas rendering context
   * @param nodes - Pre-parsed label nodes
   * @param fontFamily - Font family to use
   * @param getImageFn - Function to get cached image
   * @returns Total width of all nodes in pixels
   */
  public measureNodesWidth(
    ctx: CanvasRenderingContext2D,
    nodes: LabelNode[],
    fontFamily: string,
    getImageFn: (url: string) => HTMLImageElement | null,
  ): number {
    let totalWidth = 0
    for (const node of nodes) {
      totalWidth += this.measureNodeWidth(ctx, node, fontFamily, getImageFn)
    }
    return totalWidth
  }

  /**
   * Wrap HTML formatted text to fit within a maximum width.
   * Returns array of wrapped lines with their HTML formatting preserved.
   *
   * @param ctx - Canvas rendering context
   * @param text - HTML formatted text to wrap
   * @param maxWidth - Maximum width in pixels
   * @param fontFamily - Font family to use
   * @returns Array of wrapped text lines
   */
  public wrapHtmlText(
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number,
    fontFamily: string,
  ): string[] {
    const nodes = labelParser.parse(text)
    const lines: string[] = []
    let currentLine: { text: string; bold: boolean; italic: boolean }[] = []
    let currentLineWidth = 0

    // Save current font
    const originalFont = ctx.font

    for (const node of nodes) {
      // Skip non-text nodes for wrapping
      if (node.type !== 'text' && node.type !== 'link') {
        continue
      }

      const nodeText = node.type === 'text' ? node.text : node.text
      const style = node.style

      // Split text by words
      const words = nodeText.split(' ')

      for (let i = 0; i < words.length; i++) {
        const word = words[i]
        if (!word) continue

        // Apply font style to measure this word
        const fontStyle = this.buildFontStyle(
          ctx,
          style.bold ?? false,
          style.italic ?? false,
          fontFamily,
        )
        ctx.font = fontStyle

        // Measure word with space (unless it's the first word on the line)
        const wordText = currentLine.length === 0 ? word : ' ' + word
        const wordWidth = ctx.measureText(wordText).width

        if (currentLineWidth + wordWidth <= maxWidth) {
          // Word fits on current line
          currentLine.push({
            text: wordText,
            bold: style.bold ?? false,
            italic: style.italic ?? false,
          })
          currentLineWidth += wordWidth
        } else {
          // Word doesn't fit, start new line
          if (currentLine.length > 0) {
            // Save current line
            lines.push(this.reconstructHtmlLine(currentLine))
            // Start new line with this word
            currentLine = [
              {
                text: word,
                bold: style.bold ?? false,
                italic: style.italic ?? false,
              },
            ]
            currentLineWidth = ctx.measureText(word).width
          } else {
            // Even a single word doesn't fit, add it anyway
            currentLine.push({
              text: word,
              bold: style.bold ?? false,
              italic: style.italic ?? false,
            })
            lines.push(this.reconstructHtmlLine(currentLine))
            currentLine = []
            currentLineWidth = 0
          }
        }
      }
    }

    // Add any remaining line
    if (currentLine.length > 0) {
      lines.push(this.reconstructHtmlLine(currentLine))
    }

    // Restore original font
    ctx.font = originalFont

    return lines
  }

  /**
   * Draw multi-line HTML formatted text.
   *
   * @param ctx - Canvas rendering context
   * @param lines - Array of HTML formatted lines
   * @param x - X coordinate
   * @param y - Starting Y coordinate
   * @param lineHeight - Height of each line
   * @param pos - Position configuration for alignment
   * @param fontFamily - Font family to use
   * @param getImageFn - Function to get cached image
   * @param loadImageFn - Function to load image if not cached
   * @param onLoadCallback - Optional callback when image loads
   * @param rotationContext - Optional rotation context for link tracking
   * @param hoveredLinkHref - Optional href of currently hovered link (for underline)
   */
  public drawMultiLineHtmlText(
    ctx: CanvasRenderingContext2D,
    lines: string[],
    x: number,
    y: number,
    lineHeight: number,
    pos: LabelPosition,
    fontFamily: string,
    getImageFn: (url: string) => HTMLImageElement | null,
    loadImageFn: (url: string, onLoad?: () => void) => void,
    onLoadCallback?: () => void,
    rotationContext?: { angle: number; originX: number; originY: number },
    hoveredLinkHref?: string | null,
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
      this.drawHtmlText(
        ctx,
        line,
        x,
        lineY,
        fontFamily,
        getImageFn,
        loadImageFn,
        onLoadCallback,
        rotationContext,
        hoveredLinkHref,
      )
    })
  }

  /**
   * Draw multiple lines of pre-parsed nodes.
   * This is the preferred method for multi-line content with HTML formatting.
   *
   * @param ctx - Canvas rendering context
   * @param nodeLines - Array of lines, each line is an array of nodes
   * @param x - X coordinate
   * @param y - Starting Y coordinate
   * @param lineHeight - Height of each line
   * @param pos - Position configuration for alignment
   * @param fontFamily - Font family to use
   * @param getImageFn - Function to get cached image
   * @param loadImageFn - Function to load image if not cached
   * @param onLoadCallback - Optional callback when image loads
   * @param rotationContext - Optional rotation context for link tracking
   * @param hoveredLinkHref - Optional href of currently hovered link (for underline)
   */
  public drawMultiLineNodes(
    ctx: CanvasRenderingContext2D,
    nodeLines: LabelNode[][],
    x: number,
    y: number,
    lineHeight: number,
    pos: LabelPosition,
    fontFamily: string,
    getImageFn: (url: string) => HTMLImageElement | null,
    loadImageFn: (url: string, onLoad?: () => void) => void,
    onLoadCallback?: () => void,
    rotationContext?: { angle: number; originX: number; originY: number },
    hoveredLinkHref?: string | null,
  ): void {
    let startY = y

    // Adjust starting Y based on baseline
    if (pos.baseline === 'middle') {
      // Center the block of text vertically around the provided Y
      const totalHeight = (nodeLines.length - 1) * lineHeight
      startY = y - totalHeight / 2
    } else if (pos.baseline === 'alphabetic') {
      // Position so the last line ends at the provided Y
      const totalHeight = (nodeLines.length - 1) * lineHeight
      startY = y - totalHeight
    }

    // Draw each line with pre-parsed nodes
    nodeLines.forEach((lineNodes, index) => {
      const lineY = startY + index * lineHeight
      this.drawParsedNodes(
        ctx,
        lineNodes,
        x,
        lineY,
        fontFamily,
        getImageFn,
        loadImageFn,
        onLoadCallback,
        rotationContext,
        hoveredLinkHref,
      )
    })
  }

  /**
   * Split AST nodes into lines at newline characters.
   * Preserves node types and styles (including links) for each line.
   *
   * @param nodes - Pre-parsed label nodes
   * @returns Array of lines, each line is an array of nodes
   */
  private splitNodesByNewline(nodes: LabelNode[]): LabelNode[][] {
    const lines: LabelNode[][] = []
    let currentLine: LabelNode[] = []

    for (const node of nodes) {
      if (node.type === 'text') {
        // Text nodes may contain newlines
        const parts = node.text.split('\n')
        for (let i = 0; i < parts.length; i++) {
          const part = parts[i]
          if (i > 0) {
            // Start a new line
            lines.push(currentLine)
            currentLine = []
          }
          // Add non-empty text parts
          if (part) {
            currentLine.push({ type: 'text', text: part, style: { ...node.style } })
          }
        }
      } else {
        // Links, images, SVGs don't split - add to current line
        currentLine.push(node)
      }
    }

    // Don't forget the last line
    lines.push(currentLine)

    return lines
  }

  /**
   * Draw pre-parsed label nodes with automatic wrapping to fit within bounds.
   * This is the preferred method - labels should be parsed once and nodes passed here.
   *
   * @param ctx - Canvas rendering context
   * @param nodes - Pre-parsed label nodes
   * @param text - Original processed text (used for line break handling and word wrapping)
   * @param x - X coordinate
   * @param y - Y coordinate
   * @param maxWidth - Maximum width in pixels
   * @param maxHeight - Maximum height in pixels
   * @param pos - Position configuration for alignment
   * @param fontFamily - Font family to use
   * @param getImageFn - Function to get cached image
   * @param loadImageFn - Function to load image if not cached
   * @param onLoadCallback - Optional callback when image loads
   * @param rotationContext - Optional rotation context for link tracking
   * @param hoveredLinkHref - Optional href of currently hovered link (for underline)
   */
  public drawWrappedNodes(
    ctx: CanvasRenderingContext2D,
    nodes: LabelNode[],
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    maxHeight: number,
    pos: LabelPosition,
    fontFamily: string,
    getImageFn: (url: string) => HTMLImageElement | null,
    loadImageFn: (url: string, onLoad?: () => void) => void,
    onLoadCallback?: () => void,
    rotationContext?: RotationContext,
    hoveredLinkHref?: string | null,
  ): void {
    const lineHeight = parseInt(ctx.font.match(/\d+/)?.[0] || '12') * 1.2
    const maxLines = Math.floor(maxHeight / lineHeight)

    if (maxLines < 1) {
      // Not enough vertical space for even one line
      return
    }

    // Check if nodes contain HTML formatting (using pre-parsed nodes)
    const hasFormatting = this.nodesHaveFormatting(nodes)

    // Check if text contains explicit line breaks from <br> tags
    const hasLineBreaks = text.includes('\n')

    if (!hasLineBreaks && !hasFormatting) {
      // No line breaks and no HTML - use simple plain text logic
      const textWidth = ctx.measureText(text).width
      if (textWidth <= maxWidth) {
        // Text fits on one line
        ctx.fillText(text, x, y)
        return
      }

      // Text is too long - wrap by words
      const words = text.split(' ')
      if (words.length === 1) {
        // Single word too long
        this.drawOverflowText(ctx, text, x, y, maxWidth)
        return
      }

      // Multiple words - wrap them
      const lines: string[] = []
      let currentLine = ''

      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word
        const testWidth = ctx.measureText(testLine).width

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

      this.drawMultiLineText(ctx, lines, x, y, lineHeight, pos)
      return
    } else if (hasFormatting && !hasLineBreaks) {
      // Has HTML formatting but no line breaks - render with formatting
      const textWidth = this.measureNodesWidth(ctx, nodes, fontFamily, getImageFn)
      if (textWidth <= maxWidth) {
        // Text fits on one line - render nodes directly
        this.drawParsedNodes(
          ctx,
          nodes,
          x,
          y,
          fontFamily,
          getImageFn,
          loadImageFn,
          onLoadCallback,
          rotationContext,
          hoveredLinkHref,
        )
        return
      }

      // HTML text is too long - wrap with formatting preserved
      // Note: wrapHtmlText still needs text string for word splitting logic
      const wrappedLines = this.wrapHtmlText(ctx, text, maxWidth, fontFamily)
      if (wrappedLines.length === 0) {
        return
      }

      // Draw each line with HTML formatting
      this.drawMultiLineHtmlText(
        ctx,
        wrappedLines,
        x,
        y,
        lineHeight,
        pos,
        fontFamily,
        getImageFn,
        loadImageFn,
        onLoadCallback,
        rotationContext,
        hoveredLinkHref,
      )
      return
    }

    // Handle text with explicit line breaks using node-based splitting
    // This preserves link nodes and other HTML formatting across line breaks
    const nodeLines = this.splitNodesByNewline(nodes)

    // Limit to maxLines
    const limitedNodeLines = nodeLines.slice(0, maxLines)

    // If only one line after splitting, render directly
    if (limitedNodeLines.length === 1) {
      const lineNodes = limitedNodeLines[0] || []
      const lineWidth = this.measureNodesWidth(ctx, lineNodes, fontFamily, getImageFn)

      if (lineWidth <= maxWidth) {
        // Single line fits
        this.drawParsedNodes(
          ctx,
          lineNodes,
          x,
          y,
          fontFamily,
          getImageFn,
          loadImageFn,
          onLoadCallback,
          rotationContext,
          hoveredLinkHref,
        )
        return
      }
      // Single line too wide - could implement word wrapping for nodes here
      // For now, just render and let it overflow
      this.drawParsedNodes(
        ctx,
        lineNodes,
        x,
        y,
        fontFamily,
        getImageFn,
        loadImageFn,
        onLoadCallback,
        rotationContext,
        hoveredLinkHref,
      )
      return
    }

    // Multiple lines - use multi-line node rendering
    this.drawMultiLineNodes(
      ctx,
      limitedNodeLines,
      x,
      y,
      lineHeight,
      pos,
      fontFamily,
      getImageFn,
      loadImageFn,
      onLoadCallback,
      rotationContext,
      hoveredLinkHref,
    )
  }

  /**
   * Draw text that overflows with ellipsis truncation.
   *
   * @param ctx - Canvas rendering context
   * @param text - Text to draw
   * @param x - X coordinate
   * @param y - Y coordinate
   * @param maxWidth - Maximum width before truncation
   */
  public drawOverflowText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
  ): void {
    // For single words that are too long, try to truncate with ellipsis
    let truncatedText = text

    while (truncatedText.length > 1) {
      const testText = truncatedText + '...'
      if (ctx.measureText(testText).width <= maxWidth) {
        ctx.fillText(testText, x, y)
        return
      }
      truncatedText = truncatedText.slice(0, -1)
    }

    // If even one character is too wide, just draw it (let it overflow slightly)
    ctx.fillText(text, x, y)
  }

  /**
   * Draw multiple lines of plain text with proper baseline alignment.
   *
   * @param ctx - Canvas rendering context
   * @param lines - Array of text lines
   * @param x - X coordinate
   * @param y - Starting Y coordinate
   * @param lineHeight - Height of each line
   * @param pos - Position configuration for alignment
   */
  public drawMultiLineText(
    ctx: CanvasRenderingContext2D,
    lines: string[],
    x: number,
    y: number,
    lineHeight: number,
    pos: LabelPosition,
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
      ctx.fillText(line, x, lineY)
    })
  }

  /**
   * Reconstruct an HTML line from parsed nodes.
   * Helper for wrapping HTML text while preserving formatting.
   *
   * @param segments - Array of text segments with formatting
   * @returns HTML string
   */
  private reconstructHtmlLine(
    segments: { text: string; bold: boolean; italic: boolean }[],
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
}

/**
 * Singleton instance of LabelRenderer for use across the application.
 */
export const labelRenderer = new LabelRenderer()
