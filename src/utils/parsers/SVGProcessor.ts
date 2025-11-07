/**
 * SVGProcessor - Utilities for processing and validating SVG content
 *
 * Provides security features and dimension extraction for SVG content
 * used in keyboard labels and key graphics.
 *
 * @example
 * ```typescript
 * import { svgProcessor } from './parsers/SVGProcessor'
 *
 * // Extract dimensions
 * const { width, height } = svgProcessor.extractDimensions('<svg width="24" height="24">...</svg>')
 *
 * // Validate SVG
 * if (svgProcessor.isValidSVG(content)) {
 *   // Process SVG
 * }
 *
 * // Sanitize for security
 * const safe = svgProcessor.sanitizeSVG(untrustedSVG)
 * ```
 */

export interface SVGDimensions {
  width?: number
  height?: number
}

export class SVGProcessor {
  // Dangerous SVG elements and attributes that could enable XSS
  private readonly dangerousElements = [
    'script',
    'iframe',
    'object',
    'embed',
    'link',
    'style', // style can contain javascript: URLs
  ]

  private readonly dangerousAttributes = [
    'onclick',
    'onload',
    'onerror',
    'onmouseover',
    'onmouseout',
    'onmouseenter',
    'onmouseleave',
    'onfocus',
    'onblur',
    'onchange',
    'oninput',
    'onsubmit',
    'onkeydown',
    'onkeyup',
    'onkeypress',
  ]

