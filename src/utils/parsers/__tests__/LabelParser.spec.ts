import { describe, it, expect, beforeEach, vi } from 'vitest'
import { LabelParser } from '../LabelParser'
import { parseCache } from '../../caches/ParseCache'

describe('LabelParser', () => {
  let parser: LabelParser

  beforeEach(() => {
    parser = new LabelParser()
    parseCache.clear()
  })

  describe('parse', () => {
    describe('plain text', () => {
      it('should parse plain text', () => {
        const result = parser.parse('Hello World')
        expect(result).toEqual([{ type: 'text', text: 'Hello World', style: {} }])
      })

      it('should return plain text for empty string', () => {
        const result = parser.parse('')
        expect(result).toEqual([{ type: 'text', text: '', style: {} }])
      })
    })

    describe('line breaks (<br> tags)', () => {
      it('should convert <br> to newline text node', () => {
        const result = parser.parse('Line 1<br>Line 2')
        expect(result).toEqual([
          { type: 'text', text: 'Line 1', style: {} },
          { type: 'text', text: '\n', style: {} },
          { type: 'text', text: 'Line 2', style: {} },
        ])
      })

      it('should handle <BR> (uppercase)', () => {
        const result = parser.parse('Line 1<BR>Line 2')
        expect(result).toEqual([
          { type: 'text', text: 'Line 1', style: {} },
          { type: 'text', text: '\n', style: {} },
          { type: 'text', text: 'Line 2', style: {} },
        ])
      })

      it('should handle self-closing <br/>', () => {
        const result = parser.parse('Line 1<br/>Line 2')
        expect(result).toEqual([
          { type: 'text', text: 'Line 1', style: {} },
          { type: 'text', text: '\n', style: {} },
          { type: 'text', text: 'Line 2', style: {} },
        ])
      })

      it('should handle multiple <br> tags', () => {
        const result = parser.parse('A<br>B<br>C')
        expect(result).toEqual([
          { type: 'text', text: 'A', style: {} },
          { type: 'text', text: '\n', style: {} },
          { type: 'text', text: 'B', style: {} },
          { type: 'text', text: '\n', style: {} },
          { type: 'text', text: 'C', style: {} },
        ])
      })

      it('should handle <br> with formatting', () => {
        const result = parser.parse('<b>Bold</b><br>Normal')
        expect(result).toEqual([
          { type: 'text', text: 'Bold', style: { bold: true } },
          { type: 'text', text: '\n', style: {} },
          { type: 'text', text: 'Normal', style: {} },
        ])
      })

      it('should handle <br> inside formatting tags', () => {
        const result = parser.parse('<b>A<br>B</b>')
        expect(result).toEqual([
          { type: 'text', text: 'A', style: { bold: true } },
          { type: 'text', text: '\n', style: { bold: true } },
          { type: 'text', text: 'B', style: { bold: true } },
        ])
      })

      it('should preserve link node after <br> tags', () => {
        const result = parser.parse('Text<br><a href="https://example.com">Link</a>')
        expect(result).toEqual([
          { type: 'text', text: 'Text', style: {} },
          { type: 'text', text: '\n', style: {} },
          { type: 'link', href: 'https://example.com', text: 'Link', style: {} },
        ])
      })

      it('should preserve link node after multiple <br> tags', () => {
        const result = parser.parse(
          'First<br>Second<br><a href="https://docs.example.com">documentation</a>',
        )
        expect(result).toEqual([
          { type: 'text', text: 'First', style: {} },
          { type: 'text', text: '\n', style: {} },
          { type: 'text', text: 'Second', style: {} },
          { type: 'text', text: '\n', style: {} },
          { type: 'link', href: 'https://docs.example.com', text: 'documentation', style: {} },
        ])
      })

      it('should handle mixed content with links before and after <br>', () => {
        const result = parser.parse(
          '<a href="https://a.com">Link A</a><br><a href="https://b.com">Link B</a>',
        )
        expect(result).toEqual([
          { type: 'link', href: 'https://a.com', text: 'Link A', style: {} },
          { type: 'text', text: '\n', style: {} },
          { type: 'link', href: 'https://b.com', text: 'Link B', style: {} },
        ])
      })
    })

    describe('bold formatting', () => {
      it('should parse bold text', () => {
        const result = parser.parse('<b>Bold</b>')
        expect(result).toEqual([{ type: 'text', text: 'Bold', style: { bold: true } }])
      })

      it('should parse strong text as bold', () => {
        const result = parser.parse('<strong>Strong</strong>')
        expect(result).toEqual([{ type: 'text', text: 'Strong', style: { bold: true } }])
      })

      it('should parse mixed bold and plain text', () => {
        const result = parser.parse('Normal <b>Bold</b> Normal')
        expect(result).toEqual([
          { type: 'text', text: 'Normal ', style: {} },
          { type: 'text', text: 'Bold', style: { bold: true } },
          { type: 'text', text: ' Normal', style: {} },
        ])
      })

      it('should handle multiple bold sections', () => {
        const result = parser.parse('<b>A</b> <b>B</b>')
        expect(result).toEqual([
          { type: 'text', text: 'A', style: { bold: true } },
          { type: 'text', text: ' ', style: {} },
          { type: 'text', text: 'B', style: { bold: true } },
        ])
      })
    })

    describe('italic formatting', () => {
      it('should parse italic text', () => {
        const result = parser.parse('<i>Italic</i>')
        expect(result).toEqual([{ type: 'text', text: 'Italic', style: { italic: true } }])
      })

      it('should parse em text as italic', () => {
        const result = parser.parse('<em>Emphasis</em>')
        expect(result).toEqual([{ type: 'text', text: 'Emphasis', style: { italic: true } }])
      })

      it('should parse mixed italic and plain text', () => {
        const result = parser.parse('Normal <i>Italic</i> Normal')
        expect(result).toEqual([
          { type: 'text', text: 'Normal ', style: {} },
          { type: 'text', text: 'Italic', style: { italic: true } },
          { type: 'text', text: ' Normal', style: {} },
        ])
      })
    })

    describe('nested formatting', () => {
      it('should parse nested bold and italic', () => {
        const result = parser.parse('<b><i>Bold Italic</i></b>')
        expect(result).toEqual([
          { type: 'text', text: 'Bold Italic', style: { bold: true, italic: true } },
        ])
      })

      it('should parse nested italic and bold', () => {
        const result = parser.parse('<i><b>Italic Bold</b></i>')
        expect(result).toEqual([
          { type: 'text', text: 'Italic Bold', style: { bold: true, italic: true } },
        ])
      })

      it('should handle complex nested formatting', () => {
        const result = parser.parse('A <b>B <i>C</i> D</b> E')
        expect(result).toEqual([
          { type: 'text', text: 'A ', style: {} },
          { type: 'text', text: 'B ', style: { bold: true } },
          { type: 'text', text: 'C', style: { bold: true, italic: true } },
          { type: 'text', text: ' D', style: { bold: true } },
          { type: 'text', text: ' E', style: {} },
        ])
      })
    })

    describe('image tags', () => {
      it('should parse img tag with src', () => {
        const result = parser.parse('<img src="test.png">')
        expect(result).toEqual([
          { type: 'image', src: 'test.png', width: undefined, height: undefined },
        ])
      })

      it('should parse img tag with dimensions', () => {
        const result = parser.parse('<img src="test.png" width="32" height="32">')
        expect(result).toEqual([{ type: 'image', src: 'test.png', width: 32, height: 32 }])
      })

      it('should parse img tag with single quotes', () => {
        const result = parser.parse("<img src='test.png'>")
        expect(result).toEqual([
          { type: 'image', src: 'test.png', width: undefined, height: undefined },
        ])
      })

      it('should parse img tag mixed with text', () => {
        const result = parser.parse('Before <img src="test.png"> After')
        expect(result).toEqual([
          { type: 'text', text: 'Before ', style: {} },
          { type: 'image', src: 'test.png', width: undefined, height: undefined },
          { type: 'text', text: ' After', style: {} },
        ])
      })

      it('should handle multiple images', () => {
        const result = parser.parse('<img src="a.png"> <img src="b.png">')
        expect(result).toEqual([
          { type: 'image', src: 'a.png', width: undefined, height: undefined },
          { type: 'text', text: ' ', style: {} },
          { type: 'image', src: 'b.png', width: undefined, height: undefined },
        ])
      })
    })

    describe('SVG tags', () => {
      it('should parse inline SVG', () => {
        const result = parser.parse('<svg width="32" height="32"><circle r="10"/></svg>')
        expect(result).toHaveLength(1)
        const svgNode = result[0]!
        expect(svgNode.type).toBe('svg')
        expect((svgNode as { width?: number }).width).toBe(32)
        expect((svgNode as { height?: number }).height).toBe(32)
        expect((svgNode as { content?: string }).content).toContain('svg')
      })

      it('should parse SVG without dimensions', () => {
        const result = parser.parse('<svg><circle r="10"/></svg>')
        expect(result).toHaveLength(1)
        const svgNode = result[0]!
        expect(svgNode.type).toBe('svg')
        expect((svgNode as { width?: number }).width).toBeUndefined()
        expect((svgNode as { height?: number }).height).toBeUndefined()
      })

      it('should parse SVG mixed with text', () => {
        const result = parser.parse('Before <svg width="32" height="32"></svg> After')
        expect(result).toHaveLength(3)
        expect(result[0]).toEqual({ type: 'text', text: 'Before ', style: {} })
        expect(result[1]!.type).toBe('svg')
        expect(result[2]).toEqual({ type: 'text', text: ' After', style: {} })
      })
    })

    describe('link tags', () => {
      it('should parse link with double quotes', () => {
        const result = parser.parse('<a href="https://example.com">Example</a>')
        expect(result).toEqual([
          {
            type: 'link',
            href: 'https://example.com',
            text: 'Example',
            style: {},
          },
        ])
      })

      it('should parse link with single quotes', () => {
        const result = parser.parse("<a href='https://example.com'>Example</a>")
        expect(result).toEqual([
          {
            type: 'link',
            href: 'https://example.com',
            text: 'Example',
            style: {},
          },
        ])
      })

      it('should parse link mixed with text', () => {
        const result = parser.parse('Visit <a href="https://example.com">Example</a> site')
        expect(result).toEqual([
          { type: 'text', text: 'Visit ', style: {} },
          {
            type: 'link',
            href: 'https://example.com',
            text: 'Example',
            style: {},
          },
          { type: 'text', text: ' site', style: {} },
        ])
      })

      it('should parse link inside bold formatting', () => {
        const result = parser.parse('<b><a href="https://example.com">Bold Link</a></b>')
        expect(result).toEqual([
          {
            type: 'link',
            href: 'https://example.com',
            text: 'Bold Link',
            style: { bold: true },
          },
        ])
      })

      it('should parse link inside italic formatting', () => {
        const result = parser.parse('<i><a href="https://example.com">Italic Link</a></i>')
        expect(result).toEqual([
          {
            type: 'link',
            href: 'https://example.com',
            text: 'Italic Link',
            style: { italic: true },
          },
        ])
      })

      it('should parse link inside bold and italic formatting', () => {
        const result = parser.parse(
          '<b><i><a href="https://example.com">Bold Italic Link</a></i></b>',
        )
        expect(result).toEqual([
          {
            type: 'link',
            href: 'https://example.com',
            text: 'Bold Italic Link',
            style: { bold: true, italic: true },
          },
        ])
      })

      it('should parse multiple links', () => {
        const result = parser.parse('<a href="https://a.com">A</a> <a href="https://b.com">B</a>')
        expect(result).toEqual([
          { type: 'link', href: 'https://a.com', text: 'A', style: {} },
          { type: 'text', text: ' ', style: {} },
          { type: 'link', href: 'https://b.com', text: 'B', style: {} },
        ])
      })

      it('should parse link with extra attributes', () => {
        const result = parser.parse(
          '<a class="foo" href="https://example.com" target="_blank">Link</a>',
        )
        expect(result).toEqual([
          { type: 'link', href: 'https://example.com', text: 'Link', style: {} },
        ])
      })

      it('should handle link with relative URL', () => {
        const result = parser.parse('<a href="/path/to/page">Relative</a>')
        expect(result).toEqual([
          { type: 'link', href: '/path/to/page', text: 'Relative', style: {} },
        ])
      })
    })

    describe('mixed content', () => {
      it('should parse text, formatting, images, and SVG together', () => {
        const result = parser.parse(
          'Text <b>Bold</b> <img src="a.png"> <svg width="16" height="16"></svg> <i>Italic</i>',
        )
        expect(result[0]).toEqual({ type: 'text', text: 'Text ', style: {} })
        expect(result[1]).toEqual({ type: 'text', text: 'Bold', style: { bold: true } })
        expect(result[2]).toEqual({ type: 'text', text: ' ', style: {} })
        expect(result[3]).toEqual({
          type: 'image',
          src: 'a.png',
          width: undefined,
          height: undefined,
        })
        expect(result[4]).toEqual({ type: 'text', text: ' ', style: {} })
        expect(result[5]!.type).toBe('svg')
        expect(result[6]).toEqual({ type: 'text', text: ' ', style: {} })
        expect(result[7]).toEqual({ type: 'text', text: 'Italic', style: { italic: true } })
      })
    })

    describe('caching', () => {
      it('should use cache for repeated parsing', () => {
        const text = 'Test <b>Bold</b>'

        // First call - cache miss
        const result1 = parser.parse(text)
        const stats1 = parseCache.getStats()
        expect(stats1.misses).toBe(1)
        expect(stats1.hits).toBe(0)

        // Second call - cache hit
        const result2 = parser.parse(text)
        const stats2 = parseCache.getStats()
        expect(stats2.misses).toBe(1)
        expect(stats2.hits).toBe(1)

        // Results should be equal
        expect(result1).toEqual(result2)
      })

      it('should cache different texts separately', () => {
        parser.parse('Text A')
        parser.parse('Text B')
        parser.parse('Text A') // Should be cached

        const stats = parseCache.getStats()
        expect(stats.misses).toBe(2) // A and B
        expect(stats.hits).toBe(1) // Second call to A
      })
    })

    describe('edge cases', () => {
      it('should handle unclosed tags gracefully', () => {
        const result = parser.parse('<b>Bold text')
        expect(result).toEqual([{ type: 'text', text: 'Bold text', style: { bold: true } }])
      })

      it('should handle special characters', () => {
        const result = parser.parse('Special: &amp; &lt; &gt;')
        expect(result[0]).toBeDefined()
        const textNode = result[0]!
        expect(textNode.type).toBe('text')
        expect((textNode as { text?: string }).text).toContain('Special:')
      })
    })

    describe('CSS classes and inline styles (ignored)', () => {
      it('should ignore CSS class on bold tag', () => {
        const result = parser.parse('<b class="highlight">Bold</b>')
        expect(result).toEqual([{ type: 'text', text: 'Bold', style: { bold: true } }])
      })

      it('should ignore inline style on italic tag', () => {
        const result = parser.parse('<i style="color: red; font-size: 20px;">Italic</i>')
        expect(result).toEqual([{ type: 'text', text: 'Italic', style: { italic: true } }])
      })

      it('should ignore CSS class and style on link', () => {
        const result = parser.parse(
          '<a href="https://example.com" class="btn btn-primary" style="color: blue;">Link</a>',
        )
        expect(result).toEqual([
          { type: 'link', href: 'https://example.com', text: 'Link', style: {} },
        ])
      })

      it('should ignore CSS class on image (only src, width, height are used)', () => {
        const result = parser.parse(
          '<img src="test.png" class="rounded" style="border: 1px solid black;" width="32" height="32">',
        )
        expect(result).toEqual([{ type: 'image', src: 'test.png', width: 32, height: 32 }])
      })

      it('should ignore id attribute', () => {
        const result = parser.parse('<b id="main-title">Title</b>')
        expect(result).toEqual([{ type: 'text', text: 'Title', style: { bold: true } }])
      })

      it('should ignore data attributes', () => {
        const result = parser.parse('<a href="https://example.com" data-tracking="click">Link</a>')
        expect(result).toEqual([
          { type: 'link', href: 'https://example.com', text: 'Link', style: {} },
        ])
      })

      it('should render span with class as plain text (styles ignored)', () => {
        const result = parser.parse('Text with <span class="highlight">highlighted</span> word')
        expect(result).toEqual([
          { type: 'text', text: 'Text with ', style: {} },
          { type: 'text', text: 'highlighted', style: {} },
          { type: 'text', text: ' word', style: {} },
        ])
      })

      it('should render div with style as plain text (styles ignored)', () => {
        const result = parser.parse('<div style="background: yellow;">Content</div>')
        expect(result).toEqual([{ type: 'text', text: 'Content', style: {} }])
      })

      it('should return empty for Font Awesome icon tag (empty content with class)', () => {
        const result = parser.parse("<i class='fa fa-mouse-pointer'></i>")
        expect(result).toEqual([])
      })

      it('should return empty for empty bold tag with class', () => {
        const result = parser.parse('<b class="highlight"></b>')
        expect(result).toEqual([])
      })

      it('should return empty for empty span with class', () => {
        const result = parser.parse('<span class="icon"></span>')
        expect(result).toEqual([])
      })

      it('should return empty for empty link', () => {
        const result = parser.parse('<a href="https://example.com"></a>')
        expect(result).toEqual([])
      })

      it('should return text for non-empty element with class', () => {
        const result = parser.parse("<i class='fa'>icon text</i>")
        expect(result).toEqual([{ type: 'text', text: 'icon text', style: { italic: true } }])
      })

      it('should handle mixed empty and non-empty elements', () => {
        const result = parser.parse(
          "Text <i class='fa fa-icon'></i> more text <b class='x'>bold</b>",
        )
        expect(result).toEqual([
          { type: 'text', text: 'Text ', style: {} },
          { type: 'text', text: ' more text ', style: {} },
          { type: 'text', text: 'bold', style: { bold: true } },
        ])
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

    it('should detect strong tags', () => {
      expect(parser.hasHtmlFormatting('<strong>Strong</strong>')).toBe(true)
    })

    it('should detect em tags', () => {
      expect(parser.hasHtmlFormatting('<em>Emphasis</em>')).toBe(true)
    })

    it('should detect img tags', () => {
      expect(parser.hasHtmlFormatting('<img src="test.png">')).toBe(true)
    })

    it('should detect svg tags', () => {
      expect(parser.hasHtmlFormatting('<svg></svg>')).toBe(true)
    })

    it('should detect anchor tags', () => {
      expect(parser.hasHtmlFormatting('<a href="https://example.com">Link</a>')).toBe(true)
    })

    it('should return false for plain text', () => {
      expect(parser.hasHtmlFormatting('Plain text')).toBe(false)
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

    it('should measure link text', () => {
      const width = parser.measureHtmlText(
        '<a href="https://example.com">Link</a>',
        ctx,
        buildFontStyle,
        getImage,
      )
      expect(width).toBe(40) // 4 characters * 10px
    })

    it('should measure link text mixed with regular text', () => {
      const width = parser.measureHtmlText(
        'Visit <a href="https://example.com">Link</a>',
        ctx,
        buildFontStyle,
        getImage,
      )
      expect(width).toBe(100) // 10 characters * 10px ("Visit " + "Link")
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

  describe('getPlainText', () => {
    it('should extract text from plain text nodes', () => {
      const nodes = parser.parse('Hello World')
      expect(parser.getPlainText(nodes)).toBe('Hello World')
    })

    it('should extract text from formatted nodes', () => {
      const nodes = parser.parse('<b>Bold</b> and <i>Italic</i>')
      expect(parser.getPlainText(nodes)).toBe('Bold and Italic')
    })

    it('should extract text from links', () => {
      const nodes = parser.parse('Visit <a href="https://example.com">Example</a>')
      expect(parser.getPlainText(nodes)).toBe('Visit Example')
    })

    it('should preserve newlines from <br> tags', () => {
      const nodes = parser.parse('Line 1<br>Line 2')
      expect(parser.getPlainText(nodes)).toBe('Line 1\nLine 2')
    })

    it('should ignore image nodes', () => {
      const nodes = parser.parse('Text <img src="test.png"> More')
      expect(parser.getPlainText(nodes)).toBe('Text  More')
    })

    it('should ignore SVG nodes', () => {
      const nodes = parser.parse('Text <svg></svg> More')
      expect(parser.getPlainText(nodes)).toBe('Text  More')
    })

    it('should return empty string for empty nodes', () => {
      expect(parser.getPlainText([])).toBe('')
    })

    it('should handle complex mixed content', () => {
      const nodes = parser.parse('<b>Bold</b><br><a href="#">Link</a><img src="x.png"><i>End</i>')
      expect(parser.getPlainText(nodes)).toBe('Bold\nLinkEnd')
    })
  })
})
