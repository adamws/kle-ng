import { describe, it, expect, beforeEach } from 'vitest'
import { SVGProcessor, svgProcessor } from '../SVGProcessor'

describe('SVGProcessor', () => {
  let processor: SVGProcessor

  beforeEach(() => {
    processor = new SVGProcessor()
  })

  describe('extractDimensions', () => {
    it('should extract width and height from quoted attributes', () => {
      const svg = '<svg width="32" height="24"></svg>'
      const result = processor.extractDimensions(svg)

      expect(result).toEqual({ width: 32, height: 24 })
    })

    it('should extract width and height from unquoted attributes', () => {
      const svg = '<svg width=100 height=200></svg>'
      const result = processor.extractDimensions(svg)

      expect(result).toEqual({ width: 100, height: 200 })
    })

    it('should extract width and height with single quotes', () => {
      const svg = "<svg width='48' height='48'></svg>"
      const result = processor.extractDimensions(svg)

      expect(result).toEqual({ width: 48, height: 48 })
    })

    it('should handle missing width attribute', () => {
      const svg = '<svg height="24"></svg>'
      const result = processor.extractDimensions(svg)

      expect(result).toEqual({ width: undefined, height: 24 })
    })

    it('should handle missing height attribute', () => {
      const svg = '<svg width="32"></svg>'
      const result = processor.extractDimensions(svg)

      expect(result).toEqual({ width: 32, height: undefined })
    })

    it('should handle no dimension attributes', () => {
      const svg = '<svg viewBox="0 0 100 100"></svg>'
      const result = processor.extractDimensions(svg)

      expect(result).toEqual({ width: undefined, height: undefined })
    })

    it('should extract from complex SVG with multiple attributes', () => {
      const svg =
        '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="32" viewBox="0 0 64 32"></svg>'
      const result = processor.extractDimensions(svg)

      expect(result).toEqual({ width: 64, height: 32 })
    })

    it('should handle case-insensitive attributes', () => {
      const svg = '<svg WIDTH="16" HEIGHT="16"></svg>'
      const result = processor.extractDimensions(svg)

      expect(result).toEqual({ width: 16, height: 16 })
    })

    it('should extract first occurrence when dimensions appear multiple times', () => {
      const svg = '<svg width="32" height="32"><rect width="10" height="10"/></svg>'
      const result = processor.extractDimensions(svg)

      expect(result).toEqual({ width: 32, height: 32 })
    })
  })

  describe('isValidSVG', () => {
    it('should return true for basic valid SVG', () => {
      const svg = '<svg></svg>'
      expect(processor.isValidSVG(svg)).toBe(true)
    })

    it('should return true for SVG with content', () => {
      const svg = '<svg><circle r="10"/></svg>'
      expect(processor.isValidSVG(svg)).toBe(true)
    })

    it('should return true for SVG with attributes', () => {
      const svg = '<svg width="100" height="100"></svg>'
      expect(processor.isValidSVG(svg)).toBe(true)
    })

    it('should return true for case-insensitive tags', () => {
      const svg = '<SVG></SVG>'
      expect(processor.isValidSVG(svg)).toBe(true)
    })

    it('should return false for empty string', () => {
      expect(processor.isValidSVG('')).toBe(false)
    })

    it('should return false for null/undefined', () => {
      expect(processor.isValidSVG(null as unknown as string)).toBe(false)
      expect(processor.isValidSVG(undefined as unknown as string)).toBe(false)
    })

    it('should return false for non-SVG HTML', () => {
      expect(processor.isValidSVG('<div></div>')).toBe(false)
    })

    it('should return false for SVG without closing tag', () => {
      expect(processor.isValidSVG('<svg>')).toBe(false)
    })

    it('should return false for closing tag without opening', () => {
      expect(processor.isValidSVG('</svg>')).toBe(false)
    })

    it('should return false for malformed tag order', () => {
      expect(processor.isValidSVG('</svg><svg>')).toBe(false)
    })

    it('should return true for nested SVG', () => {
      const svg = '<svg><svg></svg></svg>'
      expect(processor.isValidSVG(svg)).toBe(true)
    })
  })

  describe('sanitizeSVG', () => {
    it('should remove script tags and content', () => {
      const dangerous = '<svg><script>alert("xss")</script></svg>'
      const result = processor.sanitizeSVG(dangerous)

      expect(result).not.toContain('<script')
      expect(result).not.toContain('alert')
    })

    it('should remove onclick attribute', () => {
      const dangerous = '<svg onclick="alert(1)"></svg>'
      const result = processor.sanitizeSVG(dangerous)

      expect(result).not.toContain('onclick')
      expect(result).toContain('<svg')
    })

    it('should remove multiple event handlers', () => {
      const dangerous = '<svg onclick="a()" onload="b()" onmouseover="c()"></svg>'
      const result = processor.sanitizeSVG(dangerous)

      expect(result).not.toContain('onclick')
      expect(result).not.toContain('onload')
      expect(result).not.toContain('onmouseover')
    })

    it('should remove iframe elements', () => {
      const dangerous = '<svg><iframe src="evil.com"></iframe></svg>'
      const result = processor.sanitizeSVG(dangerous)

      expect(result).not.toContain('<iframe')
    })

    it('should remove object elements', () => {
      const dangerous = '<svg><object data="evil.swf"></object></svg>'
      const result = processor.sanitizeSVG(dangerous)

      expect(result).not.toContain('<object')
    })

    it('should remove embed elements', () => {
      const dangerous = '<svg><embed src="evil.swf"></embed></svg>'
      const result = processor.sanitizeSVG(dangerous)

      expect(result).not.toContain('<embed')
    })

    it('should remove javascript: protocol from href', () => {
      const dangerous = '<svg><a href="javascript:alert(1)">click</a></svg>'
      const result = processor.sanitizeSVG(dangerous)

      expect(result).not.toContain('javascript:')
    })

    it('should remove javascript: from xlink:href', () => {
      const dangerous = '<svg><use xlink:href="javascript:alert(1)"/></svg>'
      const result = processor.sanitizeSVG(dangerous)

      expect(result).not.toContain('javascript:')
    })

    it('should remove data:text/html URLs', () => {
      const dangerous = '<svg><a href="data:text/html,<script>alert(1)</script>">click</a></svg>'
      const result = processor.sanitizeSVG(dangerous)

      expect(result).not.toContain('data:text/html')
    })

    it('should preserve safe SVG content', () => {
      const safe = '<svg width="100" height="100"><circle cx="50" cy="50" r="40" fill="red"/></svg>'
      const result = processor.sanitizeSVG(safe)

      expect(result).toContain('<circle')
      expect(result).toContain('cx="50"')
      expect(result).toContain('fill="red"')
    })

    it('should handle empty input', () => {
      expect(processor.sanitizeSVG('')).toBe('')
      expect(processor.sanitizeSVG(null as unknown as string)).toBe('')
      expect(processor.sanitizeSVG(undefined as unknown as string)).toBe('')
    })

    it('should remove style tags (can contain javascript:)', () => {
      const dangerous = '<svg><style>body { background: url("javascript:alert(1)") }</style></svg>'
      const result = processor.sanitizeSVG(dangerous)

      expect(result).not.toContain('<style')
    })

    it('should handle case-insensitive dangerous elements', () => {
      const dangerous = '<svg><SCRIPT>alert(1)</SCRIPT></svg>'
      const result = processor.sanitizeSVG(dangerous)

      expect(result).not.toContain('SCRIPT')
      expect(result).not.toContain('alert')
    })

    it('should handle self-closing dangerous elements', () => {
      const dangerous = '<svg><script src="evil.js"/></svg>'
      const result = processor.sanitizeSVG(dangerous)

      expect(result).not.toContain('<script')
    })

    it('should remove event handlers from nested elements', () => {
      const dangerous = '<svg><g><circle onclick="alert(1)" r="10"/></g></svg>'
      const result = processor.sanitizeSVG(dangerous)

      expect(result).not.toContain('onclick')
      expect(result).toContain('<circle')
    })
  })

  describe('validateAndSanitize', () => {
    it('should return sanitized SVG for valid input', () => {
      const svg = '<svg onclick="alert(1)"><circle r="10"/></svg>'
      const result = processor.validateAndSanitize(svg)

      expect(result).toContain('<svg')
      expect(result).toContain('<circle')
      expect(result).not.toContain('onclick')
    })

    it('should return empty string for invalid SVG', () => {
      const notSvg = '<div>not svg</div>'
      const result = processor.validateAndSanitize(notSvg)

      expect(result).toBe('')
    })

    it('should return empty string for empty input', () => {
      expect(processor.validateAndSanitize('')).toBe('')
    })
  })

  describe('hasDimensions', () => {
    it('should return true when both dimensions present', () => {
      const svg = '<svg width="32" height="24"></svg>'
      expect(processor.hasDimensions(svg)).toBe(true)
    })

    it('should return false when width missing', () => {
      const svg = '<svg height="24"></svg>'
      expect(processor.hasDimensions(svg)).toBe(false)
    })

    it('should return false when height missing', () => {
      const svg = '<svg width="32"></svg>'
      expect(processor.hasDimensions(svg)).toBe(false)
    })

    it('should return false when both missing', () => {
      const svg = '<svg></svg>'
      expect(processor.hasDimensions(svg)).toBe(false)
    })
  })

  describe('extractViewBoxDimensions', () => {
    it('should extract dimensions from viewBox', () => {
      const svg = '<svg viewBox="0 0 100 50"></svg>'
      const result = processor.extractViewBoxDimensions(svg)

      expect(result).toEqual({ width: 100, height: 50 })
    })

    it('should handle viewBox with different minX and minY', () => {
      const svg = '<svg viewBox="10 20 200 150"></svg>'
      const result = processor.extractViewBoxDimensions(svg)

      expect(result).toEqual({ width: 200, height: 150 })
    })

    it('should handle quoted viewBox', () => {
      const svg = '<svg viewBox="0 0 64 64"></svg>'
      const result = processor.extractViewBoxDimensions(svg)

      expect(result).toEqual({ width: 64, height: 64 })
    })

    it('should handle single-quoted viewBox', () => {
      const svg = "<svg viewBox='0 0 32 32'></svg>"
      const result = processor.extractViewBoxDimensions(svg)

      expect(result).toEqual({ width: 32, height: 32 })
    })

    it('should return undefined when viewBox missing', () => {
      const svg = '<svg></svg>'
      const result = processor.extractViewBoxDimensions(svg)

      expect(result).toEqual({ width: undefined, height: undefined })
    })

    it('should return undefined for malformed viewBox', () => {
      const svg = '<svg viewBox="0 0 100"></svg>' // Only 3 values
      const result = processor.extractViewBoxDimensions(svg)

      expect(result).toEqual({ width: undefined, height: undefined })
    })

    it('should handle floating point viewBox values', () => {
      const svg = '<svg viewBox="0 0 100.5 50.25"></svg>'
      const result = processor.extractViewBoxDimensions(svg)

      expect(result).toEqual({ width: 100.5, height: 50.25 })
    })

    it('should handle case-insensitive viewBox', () => {
      const svg = '<svg VIEWBOX="0 0 100 100"></svg>'
      const result = processor.extractViewBoxDimensions(svg)

      expect(result).toEqual({ width: 100, height: 100 })
    })
  })

  describe('getDimensions', () => {
    it('should prefer width/height attributes over viewBox', () => {
      const svg = '<svg width="32" height="24" viewBox="0 0 100 100"></svg>'
      const result = processor.getDimensions(svg)

      expect(result).toEqual({ width: 32, height: 24 })
    })

    it('should fall back to viewBox when attributes missing', () => {
      const svg = '<svg viewBox="0 0 64 48"></svg>'
      const result = processor.getDimensions(svg)

      expect(result).toEqual({ width: 64, height: 48 })
    })

    it('should mix attribute and viewBox dimensions', () => {
      const svg = '<svg width="50" viewBox="0 0 100 75"></svg>'
      const result = processor.getDimensions(svg)

      expect(result).toEqual({ width: 50, height: 75 })
    })

    it('should return undefined when neither source available', () => {
      const svg = '<svg></svg>'
      const result = processor.getDimensions(svg)

      expect(result).toEqual({ width: undefined, height: undefined })
    })

    it('should handle attributes-only SVG', () => {
      const svg = '<svg width="100" height="100"></svg>'
      const result = processor.getDimensions(svg)

      expect(result).toEqual({ width: 100, height: 100 })
    })

    it('should handle viewBox-only SVG', () => {
      const svg = '<svg viewBox="0 0 200 150"></svg>'
      const result = processor.getDimensions(svg)

      expect(result).toEqual({ width: 200, height: 150 })
    })
  })

  describe('singleton instance', () => {
    it('should export a singleton instance', () => {
      expect(svgProcessor).toBeInstanceOf(SVGProcessor)
    })

    it('should have all methods available on singleton', () => {
      expect(typeof svgProcessor.extractDimensions).toBe('function')
      expect(typeof svgProcessor.isValidSVG).toBe('function')
      expect(typeof svgProcessor.sanitizeSVG).toBe('function')
      expect(typeof svgProcessor.validateAndSanitize).toBe('function')
      expect(typeof svgProcessor.hasDimensions).toBe('function')
      expect(typeof svgProcessor.extractViewBoxDimensions).toBe('function')
      expect(typeof svgProcessor.getDimensions).toBe('function')
    })
  })

  describe('security edge cases', () => {
    it('should handle multiple script tags', () => {
      const dangerous = '<svg><script>a()</script><script>b()</script></svg>'
      const result = processor.sanitizeSVG(dangerous)

      expect(result).not.toContain('script')
    })

    it('should handle nested dangerous elements', () => {
      const dangerous = '<svg><g><script>alert(1)</script></g></svg>'
      const result = processor.sanitizeSVG(dangerous)

      expect(result).not.toContain('script')
    })

    it('should handle event handlers with different quote styles', () => {
      const dangerous = `<svg onclick='alert(1)' onload="eval('bad')"></svg>`
      const result = processor.sanitizeSVG(dangerous)

      expect(result).not.toContain('onclick')
      expect(result).not.toContain('onload')
    })

    it('should handle whitespace variations in attributes', () => {
      const dangerous = '<svg  onclick  =  "alert(1)"  ></svg>'
      const result = processor.sanitizeSVG(dangerous)

      expect(result).not.toContain('onclick')
    })
  })
})
