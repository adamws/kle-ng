import { describe, it, expect } from 'vitest'
import { Key, KeyboardMetadata, type Array12 } from '@adamws/kle-serial'
import {
  escapeHtml,
  sanitizeLabelForHtml,
  getLabelAtIndex,
  normalizeLayoutInput,
  lightenColor,
  DEFAULT_UNIT,
  LAYOUT_PADDING,
} from '../layout-render-utils'
import type { LabelData } from '../LayoutRendererTypes'

describe('escapeHtml', () => {
  it('escapes ampersands', () => {
    expect(escapeHtml('a & b')).toBe('a &amp; b')
  })

  it('escapes angle brackets', () => {
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;')
  })

  it('escapes quotes', () => {
    expect(escapeHtml('"hello"')).toBe('&quot;hello&quot;')
  })

  it('escapes single quotes', () => {
    expect(escapeHtml("it's")).toBe('it&#039;s')
  })

  it('returns unchanged string when nothing to escape', () => {
    expect(escapeHtml('Hello World')).toBe('Hello World')
  })

  it('handles empty string', () => {
    expect(escapeHtml('')).toBe('')
  })
})

describe('sanitizeLabelForHtml', () => {
  it('replaces backticks with HTML entity', () => {
    expect(sanitizeLabelForHtml('`key`')).toBe('&#96;key&#96;')
  })

  it('escapes </script closing tags', () => {
    expect(sanitizeLabelForHtml('</script>')).toBe('<\\/script>')
  })

  it('is case-insensitive for </script', () => {
    // The regex matches case-insensitively but replacement is lowercase
    expect(sanitizeLabelForHtml('</SCRIPT>')).toBe('<\\/script>')
  })

  it('leaves normal text unchanged', () => {
    expect(sanitizeLabelForHtml('Enter')).toBe('Enter')
  })
})

const makeLabels = (...vals: (string | null)[]): Array12<string> => {
  const arr: (string | null)[] = [...vals, ...Array(12 - vals.length).fill(null)]
  return arr as unknown as Array12<string>
}

describe('getLabelAtIndex', () => {
  const makeKey = (labels: Array12<string>): Key => {
    const key = new Key()
    key.labels = labels
    return key
  }

  it('returns top-left label at index 0', () => {
    const key = makeKey(makeLabels('A'))
    expect(getLabelAtIndex(key, 0)).toBe('A')
  })

  it('returns bottom-left label at index 6', () => {
    const key = makeKey(makeLabels(null, null, null, null, null, null, 'fn'))
    expect(getLabelAtIndex(key, 6)).toBe('fn')
  })

  it('returns empty string for null label', () => {
    const key = makeKey(makeLabels())
    expect(getLabelAtIndex(key, 0)).toBe('')
  })

  it('returns empty string for whitespace-only label', () => {
    const key = makeKey(makeLabels('   '))
    expect(getLabelAtIndex(key, 0)).toBe('')
  })

  it('sanitizes backticks in labels', () => {
    const key = makeKey(makeLabels('`A`'))
    expect(getLabelAtIndex(key, 0)).toBe('&#96;A&#96;')
  })

  it('returns empty string when key has no labels', () => {
    const key = new Key()
    key.labels = makeLabels()
    expect(getLabelAtIndex(key, 0)).toBe('')
  })
})

