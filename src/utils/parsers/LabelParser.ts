/**
 * LabelParser - Parses HTML-formatted key labels
 *
 * Supports: <b>, <i>, <b><i> (nested), <img>, <svg>...</svg>
 *
 * Performance: Uses ParseCache to avoid redundant parsing.
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

import { parseCache, type ParsedSegment } from '../caches/ParseCache'
import { svgProcessor } from './SVGProcessor'

export class LabelParser {
  /**
   * Process label text by converting <br> tags to newlines
   */
  public processLabelText(label: string): string {
    // Convert <br> and <BR> tags (with optional attributes and self-closing) to newlines
    return label.replace(/<br[^>]*>/gi, '\n')
  }

  /**
   * Parse text with HTML formatting tags and extract text segments with their styles
   * Uses ParseCache to avoid redundant regex parsing for the same label content.
   */
  public parseHtmlText(text: string): ParsedSegment[] {
    // Use cache to avoid redundant parsing
    return parseCache.getParsed(text, (textToParse) => this.doParseHtmlText(textToParse))
  }

  /**
   * Internal parser implementation (called only on cache miss)
   */
  private doParseHtmlText(text: string): ParsedSegment[] {
    const segments: ParsedSegment[] = []
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

        // Extract dimensions using SVGProcessor
        const { width, height } = svgProcessor.extractDimensions(svgContent)

        segments.push({
          type: 'svg',
          svgContent,
          width,
          height,
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
            width: widthMatch ? parseInt(widthMatch[1] ?? '0') : undefined,
            height: heightMatch ? parseInt(heightMatch[1] ?? '0') : undefined,
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
  public hasHtmlFormatting(text: string): boolean {
    return /<\s*[bi]\s*>|<\s*\/\s*[bi]\s*>|<img\s+|<svg[^>]*>/i.test(text)
  }

  /**
   * Strip HTML formatting tags from text (but not img tags)
   */
  public stripHtmlTags(text: string): string {
    // Only strip <b>, </b>, <i>, </i> tags, not <img>
    return text.replace(/<\s*\/?[bi]\s*>/gi, '')
  }

  /**
   * Measure the width of text with HTML formatting
   * @param text - The text to measure
   * @param ctx - Canvas rendering context
   * @param buildFontStyle - Function to build font style string
   * @param getImage - Function to get loaded image
   */
  public measureHtmlText(
    text: string,
    ctx: CanvasRenderingContext2D,
    buildFontStyle: (bold: boolean, italic: boolean) => string,
    getImage: (url: string) => HTMLImageElement | null,
  ): number {
    const segments = this.parseHtmlText(text)
    let totalWidth = 0

    // Save current font
    const originalFont = ctx.font

    segments.forEach((segment) => {
      if (segment.type === 'text') {
        // Apply font style for this segment
        const fontStyle = buildFontStyle(segment.bold!, segment.italic!)
        ctx.font = fontStyle

        // Measure this segment
        totalWidth += ctx.measureText(segment.text!).width
      } else if (segment.type === 'image') {
        // Images contribute their width (or a default if not loaded)
        const img = getImage(segment.src!)
        if (img) {
          const width = segment.width || img.naturalWidth
          totalWidth += width
        } else {
          // Placeholder width for unloaded images
          totalWidth += segment.width || 16
        }
      } else if (segment.type === 'svg') {
        // SVGs contribute their width
        totalWidth += segment.width || 16
      }
    })

    // Restore original font
    ctx.font = originalFont

    return totalWidth
  }

  /**
   * Build font style string
   */
  public buildFontStyle(bold: boolean, italic: boolean): string {
    let style = ''
    if (bold) style += 'bold '
    if (italic) style += 'italic '
    return style
  }
}

/**
 * Singleton instance for global use
 */
export const labelParser = new LabelParser()
