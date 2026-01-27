import type { Key } from '@adamws/kle-serial'
import type { KeyRenderParams } from '../canvas-renderer'
import type { LabelNode, ListNode, TextStyle } from '../parsers/LabelAST'
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

// List rendering constants
const LIST_BULLET = '•'
const LIST_INDENT = 12 // Pixels to indent nested list content
const LIST_ITEM_SPACING = 2 // Extra vertical spacing between items

// Dummy image getter for list measurement (lists don't support images)
const noopGetImage = (): null => null

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
  private drawImageLabel(
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
      // Links, images, SVGs, and lists are always considered "formatted"
      if (
        node.type === 'link' ||
        node.type === 'image' ||
        node.type === 'svg' ||
        node.type === 'list'
      ) {
        return true
      }
      // Text nodes with bold or italic styling are "formatted"
      if (node.type === 'text' && (node.style.bold || node.style.italic)) {
        return true
      }
      // Check list item children
      if (node.type === 'list-item') {
        if (this.nodesHaveFormatting(node.children)) {
          return true
        }
      }
    }
    return false
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
  private buildFontStyle(
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
   * Draw inline nodes (text and links) at a specific position.
   * This is the core text rendering method used by both general label rendering
   * and list item rendering.
   *
   * NOTE: Images and SVGs are intentionally NOT handled here. They are only
   * supported as standalone labels (checked via isImageOnly/isSvgOnly regex)
   * and rendered via drawImageLabel. Mixed image+text content will skip images.
   *
   * @param ctx - Canvas rendering context
   * @param nodes - Nodes to draw (only text and link nodes are rendered)
   * @param startX - Starting X coordinate
   * @param y - Y coordinate
   * @param fontFamily - Font family to use
   * @param fontSize - Font size for link rendering
   * @param textBaseline - Text baseline for link bounding box calculation
   * @param rotationContext - Optional rotation context for link tracking
   * @param hoveredLinkHref - Optional href of currently hovered link (for underline)
   * @returns The final X position after drawing all nodes
   */
  private drawInlineNodes(
    ctx: CanvasRenderingContext2D,
    nodes: LabelNode[],
    startX: number,
    y: number,
    fontFamily: string,
    fontSize: number,
    textBaseline: CanvasTextBaseline,
    rotationContext?: RotationContext,
    hoveredLinkHref?: string | null,
  ): number {
    let currentX = startX

    for (const node of nodes) {
      if (node.type === 'text') {
        const fontStyle = this.buildFontStyle(
          ctx,
          node.style.bold ?? false,
          node.style.italic ?? false,
          fontFamily,
        )
        ctx.font = fontStyle
        ctx.fillText(node.text, currentX, y)
        currentX += ctx.measureText(node.text).width
      } else if (node.type === 'link') {
        currentX += this.renderLinkNode(
          ctx,
          node,
          currentX,
          y,
          fontFamily,
          fontSize,
          textBaseline,
          rotationContext,
          hoveredLinkHref,
        )
      }
      // Images/SVGs are skipped - only supported as standalone labels
      // Lists are handled separately by renderListNode
    }

    return currentX
  }

  /**
   * Draw pre-parsed label nodes at a specific position.
   * Handles text, links, and lists. Images/SVGs are only supported standalone.
   *
   * @param ctx - Canvas rendering context
   * @param nodes - Pre-parsed label nodes to draw
   * @param x - X coordinate
   * @param y - Y coordinate
   * @param fontFamily - Font family to use
   * @param getImageFn - Function to get cached image (used for measuring)
   * @param loadImageFn - Function to load image if not cached (unused, kept for API compatibility)
   * @param onLoadCallback - Optional callback when image loads (unused, kept for API compatibility)
   * @param rotationContext - Optional rotation context for link tracking
   * @param hoveredLinkHref - Optional href of currently hovered link (for underline)
   * @returns The final Y position after rendering (useful for content after block elements)
   */
  private drawParsedNodes(
    ctx: CanvasRenderingContext2D,
    nodes: LabelNode[],
    x: number,
    y: number,
    fontFamily: string,
    getImageFn: (url: string) => HTMLImageElement | null,
    _loadImageFn: (url: string, onLoad?: () => void) => void,
    _onLoadCallback?: () => void,
    rotationContext?: RotationContext,
    hoveredLinkHref?: string | null,
    maxWidth?: number,
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

    // Check if this line contains a list (block element)
    const containsList = nodes.some((node) => node.type === 'list')

    // For center/right alignment of inline content, we need to adjust starting X
    // But NOT for lists - they handle their own alignment
    if (!containsList && (originalTextAlign === 'center' || originalTextAlign === 'right')) {
      // Calculate width of inline content only (text and links)
      let totalWidth = 0
      for (const node of nodes) {
        if (node.type === 'text' || node.type === 'link') {
          totalWidth += this.measureNodeWidth(ctx, node, fontFamily, getImageFn)
        }
      }
      if (originalTextAlign === 'center') {
        currentX = x - totalWidth / 2
      } else {
        currentX = x - totalWidth
      }
    }

    // Separate inline nodes from lists
    const inlineNodes = nodes.filter((n) => n.type === 'text' || n.type === 'link')
    const listNodes = nodes.filter((n) => n.type === 'list')

    // Draw inline content (text and links)
    if (inlineNodes.length > 0) {
      this.drawInlineNodes(
        ctx,
        inlineNodes,
        currentX,
        y,
        fontFamily,
        fontSize,
        originalTextBaseline,
        rotationContext,
        hoveredLinkHref,
      )
    }

    // Draw lists (block elements)
    for (const node of listNodes) {
      if (node.type === 'list') {
        this.renderListNode(
          ctx,
          node,
          x, // Lists use original x, not adjusted currentX
          y,
          fontFamily,
          originalTextAlign,
          originalTextBaseline,
          rotationContext,
          hoveredLinkHref,
          maxWidth,
          noopGetImage,
        )
      }
    }

    // Restore original context state
    ctx.font = originalFont
    ctx.textAlign = originalTextAlign
    ctx.textBaseline = originalTextBaseline
    ctx.fillStyle = originalFillStyle

    return y
  }

  /**
   * Render a list (ordered or unordered) with proper alignment
   * Each list item renders on a new line with bullet/number prefix
   * NOTE: Lists are text-only (no images/SVGs) - simplified rendering
   *
   * IMPORTANT: This method does NOT adjust for baseline - that should be handled
   * by the caller (drawMultiLineNodes) when positioning multiline content.
   * The list renders starting at the given Y position and grows downward.
   */
  private renderListNode(
    ctx: CanvasRenderingContext2D,
    list: ListNode,
    x: number,
    y: number,
    fontFamily: string,
    alignment: CanvasTextAlign,
    baseline: CanvasTextBaseline,
    rotationContext?: RotationContext,
    hoveredLinkHref?: string | null,
    maxWidth?: number,
    getImageFn?: (url: string) => HTMLImageElement | null,
  ): number {
    const fontSize = parseInt(ctx.font.match(/\d+/)?.[0] || '12')
    const lineHeight = fontSize * 1.2
    let currentY = y

    // NOTE: Do NOT adjust Y for baseline here - the caller handles vertical positioning
    // for multiline content. The list starts at Y and grows downward.

    // Use provided getImageFn or noop (lists don't have images)
    const getImage = getImageFn || noopGetImage

    for (let i = 0; i < list.items.length; i++) {
      const item = list.items[i]
      if (!item) continue

      // Generate marker text
      const marker = list.ordered ? `${i + 1}.` : LIST_BULLET
      const markerWidth = ctx.measureText(marker + ' ').width
      const itemContentMaxWidth = maxWidth ? maxWidth - markerWidth : undefined

      // Get inline children (text/links only, not nested lists)
      const inlineChildren = item.children.filter((c) => c.type !== 'list')

      // Apply word wrapping if maxWidth is specified
      let wrappedLines: LabelNode[][] = [inlineChildren]
      if (itemContentMaxWidth && inlineChildren.length > 0) {
        const contentWidth = this.measureNodesWidth(ctx, inlineChildren, fontFamily, getImage)
        if (contentWidth > itemContentMaxWidth) {
          wrappedLines = this.wrapSingleLine(
            ctx,
            inlineChildren,
            itemContentMaxWidth,
            fontFamily,
            getImage,
          )
        }
      }

      // Draw each wrapped line
      for (let lineIdx = 0; lineIdx < wrappedLines.length; lineIdx++) {
        const lineNodes = wrappedLines[lineIdx]
        const isFirstLine = lineIdx === 0

        // Measure this line's content width
        const lineContentWidth =
          lineNodes && lineNodes.length > 0
            ? this.measureNodesWidth(ctx, lineNodes, fontFamily, getImage)
            : 0

        // Calculate positions based on alignment - each line aligned independently
        let markerX: number
        let contentX: number

        if (alignment === 'center') {
          if (isFirstLine) {
            // First line includes marker
            const totalLineWidth = markerWidth + lineContentWidth
            markerX = x - totalLineWidth / 2
            contentX = markerX + markerWidth
          } else {
            // Subsequent lines: center content only (no marker)
            contentX = x - lineContentWidth / 2
            markerX = contentX - markerWidth // Not used, but set for consistency
          }
        } else if (alignment === 'right') {
          if (isFirstLine) {
            // First line: right edge of content at x
            contentX = x - lineContentWidth
            markerX = contentX - markerWidth
          } else {
            // Subsequent lines: right edge of content at x (no marker)
            contentX = x - lineContentWidth
            markerX = contentX - markerWidth // Not used
          }
        } else {
          // Left alignment (default)
          markerX = x
          contentX = x + markerWidth
        }

        // Draw marker on first line only
        if (isFirstLine) {
          ctx.textAlign = 'left'
          ctx.fillText(marker, markerX, currentY)
        }

        // Draw line content using the shared inline rendering method
        if (lineNodes && lineNodes.length > 0) {
          ctx.textAlign = 'left'
          this.drawInlineNodes(
            ctx,
            lineNodes,
            contentX,
            currentY,
            fontFamily,
            fontSize,
            baseline,
            rotationContext,
            hoveredLinkHref,
          )
        }

        currentY += lineHeight + LIST_ITEM_SPACING
      }

      // Handle nested lists - position based on alignment
      const nestedLists = item.children.filter((c) => c.type === 'list') as ListNode[]
      for (const nestedList of nestedLists) {
        const nestedMaxWidth = itemContentMaxWidth ? itemContentMaxWidth - LIST_INDENT : undefined
        // For nested lists, calculate starting X based on parent alignment
        let nestedX: number
        if (alignment === 'left') {
          nestedX = x + markerWidth + LIST_INDENT
        } else {
          // For center/right, nested lists are indented from the left edge
          // Use a consistent indentation from x
          nestedX = x + LIST_INDENT
        }
        currentY = this.renderListNode(
          ctx,
          nestedList,
          nestedX,
          currentY,
          fontFamily,
          alignment, // Pass through the alignment
          'hanging',
          rotationContext,
          hoveredLinkHref,
          nestedMaxWidth,
          getImage,
        )
      }
    }

    return currentY
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

    if (node.type === 'list') {
      // Lists are block elements - measure max item width
      return this.measureListWidth(ctx, node, fontFamily)
    }

    if (node.type === 'list-item') {
      // List items measured via their children (text-only)
      return this.measureListItemWidth(ctx, node.children, fontFamily)
    }

    return 0
  }

  /**
   * Measure the maximum width of a list (for layout calculations)
   * Lists contain only text content (text, links, nested lists) - no images
   */
  private measureListWidth(
    ctx: CanvasRenderingContext2D,
    list: ListNode,
    fontFamily: string,
  ): number {
    let maxWidth = 0

    for (let i = 0; i < list.items.length; i++) {
      const item = list.items[i]
      if (!item) continue

      // Measure marker width
      const markerText = list.ordered ? `${i + 1}. ` : `${LIST_BULLET} `
      const markerWidth = ctx.measureText(markerText).width

      // Measure item content width (text-only, no images)
      const contentWidth = this.measureListItemWidth(ctx, item.children, fontFamily)

      // Check for nested lists
      const nestedListWidth = this.measureNestedListsWidth(ctx, item.children, fontFamily)

      maxWidth = Math.max(maxWidth, markerWidth + contentWidth, markerWidth + nestedListWidth)
    }

    return maxWidth
  }

  /**
   * Measure text-only content width for list items
   */
  private measureListItemWidth(
    ctx: CanvasRenderingContext2D,
    children: LabelNode[],
    fontFamily: string,
  ): number {
    const originalFont = ctx.font
    let width = 0
    for (const child of children) {
      if (child.type === 'text' || child.type === 'link') {
        const fontStyle = this.buildFontStyle(
          ctx,
          child.style.bold ?? false,
          child.style.italic ?? false,
          fontFamily,
        )
        ctx.font = fontStyle
        width += ctx.measureText(child.text).width
      }
      // Nested lists measured separately, images/SVGs not supported
    }
    ctx.font = originalFont
    return width
  }

  /**
   * Measure nested lists within item children
   */
  private measureNestedListsWidth(
    ctx: CanvasRenderingContext2D,
    children: LabelNode[],
    fontFamily: string,
  ): number {
    let maxWidth = 0
    for (const child of children) {
      if (child.type === 'list') {
        const nestedWidth = LIST_INDENT + this.measureListWidth(ctx, child, fontFamily)
        maxWidth = Math.max(maxWidth, nestedWidth)
      }
    }
    return maxWidth
  }

  /**
   * Calculate the total height of a list including all items and nested lists
   * Accounts for word wrapping when maxWidth is specified
   */
  private measureListHeight(
    ctx: CanvasRenderingContext2D,
    list: ListNode,
    fontFamily?: string,
    maxWidth?: number,
  ): number {
    const fontSize = parseInt(ctx.font.match(/\d+/)?.[0] || '12')
    const lineHeight = fontSize * 1.2
    let totalHeight = 0

    for (let i = 0; i < list.items.length; i++) {
      const item = list.items[i]
      if (!item) continue

      // Calculate marker width for this item
      const marker = list.ordered ? `${i + 1}.` : LIST_BULLET
      const markerWidth = ctx.measureText(marker + ' ').width
      const contentMaxWidth = maxWidth ? maxWidth - markerWidth : undefined

      // Get inline children (text/links only, not nested lists)
      const inlineChildren = item.children.filter((c) => c.type !== 'list')

      // Calculate how many lines this item takes with wrapping
      let itemLineCount = 1
      if (contentMaxWidth && fontFamily && inlineChildren.length > 0) {
        const contentWidth = this.measureNodesWidth(ctx, inlineChildren, fontFamily, noopGetImage)
        if (contentWidth > contentMaxWidth) {
          const wrappedLines = this.wrapSingleLine(
            ctx,
            inlineChildren,
            contentMaxWidth,
            fontFamily,
            noopGetImage,
          )
          itemLineCount = wrappedLines.length
        }
      }

      // Add height for all lines of this item
      totalHeight += itemLineCount * (lineHeight + LIST_ITEM_SPACING)

      // Check for nested lists which add more height
      for (const child of item.children) {
        if (child.type === 'list') {
          const nestedMaxWidth = contentMaxWidth ? contentMaxWidth - LIST_INDENT : undefined
          totalHeight += this.measureListHeight(ctx, child, fontFamily, nestedMaxWidth)
        }
      }
    }

    return totalHeight
  }

  /**
   * Calculate the height of a line of nodes (accounting for lists)
   */
  private measureLineHeight(
    ctx: CanvasRenderingContext2D,
    nodes: LabelNode[],
    fontFamily?: string,
    maxWidth?: number,
  ): number {
    const fontSize = parseInt(ctx.font.match(/\d+/)?.[0] || '12')
    const baseLineHeight = fontSize * 1.2

    // Check if line contains a list
    for (const node of nodes) {
      if (node.type === 'list') {
        return this.measureListHeight(ctx, node, fontFamily, maxWidth)
      }
    }

    return baseLineHeight
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
  private drawMultiLineNodes(
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
    maxWidth?: number,
  ): void {
    // Check if any line contains a list (which has variable height)
    const hasLists = nodeLines.some((line) => line.some((node) => node.type === 'list'))

    let startY = y

    if (hasLists) {
      // Calculate total height accounting for variable-height lines (lists with wrapping)
      let totalHeight = 0
      for (let i = 0; i < nodeLines.length; i++) {
        const line = nodeLines[i]
        if (line) {
          totalHeight += this.measureLineHeight(ctx, line, fontFamily, maxWidth)
        }
      }

      // Adjust starting Y based on baseline
      if (pos.baseline === 'middle') {
        // Center the block of text vertically around the provided Y
        startY = y - totalHeight / 2
      } else if (pos.baseline === 'alphabetic') {
        // Position so the last line ends at the provided Y
        startY = y - totalHeight + lineHeight
      }
    } else {
      // For regular text without lists, use the original calculation
      // which is based on (numLines - 1) to account for text baseline positioning
      const totalHeight = (nodeLines.length - 1) * lineHeight

      if (pos.baseline === 'middle') {
        startY = y - totalHeight / 2
      } else if (pos.baseline === 'alphabetic') {
        startY = y - totalHeight
      }
    }

    // Draw each line with pre-parsed nodes, tracking actual Y position
    let currentY = startY
    for (const lineNodes of nodeLines) {
      this.drawParsedNodes(
        ctx,
        lineNodes,
        x,
        currentY,
        fontFamily,
        getImageFn,
        loadImageFn,
        onLoadCallback,
        rotationContext,
        hoveredLinkHref,
        maxWidth,
      )
      // Advance Y by the height of this line
      // Use measureLineHeight for lists (variable height), fixed lineHeight for regular text
      if (hasLists) {
        currentY += this.measureLineHeight(ctx, lineNodes, fontFamily, maxWidth)
      } else {
        currentY += lineHeight
      }
    }
  }

  /**
   * Split AST nodes into lines at newline characters.
   * Preserves node types and styles (including links) for each line.
   * Lists are treated as block elements and get their own "line".
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
      } else if (node.type === 'list') {
        // Lists are block elements - flush current line and add list separately
        if (currentLine.length > 0) {
          lines.push(currentLine)
          currentLine = []
        }
        // Each list gets its own "line" (will be rendered specially)
        lines.push([node])
      } else {
        // Links, images, SVGs don't split - add to current line
        currentLine.push(node)
      }
    }

    // Don't forget the last line
    if (currentLine.length > 0) {
      lines.push(currentLine)
    }

    return lines
  }

  /**
   * Wrap node lines to fit within a maximum width.
   * Takes lines that have already been split by newlines and applies word wrapping.
   *
   * @param ctx - Canvas rendering context
   * @param nodeLines - Array of lines, each line is an array of nodes
   * @param maxWidth - Maximum width in pixels
   * @param fontFamily - Font family to use
   * @param getImageFn - Function to get cached image
   * @returns Array of wrapped lines
   */
  private wrapNodeLines(
    ctx: CanvasRenderingContext2D,
    nodeLines: LabelNode[][],
    maxWidth: number,
    fontFamily: string,
    getImageFn: (url: string) => HTMLImageElement | null,
  ): LabelNode[][] {
    const result: LabelNode[][] = []

    for (const line of nodeLines) {
      const lineWidth = this.measureNodesWidth(ctx, line, fontFamily, getImageFn)

      if (lineWidth <= maxWidth) {
        result.push(line)
      } else {
        // Line is too wide - wrap it
        result.push(...this.wrapSingleLine(ctx, line, maxWidth, fontFamily, getImageFn))
      }
    }

    return result
  }

  /**
   * Truncate text with ellipsis to fit within maxWidth.
   *
   * @param ctx - Canvas rendering context
   * @param text - Text to truncate
   * @param maxWidth - Maximum width in pixels
   * @returns Truncated text with ellipsis, or original if it fits
   */
  private truncateWithEllipsis(
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number,
  ): string {
    if (ctx.measureText(text).width <= maxWidth) {
      return text
    }

    let truncated = text
    while (truncated.length > 1) {
      truncated = truncated.slice(0, -1)
      const testText = truncated + '...'
      if (ctx.measureText(testText).width <= maxWidth) {
        return testText
      }
    }

    // If even one character + ellipsis is too wide, return original (will overflow)
    return text
  }

  /**
   * Wrap a single line of nodes by word boundaries to fit within maxWidth.
   *
   * @param ctx - Canvas rendering context
   * @param lineNodes - Nodes in the line to wrap
   * @param maxWidth - Maximum width in pixels
   * @param fontFamily - Font family to use
   * @param getImageFn - Function to get cached image
   * @returns Array of wrapped lines
   */
  private wrapSingleLine(
    ctx: CanvasRenderingContext2D,
    lineNodes: LabelNode[],
    maxWidth: number,
    fontFamily: string,
    getImageFn: (url: string) => HTMLImageElement | null,
  ): LabelNode[][] {
    const result: LabelNode[][] = []
    let currentLine: LabelNode[] = []
    let currentLineWidth = 0

    for (const node of lineNodes) {
      if (node.type === 'text' || node.type === 'link') {
        // Split text/link nodes by words
        const text = node.type === 'text' ? node.text : node.text
        const words = text.split(' ')

        for (let i = 0; i < words.length; i++) {
          const word = words[i]
          if (!word) continue

          // Create a temporary node for measuring
          const tempNode: LabelNode =
            node.type === 'text'
              ? { type: 'text', text: word, style: { ...node.style } }
              : { type: 'link', href: node.href, text: word, style: { ...node.style } }

          const wordWidth = this.measureNodeWidth(ctx, tempNode, fontFamily, getImageFn)
          const spaceWidth = currentLine.length > 0 ? ctx.measureText(' ').width : 0

          if (currentLineWidth + spaceWidth + wordWidth <= maxWidth) {
            // Word fits on current line
            if (currentLine.length > 0) {
              // Add space before word if not first on line
              const lastNode = currentLine[currentLine.length - 1]
              if (lastNode && (lastNode.type === 'text' || lastNode.type === 'link')) {
                // Append space to last text/link node
                if (lastNode.type === 'text') {
                  lastNode.text += ' '
                } else {
                  // For links, we need to add a new text node for the space
                  currentLine.push({ type: 'text', text: ' ', style: {} })
                }
              } else {
                currentLine.push({ type: 'text', text: ' ', style: {} })
              }
            }
            currentLine.push(tempNode)
            currentLineWidth += spaceWidth + wordWidth
          } else {
            // Word doesn't fit - start new line
            if (currentLine.length > 0) {
              result.push(currentLine)
            }

            // Check if word itself is wider than maxWidth - truncate with ellipsis
            if (wordWidth > maxWidth) {
              const originalFont = ctx.font
              const fontStyle = this.buildFontStyle(
                ctx,
                node.style.bold ?? false,
                node.style.italic ?? false,
                fontFamily,
              )
              ctx.font = fontStyle
              const truncatedText = this.truncateWithEllipsis(ctx, word, maxWidth)
              ctx.font = originalFont

              const truncatedNode: LabelNode =
                node.type === 'text'
                  ? { type: 'text', text: truncatedText, style: { ...node.style } }
                  : { type: 'link', href: node.href, text: truncatedText, style: { ...node.style } }

              currentLine = [truncatedNode]
              currentLineWidth = this.measureNodeWidth(ctx, truncatedNode, fontFamily, getImageFn)
            } else {
              currentLine = [tempNode]
              currentLineWidth = wordWidth
            }
          }
        }
      } else {
        // Non-text nodes (images, SVGs) - add as-is
        const nodeWidth = this.measureNodeWidth(ctx, node, fontFamily, getImageFn)

        if (currentLineWidth + nodeWidth <= maxWidth) {
          currentLine.push(node)
          currentLineWidth += nodeWidth
        } else {
          // Node doesn't fit - start new line
          if (currentLine.length > 0) {
            result.push(currentLine)
          }
          currentLine = [node]
          currentLineWidth = nodeWidth
        }
      }
    }

    // Don't forget remaining line
    if (currentLine.length > 0) {
      result.push(currentLine)
    }

    return result.length > 0 ? result : [[]]
  }

  /**
   * Draw pre-parsed label nodes with automatic wrapping to fit within bounds.
   * Uses a unified rendering path for all content types.
   *
   * @param ctx - Canvas rendering context
   * @param nodes - Pre-parsed label nodes
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
  private drawWrappedNodes(
    ctx: CanvasRenderingContext2D,
    nodes: LabelNode[],
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
      return
    }

    // 1. Always split by newlines (handles <br> already converted to \n by parser)
    const nodeLines = this.splitNodesByNewline(nodes)

    // 2. Apply word wrapping to overflowing lines
    const wrappedLines = this.wrapNodeLines(ctx, nodeLines, maxWidth, fontFamily, getImageFn)

    // 3. Limit to maxLines
    const limitedLines = wrappedLines.slice(0, maxLines)

    // 4. Render through unified path
    if (limitedLines.length === 1) {
      // Single line - render directly without multi-line positioning
      this.drawParsedNodes(
        ctx,
        limitedLines[0] || [],
        x,
        y,
        fontFamily,
        getImageFn,
        loadImageFn,
        onLoadCallback,
        rotationContext,
        hoveredLinkHref,
        maxWidth,
      )
    } else {
      // Multiple lines - use multi-line node rendering
      this.drawMultiLineNodes(
        ctx,
        limitedLines,
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
        maxWidth,
      )
    }
  }
}

/**
 * Singleton instance of LabelRenderer for use across the application.
 */
export const labelRenderer = new LabelRenderer()
