import type { Key } from '@adamws/kle-serial'
import type { KeyRenderParams } from '../canvas-renderer'
import type { ParsedSegment } from '../caches/ParseCache'
import { labelParser } from '../parsers/LabelParser'
import { svgCache } from '../caches/SVGCache'

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
   */
  public drawKeyLabels(
    ctx: CanvasRenderingContext2D,
    key: Key,
    params: KeyRenderParams,
    options: LabelRenderOptions,
    getImageFn: (url: string) => HTMLImageElement | null,
    loadImageFn: (url: string, onLoad?: () => void) => void,
    onLoadCallback?: () => void,
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
        // Text or mixed content: use normal text rendering
        const processedLabel = labelParser.processLabelText(label)
        this.drawWrappedText(
          ctx,
          processedLabel,
          x,
          y,
          availableWidth,
          availableHeight,
          pos,
          fontFamily,
          getImageFn,
          loadImageFn,
          onLoadCallback,
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
   */
  public drawRotaryEncoderLabels(
    ctx: CanvasRenderingContext2D,
    key: Key,
    params: KeyRenderParams,
    options: LabelRenderOptions,
    getImageFn: (url: string) => HTMLImageElement | null,
    loadImageFn: (url: string, onLoad?: () => void) => void,
    onLoadCallback?: () => void,
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
        // Text or mixed content: use normal text rendering
        const processedLabel = labelParser.processLabelText(label)
        this.drawWrappedText(
          ctx,
          processedLabel,
          x,
          y,
          availableWidth,
          availableHeight,
          pos,
          fontFamily,
          getImageFn,
          loadImageFn,
          onLoadCallback,
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
    const segments = labelParser.parseHtmlText(label)
    const imageSegment = segments.find((s) => s.type === 'image' || s.type === 'svg')

    if (!imageSegment) {
      return
    }

    let img: HTMLImageElement | null = null
    let width: number
    let height: number

    if (imageSegment.type === 'svg' && imageSegment.svgContent) {
      // Inline SVG: convert to data URL and load
      const dataUrl = svgCache.toDataUrl(imageSegment.svgContent)
      img = getImageFn(dataUrl)
      if (!img) {
        // Image not loaded yet, trigger loading
        loadImageFn(dataUrl, onLoadCallback)
        return
      }
      // Use dimensions from SVG attributes or natural dimensions
      width = imageSegment.width || img.naturalWidth || 32
      height = imageSegment.height || img.naturalHeight || 32
    } else if (imageSegment.type === 'image' && imageSegment.src) {
      // External image
      img = getImageFn(imageSegment.src)
      if (!img) {
        // Image not loaded yet, trigger loading
        loadImageFn(imageSegment.src, onLoadCallback)
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
    ctx.drawImage(img, imgX, imgY, width, height)
  }

  /**
   * Check if text contains HTML formatting tags.
   * Delegates to labelParser for consistent parsing.
   *
   * @param text - Text to check
   * @returns True if text contains HTML tags
   */
  public hasHtmlFormatting(text: string): boolean {
    return labelParser.hasHtmlFormatting(text)
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
   * Draw HTML formatted text at a specific position.
   * Handles mixed bold, italic, and plain text segments with images.
   *
   * @param ctx - Canvas rendering context
   * @param text - HTML formatted text to draw
   * @param x - X coordinate
   * @param y - Y coordinate
   * @param fontFamily - Font family to use
   * @param getImageFn - Function to get cached image
   * @param loadImageFn - Function to load image if not cached
   * @param onLoadCallback - Optional callback when image loads
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
  ): void {
    const segments = labelParser.parseHtmlText(text)

    // Save context state
    const originalFont = ctx.font
    const originalTextAlign = ctx.textAlign
    const originalTextBaseline = ctx.textBaseline

    // For center/right alignment, we need to calculate total width first
    let totalWidth = 0
    if (originalTextAlign === 'center' || originalTextAlign === 'right') {
      totalWidth = this.measureHtmlText(ctx, text, fontFamily, getImageFn)
    }

    // Calculate starting x position based on alignment
    let currentX = x
    if (originalTextAlign === 'center') {
      currentX = x - totalWidth / 2
    } else if (originalTextAlign === 'right') {
      currentX = x - totalWidth
    }

    // Temporarily set text align to left for segment-by-segment rendering
    ctx.textAlign = 'left'

    // Draw each segment
    segments.forEach((segment) => {
      if (segment.type === 'text') {
        // Apply font style for this segment
        const fontStyle = this.buildFontStyle(ctx, segment.bold!, segment.italic!, fontFamily)
        ctx.font = fontStyle

        // Draw the text segment
        ctx.fillText(segment.text!, currentX, y)

        // Move x position for next segment
        currentX += ctx.measureText(segment.text!).width
      } else if (segment.type === 'image' && segment.src) {
        // For mixed text+image content (not supported)
        // Just skip images in mixed content - they should use image-only labels
        const img = getImageFn(segment.src)
        if (!img) {
          // Trigger loading for next render
          loadImageFn(segment.src, onLoadCallback)

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
          ctx.save()
          ctx.strokeStyle = '#ccc'
          ctx.strokeRect(currentX, imgY, width, height)
          ctx.restore()

          currentX += width
        }
      }
    })

    // Restore original font and text align
    ctx.font = originalFont
    ctx.textAlign = originalTextAlign
    ctx.textBaseline = originalTextBaseline
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
    const segments = labelParser.parseHtmlText(text)
    const lines: string[] = []
    let currentLine: ParsedSegment[] = []
    let currentLineWidth = 0

    // Save current font
    const originalFont = ctx.font

    for (const segment of segments) {
      // Skip image segments - they don't wrap
      if (segment.type === 'image') {
        continue
      }

      // Split text segment by words
      const words = segment.text!.split(' ')

      for (let i = 0; i < words.length; i++) {
        const word = words[i]
        if (!word) continue

        // Apply font style to measure this word
        const fontStyle = this.buildFontStyle(ctx, segment.bold!, segment.italic!, fontFamily)
        ctx.font = fontStyle

        // Measure word with space (unless it's the first word on the line)
        const wordText = currentLine.length === 0 ? word : ' ' + word
        const wordWidth = ctx.measureText(wordText).width

        if (currentLineWidth + wordWidth <= maxWidth) {
          // Word fits on current line
          currentLine.push({
            type: 'text',
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
            // Start new line with this word
            currentLine = [
              {
                type: 'text',
                text: word,
                bold: segment.bold!,
                italic: segment.italic!,
              },
            ]
            currentLineWidth = ctx.measureText(word).width
          } else {
            // Even a single word doesn't fit, add it anyway
            currentLine.push({
              type: 'text',
              text: word,
              bold: segment.bold!,
              italic: segment.italic!,
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
      this.drawHtmlText(ctx, line, x, lineY, fontFamily, getImageFn, loadImageFn, onLoadCallback)
    })
  }

  /**
   * Draw text with automatic wrapping to fit within bounds.
   * Handles plain text, HTML formatted text, line breaks, and overflow.
   *
   * @param ctx - Canvas rendering context
   * @param text - Text to draw (plain or HTML)
   * @param x - X coordinate
   * @param y - Y coordinate
   * @param maxWidth - Maximum width in pixels
   * @param maxHeight - Maximum height in pixels
   * @param pos - Position configuration for alignment
   * @param fontFamily - Font family to use
   * @param getImageFn - Function to get cached image
   * @param loadImageFn - Function to load image if not cached
   * @param onLoadCallback - Optional callback when image loads
   */
  public drawWrappedText(
    ctx: CanvasRenderingContext2D,
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
  ): void {
    const lineHeight = parseInt(ctx.font.match(/\d+/)?.[0] || '12') * 1.2
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

      // Multiple words - wrap them using original logic
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
    } else if (hasHtml && !hasLineBreaks) {
      // Has HTML formatting but no line breaks - render with formatting
      const textWidth = this.measureHtmlText(ctx, text, fontFamily, getImageFn)
      if (textWidth <= maxWidth) {
        // Text fits on one line with HTML formatting
        this.drawHtmlText(ctx, text, x, y, fontFamily, getImageFn, loadImageFn, onLoadCallback)
        return
      }

      // HTML text is too long - wrap with formatting preserved
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
      )
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
      const lineWidth = ctx.measureText(trimmedLine).width

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
            const testWidth = ctx.measureText(testLine).width

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
    const firstLine = finalLines[0]
    if (finalLines.length === 1 && firstLine && ctx.measureText(firstLine).width <= maxWidth) {
      ctx.fillText(firstLine, x, y)
      return
    }

    // Use multi-line rendering for multiple lines or overflow cases
    this.drawMultiLineText(ctx, finalLines.slice(0, maxLines), x, y, lineHeight, pos)
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
      const testText = truncatedText + '…'
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
   * Reconstruct an HTML line from parsed segments.
   * Helper for wrapping HTML text while preserving formatting.
   *
   * @param segments - Array of parsed segments
   * @returns HTML string
   */
  private reconstructHtmlLine(segments: ParsedSegment[]): string {
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
