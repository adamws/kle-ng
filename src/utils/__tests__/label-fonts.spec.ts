import { describe, it, expect, afterEach, vi } from 'vitest'
import { Key } from '@adamws/kle-serial'
import {
  DEFAULT_LABEL_FONT_FAMILY,
  MARKS_FONT_FAMILY,
  loadMarksFont,
  withMarksFont,
} from '../label-fonts'
import { LabelRenderer } from '../renderers/LabelRenderer'
import { keyRenderer } from '../renderers/KeyRenderer'

describe('withMarksFont', () => {
  it('puts the marks font in front of the stack', () => {
    expect(withMarksFont(DEFAULT_LABEL_FONT_FAMILY)).toBe(
      `${MARKS_FONT_FAMILY}, ${DEFAULT_LABEL_FONT_FAMILY}`,
    )
  })

  it('keeps a layout font behind it', () => {
    expect(withMarksFont('"Noto Sans JP"')).toBe(`${MARKS_FONT_FAMILY}, "Noto Sans JP"`)
  })

  it('does not add it twice', () => {
    const once = withMarksFont(DEFAULT_LABEL_FONT_FAMILY)
    expect(withMarksFont(once)).toBe(once)
  })
})

describe('loadMarksFont', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('resolves false where the Font Loading API is missing', async () => {
    // jsdom has no document.fonts
    await expect(loadMarksFont()).resolves.toBe(false)
  })

  it('resolves false instead of throwing when the load fails', async () => {
    vi.stubGlobal('document', { fonts: { load: () => Promise.reject(new Error('offline')) } })
    await expect(loadMarksFont()).resolves.toBe(false)
  })

  it('reports whether a face was loaded', async () => {
    vi.stubGlobal('document', { fonts: { load: () => Promise.resolve([{}]) } })
    await expect(loadMarksFont()).resolves.toBe(true)
  })
})

describe('LabelRenderer font stack', () => {
  // Records every ctx.font assignment; just enough context for one text label.
  const recordingContext = () => {
    const fonts: string[] = []
    const ctx = {
      set font(value: string) {
        fonts.push(value)
      },
      get font() {
        return fonts[fonts.length - 1] ?? '12px sans-serif'
      },
      fillStyle: '',
      textAlign: 'left',
      textBaseline: 'alphabetic',
      measureText: (text: string) => ({ width: text.length * 6 }),
      fillText: vi.fn(),
    }
    return { ctx: ctx as unknown as CanvasRenderingContext2D, fonts, fillText: ctx.fillText }
  }

  const draw = (fontFamily?: string) => {
    const key = new Key()
    key.labels[0] = '◌̉'
    const { ctx, fonts, fillText } = recordingContext()
    new LabelRenderer().drawKeyLabels(
      ctx,
      key,
      keyRenderer.getRenderParams(key, { unit: 54 }),
      { unit: 54, fontFamily },
      () => null,
      () => {},
    )
    return { fonts, fillText }
  }

  it('leads the default stack with the marks font', () => {
    const { fonts, fillText } = draw()
    expect(fonts.length).toBeGreaterThan(0)
    for (const font of fonts)
      expect(font).toContain(`${MARKS_FONT_FAMILY}, ${DEFAULT_LABEL_FONT_FAMILY}`)
    // The circle and its mark are one string, so they are shaped together.
    expect(fillText).toHaveBeenCalledWith('◌̉', expect.any(Number), expect.any(Number))
  })

  it('leads a layout font with the marks font too', () => {
    const { fonts } = draw('"Noto Sans JP"')
    for (const font of fonts) expect(font).toContain(`${MARKS_FONT_FAMILY}, "Noto Sans JP"`)
  })
})
