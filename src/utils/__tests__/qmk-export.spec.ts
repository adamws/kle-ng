import { describe, it, expect } from 'vitest'
import LZString from 'lz-string'
import { convertKleToQmk } from '../qmk-export'
import { convertQmkToKle } from '../qmk-import'

// Helper: build a minimal KLE internal format with annotated keys
function makeKleInternal(
  keys: Array<{
    labels: string[]
    x?: number
    y?: number
    w?: number
    h?: number
    r?: number
    rx?: number
    ry?: number
    decal?: boolean
    ghost?: boolean
  }>,
  meta?: Record<string, unknown>,
) {
  return {
    meta: { name: '', author: '', ...meta },
    keys: keys.map((k) => ({
      labels: [...k.labels, ...Array(12 - k.labels.length).fill('')],
      x: k.x ?? 0,
      y: k.y ?? 0,
      width: k.w ?? 1,
      height: k.h ?? 1,
      x2: 0,
      y2: 0,
      width2: k.w ?? 1,
      height2: k.h ?? 1,
      rotation_angle: k.r ?? 0,
      rotation_x: k.rx ?? 0,
      rotation_y: k.ry ?? 0,
      color: '#cccccc',
      textColor: Array(12).fill(''),
      textSize: Array(12).fill(0),
      decal: k.decal ?? false,
      ghost: k.ghost ?? false,
      stepped: false,
      nub: false,
      profile: '',
      sm: '',
      sb: '',
      st: '',
      switchRotation: 0,
      stabRotation: 0,
    })),
  }
}

// Build a 12-element labels array with a value at a specific position
function labelsAt(pos0: string, optPos?: number, optVal?: string): string[] {
  const arr = Array(12).fill('')
  arr[0] = pos0
  if (optPos !== undefined && optVal !== undefined) arr[optPos] = optVal
  return arr
}

