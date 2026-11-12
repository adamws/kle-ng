import { describe, it, expect, vi, afterEach } from 'vitest'
import { SvgLayoutRenderer } from '../SvgLayoutRenderer'
import type { LayoutRenderInput, LabelData } from '../LayoutRendererTypes'

const singleKey = {
  left: 0,
  top: 0,
  width: 54,
  height: 54,
  labels: [] as LabelData[],
  rotationAngle: 0,
  rotationOriginX: 0,
  rotationOriginY: 0,
  darkColor: '#cccccc',
  lightColor: '#f0f0f0',
}

const makeLabel = (overrides: Partial<LabelData> = {}): LabelData => ({
  text: 'A',
  fontSize: 12,
  color: '#111827',
  align: 'left',
  baseline: 'hanging',
  relX: 9,
  relY: 8,
  maxWidth: 38,
  maxHeight: 36,
  ...overrides,
})

const makeInput = (overrides: Partial<LayoutRenderInput> = {}): LayoutRenderInput => ({
  layoutName: 'Test Board',
  author: 'Jane Doe',
  backColor: '#cccccc',
  radiiValue: '8px',
  unit: 54,
  boardWidth: 162,
  boardHeight: 54,
  keys: [
    {
      left: 0,
      top: 0,
      width: 54,
      height: 54,
      labels: [makeLabel({ text: 'A', color: '#111827' })],
      rotationAngle: 0,
      rotationOriginX: 0,
      rotationOriginY: 0,
      darkColor: '#cccccc',
      lightColor: '#f0f0f0',
    },
    {
      left: 54,
      top: 0,
      width: 54,
      height: 54,
      labels: [
        makeLabel({ text: 'B', color: '#111827' }),
        makeLabel({ text: 'fn', color: '#111827', relY: 40, baseline: 'alphabetic' }),
      ],
      rotationAngle: 0,
      rotationOriginX: 0,
      rotationOriginY: 0,
      darkColor: '#aaaaaa',
      lightColor: '#dddddd',
    },
    {
      left: 108,
      top: 0,
      width: 54,
      height: 54,
      labels: [],
      rotationAngle: 0,
      rotationOriginX: 0,
      rotationOriginY: 0,
      darkColor: '#cccccc',
      lightColor: '#f0f0f0',
    },
  ],
  ...overrides,
})

