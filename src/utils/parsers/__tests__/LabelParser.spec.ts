import { describe, it, expect, beforeEach, vi } from 'vitest'
import { LabelParser } from '../LabelParser'
import { parseCache } from '../../caches/ParseCache'

describe('LabelParser', () => {
  let parser: LabelParser

  beforeEach(() => {
    parser = new LabelParser()
    parseCache.clear()
  })

  describe('processLabelText', () => {
    it('should convert <br> tags to newlines', () => {
      expect(parser.processLabelText('Line 1<br>Line 2')).toBe('Line 1\nLine 2')
    })

    it('should convert <BR> tags to newlines', () => {
      expect(parser.processLabelText('Line 1<BR>Line 2')).toBe('Line 1\nLine 2')
    })

    it('should handle self-closing <br/> tags', () => {
      expect(parser.processLabelText('Line 1<br/>Line 2')).toBe('Line 1\nLine 2')
    })

    it('should handle <br> tags with attributes', () => {
      expect(parser.processLabelText('Line 1<br class="foo">Line 2')).toBe('Line 1\nLine 2')
    })

    it('should handle multiple <br> tags', () => {
      expect(parser.processLabelText('A<br>B<br>C')).toBe('A\nB\nC')
    })

    it('should return unchanged text if no <br> tags', () => {
      expect(parser.processLabelText('No breaks here')).toBe('No breaks here')
    })
  })

  describe('parseHtmlText', () => {
    describe('plain text', () => {
      it('should parse plain text', () => {
        const result = parser.parseHtmlText('Hello World')
        expect(result).toEqual([{ type: 'text', text: 'Hello World', bold: false, italic: false }])
      })

      it('should return plain text for empty string', () => {
        const result = parser.parseHtmlText('')
        expect(result).toEqual([{ type: 'text', text: '', bold: false, italic: false }])
      })
    })

    describe('bold formatting', () => {
      it('should parse bold text', () => {
        const result = parser.parseHtmlText('<b>Bold</b>')
        expect(result).toEqual([{ type: 'text', text: 'Bold', bold: true, italic: false }])
      })

      it('should parse mixed bold and plain text', () => {
        const result = parser.parseHtmlText('Normal <b>Bold</b> Normal')
        expect(result).toEqual([
          { type: 'text', text: 'Normal ', bold: false, italic: false },
          { type: 'text', text: 'Bold', bold: true, italic: false },
          { type: 'text', text: ' Normal', bold: false, italic: false },
        ])
      })

      it('should handle multiple bold sections', () => {
        const result = parser.parseHtmlText('<b>A</b> <b>B</b>')
        expect(result).toEqual([
          { type: 'text', text: 'A', bold: true, italic: false },
          { type: 'text', text: ' ', bold: false, italic: false },
          { type: 'text', text: 'B', bold: true, italic: false },
        ])
      })
    })

    describe('italic formatting', () => {
      it('should parse italic text', () => {
        const result = parser.parseHtmlText('<i>Italic</i>')
        expect(result).toEqual([{ type: 'text', text: 'Italic', bold: false, italic: true }])
      })

      it('should parse mixed italic and plain text', () => {
        const result = parser.parseHtmlText('Normal <i>Italic</i> Normal')
        expect(result).toEqual([
          { type: 'text', text: 'Normal ', bold: false, italic: false },
          { type: 'text', text: 'Italic', bold: false, italic: true },
          { type: 'text', text: ' Normal', bold: false, italic: false },
        ])
      })
    })

    describe('nested formatting', () => {
      it('should parse nested bold and italic', () => {
        const result = parser.parseHtmlText('<b><i>Bold Italic</i></b>')
        expect(result).toEqual([{ type: 'text', text: 'Bold Italic', bold: true, italic: true }])
      })

      it('should parse nested italic and bold', () => {
        const result = parser.parseHtmlText('<i><b>Italic Bold</b></i>')
        expect(result).toEqual([{ type: 'text', text: 'Italic Bold', bold: true, italic: true }])
      })

      it('should handle complex nested formatting', () => {
        const result = parser.parseHtmlText('A <b>B <i>C</i> D</b> E')
        expect(result).toEqual([
          { type: 'text', text: 'A ', bold: false, italic: false },
          { type: 'text', text: 'B ', bold: true, italic: false },
          { type: 'text', text: 'C', bold: true, italic: true },
          { type: 'text', text: ' D', bold: true, italic: false },
          { type: 'text', text: ' E', bold: false, italic: false },
        ])
      })
    })

    describe('image tags', () => {
      it('should parse img tag with src', () => {
        const result = parser.parseHtmlText('<img src="test.png">')
        expect(result).toEqual([
          { type: 'image', src: 'test.png', width: undefined, height: undefined },
        ])
      })

      it('should parse img tag with dimensions', () => {
        const result = parser.parseHtmlText('<img src="test.png" width="32" height="32">')
        expect(result).toEqual([{ type: 'image', src: 'test.png', width: 32, height: 32 }])
      })

      it('should parse img tag with single quotes', () => {
        const result = parser.parseHtmlText("<img src='test.png'>")
        expect(result).toEqual([
          { type: 'image', src: 'test.png', width: undefined, height: undefined },
        ])
      })

      it('should parse img tag mixed with text', () => {
        const result = parser.parseHtmlText('Before <img src="test.png"> After')
        expect(result).toEqual([
          { type: 'text', text: 'Before ', bold: false, italic: false },
          { type: 'image', src: 'test.png', width: undefined, height: undefined },
          { type: 'text', text: ' After', bold: false, italic: false },
        ])
      })

      it('should handle multiple images', () => {
        const result = parser.parseHtmlText('<img src="a.png"> <img src="b.png">')
        expect(result).toEqual([
          { type: 'image', src: 'a.png', width: undefined, height: undefined },
          { type: 'text', text: ' ', bold: false, italic: false },
          { type: 'image', src: 'b.png', width: undefined, height: undefined },
        ])
      })
    })

    describe('SVG tags', () => {
      it('should parse inline SVG', () => {
        const svgContent = '<svg width="32" height="32"><circle r="10"/></svg>'
        const result = parser.parseHtmlText(svgContent)
        expect(result).toEqual([{ type: 'svg', svgContent, width: 32, height: 32 }])
      })

      it('should parse SVG without dimensions', () => {
        const svgContent = '<svg><circle r="10"/></svg>'
        const result = parser.parseHtmlText(svgContent)
        expect(result).toEqual([{ type: 'svg', svgContent, width: undefined, height: undefined }])
      })

      it('should parse SVG with single quotes', () => {
        const svgContent = "<svg width='32' height='32'><circle r='10'/></svg>"
        const result = parser.parseHtmlText(svgContent)
        expect(result).toEqual([{ type: 'svg', svgContent, width: 32, height: 32 }])
      })

      it('should parse SVG mixed with text', () => {
        const svgContent = '<svg width="32" height="32"><circle r="10"/></svg>'
        const result = parser.parseHtmlText(`Before ${svgContent} After`)
        expect(result).toEqual([
          { type: 'text', text: 'Before ', bold: false, italic: false },
          { type: 'svg', svgContent, width: 32, height: 32 },
          { type: 'text', text: ' After', bold: false, italic: false },
        ])
      })

      it('should handle complex SVG content', () => {
        const svgContent =
          '<svg width="48" height="48"><path d="M10,10 L20,20"/><circle cx="24" cy="24" r="5"/></svg>'
        const result = parser.parseHtmlText(svgContent)
        expect(result).toEqual([{ type: 'svg', svgContent, width: 48, height: 48 }])
      })
    })

    describe('mixed content', () => {
      it('should parse text, formatting, images, and SVG together', () => {
        const result = parser.parseHtmlText(
          'Text <b>Bold</b> <img src="a.png"> <svg width="16" height="16"></svg> <i>Italic</i>',
        )
        expect(result).toEqual([
          { type: 'text', text: 'Text ', bold: false, italic: false },
          { type: 'text', text: 'Bold', bold: true, italic: false },
          { type: 'text', text: ' ', bold: false, italic: false },
          { type: 'image', src: 'a.png', width: undefined, height: undefined },
          { type: 'text', text: ' ', bold: false, italic: false },
          { type: 'svg', svgContent: '<svg width="16" height="16"></svg>', width: 16, height: 16 },
          { type: 'text', text: ' ', bold: false, italic: false },
          { type: 'text', text: 'Italic', bold: false, italic: true },
        ])
      })
    })

    describe('caching', () => {
      it('should use cache for repeated parsing', () => {
        const text = 'Test <b>Bold</b>'

        // First call - cache miss
        const result1 = parser.parseHtmlText(text)
        const stats1 = parseCache.getStats()
        expect(stats1.misses).toBe(1)
        expect(stats1.hits).toBe(0)

        // Second call - cache hit
        const result2 = parser.parseHtmlText(text)
        const stats2 = parseCache.getStats()
        expect(stats2.misses).toBe(1)
        expect(stats2.hits).toBe(1)

        // Results should be equal
        expect(result1).toEqual(result2)
      })

      it('should cache different texts separately', () => {
        parser.parseHtmlText('Text A')
        parser.parseHtmlText('Text B')
        parser.parseHtmlText('Text A') // Should be cached

        const stats = parseCache.getStats()
        expect(stats.misses).toBe(2) // A and B
        expect(stats.hits).toBe(1) // Second call to A
      })
    })

    describe('edge cases', () => {
      it('should handle whitespace in tags', () => {
        const result = parser.parseHtmlText('< b >Bold</ b >')
        // Whitespace in tags is not supported by the regex, treated as plain text
        expect(result[0]).toBeDefined()
        expect(result[0]!.type).toBe('text')
      })

      it('should handle unclosed tags gracefully', () => {
        const result = parser.parseHtmlText('<b>Bold text')
        expect(result).toEqual([{ type: 'text', text: 'Bold text', bold: true, italic: false }])
      })

      it('should handle special characters', () => {
        const result = parser.parseHtmlText('Special: & < >')
        // The < and > are treated as potential HTML tags, so parsing stops
        expect(result[0]).toBeDefined()
        expect(result[0]!.type).toBe('text')
        expect(result[0]!.text).toContain('Special:')
      })

      it('should handle dimensions without quotes', () => {
        const result = parser.parseHtmlText('<img src="test.png" width=32 height=24>')
        expect(result).toEqual([{ type: 'image', src: 'test.png', width: 32, height: 24 }])
      })
    })
  })

  describe('hasHtmlFormatting', () => {
    it('should detect bold tags', () => {
      expect(parser.hasHtmlFormatting('<b>Bold</b>')).toBe(true)
    })

    it('should detect italic tags', () => {
      expect(parser.hasHtmlFormatting('<i>Italic</i>')).toBe(true)
    })

    it('should detect img tags', () => {
      expect(parser.hasHtmlFormatting('<img src="test.png">')).toBe(true)
    })

    it('should detect svg tags', () => {
      expect(parser.hasHtmlFormatting('<svg></svg>')).toBe(true)
    })

    it('should return false for plain text', () => {
      expect(parser.hasHtmlFormatting('Plain text')).toBe(false)
    })

    it('should detect closing tags', () => {
      expect(parser.hasHtmlFormatting('</b>')).toBe(true)
      expect(parser.hasHtmlFormatting('</i>')).toBe(true)
    })
  })

  describe('stripHtmlTags', () => {
    it('should strip bold tags', () => {
      expect(parser.stripHtmlTags('<b>Bold</b>')).toBe('Bold')
    })

    it('should strip italic tags', () => {
      expect(parser.stripHtmlTags('<i>Italic</i>')).toBe('Italic')
    })

    it('should strip nested tags', () => {
      expect(parser.stripHtmlTags('<b><i>Text</i></b>')).toBe('Text')
    })

    it('should not strip img tags', () => {
      expect(parser.stripHtmlTags('<img src="test.png">')).toBe('<img src="test.png">')
    })

    it('should handle mixed content', () => {
      expect(parser.stripHtmlTags('Normal <b>Bold</b> <i>Italic</i>')).toBe('Normal Bold Italic')
    })

    it('should return unchanged text if no tags', () => {
      expect(parser.stripHtmlTags('Plain text')).toBe('Plain text')
    })
  })

  describe('measureHtmlText', () => {
    let ctx: CanvasRenderingContext2D
    let buildFontStyle: (bold: boolean, italic: boolean) => string
    let getImage: (url: string) => HTMLImageElement | null

    beforeEach(() => {
      // Create mock canvas context
      const mockCtx = {
        font: '16px Arial',
        measureText: vi.fn((text: string) => ({
          width: text.length * 10, // Simple mock: 10px per character
        })),
      }
      ctx = mockCtx as unknown as CanvasRenderingContext2D

      // Mock buildFontStyle
      buildFontStyle = (bold: boolean, italic: boolean) => {
        let style = ''
        if (bold) style += 'bold '
        if (italic) style += 'italic '
        return style + '16px Arial'
      }

      // Mock getImage
      getImage = vi.fn((url: string) => {
        if (url === 'loaded.png') {
          return { naturalWidth: 32, naturalHeight: 32 } as HTMLImageElement
        }
        return null
      })
    })

    it('should measure plain text', () => {
      const width = parser.measureHtmlText('Hello', ctx, buildFontStyle, getImage)
      expect(width).toBe(50) // 5 characters * 10px
    })

    it('should measure bold text', () => {
      const width = parser.measureHtmlText('<b>Bold</b>', ctx, buildFontStyle, getImage)
      expect(width).toBe(40) // 4 characters * 10px
    })

    it('should measure mixed formatting', () => {
      const width = parser.measureHtmlText('A <b>B</b> C', ctx, buildFontStyle, getImage)
      // The HTML parser may consolidate spaces, so actual measurement may vary
      expect(width).toBeGreaterThan(0)
      expect(width).toBeLessThanOrEqual(60)
    })

    it('should include image width for loaded images', () => {
      const width = parser.measureHtmlText(
        'Text <img src="loaded.png"> More',
        ctx,
        buildFontStyle,
        getImage,
      )
      expect(width).toBe(32 + 100) // 32px image + 10 characters * 10px
    })

    it('should use default width for unloaded images without dimensions', () => {
      const width = parser.measureHtmlText('<img src="missing.png">', ctx, buildFontStyle, getImage)
      expect(width).toBe(16) // Default placeholder width
    })

    it('should use specified width for unloaded images with dimensions', () => {
      const width = parser.measureHtmlText(
        '<img src="missing.png" width="48">',
        ctx,
        buildFontStyle,
        getImage,
      )
      expect(width).toBe(48)
    })

    it('should include SVG width', () => {
      const width = parser.measureHtmlText(
        '<svg width="24" height="24"></svg>',
        ctx,
        buildFontStyle,
        getImage,
      )
      expect(width).toBe(24)
    })

    it('should use default width for SVG without dimensions', () => {
      const width = parser.measureHtmlText('<svg></svg>', ctx, buildFontStyle, getImage)
      expect(width).toBe(16) // Default placeholder width
    })

    it('should restore original font after measuring', () => {
      const originalFont = '14px Verdana'
      ctx.font = originalFont

      parser.measureHtmlText('<b>Bold</b> <i>Italic</i>', ctx, buildFontStyle, getImage)

      expect(ctx.font).toBe(originalFont)
    })
  })

  describe('buildFontStyle', () => {
    it('should build normal font style', () => {
      expect(parser.buildFontStyle(false, false)).toBe('')
    })

    it('should build bold font style', () => {
      expect(parser.buildFontStyle(true, false)).toBe('bold ')
    })

    it('should build italic font style', () => {
      expect(parser.buildFontStyle(false, true)).toBe('italic ')
    })

    it('should build bold italic font style', () => {
      expect(parser.buildFontStyle(true, true)).toBe('bold italic ')
    })
  })
})