describe('QMK Export', () => {
  describe('convertKleToQmk — basic', () => {
    it('returns null when no keys have matrix coordinates', () => {
      const kleData = makeKleInternal([
        { labels: ['A', '', '', '', '', '', '', '', '', '', '', ''], x: 0, y: 0 },
      ])
      expect(convertKleToQmk(kleData)).toBeNull()
    })

    it('returns null for empty/null input', () => {
      expect(convertKleToQmk(null)).toBeNull()
      expect(convertKleToQmk({})).toBeNull()
    })

    it('converts a single layout with correct matrix and position', () => {
      const kleData = makeKleInternal([
        { labels: labelsAt('0,0'), x: 0, y: 0 },
        { labels: labelsAt('0,1'), x: 1, y: 0 },
        { labels: labelsAt('1,0'), x: 0, y: 1 },
      ])
      const result = convertKleToQmk(kleData) as Record<string, unknown>
      const layouts = result.layouts as Record<string, { layout: unknown[] }>
      const keys = Object.values(layouts)[0]!.layout
      expect(keys).toHaveLength(3)
      expect(keys[0]).toEqual({ matrix: [0, 0], x: 0, y: 0 })
      expect(keys[1]).toEqual({ matrix: [0, 1], x: 1, y: 0 })
      expect(keys[2]).toEqual({ matrix: [1, 0], x: 0, y: 1 })
    })

    it('omits default w=1, h=1, r=0, rx=0, ry=0 from output keys', () => {
      const kleData = makeKleInternal([{ labels: labelsAt('0,0'), x: 0, y: 0 }])
      const result = convertKleToQmk(kleData) as Record<string, unknown>
      const layouts = result.layouts as Record<string, { layout: Array<Record<string, unknown>> }>
      const key = Object.values(layouts)[0]!.layout[0]!
      expect(key.w).toBeUndefined()
      expect(key.h).toBeUndefined()
      expect(key.r).toBeUndefined()
      expect(key.rx).toBeUndefined()
      expect(key.ry).toBeUndefined()
    })

    it('includes non-default w, h, r, rx, ry', () => {
      // Place [0,0] at origin so normalization is a no-op; focus is on w/h/r/rx/ry output.
      const kleData = makeKleInternal([
        { labels: labelsAt('0,0'), x: 0, y: 0, w: 2, h: 1.5, r: 15, rx: 4.5, ry: 9.1 },
      ])
      const result = convertKleToQmk(kleData) as Record<string, unknown>
      const layouts = result.layouts as Record<string, { layout: Array<Record<string, unknown>> }>
      const key = Object.values(layouts)[0]!.layout[0]!
      expect(key.w).toBe(2)
      expect(key.h).toBe(1.5)
      expect(key.r).toBe(15)
      expect(key.rx).toBe(4.5)
      expect(key.ry).toBe(9.1)
    })

    it('sorts output keys by matrix position (row then col)', () => {
      const kleData = makeKleInternal([
        { labels: labelsAt('1,1'), x: 1, y: 1 },
        { labels: labelsAt('0,0'), x: 0, y: 0 },
        { labels: labelsAt('0,1'), x: 1, y: 0 },
        { labels: labelsAt('1,0'), x: 0, y: 1 },
      ])
      const result = convertKleToQmk(kleData) as Record<string, unknown>
      const layouts = result.layouts as Record<string, { layout: Array<Record<string, unknown>> }>
      const keys = Object.values(layouts)[0]!.layout
      expect(keys[0]!.matrix).toEqual([0, 0])
      expect(keys[1]!.matrix).toEqual([0, 1])
      expect(keys[2]!.matrix).toEqual([1, 0])
      expect(keys[3]!.matrix).toEqual([1, 1])
    })

    it('excludes decal and ghost keys', () => {
      const kleData = makeKleInternal([
        { labels: labelsAt('0,0'), x: 0, y: 0 },
        { labels: labelsAt('0,1'), x: 1, y: 0, decal: true },
        { labels: labelsAt('0,2'), x: 2, y: 0, ghost: true },
      ])
      const result = convertKleToQmk(kleData) as Record<string, unknown>
      const layouts = result.layouts as Record<string, { layout: unknown[] }>
      expect(Object.values(layouts)[0]!.layout).toHaveLength(1)
    })
  })

  describe('convertKleToQmk — floating-point accuracy', () => {
    it('removes floating-point noise from kle-serial rotation arithmetic', () => {
      // Simulate kle-serial adding rx + x_offset with fp noise
      // e.g. rx=5.5142, x_kle=-1.125 → key.x = 5.5142 - 1.125 = 4.3892000000...003
      const kleData = makeKleInternal([
        {
          labels: labelsAt('4,4'),
          x: 5.5142 + -1.125, // = 4.389200000000003 in JS
          y: 5.6062 + -0.5, //  = 5.1062000000000003 in JS
          r: 36.4,
          rx: 5.5142,
          ry: 5.6062,
          w: 2.25,
        },
      ])
      const result = convertKleToQmk(kleData) as Record<string, unknown>
      const layouts = result.layouts as Record<string, { layout: Array<Record<string, unknown>> }>
      const key = Object.values(layouts)[0]!.layout[0]!
      // Must not contain floating-point garbage digits
      expect(key.x).toBe(4.3892)
      expect(key.y).toBe(5.1062)
    })

    it('preserves original decimal precision for clean values', () => {
      // Use matrix 1,0 (not 0,0) so normalizeLayoutToOrigin does not shift the key
      const kleData = makeKleInternal([
        { labels: labelsAt('1,0'), x: 4.5, y: 9.1, r: 15, rx: 4.5, ry: 9.1 },
      ])
      const result = convertKleToQmk(kleData) as Record<string, unknown>
      const layouts = result.layouts as Record<string, { layout: Array<Record<string, unknown>> }>
      const key = Object.values(layouts)[0]!.layout[0]!
      expect(key.x).toBe(4.5)
      expect(key.y).toBe(9.1)
      expect(key.r).toBe(15)
    })
  })

  describe('convertKleToQmk — plain keyboard (no VIA options) → single LAYOUT_all', () => {
    it('produces LAYOUT_all when no option/choice labels are present', () => {
      const kleData = makeKleInternal([{ labels: labelsAt('0,0'), x: 0, y: 0 }])
      const result = convertKleToQmk(kleData) as Record<string, unknown>
      expect(Object.keys(result.layouts as object)).toEqual(['LAYOUT_all'])
    })

    it('uses the single stored layout name when _kleng_qmk_data has exactly one layout', () => {
      const stored = { keyboard_name: 'Test', layouts: { LAYOUT_default: {} } }
      const compressed = LZString.compressToBase64(JSON.stringify(stored))
      const kleData = makeKleInternal([{ labels: labelsAt('0,0'), x: 0, y: 0 }], {
        _kleng_qmk_data: compressed,
      })
      const result = convertKleToQmk(kleData) as Record<string, unknown>
      expect(Object.keys(result.layouts as object)).toEqual(['LAYOUT_default'])
    })

    it('deduplicates physically identical plain keys (no option labels)', () => {
      // Same matrix position, same physical coords — only one survives
      const kleData = makeKleInternal([
        { labels: labelsAt('0,0'), x: 0, y: 0 },
        { labels: labelsAt('0,0'), x: 0, y: 0 },
        { labels: labelsAt('0,1'), x: 1, y: 0 },
      ])
      const result = convertKleToQmk(kleData) as Record<string, unknown>
      const layouts = result.layouts as Record<string, { layout: unknown[] }>
      expect(Object.keys(layouts)).toEqual(['LAYOUT_all'])
      expect(layouts['LAYOUT_all']!.layout).toHaveLength(2)
    })
  })

  describe('convertKleToQmk — VIA option/choice keyboard → per-choice QMK layouts', () => {
    it('generates LAYOUT (default) and LAYOUT_option{N}_{C} for each non-default choice', () => {
      // Single option (0) with 2 choices: wide ANSI enter (choice 0) vs narrow ISO (choice 1)
      const kleData = makeKleInternal([
        { labels: labelsAt('0,0'), x: 0, y: 0 }, // shared
        { labels: labelsAt('0,1', 8, '0,0'), x: 1, y: 0, w: 2.25 }, // option 0, choice 0
        { labels: labelsAt('0,1', 8, '0,1'), x: 1, y: 0, w: 1.25 }, // option 0, choice 1
      ])
      const result = convertKleToQmk(kleData) as Record<string, unknown>
      const layouts = result.layouts as Record<string, { layout: Array<Record<string, unknown>> }>
      expect(Object.keys(layouts)).toEqual(['LAYOUT', 'LAYOUT_option0_1'])
      // Default (choice 0): shared + wide key
      expect(layouts['LAYOUT']!.layout).toHaveLength(2)
      expect(layouts['LAYOUT']!.layout.find((k) => k.w === 2.25)).toBeDefined()
      expect(layouts['LAYOUT']!.layout.find((k) => k.w === 1.25)).toBeUndefined()
      // Alternative (choice 1): shared + narrow key
      expect(layouts['LAYOUT_option0_1']!.layout).toHaveLength(2)
      expect(layouts['LAYOUT_option0_1']!.layout.find((k) => k.w === 1.25)).toBeDefined()
      expect(layouts['LAYOUT_option0_1']!.layout.find((k) => k.w === 2.25)).toBeUndefined()
    })

    it('each collapsed layout has exactly one key per matrix position (no duplicates)', () => {
      // Two choices for the same matrix position — each layout has exactly 1 key
      const kleData = makeKleInternal([
        { labels: labelsAt('0,0', 8, '0,0'), x: 0, y: 0, w: 2.25 },
        { labels: labelsAt('0,0', 8, '0,1'), x: 0, y: 0, w: 1.25 },
      ])
      const result = convertKleToQmk(kleData) as Record<string, unknown>
      const layouts = result.layouts as Record<string, { layout: Array<Record<string, unknown>> }>
      expect(Object.keys(layouts)).toEqual(['LAYOUT', 'LAYOUT_option0_1'])
      expect(layouts['LAYOUT']!.layout).toHaveLength(1)
      expect(layouts['LAYOUT']!.layout[0]!.w).toBe(2.25)
      expect(layouts['LAYOUT_option0_1']!.layout).toHaveLength(1)
      expect(layouts['LAYOUT_option0_1']!.layout[0]!.w).toBe(1.25)
    })

    it('translates VIA choice-1 y-offset to physical row before collapsing', () => {
      // VIA KLE files display alternative choices at different canvas y positions for visual
      // separation. Here choice 1 (spacebar w=7) is at y=4.5 in the canvas but should be
      // collapsed to y=4 (same physical row as choice 0).
      const kleData = makeKleInternal([
        { labels: labelsAt('0,0'), x: 0, y: 0 }, // shared
        { labels: labelsAt('4,6', 8, '4,0'), x: 2.5, y: 4, w: 6.25 }, // choice 0 at y=4
        { labels: labelsAt('4,6', 8, '4,1'), x: 2.5, y: 4.5, w: 7 }, // choice 1 at y=4.5
      ])
      const result = convertKleToQmk(kleData) as Record<string, unknown>
      const layouts = result.layouts as Record<string, { layout: Array<Record<string, unknown>> }>
      expect(Object.keys(layouts)).toEqual(['LAYOUT', 'LAYOUT_option4_1'])
      // LAYOUT: spacebar w=6.25 at y=4
      const defSpace = layouts['LAYOUT']!.layout.find((k) => (k.matrix as number[])[0] === 4)!
      expect(defSpace.y).toBe(4)
      expect(defSpace.w).toBe(6.25)
      // LAYOUT_option4_1: spacebar w=7 translated to y=4
      const altSpace = layouts['LAYOUT_option4_1']!.layout.find(
        (k) => (k.matrix as number[])[0] === 4,
      )!
      expect(altSpace.y).toBe(4) // translated from 4.5
      expect(altSpace.w).toBe(7)
    })

    it('translates VIA choice-1 x-offset to physical position (split shift)', () => {
      // VIA shows split-shift (choice 1) at x=0, but physically it starts at x=2.5
      // (aligned with the standard 2.25u shift, choice 0).
      const kleData = makeKleInternal([
        { labels: labelsAt('3,0', 8, '2,0'), x: 2.5, y: 3, w: 2.25 }, // standard shift
        { labels: labelsAt('3,0', 8, '2,1'), x: 0, y: 3, w: 1.25 }, // split: displayed at x=0
        { labels: labelsAt('3,1', 8, '2,1'), x: 1.25, y: 3 }, // split: extra key
      ])
      const result = convertKleToQmk(kleData) as Record<string, unknown>
      const layouts = result.layouts as Record<string, { layout: Array<Record<string, unknown>> }>
      expect(Object.keys(layouts)).toEqual(['LAYOUT', 'LAYOUT_option2_1'])
      // LAYOUT: standard shift at x=2.5
      expect(layouts['LAYOUT']!.layout[0]!.x).toBe(2.5)
      expect(layouts['LAYOUT']!.layout[0]!.w).toBe(2.25)
      // LAYOUT_option2_1: split shift translated to start at x=2.5
      const alt = layouts['LAYOUT_option2_1']!.layout
      expect(alt.find((k) => k.w === 1.25)?.x).toBe(2.5) // translated from 0
      expect(alt.find((k) => (k.matrix as number[])[1] === 1)?.x).toBe(3.75) // translated from 1.25
    })

    it('generates 7 layouts for a 5-option keyboard (options 0-3 with 2 choices, option 4 with 3)', () => {
      const kleData = makeKleInternal([
        { labels: labelsAt('0,0'), x: 0, y: 0 }, // shared
        { labels: labelsAt('0,14', 8, '0,0'), x: 14, y: 0, w: 2 }, // option 0, choice 0
        { labels: labelsAt('0,14', 8, '0,1'), x: 14, y: 0 }, // option 0, choice 1
        { labels: labelsAt('2,13', 8, '1,0'), x: 13, y: 2, w: 2.25 }, // option 1, choice 0
        { labels: labelsAt('2,13', 8, '1,1'), x: 13, y: 2, w: 1.5 }, // option 1, choice 1
        { labels: labelsAt('3,0', 8, '2,0'), x: 0, y: 3, w: 2.25 }, // option 2, choice 0
        { labels: labelsAt('3,0', 8, '2,1'), x: 0, y: 3, w: 1.25 }, // option 2, choice 1
        { labels: labelsAt('3,13', 8, '3,0'), x: 13, y: 3, w: 2.75 }, // option 3, choice 0
        { labels: labelsAt('3,13', 8, '3,1'), x: 13, y: 3, w: 1.75 }, // option 3, choice 1
        { labels: labelsAt('4,6', 8, '4,0'), x: 5, y: 4, w: 6.25 }, // option 4, choice 0
        { labels: labelsAt('4,6', 8, '4,1'), x: 5, y: 4.5, w: 7 }, // option 4, choice 1
        { labels: labelsAt('4,6', 8, '4,2'), x: 5, y: 4.75, w: 7 }, // option 4, choice 2
      ])
      const result = convertKleToQmk(kleData) as Record<string, unknown>
      const layoutNames = Object.keys(result.layouts as object)
      expect(layoutNames).toHaveLength(7) // LAYOUT + 4×1 + 1×2
      expect(layoutNames).toContain('LAYOUT')
      expect(layoutNames).toContain('LAYOUT_option0_1')
      expect(layoutNames).toContain('LAYOUT_option1_1')
      expect(layoutNames).toContain('LAYOUT_option2_1')
      expect(layoutNames).toContain('LAYOUT_option3_1')
      expect(layoutNames).toContain('LAYOUT_option4_1')
      expect(layoutNames).toContain('LAYOUT_option4_2')
    })

    it('detects option/choice labels at position 3 (kle_v3.json style)', () => {
      // Some KLE files store option/choice at labels[3] (3 newlines before the value)
      // rather than the VIA-standard labels[8]. findOptionPos should detect position 3.
      const kleData = makeKleInternal([
        { labels: labelsAt('0,0'), x: 0, y: 0 }, // shared
        { labels: labelsAt('2,13', 3, '1,0'), x: 12.25, y: 2, w: 2.25 }, // option 1, choice 0
        { labels: labelsAt('2,13', 3, '1,1'), x: 12.25, y: 2, w: 1.5 }, // option 1, choice 1
        { labels: labelsAt('4,0', 3, '5,0'), x: 0, y: 4, w: 2.75 }, // option 5, choice 0
        { labels: labelsAt('4,0', 3, '5,1'), x: 0, y: 4, w: 1.5 }, // option 5, choice 1
      ])
      const result = convertKleToQmk(kleData) as Record<string, unknown>
      const layouts = result.layouts as Record<string, { layout: Array<Record<string, unknown>> }>
      expect(Object.keys(layouts)).toEqual(['LAYOUT', 'LAYOUT_option1_1', 'LAYOUT_option5_1'])
      expect(layouts['LAYOUT']!.layout.find((k) => k.w === 2.25)).toBeDefined() // ANSI enter
      expect(layouts['LAYOUT_option1_1']!.layout.find((k) => k.w === 1.5)).toBeDefined() // ISO enter
      expect(layouts['LAYOUT']!.layout.find((k) => k.w === 2.75)).toBeDefined() // standard shift
      expect(layouts['LAYOUT_option5_1']!.layout.find((k) => k.w === 1.5)).toBeDefined() // split shift
    })

    it('uses decal blocker position as anchor when choice lacks a switch at that spot', () => {
      // Choice 2 bottom row: a 1.5u decal at x=2.5 blocks where choice 0 has [4,0].
      // The first real key [4,1] is at x=4.0. Without decal in anchor calculation,
      // minXY(choice2) = (4.0, 4.75) and the translation shifts [4,1] wrongly to x=2.5.
      // With decal included, minXY(choice2) = (2.5, 4.75) and dx=0 → [4,1] stays at x=4.0.
      const kleData = makeKleInternal([
        // Choice 0: [4,0] at x=2.5 (w=1.25), then [4,1] at x=3.75
        { labels: labelsAt('4,0', 8, '4,0'), x: 2.5, y: 4, w: 1.25 },
        { labels: labelsAt('4,1', 8, '4,0'), x: 3.75, y: 4 },
        // Choice 2: decal blocker at x=2.5 (w=1.5), then [4,1] at x=4.0
        {
          labels: Array(12)
            .fill('')
            .map((_, i) => (i === 8 ? '4,2' : '')),
          x: 2.5,
          y: 4.25,
          w: 1.5,
          decal: true,
        },
        { labels: labelsAt('4,1', 8, '4,2'), x: 4.0, y: 4.25 },
      ])
      const result = convertKleToQmk(kleData) as Record<string, unknown>
      const layouts = result.layouts as Record<string, { layout: Array<Record<string, unknown>> }>
      expect(Object.keys(layouts)).toContain('LAYOUT_option4_2')
      const alt = layouts['LAYOUT_option4_2']!.layout
      // [4,1] must be at x=4.0 (translated only in y, not x)
      const key41 = alt.find((k) => (k.matrix as number[])[1] === 1)!
      expect(key41.x).toBe(4) // not shifted left to 2.5
      expect(key41.y).toBe(4) // y translated from 4.25 to 4
    })

    it('stored layout names in _kleng_qmk_data are ignored when VIA options are detected', () => {
      // The VIA multi-layout path uses auto-generated LAYOUT/LAYOUT_option{N}_{C} names
      // regardless of what names were stored in _kleng_qmk_data.
      const stored = { keyboard_name: 'Test', layouts: { LAYOUT_ansi: {}, LAYOUT_iso: {} } }
      const compressed = LZString.compressToBase64(JSON.stringify(stored))
      const kleData = makeKleInternal(
        [
          { labels: labelsAt('0,0', 8, '0,0'), x: 0, y: 0, w: 2.25 },
          { labels: labelsAt('0,0', 8, '0,1'), x: 0, y: 0, w: 1.25 },
        ],
        { _kleng_qmk_data: compressed },
      )
      const result = convertKleToQmk(kleData) as Record<string, unknown>
      expect(Object.keys(result.layouts as object)).toEqual(['LAYOUT', 'LAYOUT_option0_1'])
    })
  })

  describe('convertKleToQmk — metadata', () => {
    it('overrides keyboard_name and manufacturer from metadata while preserving other fields', () => {
      const stored = {
        keyboard_name: 'OldName',
        manufacturer: 'OldMfg',
        url: 'https://example.com',
        layouts: { LAYOUT: {} },
      }
      const compressed = LZString.compressToBase64(JSON.stringify(stored))
      const kleData = makeKleInternal([{ labels: labelsAt('0,0'), x: 0, y: 0 }], {
        name: 'NewName',
        author: 'NewMfg',
        _kleng_qmk_data: compressed,
      })
      const result = convertKleToQmk(kleData) as Record<string, unknown>
      expect(result.keyboard_name).toBe('NewName')
      expect(result.manufacturer).toBe('NewMfg')
      expect(result.url).toBe('https://example.com')
    })

    it('produces minimal output when no stored QMK data', () => {
      const kleData = makeKleInternal([{ labels: labelsAt('0,0'), x: 0, y: 0 }], {
        name: 'MyBoard',
        author: 'Me',
      })
      const result = convertKleToQmk(kleData) as Record<string, unknown>
      expect(Object.keys(result).sort()).toEqual(['keyboard_name', 'layouts', 'manufacturer'])
    })
  })

  describe('convertKleToQmk — roundtrip with convertQmkToKle', () => {
    it('preserves layout structure and metadata through QMK→KLE→QMK roundtrip', () => {
      const qmkData = {
        keyboard_name: 'Roundtrip',
        manufacturer: 'Test',
        url: 'https://roundtrip.test',
        layouts: {
          LAYOUT_ansi: {
            layout: [
              { matrix: [0, 0], x: 0, y: 0 },
              { matrix: [0, 1], x: 1, y: 0, w: 2.25 },
            ],
          },
          LAYOUT_iso: {
            layout: [
              { matrix: [0, 0], x: 0, y: 0 },
              { matrix: [0, 1], x: 1, y: 0, w: 1.25 },
            ],
          },
        },
      }

      const keyboard = convertQmkToKle(qmkData)
      const result = convertKleToQmk({ meta: keyboard.meta, keys: keyboard.keys }) as Record<
        string,
        unknown
      >

      expect(result).not.toBeNull()
      expect(result.keyboard_name).toBe('Roundtrip')
      expect(result.url).toBe('https://roundtrip.test')

      const layouts = result.layouts as Record<string, { layout: Array<Record<string, unknown>> }>
      expect(Object.keys(layouts)).toEqual(['LAYOUT_ansi', 'LAYOUT_iso'])

      const ansiKey = layouts['LAYOUT_ansi']!.layout.find((k) => (k.matrix as number[])[1] === 1)!
      const isoKey = layouts['LAYOUT_iso']!.layout.find((k) => (k.matrix as number[])[1] === 1)!
      expect(ansiKey.w).toBe(2.25)
      expect(isoKey.w).toBe(1.25)
    })

    it('correctly reconstructs 3 named layouts using QMK membership labels', () => {
      // Mirrors the multi-layout scenario: shared keys + layout-specific variants
      const qmkData = {
        keyboard_name: 'TriLayout',
        layouts: {
          LAYOUT_base: {
            layout: [
              { matrix: [0, 0], x: 0, y: 0 }, // shared
              { matrix: [0, 1], x: 1, y: 0, w: 2.75 }, // base only
            ],
          },
          LAYOUT_split: {
            layout: [
              { matrix: [0, 0], x: 0, y: 0 }, // shared
              { matrix: [0, 1], x: 1, y: 0, w: 1.75 }, // split + all
              { matrix: [0, 2], x: 2.75, y: 0 }, // split + all
            ],
          },
          LAYOUT_all: {
            layout: [
              { matrix: [0, 0], x: 0, y: 0 }, // shared
              { matrix: [0, 1], x: 1, y: 0, w: 1.75 }, // split + all
              { matrix: [0, 2], x: 2.75, y: 0 }, // split + all
              { matrix: [0, 3], x: 3.75, y: 0 }, // all only
            ],
          },
        },
      }

      const keyboard = convertQmkToKle(qmkData)
      // 5 distinct physical keys: [0,0] shared + [0,1] w=2.75 + [0,1] w=1.75 + [0,2] + [0,3]
      expect(keyboard.keys).toHaveLength(5)

      const result = convertKleToQmk({ meta: keyboard.meta, keys: keyboard.keys }) as Record<
        string,
        unknown
      >

      const layouts = result.layouts as Record<string, { layout: Array<Record<string, unknown>> }>
      expect(Object.keys(layouts)).toEqual(['LAYOUT_base', 'LAYOUT_split', 'LAYOUT_all'])

      // LAYOUT_base: shared [0,0] + wide [0,1]
      const base = layouts['LAYOUT_base']!.layout
      expect(base).toHaveLength(2)
      expect(base.find((k) => (k.matrix as number[])[1] === 1)?.w).toBe(2.75)
      expect(base.find((k) => (k.matrix as number[])[1] === 2)).toBeUndefined()

      // LAYOUT_split: shared [0,0] + narrow [0,1] + [0,2]
      const split = layouts['LAYOUT_split']!.layout
      expect(split).toHaveLength(3)
      expect(split.find((k) => (k.matrix as number[])[1] === 1)?.w).toBe(1.75)

      // LAYOUT_all: shared [0,0] + narrow [0,1] + [0,2] + [0,3]
      const all = layouts['LAYOUT_all']!.layout
      expect(all).toHaveLength(4)
      expect(all.find((k) => (k.matrix as number[])[1] === 3)).toBeDefined()
    })

    it('roundtrip with rotation values produces no floating-point artifacts', () => {
      const qmkData = {
        keyboard_name: 'Corne',
        layouts: {
          LAYOUT_default: {
            layout: [
              { matrix: [3, 3], x: 4, y: 4.25 },
              { matrix: [3, 4], x: 4, y: 4.25, r: 15, rx: 4.5, ry: 9.1 },
              { matrix: [3, 5], x: 4, y: 4.25, h: 1.5, r: 30, rx: 5.4, ry: 9.3 },
            ],
          },
        },
      }

      const keyboard = convertQmkToKle(qmkData)
      const result = convertKleToQmk({ meta: keyboard.meta, keys: keyboard.keys }) as Record<
        string,
        unknown
      >
      const layouts = result.layouts as Record<string, { layout: Array<Record<string, unknown>> }>
      const keys = layouts['LAYOUT_default']!.layout

      // All values must be clean numbers — no floating-point noise
      const numericEntries = keys.flatMap((key) =>
        Object.entries(key).filter(([k, v]) => k !== 'matrix' && typeof v === 'number'),
      ) as [string, number][]

      for (const [k, v] of numericEntries) {
        expect(
          String(v).includes('e') === false,
          `${k}=${v} should not be in scientific notation`,
        ).toBe(true)
        expect(v, `${k}=${v} should not have fp noise`).toBe(parseFloat(v.toFixed(6)))
      }

      // Specific values must match originals exactly
      const k0 = keys.find((k) => (k.matrix as number[])[1] === 3)!
      const k1 = keys.find((k) => (k.matrix as number[])[1] === 4)!
      const k2 = keys.find((k) => (k.matrix as number[])[1] === 5)!
      expect(k0).toEqual({ matrix: [3, 3], x: 4, y: 4.25 })
      expect(k1).toEqual({ matrix: [3, 4], x: 4, y: 4.25, r: 15, rx: 4.5, ry: 9.1 })
      expect(k2).toEqual({ matrix: [3, 5], x: 4, y: 4.25, h: 1.5, r: 30, rx: 5.4, ry: 9.3 })
    })
  })

  describe('convertKleToQmk — kle_v3.json-style keyboard', () => {
    // This mirrors the structure of kle_v3.json: a real keyboard with matrix annotations,
    // multiple independent VIA options at labels[3], and rotated keys with fp-prone coords.
    it('generates per-choice QMK layouts for labels[3] option groups', () => {
      const kleData = makeKleInternal([
        // Shared keys (no option/choice)
        { labels: labelsAt('0,0'), x: 0, y: 0 },
        { labels: labelsAt('0,1'), x: 1, y: 0 },
        // Option 1: enter shape — choice 0 = ANSI (w=2.25), choice 1 = ISO (w=1.5)
        { labels: labelsAt('2,13', 3, '1,0'), x: 12.25, y: 2, w: 2.25 },
        { labels: labelsAt('2,13', 3, '1,1'), x: 12.25, y: 2, w: 1.5 },
        // Option 5: bottom row — choice 0 = standard (w=2.75), choice 1 = split (w=1.5 + extra key)
        { labels: labelsAt('4,0', 3, '5,0'), x: 0, y: 4, w: 2.75 },
        { labels: labelsAt('4,0', 3, '5,1'), x: 0, y: 4, w: 1.5 },
        { labels: labelsAt('4,1', 3, '5,1'), x: 1.5, y: 4 },
      ])
      const result = convertKleToQmk(kleData) as Record<string, unknown>
      const layouts = result.layouts as Record<string, { layout: Array<Record<string, unknown>> }>

      // Options 1 and 5, each with choice 1 → LAYOUT + LAYOUT_option1_1 + LAYOUT_option5_1
      expect(Object.keys(layouts)).toEqual(['LAYOUT', 'LAYOUT_option1_1', 'LAYOUT_option5_1'])

      // Default: 2 shared + ANSI enter + standard shift = 4 keys
      expect(layouts['LAYOUT']!.layout).toHaveLength(4)
      expect(layouts['LAYOUT']!.layout.find((k) => k.w === 2.25)).toBeDefined() // ANSI
      expect(layouts['LAYOUT']!.layout.find((k) => k.w === 2.75)).toBeDefined() // standard shift

      // ISO enter variant: 2 shared + ISO enter + standard shift = 4 keys
      expect(layouts['LAYOUT_option1_1']!.layout).toHaveLength(4)
      expect(layouts['LAYOUT_option1_1']!.layout.find((k) => k.w === 1.5)).toBeDefined() // ISO

      // Split shift variant: 2 shared + ANSI enter + split shift (2 keys) = 5 keys
      expect(layouts['LAYOUT_option5_1']!.layout).toHaveLength(5)
      expect(layouts['LAYOUT_option5_1']!.layout.find((k) => k.w === 1.5)).toBeDefined()
      expect(
        layouts['LAYOUT_option5_1']!.layout.find((k) => (k.matrix as number[])[1] === 1),
      ).toBeDefined() // extra split key [4,1]
    })

    it('kle_v3.json-style with rotated keys produces no fp artifacts', () => {
      // Key with exact kle_v3.json rotation values that cause fp noise in JS
      // rx=5.5142, kle_x=-1.125 → abs_x = 5.5142 - 1.125 = 4.3892000000000003
      // ry=5.6062, kle_y=-0.5  → abs_y = 5.6062 - 0.5  = 5.1062000000000003
      const kleData = makeKleInternal([
        {
          labels: labelsAt('4,4', 3, '3,0'),
          x: 5.5142 + -1.125,
          y: 5.6062 + -0.5,
          w: 2.25,
          r: 36.4,
          rx: 5.5142,
          ry: 5.6062,
        },
        {
          labels: labelsAt('4,3', 3, '3,1'),
          x: 5.5142 + -1.1242,
          y: 5.6062 + 0.5038,
          r: 36.4,
          rx: 5.5142,
          ry: 5.6062,
        },
        {
          labels: labelsAt('4,4', 3, '3,1'),
          x: 5.5142 + -0.1242,
          y: 5.6062 + 0.5038,
          w: 1.25,
          r: 36.4,
          rx: 5.5142,
          ry: 5.6062,
        },
      ])
      const result = convertKleToQmk(kleData) as Record<string, unknown>
      const layouts = result.layouts as Record<string, { layout: Array<Record<string, unknown>> }>

      for (const layout of Object.values(layouts)) {
        for (const key of layout.layout) {
          for (const [prop, val] of Object.entries(key)) {
            if (prop === 'matrix' || typeof val !== 'number') continue
            expect(val, `${prop}=${val} must equal rounded self`).toBe(parseFloat(val.toFixed(6)))
          }
        }
      }
    })
  })
})