describe('SvgLayoutRenderer', () => {
  const renderer = new SvgLayoutRenderer()

  afterEach(() => {
    vi.unstubAllGlobals()
    // Reset cached measureCtx between tests that stub document
    ;(renderer as unknown as { _measureCtx: unknown })._measureCtx = undefined
  })

  it('output starts with <?xml declaration', () => {
    const svg = renderer.render(makeInput())
    expect(svg.trimStart()).toMatch(/^<\?xml/)
  })

  it('contains an <svg> element with correct dimensions', () => {
    const svg = renderer.render(makeInput())
    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"')
    expect(svg).toContain('width="162" height="54"')
    expect(svg).toContain('viewBox="0 0 162 54"')
  })

  it('SVG root has overflow="visible"', () => {
    const svg = renderer.render(makeInput())
    expect(svg).toContain('overflow="visible"')
  })

  it('contains <title> with the layout name', () => {
    const svg = renderer.render(makeInput({ layoutName: 'My Board' }))
    expect(svg).toContain('<title>My Board</title>')
  })

  it('escapes HTML special chars in <title>', () => {
    const svg = renderer.render(makeInput({ layoutName: '<script>alert(1)</script>' }))
    expect(svg).toContain('&lt;script&gt;')
    expect(svg).not.toContain('<script>alert(1)</script>')
  })

  it('renders board background <rect> with backColor and parsed rx', () => {
    const svg = renderer.render(makeInput())
    // radiiValue '8px' → rx="8"
    expect(svg).toContain('fill="#cccccc"')
    expect(svg).toContain('rx="8"')
    expect(svg).toContain(`width="162" height="54" fill="#cccccc" rx="8"`)
  })

  it('renders one <g> per key', () => {
    const svg = renderer.render(makeInput())
    // Non-rotated keys use <g> without transform; match opening <g> tags
    const groupCount = (svg.match(/<g[\s>]/g) ?? []).length
    expect(groupCount).toBe(3)
  })

  it('each key group has an outer rect with darkColor and black stroke', () => {
    const svg = renderer.render(makeInput())
    expect(svg).toContain('fill="#cccccc" stroke="#000000" stroke-width="1"')
    expect(svg).toContain('fill="#aaaaaa" stroke="#000000" stroke-width="1"')
  })

  it('each key group has an inner rect with lightColor', () => {
    const svg = renderer.render(makeInput())
    expect(svg).toContain('fill="#f0f0f0" rx="3"')
    expect(svg).toContain('fill="#dddddd" rx="3"')
  })

  it('renders outer rect with 0.5px offset for crisp borders', () => {
    // Key at left=0: outer rect x should be 0.5
    const svg = renderer.render(makeInput())
    expect(svg).toContain('x="0.5" y="0.5"')
  })

  it('renders inner rect with correct bevel offsets (left+6, top+3, width-12, height-12)', () => {
    // Key at left=0, top=0, width=54, height=54:
    // inner: x=6, y=3, width=42, height=42
    const svg = renderer.render(makeInput())
    expect(svg).toContain('x="6" y="3" width="42" height="42"')
  })

  it('renders <text> for non-empty label with correct fill and text-anchor', () => {
    const svg = renderer.render(makeInput())
    expect(svg).toContain('>A<')
    expect(svg).toContain('>B<')
    expect(svg).toContain('fill="#111827"')
    expect(svg).toContain('text-anchor="start"')
  })

  it('top label (hanging) y = keyTop + relY (no offset)', () => {
    // Label at relY=4, baseline=hanging, fontSize=12, keyTop=0
    // dominant-baseline="hanging" maps Y to the top of the em box → startY = 0 + 4 = 4
    const input = makeInput({
      keys: [
        {
          left: 0,
          top: 0,
          width: 54,
          height: 54,
          labels: [makeLabel({ relY: 4, baseline: 'hanging', fontSize: 12 })],
          rotationAngle: 0,
          rotationOriginX: 0,
          rotationOriginY: 0,
          darkColor: '#cccccc',
          lightColor: '#f0f0f0',
        },
      ],
    })
    const svg = renderer.render(input)
    expect(svg).toContain('y="4"')
    expect(svg).toContain('dominant-baseline="hanging"')
  })

  it('bottom label (alphabetic) y = keyTop + relY for single line', () => {
    // Label at relY=40, baseline=alphabetic, fontSize=12, keyTop=0, single line
    // dominant-baseline="auto" maps Y to the alphabetic baseline directly → startY = 0 + 40 = 40
    const input = makeInput({
      keys: [
        {
          left: 0,
          top: 0,
          width: 54,
          height: 54,
          labels: [makeLabel({ relY: 40, baseline: 'alphabetic', fontSize: 12 })],
          rotationAngle: 0,
          rotationOriginX: 0,
          rotationOriginY: 0,
          darkColor: '#cccccc',
          lightColor: '#f0f0f0',
        },
      ],
    })
    const svg = renderer.render(input)
    expect(svg).toContain('y="40"')
    expect(svg).toContain('dominant-baseline="auto"')
  })

  it('renders <text> for bottom label', () => {
    const svg = renderer.render(makeInput())
    expect(svg).toContain('>fn<')
  })

  it('keys with labels: [] produce no <text> elements', () => {
    const input = makeInput({
      keys: [
        {
          left: 0,
          top: 0,
          width: 54,
          height: 54,
          labels: [],
          rotationAngle: 0,
          rotationOriginX: 0,
          rotationOriginY: 0,
          darkColor: '#cccccc',
          lightColor: '#f0f0f0',
        },
      ],
    })
    const svg = renderer.render(input)
    expect(svg).not.toContain('<text')
  })

  it('center-aligned label → text-anchor="middle"', () => {
    const input = makeInput({
      keys: [
        {
          left: 0,
          top: 0,
          width: 54,
          height: 54,
          labels: [makeLabel({ align: 'center', relX: 27 })],
          rotationAngle: 0,
          rotationOriginX: 0,
          rotationOriginY: 0,
          darkColor: '#cccccc',
          lightColor: '#f0f0f0',
        },
      ],
    })
    const svg = renderer.render(input)
    expect(svg).toContain('text-anchor="middle"')
  })

  it('rotated key → key <g> has transform="rotate(...)"', () => {
    const input = makeInput({
      keys: [
        {
          left: 0,
          top: 0,
          width: 54,
          height: 54,
          labels: [],
          rotationAngle: 15,
          rotationOriginX: 54,
          rotationOriginY: 54,
          darkColor: '#cccccc',
          lightColor: '#f0f0f0',
        },
      ],
    })
    const svg = renderer.render(input)
    expect(svg).toContain('transform="rotate(15, 54, 54)"')
  })

  it('non-rotated key → key <g> has no transform attribute', () => {
    const svg = renderer.render(makeInput())
    // All keys in makeInput are non-rotated → <g> with no transform
    expect(svg).toContain('<g>')
    expect(svg).not.toContain('transform="rotate')
  })

  it('handles empty keys array gracefully', () => {
    const svg = renderer.render(makeInput({ keys: [] }))
    expect(svg).toContain('<svg')
    expect(svg).not.toContain('<g')
  })

  it('parses leading integer from radiiValue for board rx', () => {
    const svg = renderer.render(makeInput({ radiiValue: '12px' }))
    expect(svg).toContain('rx="12"')
  })

  it('falls back to rx=0 when radiiValue is not parseable', () => {
    const svg = renderer.render(makeInput({ radiiValue: 'round' }))
    expect(svg).toContain('rx="0"')
  })

  it('multi-word label in narrow key → output contains multiple <tspan>', () => {
    // Mock document.createElement to return a canvas with measureText
    // Each character counts as 8px wide, so "Hello World" = 88px > maxWidth=38px
    vi.stubGlobal('document', {
      createElement: () => ({
        getContext: () => ({
          measureText: (text: string) => ({ width: text.length * 8 }),
          font: '',
        }),
      }),
    })
    ;(renderer as unknown as { _measureCtx: unknown })._measureCtx = undefined

    const input = makeInput({
      keys: [
        {
          left: 0,
          top: 0,
          width: 54,
          height: 54,
          labels: [makeLabel({ text: 'Hello World', maxWidth: 38 })],
          rotationAngle: 0,
          rotationOriginX: 0,
          rotationOriginY: 0,
          darkColor: '#cccccc',
          lightColor: '#f0f0f0',
        },
      ],
    })
    const svg = renderer.render(input)
    expect(svg).toContain('<tspan')
  })

  describe('ghost key', () => {
    it('renders with opacity="0.3"', () => {
      const input = makeInput({
        keys: [
          {
            left: 0,
            top: 0,
            width: 54,
            height: 54,
            labels: [],
            rotationAngle: 0,
            rotationOriginX: 0,
            rotationOriginY: 0,
            darkColor: '#cccccc',
            lightColor: '#f0f0f0',
            ghost: true,
          },
        ],
      })
      const svg = renderer.render(input)
      expect(svg).toContain('opacity="0.3"')
    })
  })

  describe('decal key', () => {
    it('renders no <rect inside key group', () => {
      const input = makeInput({
        keys: [
          {
            left: 0,
            top: 0,
            width: 54,
            height: 54,
            labels: [makeLabel({ text: 'Decal' })],
            rotationAngle: 0,
            rotationOriginX: 0,
            rotationOriginY: 0,
            darkColor: '#cccccc',
            lightColor: '#f0f0f0',
            decal: true,
          },
        ],
      })
      const svg = renderer.render(input)
      // Board background rect still exists, but no key rect
      const rectCount = (svg.match(/<rect/g) ?? []).length
      expect(rectCount).toBe(1) // only the board background rect
    })

    it('still renders labels', () => {
      const input = makeInput({
        keys: [
          {
            left: 0,
            top: 0,
            width: 54,
            height: 54,
            labels: [makeLabel({ text: 'Decal' })],
            rotationAngle: 0,
            rotationOriginX: 0,
            rotationOriginY: 0,
            darkColor: '#cccccc',
            lightColor: '#f0f0f0',
            decal: true,
          },
        ],
      })
      const svg = renderer.render(input)
      expect(svg).toContain('>Decal<')
    })
  })

  describe('homing nub key', () => {
    it('renders a nub rect with fill="rgba(0,0,0,0.3)"', () => {
      const input = makeInput({
        keys: [
          {
            left: 0,
            top: 0,
            width: 54,
            height: 54,
            labels: [],
            rotationAngle: 0,
            rotationOriginX: 0,
            rotationOriginY: 0,
            darkColor: '#cccccc',
            lightColor: '#f0f0f0',
            nub: true,
          },
        ],
      })
      const svg = renderer.render(input)
      expect(svg).toContain('fill="rgba(0,0,0,0.3)"')
    })
  })

  describe('rotary encoder key', () => {
    it('renders <circle elements instead of key <rect', () => {
      const input = makeInput({
        keys: [
          {
            left: 0,
            top: 0,
            width: 54,
            height: 54,
            labels: [],
            rotationAngle: 0,
            rotationOriginX: 0,
            rotationOriginY: 0,
            darkColor: '#cccccc',
            lightColor: '#f0f0f0',
            isRotaryEncoder: true,
          },
        ],
      })
      const svg = renderer.render(input)
      expect(svg).toContain('<circle')
      // Only the board background rect should remain
      const rectCount = (svg.match(/<rect/g) ?? []).length
      expect(rectCount).toBe(1)
    })

    it('outer circle has correct cx, cy, r', () => {
      // left=0, top=0, width=54 → cx=27, cy=27, r=27
      const input = makeInput({
        keys: [
          {
            left: 0,
            top: 0,
            width: 54,
            height: 54,
            labels: [],
            rotationAngle: 0,
            rotationOriginX: 0,
            rotationOriginY: 0,
            darkColor: '#cccccc',
            lightColor: '#f0f0f0',
            isRotaryEncoder: true,
          },
        ],
      })
      const svg = renderer.render(input)
      expect(svg).toContain('cx="27" cy="27" r="27"')
    })
  })

  describe('entity decoding', () => {
    it('renders &#96; label as a backtick, not as &amp;#96;', () => {
      const svg = renderer.render(
        makeInput({
          keys: [{ ...singleKey, labels: [makeLabel({ text: '&#96;' })] }],
        }),
      )
      expect(svg).not.toContain('&amp;#96;')
      expect(svg).not.toContain('&#96;') // should be decoded to literal `
    })
  })

  describe('formatted labels', () => {
    it('renders <b> label with font-weight="bold"', () => {
      const svg = renderer.render(
        makeInput({
          keys: [{ ...singleKey, labels: [makeLabel({ text: '<b>Bold</b>' })] }],
        }),
      )
      expect(svg).toContain('font-weight="bold"')
      expect(svg).toContain('>Bold<')
      expect(svg).not.toContain('&lt;b&gt;')
    })

    it('renders <i> label with font-style="italic"', () => {
      const svg = renderer.render(
        makeInput({
          keys: [{ ...singleKey, labels: [makeLabel({ text: '<i>Italic</i>' })] }],
        }),
      )
      expect(svg).toContain('font-style="italic"')
      expect(svg).toContain('>Italic<')
    })

    it('renders <em>/<strong> the same as <i>/<b>', () => {
      const svg = renderer.render(
        makeInput({
          keys: [{ ...singleKey, labels: [makeLabel({ text: '<strong>S</strong>' })] }],
        }),
      )
      expect(svg).toContain('font-weight="bold"')
    })
  })

  describe('SVG-only labels', () => {
    it('renders SVG label as <image> with data URL', () => {
      const svgLabel =
        '<svg width="16" height="16" xmlns="http://www.w3.org/2000/svg"><circle cx="8" cy="8" r="8"/></svg>'
      const svg = renderer.render(
        makeInput({
          keys: [{ ...singleKey, labels: [makeLabel({ text: svgLabel })] }],
        }),
      )
      expect(svg).toContain('<image')
      expect(svg).toContain('data:image/svg+xml')
      expect(svg).not.toContain('&lt;svg')
    })

    it('respects SVG dimensions for width/height attributes', () => {
      const svgLabel = '<svg width="20" height="30" xmlns="http://www.w3.org/2000/svg"></svg>'
      const svg = renderer.render(
        makeInput({
          keys: [
            {
              ...singleKey,
              labels: [makeLabel({ text: svgLabel, maxWidth: 100, maxHeight: 100 })],
            },
          ],
        }),
      )
      expect(svg).toContain('width="20"')
      expect(svg).toContain('height="30"')
    })
  })

  describe('non-rectangular key', () => {
    const makeNonRectInput = () =>
      makeInput({
        keys: [
          {
            left: 9,
            top: 9,
            width: 67,
            height: 108,
            labels: [],
            rotationAngle: 0,
            rotationOriginX: 0,
            rotationOriginY: 0,
            darkColor: '#cccccc',
            lightColor: '#f0f0f0',
            left2: 9,
            top2: 9,
            width2: 81,
            height2: 54,
          },
        ],
      })

    it('renders polygon union as two <path elements (outer + inner) instead of four <rect', () => {
      const svg = renderer.render(makeNonRectInput())
      // Only the board background rect should remain; key is rendered as <path
      const rectCount = (svg.match(/<rect/g) ?? []).length
      expect(rectCount).toBe(1)
      const pathCount = (svg.match(/<path/g) ?? []).length
      expect(pathCount).toBe(2) // outer union path + inner union path
    })

    it('outer union path has darkColor fill and black stroke', () => {
      const svg = renderer.render(makeNonRectInput())
      expect(svg).toContain('fill="#cccccc" stroke="#000000" stroke-width="1"')
    })

    it('inner union path has lightColor fill and no stroke', () => {
      const svg = renderer.render(makeNonRectInput())
      expect(svg).toContain('fill="#f0f0f0"')
      // The inner path should not have a stroke
      const innerPath = svg.match(/<path d="[^"]*" fill="#f0f0f0"[^/]*/)?.[0] ?? ''
      expect(innerPath).not.toContain('stroke=')
    })
  })

  describe('stepped key', () => {
    // Stepped caps lock: raised 1.25u top, lower step out to 1.75u
    const makeSteppedInput = () =>
      makeInput({
        keys: [
          {
            left: 9,
            top: 9,
            width: 67.5,
            height: 54,
            labels: [],
            rotationAngle: 0,
            rotationOriginX: 0,
            rotationOriginY: 0,
            darkColor: '#cccccc',
            lightColor: '#f0f0f0',
            left2: 9,
            top2: 9,
            width2: 94.5,
            height2: 54,
            stepped: true,
          },
        ],
      })

    it('outlines both rects but draws the light top only on the raised (primary) rect', () => {
      const svg = renderer.render(makeSteppedInput())
      const outer = svg.match(/<path d="[^"]*" fill="#cccccc" stroke="#000000"/g) ?? []
      expect(outer).toHaveLength(1)
      const lightFills = svg.match(/<(rect|path)[^>]*fill="#f0f0f0"[^>]*>/g) ?? []
      expect(lightFills).toHaveLength(1)
      // Inner rect of the primary 67.5px rect, never stretched over the 94.5px step
      const w = Number(lightFills[0]!.match(/width="([\d.]+)"/)?.[1])
      expect(w).toBeLessThan(67.5)
    })
  })
})
