/**
 * LabelParser - Parses HTML-formatted key labels using DOMParser
 *
 * Supports: <b>, <strong>, <i>, <em>, <a>, <img>, <svg>, <br>
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

import { parseCache } from '../caches/ParseCache'
import { svgProcessor } from './SVGProcessor'
import type { LabelNode, ListItemNode, TextStyle } from './LabelAST'

export class LabelParser {
  /**
   * Parse text with HTML formatting tags and return AST nodes.
   * Handles <br> tags by converting them to newline characters in text nodes.
   * Uses ParseCache to avoid redundant parsing for the same label content.
   */
  public parse(text: string): LabelNode[] {
    return parseCache.getParsed(text, (textToParse) => this.doParse(textToParse))
  }

  /**
   * Internal parser implementation using DOMParser (called only on cache miss)
   */
  private doParse(text: string): LabelNode[] {
    // Handle empty text
    if (!text) {
      return [{ type: 'text', text: '', style: {} }]
    }

    // Use DOMParser to parse HTML
    const parser = new DOMParser()
    const doc = parser.parseFromString(`<div>${text}</div>`, 'text/html')
    const container = doc.body.firstChild

    if (!container) {
      return [{ type: 'text', text, style: {} }]
    }

    const nodes = this.parseChildNodes(container, {})

    // If no nodes were created:
    // - If the input contained HTML tags, return empty (the HTML was parsed but had no content)
    // - Otherwise, return original text as plain text
    if (nodes.length === 0) {
      if (this.hasHtmlFormatting(text)) {
        // HTML was parsed but resulted in no content (e.g., <i class="fa fa-icon"></i>)
        return []
      }
      return [{ type: 'text', text, style: {} }]
    }

    return nodes
  }

  /**
   * Parse all child nodes of an element
   */
  private parseChildNodes(element: Node, style: TextStyle): LabelNode[] {
    const nodes: LabelNode[] = []

    element.childNodes.forEach((child) => {
      const childNodes = this.parseNode(child, style)
      nodes.push(...childNodes)
    })

    return nodes
  }

  /**
   * Parse a single DOM node into LabelNode(s)
   */
  private parseNode(node: Node, style: TextStyle): LabelNode[] {
    // Text node
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? ''
      if (text) {
        return [{ type: 'text', text, style: { ...style } }]
      }
      return []
    }

    // Element node
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return []
    }

    const el = node as HTMLElement
    const tag = el.tagName.toLowerCase()

    // Line break tag - convert to newline in text node
    if (tag === 'br') {
      return [{ type: 'text', text: '\n', style: { ...style } }]
    }

    // Bold tags
    if (tag === 'b' || tag === 'strong') {
      return this.parseChildNodes(el, { ...style, bold: true })
    }

    // Italic tags
    if (tag === 'i' || tag === 'em') {
      return this.parseChildNodes(el, { ...style, italic: true })
    }

    // Anchor/link tag
    if (tag === 'a') {
      const href = el.getAttribute('href') ?? ''
      const text = el.textContent ?? ''
      // Skip empty links (no text to display)
      if (!text) {
        return []
      }
      return [{ type: 'link', href, text, style: { ...style } }]
    }

    // Image tag
    if (tag === 'img') {
      const src = el.getAttribute('src') ?? ''
      const widthAttr = el.getAttribute('width')
      const heightAttr = el.getAttribute('height')

      return [
        {
          type: 'image',
          src,
          width: widthAttr ? parseInt(widthAttr) : undefined,
          height: heightAttr ? parseInt(heightAttr) : undefined,
        },
      ]
    }

    // SVG tag
    if (tag === 'svg') {
      const content = el.outerHTML
      const { width, height } = svgProcessor.extractDimensions(content)

      return [
        {
          type: 'svg',
          content,
          width,
          height,
        },
      ]
    }

    // List tags (ul, ol)
    if (tag === 'ul' || tag === 'ol') {
      return this.parseList(el, style, tag === 'ol')
    }

    // Default: recurse into children (handles div, span, etc.)
    return this.parseChildNodes(el, style)
  }

  /**
   * Parse a list element (<ul> or <ol>) into a LabelNode[]
   * Handles nested lists by recursively calling parseChildNodes
   */
  private parseList(element: HTMLElement, style: TextStyle, ordered: boolean): LabelNode[] {
    const items: ListItemNode[] = []

    // Iterate through child elements looking for <li> tags
    for (let i = 0; i < element.children.length; i++) {
      const child = element.children[i]
      if (child && child.tagName.toLowerCase() === 'li') {
        const itemNode = this.parseListItem(child as HTMLElement, style)
        if (itemNode) {
          items.push(itemNode)
        }
      }
    }

    // Return empty array for empty lists (consistent with other empty content handling)
    if (items.length === 0) {
      return []
    }

    return [
      {
        type: 'list',
        ordered,
        items,
      },
    ]
  }

  /**
   * Parse a list item (<li>) into a ListItemNode
   * List items can contain:
   * - Text content (plain text, bold, italic)
   * - Links (<a>)
   * - Nested lists (<ul>, <ol>)
   * NOTE: Images/SVGs are intentionally filtered out (not supported in lists)
   */
  private parseListItem(element: HTMLElement, style: TextStyle): ListItemNode | null {
    // Parse all child content with inherited style
    const children = this.parseChildNodes(element, style)

    // Filter out empty text nodes AND images/SVGs (not supported in lists)
    const filteredChildren = children.filter((child) => {
      // Filter out images and SVGs - lists are text-only
      if (child.type === 'image' || child.type === 'svg') {
        return false
      }
      if (child.type === 'text') {
        return child.text.trim().length > 0 || child.text.includes('\n')
      }
      return true
    })

    if (filteredChildren.length === 0) {
      return null
    }

    return {
      type: 'list-item',
      children: filteredChildren,
    }
  }

  /**
   * Check if text contains HTML elements using DOMParser.
   * Returns true if the text contains any element nodes (not just text).
   */
  public hasHtmlFormatting(text: string): boolean {
    if (!text) return false

    const parser = new DOMParser()
    const doc = parser.parseFromString(`<div>${text}</div>`, 'text/html')
    const container = doc.body.firstChild

    if (!container) return false

    // Check if there are any element nodes (not just text nodes)
    return this.containsElementNodes(container)
  }

  /**
   * Check if a node contains any element nodes (not just text)
   */
  private containsElementNodes(node: Node): boolean {
    const children = node.childNodes
    for (let i = 0; i < children.length; i++) {
      const child = children.item(i)
      if (child && child.nodeType === Node.ELEMENT_NODE) {
        return true
      }
    }
    return false
  }

  /**
   * Strip HTML formatting tags from text (but not img tags)
   */
  public stripHtmlTags(text: string): string {
    // Only strip formatting tags, not <img>
    return text.replace(/<\s*\/?[biu]\s*>|<\s*\/?(strong|em)\s*>/gi, '')
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
    const nodes = this.parse(text)

    // Save current font
    const originalFont = ctx.font

    // Track max width across all lines and the current line width
    let maxWidth = 0
    let currentLineWidth = 0

    const measureNodes = (nodeList: LabelNode[]): void => {
      for (const node of nodeList) {
        if (node.type === 'text') {
          const fontStyle = buildFontStyle(node.style.bold ?? false, node.style.italic ?? false)
          ctx.font = fontStyle

          // Handle newlines in text - each line is measured separately
          const lines = node.text.split('\n')
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i] ?? ''
            if (i > 0) {
              // New line: save current line width and start fresh
              maxWidth = Math.max(maxWidth, currentLineWidth)
              currentLineWidth = 0
            }
            currentLineWidth += ctx.measureText(line).width
          }
        } else if (node.type === 'link') {
          const fontStyle = buildFontStyle(node.style.bold ?? false, node.style.italic ?? false)
          ctx.font = fontStyle
          currentLineWidth += ctx.measureText(node.text).width
        } else if (node.type === 'image') {
          const img = getImage(node.src)
          if (img) {
            currentLineWidth += node.width || img.naturalWidth
          } else {
            currentLineWidth += node.width || 16
          }
        } else if (node.type === 'svg') {
          currentLineWidth += node.width || 16
        } else if (node.type === 'list') {
          // Lists are block elements - flush current line and measure list items
          maxWidth = Math.max(maxWidth, currentLineWidth)
          currentLineWidth = 0

          // Measure each list item
          const bulletWidth = ctx.measureText('• ').width
          for (const item of node.items) {
            // Measure item content (text/links only, no images in lists)
            let itemWidth = bulletWidth
            for (const child of item.children) {
              if (child.type === 'text') {
                const fontStyle = buildFontStyle(
                  child.style.bold ?? false,
                  child.style.italic ?? false,
                )
                ctx.font = fontStyle
                itemWidth += ctx.measureText(child.text).width
              } else if (child.type === 'link') {
                const fontStyle = buildFontStyle(
                  child.style.bold ?? false,
                  child.style.italic ?? false,
                )
                ctx.font = fontStyle
                itemWidth += ctx.measureText(child.text).width
              } else if (child.type === 'list') {
                // Nested lists - measure recursively (simplified: just track max width)
                measureNodes([child])
              }
            }
            maxWidth = Math.max(maxWidth, itemWidth)
          }
        }
      }
    }

    measureNodes(nodes)

    // Include the final line width
    maxWidth = Math.max(maxWidth, currentLineWidth)

    // Restore original font
    ctx.font = originalFont

    return maxWidth
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

  /**
   * Extract plain text content from parsed nodes.
   * Useful for text operations like line break detection and word wrapping.
   *
   * @param nodes - Parsed label nodes
   * @returns Plain text representation with newlines preserved
   */
  public getPlainText(nodes: LabelNode[]): string {
    let text = ''
    for (const node of nodes) {
      if (node.type === 'text') {
        text += node.text
      } else if (node.type === 'link') {
        text += node.text
      } else if (node.type === 'list') {
        // Extract text from list items
        for (const item of node.items) {
          text += this.getPlainText(item.children) + '\n'
        }
      }
      // Images and SVGs don't contribute to plain text
    }
    return text
  }
}

/**
 * Singleton instance for global use
 */
export const labelParser = new LabelParser()
