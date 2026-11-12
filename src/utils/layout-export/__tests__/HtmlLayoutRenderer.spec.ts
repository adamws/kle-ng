import { describe, it, expect } from 'vitest'
import { HtmlLayoutRenderer } from '../HtmlLayoutRenderer'
import type { LayoutRenderInput, LabelData } from '../LayoutRendererTypes'

const makeLabel = (overrides: Partial<LabelData> = {}): LabelData => ({
  text: 'A',
  fontSize: 12,
  color: '#000000',
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
      labels: [makeLabel({ text: 'A' })],
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
        makeLabel({ text: 'B' }),
        makeLabel({ text: 'fn', relY: 46, baseline: 'alphabetic', align: 'left' }),
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

describe('HtmlLayoutRenderer', () => {
  const renderer = new HtmlLayoutRenderer()

  it('returns a string starting with <!DOCTYPE html>', () => {
    const html = renderer.render(makeInput())
    expect(html.trimStart()).toMatch(/^<!DOCTYPE html>/)
  })

  it('includes the layout name in the <title>', () => {
    const html = renderer.render(makeInput({ layoutName: 'My Keyboard' }))
    expect(html).toContain('<title>My Keyboard</title>')
  })

  it('escapes HTML special chars in the title', () => {
    const html = renderer.render(makeInput({ layoutName: '<script>alert(1)</script>' }))
    expect(html).toContain('&lt;script&gt;')
    expect(html).not.toContain('<script>alert(1)</script>')
  })

  it('renders the layout name as an h1', () => {
    const html = renderer.render(makeInput({ layoutName: 'My Board' }))
    expect(html).toContain('<h1 class="keyboard-title">My Board</h1>')
  })

  it('omits the h1 when layoutName is empty', () => {
    const html = renderer.render(makeInput({ layoutName: '' }))
    expect(html).not.toContain('<h1 class="keyboard-title">')
  })

  it('renders the author paragraph', () => {
    const html = renderer.render(makeInput({ author: 'Jane Doe' }))
    expect(html).toContain('<p class="keyboard-author">by Jane Doe</p>')
  })

  it('omits the author paragraph when author is empty', () => {
    const html = renderer.render(makeInput({ author: '' }))
    expect(html).not.toContain('<p class="keyboard-author">')
  })

  it('reflects backColor in the CSS board rule', () => {
    const html = renderer.render(makeInput({ backColor: '#ff0000' }))
    expect(html).toContain('background: #ff0000')
  })

  it('reflects radiiValue in the CSS board rule', () => {
    const html = renderer.render(makeInput({ radiiValue: '12px' }))
    expect(html).toContain('border-radius: 12px')
  })

  it('reflects unit in CSS variables', () => {
    const html = renderer.render(makeInput({ unit: 60 }))
    expect(html).toContain('--unit: 60px')
  })

  it('reflects boardWidth and boardHeight in CSS variables', () => {
    const html = renderer.render(makeInput({ boardWidth: 300, boardHeight: 100 }))
    expect(html).toContain('--board-width: 300px')
    expect(html).toContain('--board-height: 100px')
  })

  it('renders a .key div for each key', () => {
    const html = renderer.render(makeInput())
    const keyDivCount = (html.match(/class="key"/g) ?? []).length
    expect(keyDivCount).toBe(3)
  })

  it('renders a .key-inner div inside each .key', () => {
    const html = renderer.render(makeInput())
    const innerCount = (html.match(/class="key-inner"/g) ?? []).length
    expect(innerCount).toBe(3)
  })

  it('renders key position and size as inline styles on .key (width+1, height+1 for border overlap)', () => {
    const html = renderer.render(makeInput())
    // Each key is rendered 1px wider and taller than its nominal grid size so
    // adjacent keys' inset box-shadows overlap — producing a single 1px border.
    expect(html).toContain('left:0px;top:0px;width:55px;height:55px')
    expect(html).toContain('left:54px;top:0px;width:55px;height:55px')
  })

  it('renders darkColor as background on .key outer div', () => {
    const html = renderer.render(makeInput())
    expect(html).toContain('background:#cccccc')
    expect(html).toContain('background:#aaaaaa')
  })

  it('renders lightColor as background on .key-inner div', () => {
    const html = renderer.render(makeInput())
    expect(html).toContain('background:#f0f0f0')
    expect(html).toContain('background:#dddddd')
  })

  it('does not contain --key-bg CSS variable', () => {
    const html = renderer.render(makeInput())
    expect(html).not.toContain('--key-bg')
  })

  it('renders non-empty label as .key-label span with correct text', () => {
    const html = renderer.render(makeInput())
    expect(html).toContain('class="key-label"')
    expect(html).toContain('>A<')
    expect(html).toContain('>B<')
  })

  it('renders bottom label text', () => {
    const html = renderer.render(makeInput())
    expect(html).toContain('>fn<')
  })

  it('keys with labels: [] produce no .key-label spans', () => {
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
    const html = renderer.render(input)
    expect(html).not.toContain('<span class="key-label"')
  })

  it('center-aligned label → text-align:center in span style', () => {
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
    const html = renderer.render(input)
    expect(html).toContain('text-align:center')
  })

  it('baseline alphabetic → top offset positions alphabetic baseline at relY', () => {
    // fontSize=10, lineHeight=12, relY=40: cssTop = 40 - 12*0.75 = 40 - 9 = 31
    const input = makeInput({
      keys: [
        {
          left: 0,
          top: 0,
          width: 54,
          height: 54,
          labels: [makeLabel({ baseline: 'alphabetic', relY: 40, fontSize: 10 })],
          rotationAngle: 0,
          rotationOriginX: 0,
          rotationOriginY: 0,
          darkColor: '#cccccc',
          lightColor: '#f0f0f0',
        },
      ],
    })
    const html = renderer.render(input)
    expect(html).toContain('top:31px')
  })

  it('rotated key → .key style includes transform:rotate and transform-origin', () => {
    const input = makeInput({
      keys: [
        {
          left: 50,
          top: 50,
          width: 54,
          height: 54,
          labels: [],
          rotationAngle: 30,
          rotationOriginX: 100,
          rotationOriginY: 100,
          darkColor: '#cccccc',
          lightColor: '#f0f0f0',
        },
      ],
    })
    const html = renderer.render(input)
    expect(html).toContain('transform:rotate(30deg)')
    expect(html).toContain('transform-origin:')
  })

  it('non-rotated key → no transform:rotate in .key style', () => {
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
    const html = renderer.render(input)
    expect(html).not.toContain('transform:rotate')
  })

  it('board CSS rule has overflow: visible', () => {
    const html = renderer.render(makeInput())
    // The .board CSS rule must use overflow: visible (not hidden)
    expect(html).toContain('overflow: visible')
    // Verify the board <div> itself does not have inline overflow:hidden
    expect(html).toContain('<div class="board">')
  })

  it('includes a footer link to the editor', () => {
    const html = renderer.render(makeInput())
    expect(html).toContain('keyboard-footer')
    expect(html).toContain('editor.keyboard-tools.xyz')
  })

  it('handles an empty keys array gracefully', () => {
    const html = renderer.render(makeInput({ keys: [] }))
    expect(html).toContain('<div class="board">')
  })

  describe('ghost key', () => {
    it('renders with opacity:0.3', () => {
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
      const html = renderer.render(input)
      expect(html).toContain('opacity:0.3')
    })
  })

  describe('decal key', () => {
    it('renders no .key div', () => {
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
      const html = renderer.render(input)
      expect(html).not.toContain('class="key"')
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
      const html = renderer.render(input)
      expect(html).toContain('>Decal<')
    })
  })

  describe('homing nub key', () => {
    it('renders nub element with correct dimensions and color', () => {
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
      const html = renderer.render(input)
      expect(html).toContain('width:10px')
      expect(html).toContain('height:2px')
      expect(html).toContain('rgba(0,0,0,0.3)')
    })
  })

  describe('rotary encoder key', () => {
    it('renders with border-radius:50% on both key and key-inner', () => {
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
      const html = renderer.render(input)
      const matches = html.match(/border-radius:50%/g) ?? []
      expect(matches.length).toBeGreaterThanOrEqual(2)
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
            labels: [makeLabel({ text: 'Enter' })],
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

    it('renders two .key divs (outer1 + outer2)', () => {
      const html = renderer.render(makeNonRectInput())
      const keyDivCount = (html.match(/class="key"/g) ?? []).length
      expect(keyDivCount).toBe(2)
    })

    it('renders an overflow:visible container at outer1 position', () => {
      const html = renderer.render(makeNonRectInput())
      expect(html).toContain('overflow:visible')
      expect(html).toContain('left:9px;top:9px')
    })

    it('renders a filler div (no .key class) inset by 1px to cover the junction seam', () => {
      const html = renderer.render(makeNonRectInput())
      expect(html).toContain('left:1px;top:1px')
      expect(html).toContain('border-radius:5px')
    })

    it('renders two light-color inner divs', () => {
      const html = renderer.render(makeNonRectInput())
      const lightColorCount = (html.match(/background:#f0f0f0/g) ?? []).length
      expect(lightColorCount).toBe(2)
    })

    it('renders one light-color inner div for a stepped key (lower step stays dark)', () => {
      const input = makeNonRectInput()
      input.keys[0]!.stepped = true
      const html = renderer.render(input)
      expect((html.match(/class="key"/g) ?? []).length).toBe(2)
      expect((html.match(/background:#f0f0f0/g) ?? []).length).toBe(1)
    })

    it('still renders labels inside the container', () => {
      const html = renderer.render(makeNonRectInput())
      expect(html).toContain('>Enter<')
    })
  })
})
