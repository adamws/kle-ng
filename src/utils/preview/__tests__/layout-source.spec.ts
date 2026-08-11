import { describe, it, expect } from 'vitest'
import { qmkLayoutSource, viaLayoutSource, MAX_PREVIEW_KEYS } from '../layout-source'

/** Minimal QMK info.json envelope with `count` LAYOUT_* macros */
function qmkEnvelope(name: string, layouts: Record<string, { matrix: number[]; x: number }[]>) {
  return {
    keyboards: {
      [name]: {
        keyboard_name: name,
        manufacturer: 'Test',
        layouts: Object.fromEntries(
          Object.entries(layouts).map(([layoutName, keys]) => [
            layoutName,
            { layout: keys.map((k) => ({ matrix: k.matrix, x: k.x, y: 0 })) },
          ]),
        ),
      },
    },
  }
}

describe('qmkLayoutSource', () => {
  it('builds URLs for the QMK API', () => {
    expect(qmkLayoutSource.listUrl).toContain('keyboard_list.json')
    expect(qmkLayoutSource.layoutUrl('planck/rev6')).toBe(
      'https://keyboards.qmk.fm/v1/keyboards/planck/rev6/info.json',
    )
  })

  it('throws when the envelope has no entry for the requested name', () => {
    expect(() => qmkLayoutSource.toPreviewLayout({ keyboards: {} }, 'nope')).toThrow(
      /Keyboard data not found/,
    )
  })

  it('produces one variant per LAYOUT_* macro', () => {
    const raw = qmkEnvelope('test/board', {
      LAYOUT_ansi: [
        { matrix: [0, 0], x: 0 },
        { matrix: [0, 1], x: 1 },
        { matrix: [0, 2], x: 2 },
      ],
      LAYOUT_iso: [
        { matrix: [0, 0], x: 0 },
        { matrix: [0, 1], x: 1 },
        { matrix: [0, 3], x: 3 },
      ],
    })

    const preview = qmkLayoutSource.toPreviewLayout(raw, 'test/board')

    expect(preview.variants.map((v) => v.label)).toEqual(['LAYOUT_ansi', 'LAYOUT_iso'])
    // Each variant is a strict subset of the flattened superset
    expect(preview.variants[0]!.keys.length).toBe(3)
    expect(preview.variants[1]!.keys.length).toBe(3)
    expect(preview.keyCount).toBe(4) // 2 shared + 1 per variant
  })

  it('falls back to a single variant for single-layout keyboards', () => {
    const raw = qmkEnvelope('test/solo', {
      LAYOUT: [
        { matrix: [0, 0], x: 0 },
        { matrix: [0, 1], x: 1 },
      ],
    })

    const preview = qmkLayoutSource.toPreviewLayout(raw, 'test/solo')

    expect(preview.variants).toHaveLength(1)
    expect(preview.variants[0]!.keys).toHaveLength(2)
  })

  it('keeps the raw response so import can skip a second download', () => {
    const raw = qmkEnvelope('test/solo', { LAYOUT: [{ matrix: [0, 0], x: 0 }] })
    const preview = qmkLayoutSource.toPreviewLayout(raw, 'test/solo')
    expect(preview.raw).toBe(raw)
  })

  it('flags layouts that exceed the store key limit', () => {
    const many = Array.from({ length: MAX_PREVIEW_KEYS + 1 }, (_, i) => ({
      matrix: [0, i],
      x: i,
    }))
    const preview = qmkLayoutSource.toPreviewLayout(
      qmkEnvelope('test/huge', { LAYOUT: many }),
      'test/huge',
    )

    expect(preview.keyCount).toBe(MAX_PREVIEW_KEYS + 1)
    expect(preview.tooLarge).toBe(true)
  })
})

describe('viaLayoutSource', () => {
  it('builds URLs for the via keyboards repo', () => {
    expect(viaLayoutSource.layoutUrl('wilba.tech/wt60_a')).toBe(
      'https://raw.githubusercontent.com/the-via/keyboards/master/v3/wilba.tech/wt60_a.json',
    )
  })

  it('returns a single default variant when there are no option groups', () => {
    const raw = {
      name: 'Plain',
      vendorId: '0x0001',
      productId: '0x0001',
      matrix: { rows: 1, cols: 2 },
      layouts: { keymap: [['0,0', '0,1']] },
    }

    const preview = viaLayoutSource.toPreviewLayout(raw, 'plain')

    expect(preview.variants).toHaveLength(1)
    expect(preview.variants[0]!.label).toBe('Layout')
    expect(preview.keyCount).toBe(2)
    expect(preview.tooLarge).toBe(false)
  })

  it('expands option groups into one variant per non-zero choice', () => {
    // VIA carries "option,choice" in labels[8]. Under KLE alignment 0 the
    // fourth newline-separated chunk lands there.
    const optionKey = (matrix: string, option: number, choice: number) =>
      `${matrix}\n\n\n${option},${choice}`

    const raw = {
      name: 'Optioned',
      vendorId: '0x0001',
      productId: '0x0001',
      matrix: { rows: 1, cols: 3 },
      layouts: {
        labels: [['Bottom row', '7u', 'Split']],
        keymap: [[{ a: 0 }, '0,0', optionKey('0,1', 0, 0), optionKey('0,2', 0, 1)]],
      },
    }

    const preview = viaLayoutSource.toPreviewLayout(raw, 'optioned')

    expect(preview.variants.map((v) => v.label)).toEqual(['Default', 'Bottom row: Split'])
    expect(preview.variants[0]!.keys.length).toBeGreaterThan(0)
    expect(preview.variants[1]!.keys.length).toBeGreaterThan(0)
  })

  it('keeps the raw response so import can reattach VIA metadata', () => {
    const raw = {
      name: 'Plain',
      vendorId: '0x0001',
      productId: '0x0001',
      matrix: { rows: 1, cols: 1 },
      layouts: { keymap: [['0,0']] },
    }

    expect(viaLayoutSource.toPreviewLayout(raw, 'plain').raw).toBe(raw)
  })

  it('rejects data that is not in VIA format', () => {
    expect(() => viaLayoutSource.toPreviewLayout({ nope: true }, 'bad')).toThrow(/Invalid VIA/)
  })
})