  /**
   * Extract width and height dimensions from SVG content
   *
   * Parses width and height attributes from the SVG opening tag.
   * Supports both quoted and unquoted numeric values.
   *
   * @param svgContent - The SVG markup string
   * @returns Object with width and height (undefined if not found)
   *
   * @example
   * ```typescript
   * extractDimensions('<svg width="32" height="24">...</svg>')
   * // Returns: { width: 32, height: 24 }
   *
   * extractDimensions('<svg viewBox="0 0 100 100">...</svg>')
   * // Returns: { width: undefined, height: undefined }
   * ```
   */
  public extractDimensions(svgContent: string): SVGDimensions {
    const widthMatch = svgContent.match(/width\s*=\s*["']?(\d+)["']?/i)
    const heightMatch = svgContent.match(/height\s*=\s*["']?(\d+)["']?/i)

    return {
      width: widthMatch ? parseInt(widthMatch[1], 10) : undefined,
      height: heightMatch ? parseInt(heightMatch[1], 10) : undefined,
    }
  }

  /**
   * Check if content appears to be valid SVG
   *
   * Performs basic validation:
   * - Contains <svg> opening tag
   * - Has matching closing tag
   * - No empty content
   *
   * Note: This is a basic check, not a full SVG schema validation.
   *
   * @param content - The content to validate
   * @returns true if content appears to be valid SVG
   *
   * @example
   * ```typescript
   * isValidSVG('<svg>...</svg>') // true
   * isValidSVG('<div>...</div>') // false
   * isValidSVG('') // false
   * ```
   */
  public isValidSVG(content: string): boolean {
    if (!content || typeof content !== 'string') {
      return false
    }

    // Must contain <svg opening tag
    const hasSvgOpen = /<svg[\s>]/i.test(content)
    if (!hasSvgOpen) {
      return false
    }

    // Must have closing tag
    const hasSvgClose = /<\/svg>/i.test(content)
    if (!hasSvgClose) {
      return false
    }

    // Basic structure check: opening tag should come before closing
    const openIndex = content.search(/<svg[\s>]/i)
    const closeIndex = content.search(/<\/svg>/i)
    if (openIndex >= closeIndex) {
      return false
    }

    return true
  }

  /**
   * Sanitize SVG content by removing potentially dangerous elements and attributes
   *
   * Removes:
   * - Script tags and content
   * - Event handler attributes (onclick, onload, etc.)
   * - Dangerous elements (iframe, object, embed, etc.)
   * - javascript: protocol URLs
   *
   * @param svgContent - The SVG content to sanitize
   * @returns Sanitized SVG content
   *
   * @example
   * ```typescript
   * sanitizeSVG('<svg onclick="alert(1)"><script>alert(1)</script></svg>')
   * // Returns: '<svg><\/svg>' (dangerous parts removed)
   * ```
   */
  public sanitizeSVG(svgContent: string): string {
    if (!svgContent || typeof svgContent !== 'string') {
      return ''
    }

    let sanitized = svgContent

    // Remove dangerous elements and their content
    for (const element of this.dangerousElements) {
      // Remove both <element ...>...</element> and self-closing <element ... />
      const pattern = new RegExp(`<${element}[^>]*>.*?<\\/${element}>`, 'gis')
      sanitized = sanitized.replace(pattern, '')

      // Remove self-closing tags
      const selfClosingPattern = new RegExp(`<${element}[^>]*\\/>`, 'gi')
      sanitized = sanitized.replace(selfClosingPattern, '')
    }

    // Remove dangerous event handler attributes
    for (const attr of this.dangerousAttributes) {
      const pattern = new RegExp(`\\s${attr}\\s*=\\s*["'][^"']*["']`, 'gi')
      sanitized = sanitized.replace(pattern, '')

      // Also handle unquoted attributes
      const unquotedPattern = new RegExp(`\\s${attr}\\s*=\\s*[^\\s>]+`, 'gi')
      sanitized = sanitized.replace(unquotedPattern, '')
    }

    // Remove javascript: protocol from href and xlink:href
    sanitized = sanitized.replace(/href\s*=\s*["']javascript:[^"']*["']/gi, '')
    sanitized = sanitized.replace(/xlink:href\s*=\s*["']javascript:[^"']*["']/gi, '')

    // Remove data: URLs that might contain scripts (very dangerous)
    sanitized = sanitized.replace(/href\s*=\s*["']data:text\/html[^"']*["']/gi, '')
    sanitized = sanitized.replace(/xlink:href\s*=\s*["']data:text\/html[^"']*["']/gi, '')

    return sanitized
  }

  /**
   * Validate and sanitize SVG content in one step
   *
   * @param content - The SVG content to process
   * @returns Sanitized SVG content, or empty string if invalid
   *
   * @example
   * ```typescript
   * const safe = validateAndSanitize(userProvidedSVG)
   * if (safe) {
   *   // Use safe SVG
   * }
   * ```
   */
  public validateAndSanitize(content: string): string {
    if (!this.isValidSVG(content)) {
      return ''
    }

    return this.sanitizeSVG(content)
  }

  /**
   * Check if SVG has explicit dimensions
   *
   * @param svgContent - The SVG content to check
   * @returns true if both width and height are present
   */
  public hasDimensions(svgContent: string): boolean {
    const { width, height } = this.extractDimensions(svgContent)
    return width !== undefined && height !== undefined
  }

  /**
   * Extract viewBox dimensions as a fallback
   *
   * If width/height attributes are not present, tries to extract
   * dimensions from the viewBox attribute.
   *
   * @param svgContent - The SVG content
   * @returns Dimensions from viewBox, or undefined if not found
   *
   * @example
   * ```typescript
   * extractViewBoxDimensions('<svg viewBox="0 0 100 50">...</svg>')
   * // Returns: { width: 100, height: 50 }
   * ```
   */
  public extractViewBoxDimensions(svgContent: string): SVGDimensions {
    const viewBoxMatch = svgContent.match(/viewBox\s*=\s*["']([^"']+)["']/i)

    if (!viewBoxMatch) {
      return { width: undefined, height: undefined }
    }

    const values = viewBoxMatch[1].trim().split(/\s+/)
    if (values.length !== 4) {
      return { width: undefined, height: undefined }
    }

    // viewBox="minX minY width height"
    const width = parseFloat(values[2])
    const height = parseFloat(values[3])

    return {
      width: isNaN(width) ? undefined : width,
      height: isNaN(height) ? undefined : height,
    }
  }

  /**
   * Get dimensions with viewBox as fallback
   *
   * Tries to get width/height from attributes first, then falls back
   * to viewBox if attributes are not present.
   *
   * @param svgContent - The SVG content
   * @returns Dimensions (may be undefined if neither source is available)
   */
  public getDimensions(svgContent: string): SVGDimensions {
    const attrDimensions = this.extractDimensions(svgContent)

    // If we have both dimensions from attributes, return them
    if (attrDimensions.width !== undefined && attrDimensions.height !== undefined) {
      return attrDimensions
    }

    // Try viewBox as fallback
    const viewBoxDimensions = this.extractViewBoxDimensions(svgContent)

    // Return whichever we have (prefer attributes, fill in missing with viewBox)
    return {
      width: attrDimensions.width ?? viewBoxDimensions.width,
      height: attrDimensions.height ?? viewBoxDimensions.height,
    }
  }
}

/**
 * Singleton instance for global use
 */
export const svgProcessor = new SVGProcessor()