describe('lightenColor', () => {
  it('returns a valid 7-char hex string for a normal color', () => {
    const result = lightenColor('#cccccc')
    expect(result).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('returns a lighter color than the input (L* increased)', () => {
    // #888888 mid-gray should lighten noticeably
    const input = '#888888'
    const result = lightenColor(input)
    const inputLum = parseInt(input.slice(1, 3), 16)
    const resultLum = parseInt(result.slice(1, 3), 16)
    // All channels should be >= input for a gray (no hue shift)
    expect(resultLum).toBeGreaterThanOrEqual(inputLum)
    expect(result).not.toBe(input)
  })

  it('clamps white to white (already max L*)', () => {
    expect(lightenColor('#ffffff')).toBe('#ffffff')
  })

  it('returns input unchanged for a non-6-digit hex string', () => {
    expect(lightenColor('bad')).toBe('bad')
    expect(lightenColor('#fff')).toBe('#fff')
    expect(lightenColor('')).toBe('')
  })
})

describe('normalizeLayoutInput', () => {
  // Build a Key with labels at specific positions and optional overrides
  const makeKey = (
    x: number,
    y: number,
    w = 1,
    h = 1,
    labelMap: Record<number, string> = {},
    color = '',
    textSizeMap: Record<number, number> = {},
    textColorMap: Record<number, string> = {},
    rotation: { angle?: number; rx?: number; ry?: number } = {},
  ): Key => {
    const key = new Key()
    key.x = x
    key.y = y
    key.width = w
    key.height = h
    key.color = color

    const labels = Array(12).fill(null) as Array12<string>
    for (const [idx, text] of Object.entries(labelMap)) {
      labels[Number(idx)] = (text || null) as unknown as string
    }
    key.labels = labels as unknown as Array12<string>

    const textSizes = Array(12).fill(0) as Array12<number>
    for (const [idx, size] of Object.entries(textSizeMap)) {
      textSizes[Number(idx)] = size
    }
    key.textSize = textSizes

    const textColors = Array(12).fill('') as Array12<string>
    for (const [idx, c] of Object.entries(textColorMap)) {
      textColors[Number(idx)] = c
    }
    key.textColor = textColors

    if (rotation.angle !== undefined) key.rotation_angle = rotation.angle
    if (rotation.rx !== undefined) key.rotation_x = rotation.rx
    if (rotation.ry !== undefined) key.rotation_y = rotation.ry

    return key
  }

  const makeMetadata = (overrides: Partial<KeyboardMetadata> = {}): KeyboardMetadata => {
    const meta = new KeyboardMetadata()
    Object.assign(meta, overrides)
    return meta
  }

  it('computes boardWidth and boardHeight from key extents', () => {
    const keys = [makeKey(0, 0, 1, 1), makeKey(1, 0, 1, 1), makeKey(2, 0, 1, 1)]
    const meta = makeMetadata()
    const result = normalizeLayoutInput(keys, meta, 'test')

    expect(result.boardWidth).toBe(3 * DEFAULT_UNIT + LAYOUT_PADDING * 2)
    expect(result.boardHeight).toBe(1 * DEFAULT_UNIT + LAYOUT_PADDING * 2)
  })

  it('offsets keys relative to minimum x/y', () => {
    const keys = [makeKey(1, 2, 1, 1)]
    const meta = makeMetadata()
    const result = normalizeLayoutInput(keys, meta, 'test')

    expect(result.keys[0]!.left).toBe(LAYOUT_PADDING)
    expect(result.keys[0]!.top).toBe(LAYOUT_PADDING)
  })

  it('respects custom unit size', () => {
    const keys = [makeKey(0, 0, 2, 1)]
    const meta = makeMetadata()
    const unit = 100
    const result = normalizeLayoutInput(keys, meta, 'test', unit)

    expect(result.keys[0]!.width).toBe(200)
    expect(result.boardWidth).toBe(200 + LAYOUT_PADDING * 2)
  })

  it('uses metadata.name as layoutName when available', () => {
    const keys = [makeKey(0, 0)]
    const meta = makeMetadata({ name: 'My Board' })
    const result = normalizeLayoutInput(keys, meta, 'filename')
    expect(result.layoutName).toBe('My Board')
  })

  it('falls back to filename when metadata.name is empty', () => {
    const keys = [makeKey(0, 0)]
    const meta = makeMetadata({ name: '' })
    const result = normalizeLayoutInput(keys, meta, 'my-file')
    expect(result.layoutName).toBe('my-file')
  })

  it('uses metadata.backcolor for backColor', () => {
    const keys = [makeKey(0, 0)]
    const meta = makeMetadata({ backcolor: '#abcdef' })
    const result = normalizeLayoutInput(keys, meta, 'test')
    expect(result.backColor).toBe('#abcdef')
  })

  it('defaults backColor to #ffffff when backcolor is empty', () => {
    const keys = [makeKey(0, 0)]
    const meta = makeMetadata({ backcolor: '' })
    const result = normalizeLayoutInput(keys, meta, 'test')
    expect(result.backColor).toBe('#ffffff')
  })

  it('uses metadata.radii trimmed for radiiValue', () => {
    const keys = [makeKey(0, 0)]
    const meta = makeMetadata({ radii: '  10px  ' })
    const result = normalizeLayoutInput(keys, meta, 'test')
    expect(result.radiiValue).toBe('10px')
  })

  it('defaults radiiValue to 6px when radii is empty', () => {
    const keys = [makeKey(0, 0)]
    const meta = makeMetadata({ radii: '' })
    const result = normalizeLayoutInput(keys, meta, 'test')
    expect(result.radiiValue).toBe('6px')
  })

  it('handles multiple keys with correct positions', () => {
    const keys = [makeKey(0, 0), makeKey(1, 0), makeKey(0, 1)]
    const meta = makeMetadata()
    const result = normalizeLayoutInput(keys, meta, 'test')

    expect(result.keys[0]).toMatchObject({ left: LAYOUT_PADDING, top: LAYOUT_PADDING })
    expect(result.keys[1]).toMatchObject({
      left: DEFAULT_UNIT + LAYOUT_PADDING,
      top: LAYOUT_PADDING,
    })
    expect(result.keys[2]).toMatchObject({
      left: LAYOUT_PADDING,
      top: DEFAULT_UNIT + LAYOUT_PADDING,
    })
  })

  it('uses key.color as darkColor', () => {
    const keys = [makeKey(0, 0, 1, 1, {}, '#ff0000')]
    const meta = makeMetadata()
    const result = normalizeLayoutInput(keys, meta, 'test')
    expect(result.keys[0]!.darkColor).toBe('#ff0000')
  })

  it('defaults darkColor to #cccccc when key.color is empty', () => {
    const keys = [makeKey(0, 0, 1, 1, {}, '')]
    const meta = makeMetadata()
    const result = normalizeLayoutInput(keys, meta, 'test')
    expect(result.keys[0]!.darkColor).toBe('#cccccc')
  })

  it('computes a valid lightColor from darkColor', () => {
    const keys = [makeKey(0, 0, 1, 1, {}, '#888888')]
    const meta = makeMetadata()
    const result = normalizeLayoutInput(keys, meta, 'test')
    const { lightColor } = result.keys[0]!
    expect(lightColor).toMatch(/^#[0-9a-f]{6}$/)
  })

  // --- Label extraction tests ---

  it('label at index 0 → align left, baseline hanging', () => {
    const keys = [makeKey(0, 0, 1, 1, { 0: 'A' })]
    const meta = makeMetadata()
    const result = normalizeLayoutInput(keys, meta, 'test')
    const label = result.keys[0]!.labels[0] as LabelData
    expect(label.text).toBe('A')
    expect(label.align).toBe('left')
    expect(label.baseline).toBe('hanging')
  })

  it('key with only position-4 label non-empty → labels[0].align center, baseline middle', () => {
    const keys = [makeKey(0, 0, 1, 1, { 4: 'X' })]
    const meta = makeMetadata()
    const result = normalizeLayoutInput(keys, meta, 'test')
    expect(result.keys[0]!.labels).toHaveLength(1)
    const label = result.keys[0]!.labels[0] as LabelData
    expect(label.text).toBe('X')
    expect(label.align).toBe('center')
    expect(label.baseline).toBe('middle')
  })

  it('key with no non-empty labels → labels is []', () => {
    const keys = [makeKey(0, 0, 1, 1, {})]
    const meta = makeMetadata()
    const result = normalizeLayoutInput(keys, meta, 'test')
    expect(result.keys[0]!.labels).toEqual([])
  })

  it('textSize=3 (default) → fontSize === 12', () => {
    const keys = [makeKey(0, 0, 1, 1, { 0: 'A' })]
    const meta = makeMetadata()
    const result = normalizeLayoutInput(keys, meta, 'test')
    // key.textSize[0] = 0 (use default), key.default.textSize = 3 → 6 + 2*3 = 12
    expect(result.keys[0]!.labels[0]!.fontSize).toBe(12)
  })

  it('textSize=5 → fontSize === 16', () => {
    const keys = [makeKey(0, 0, 1, 1, { 0: 'A' }, '', { 0: 5 })]
    const meta = makeMetadata()
    const result = normalizeLayoutInput(keys, meta, 'test')
    expect(result.keys[0]!.labels[0]!.fontSize).toBe(16)
  })

  it('front legend (index 9) → fontSize ≤ 10, relY === height - 8', () => {
    const keys = [makeKey(0, 0, 1, 1, { 9: 'fn' })]
    const meta = makeMetadata()
    const result = normalizeLayoutInput(keys, meta, 'test')
    const label = result.keys[0]!.labels[0] as LabelData
    expect(label.fontSize).toBeLessThanOrEqual(10)
    expect(label.relY).toBe(DEFAULT_UNIT - 8)
  })

  it('rotationAngle passes through correctly', () => {
    const keys = [makeKey(1, 1, 1, 1, {}, '', {}, {}, { angle: 15, rx: 2, ry: 3 })]
    const meta = makeMetadata()
    const result = normalizeLayoutInput(keys, meta, 'test')
    expect(result.keys[0]!.rotationAngle).toBe(15)
  })

  it('rotationAngle defaults to 0 when not set', () => {
    const keys = [makeKey(0, 0)]
    const meta = makeMetadata()
    const result = normalizeLayoutInput(keys, meta, 'test')
    expect(result.keys[0]!.rotationAngle).toBe(0)
  })

  it('rotation origin coords are correct for non-rotated keys (0° = same as simple offset)', () => {
    // With 0° rotation, BoundsCalculator uses the simple rectangle path, so the
    // result must match the straightforward formula: (rx - minX) * unit + LAYOUT_PADDING
    const keys = [makeKey(1, 1, 1, 1, {}, '', {}, {}, { angle: 0, rx: 2, ry: 3 })]
    const meta = makeMetadata()
    const result = normalizeLayoutInput(keys, meta, 'test')
    // bounds.x = 1 * 54, so rotationOriginX = 2*54 - 1*54 + 9 = 54 + 9 = 63
    expect(result.keys[0]!.rotationOriginX).toBe((2 - 1) * DEFAULT_UNIT + LAYOUT_PADDING)
    expect(result.keys[0]!.rotationOriginY).toBe((3 - 1) * DEFAULT_UNIT + LAYOUT_PADDING)
  })

  it('board dimensions account for rotated key extents (rotation-aware bounding box)', () => {
    // A 1×1 key rotated 45° around its own centre has a larger AABB than unrotated.
    // (diagonal of a unit square = √2 ≈ 1.414 units per side)
    const cx = 0.5 // centre of the key
    const cy = 0.5
    const rotatedKey = makeKey(0, 0, 1, 1, {}, '', {}, {}, { angle: 45, rx: cx, ry: cy })
    const nonRotatedKey = makeKey(0, 0, 1, 1)
    const meta = makeMetadata()

    const rotatedResult = normalizeLayoutInput([rotatedKey], meta, 'test')
    const plainResult = normalizeLayoutInput([nonRotatedKey], meta, 'test')

    expect(rotatedResult.boardWidth).toBeGreaterThan(plainResult.boardWidth)
    expect(rotatedResult.boardHeight).toBeGreaterThan(plainResult.boardHeight)
  })

  // --- Special key rendering flags ---

  it('ghost key → KeyRenderData.ghost === true', () => {
    const key = makeKey(0, 0)
    key.ghost = true
    const meta = makeMetadata()
    const result = normalizeLayoutInput([key], meta, 'test')
    expect(result.keys[0]!.ghost).toBe(true)
  })

  it('non-ghost key → no ghost field', () => {
    const key = makeKey(0, 0)
    const meta = makeMetadata()
    const result = normalizeLayoutInput([key], meta, 'test')
    expect(result.keys[0]!.ghost).toBeUndefined()
  })

  it('decal key → KeyRenderData.decal === true', () => {
    const key = makeKey(0, 0)
    key.decal = true
    const meta = makeMetadata()
    const result = normalizeLayoutInput([key], meta, 'test')
    expect(result.keys[0]!.decal).toBe(true)
  })

  it('nub key → KeyRenderData.nub === true', () => {
    const key = makeKey(0, 0)
    key.nub = true
    const meta = makeMetadata()
    const result = normalizeLayoutInput([key], meta, 'test')
    expect(result.keys[0]!.nub).toBe(true)
  })

  it('rotary encoder (sm=rot_ec11) → KeyRenderData.isRotaryEncoder === true', () => {
    const key = makeKey(0, 0)
    key.sm = 'rot_ec11'
    const meta = makeMetadata()
    const result = normalizeLayoutInput([key], meta, 'test')
    expect(result.keys[0]!.isRotaryEncoder).toBe(true)
  })

  it('normal key (sm unset) → no isRotaryEncoder field', () => {
    const key = makeKey(0, 0)
    const meta = makeMetadata()
    const result = normalizeLayoutInput([key], meta, 'test')
    expect(result.keys[0]!.isRotaryEncoder).toBeUndefined()
  })

  it('ISO Enter (non-rectangular) → left2/top2/width2/height2 populated', () => {
    // ISO Enter: width=1.25, height=2, width2=1.5, height2=1, x2=-0.25, y2=0
    const key = makeKey(0, 0, 1.25, 2)
    key.width2 = 1.5
    key.height2 = 1
    key.x2 = -0.25
    key.y2 = 0
    const meta = makeMetadata()
    const result = normalizeLayoutInput([key], meta, 'test', DEFAULT_UNIT)
    const k = result.keys[0]!
    expect(k.left2).toBeDefined()
    expect(k.top2).toBeDefined()
    expect(k.width2).toBeCloseTo(1.5 * DEFAULT_UNIT)
    expect(k.height2).toBe(1 * DEFAULT_UNIT)
    // left2 = (0 + (-0.25)) * unit - minPxX + LAYOUT_PADDING
    // minPxX is the left edge = min(0, -0.25) * unit = -0.25 * unit
    // so left2 = -0.25*54 - (-0.25*54) + 9 = 9
    expect(k.left2).toBeCloseTo(LAYOUT_PADDING)
  })

  it('stepped key → stepped flag set alongside the second rect', () => {
    const key = makeKey(0, 0, 1.25, 1)
    key.width2 = 1.75
    key.stepped = true
    const result = normalizeLayoutInput([key], makeMetadata(), 'test', DEFAULT_UNIT)
    const k = result.keys[0]!
    expect(k.stepped).toBe(true)
    expect(k.width2).toBeCloseTo(1.75 * DEFAULT_UNIT)
  })

  it('stepped flag on a rectangular key → no stepped field (nothing to step)', () => {
    const key = makeKey(0, 0, 1.75, 1)
    key.width2 = 1.75
    key.stepped = true
    const result = normalizeLayoutInput([key], makeMetadata(), 'test')
    expect(result.keys[0]!.stepped).toBeUndefined()
  })

  it('normal rectangular key → no left2 field', () => {
    const key = makeKey(0, 0, 1, 1)
    const meta = makeMetadata()
    const result = normalizeLayoutInput([key], meta, 'test')
    expect(result.keys[0]!.left2).toBeUndefined()
  })
})
