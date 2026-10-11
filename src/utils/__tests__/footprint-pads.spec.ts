/**
 * Pad geometry pipeline: the s-expression parser, the .kicad_mod pad parser,
 * the committed public/data/footprints/pads/*.json and their placement against
 * kbplacer's golden pad dump (see pcb-coordinate-contract.spec.ts).
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'
import { parseSExpr, SExprError } from '../kicad/sexpr'
import {
  padCopperLayers,
  parseFootprintPads,
  placePads,
  type FootprintPads,
} from '../kicad/footprint-pads'
import golden from './fixtures/pcb-golden-pads.json'

const FOOTPRINTS_DIR = resolve(__dirname, '../../../public/data/footprints')
const TOLERANCE_MM = 1e-5

function loadPads(name: string): FootprintPads {
  return JSON.parse(readFileSync(resolve(FOOTPRINTS_DIR, 'pads', `${name}.json`), 'utf8'))
}

describe('parseSExpr', () => {
  it('parses nested lists, quoted strings and bare atoms', () => {
    expect(parseSExpr('(pad "1" smd (at -1.4 0) (layers "F.Cu" F.Mask))')).toEqual([
      'pad',
      '1',
      'smd',
      ['at', '-1.4', '0'],
      ['layers', 'F.Cu', 'F.Mask'],
    ])
  })

  it('keeps empty strings and handles escapes', () => {
    expect(parseSExpr('(pad "" (descr "a \\"b\\"\\nc"))')).toEqual([
      'pad',
      '',
      ['descr', 'a "b"\nc'],
    ])
  })

  it('rejects unbalanced input', () => {
    expect(() => parseSExpr('(a (b)')).toThrow(SExprError)
    expect(() => parseSExpr(')')).toThrow(SExprError)
    expect(() => parseSExpr('(a "b)')).toThrow(SExprError)
  })
})

describe('parseFootprintPads', () => {
  it('parses a KiCad 5 module with THT and NPTH circle pads', () => {
    const fp = parseFootprintPads(`(module SW_Test (layer F.Cu) (tedit 0)
      (fp_line (start -7.25 -7.25) (end 7.25 -7.25) (layer F.CrtYd) (width 0.05))
      (fp_line (start 7.25 -7.25) (end 7.25 7.25) (layer F.CrtYd) (width 0.05))
      (fp_line (start -9.525 -9.525) (end 9.525 9.525) (layer Dwgs.User) (width 0.1))
      (pad 1 thru_hole circle (at -3.81 -2.54) (size 2.5 2.5) (drill 1.5) (layers *.Cu *.Mask))
      (pad "" np_thru_hole circle (at 0 0) (size 4 4) (drill 4) (layers *.Cu *.Mask)))`)
    expect(fp.footprint).toBe('SW_Test')
    // two courtyard lines, closed by a straight edge (see courtyard.spec.ts)
    expect(fp.courtyard).toEqual({
      front: [
        [
          { x: -7.25, y: -7.25 },
          { x: 7.25, y: -7.25 },
          { x: 7.25, y: 7.25 },
        ],
      ],
      back: [],
    })
    expect(fp.pads).toEqual([
      {
        number: '1',
        type: 'thru_hole',
        shape: 'circle',
        at: { x: -3.81, y: -2.54, rot: 0 },
        size: { w: 2.5, h: 2.5 },
        drill: { w: 1.5, h: 1.5, offset: { x: 0, y: 0 } },
        layers: ['F.Cu', 'B.Cu', 'F.Mask', 'B.Mask'],
      },
      {
        number: '',
        type: 'np_thru_hole',
        shape: 'circle',
        at: { x: 0, y: 0, rot: 0 },
        size: { w: 4, h: 4 },
        drill: { w: 4, h: 4, offset: { x: 0, y: 0 } },
        layers: ['F.Cu', 'B.Cu', 'F.Mask', 'B.Mask'],
      },
    ])
  })

  it('parses a KiCad 9 roundrect SMD pad', () => {
    const fp = parseFootprintPads(`(footprint "D_Test" (version 20241229) (layer "F.Cu")
      (fp_rect (start -2.2 -1.15) (end 2.2 1.15) (layer "F.CrtYd") (stroke (width 0.05)))
      (pad "1" smd roundrect (at -1.4 0 90) (size 1.1 1.2)
        (layers "F.Cu" "F.Mask" "F.Paste") (roundrect_rratio 0.25) (uuid "x")))`)
    expect(fp.pads[0]).toEqual({
      number: '1',
      type: 'smd',
      shape: 'roundrect',
      at: { x: -1.4, y: 0, rot: 90 },
      size: { w: 1.1, h: 1.2 },
      rratio: 0.25,
      layers: ['F.Cu', 'F.Mask', 'F.Paste'],
    })
    expect(padCopperLayers(fp.pads[0]!)).toEqual(['F.Cu'])
  })

  it('parses an oval drill with offset', () => {
    const fp = parseFootprintPads(`(footprint "X"
      (pad "2" thru_hole oval (at 1 2) (size 2 3) (drill oval 1 2 (offset 0 0.5)) (layers "*.Cu")))`)
    expect(fp.pads[0]!.drill).toEqual({ w: 1, h: 2, offset: { x: 0, y: 0.5 } })
    expect(fp.pads[0]!.layers).toEqual(['F.Cu', 'B.Cu'])
  })

  it('parses a custom pad with polygon, rect and circle primitives', () => {
    const fp = parseFootprintPads(`(footprint "X"
      (pad "1" smd custom (at 0 0) (size 1 1) (layers "B.Cu")
        (options (clearance outline) (anchor circle))
        (primitives
          (gr_poly (pts (xy 0 0) (xy 2 0) (xy 2 1)) (width 0.1) (fill yes))
          (gr_rect (start -1 -1) (end 0 0) (width 0))
          (gr_circle (center 3 0) (end 3.5 0) (width 0)))))`)
    const pad = fp.pads[0]!
    expect(pad.anchor).toBe('circle')
    expect(pad.primitives).toEqual([
      {
        type: 'poly',
        points: [
          { x: 0, y: 0 },
          { x: 2, y: 0 },
          { x: 2, y: 1 },
        ],
        width: 0.1,
      },
      {
        type: 'poly',
        points: [
          { x: -1, y: -1 },
          { x: 0, y: -1 },
          { x: 0, y: 0 },
          { x: -1, y: 0 },
        ],
        width: 0,
      },
      { type: 'circle', center: { x: 3, y: 0 }, radius: 0.5, width: 0 },
    ])
  })

  it('rejects files that are not footprints and unknown pad kinds', () => {
    expect(() => parseFootprintPads('(kicad_pcb)')).toThrow(SExprError)
    expect(() =>
      parseFootprintPads('(footprint "X" (pad 1 smd hexagon (at 0 0) (size 1 1)))'),
    ).toThrow(/pad shape/)
  })
})

describe('committed pad JSON', () => {
  const svgNames = ['front', 'back'].flatMap((side) =>
    readdirSync(resolve(FOOTPRINTS_DIR, side))
      .filter((f) => f.endsWith('.svg'))
      .map((f) => f.replace(/\.svg$/, '')),
  )

  it.each([...new Set(svgNames)])('%s has a pads JSON', (name) => {
    expect(existsSync(resolve(FOOTPRINTS_DIR, 'pads', `${name}.json`))).toBe(true)
    const pads = loadPads(name)
    expect(pads.footprint).toBe(name)
    expect(pads.pads.length).toBeGreaterThan(0)
  })
})

interface GoldenPad {
  number: string
  layers: string[]
  switch_local: { x_nm: number; y_nm: number }
}

describe('placed pads match kbplacer (golden dump)', () => {
  const cases = golden.cases.map((c) => ({
    name: `${c.switch_footprint.split(':')[1]}, diode ${c.diode.x} ${c.diode.y} ${c.diode.rotation} ${c.diode.side}`,
    c,
  }))
  it.each(cases)('$name', ({ c }) => {
    const d = c.diode
    const placed = {
      SW1: placePads(loadPads(c.switch_footprint.split(':')[1]!).pads, {
        x: 0,
        y: 0,
        rotation: 0,
        side: 'FRONT',
      }),
      D1: placePads(loadPads(c.diode_footprint.split(':')[1]!).pads, {
        ...d,
        side: d.side as 'FRONT' | 'BACK',
      }),
    }
    for (const footprint of c.footprints) {
      const ours = [...placed[footprint.reference as 'SW1' | 'D1']]
      expect(ours).toHaveLength(footprint.pads.length)
      for (const g of footprint.pads as GoldenPad[]) {
        const x = g.switch_local.x_nm / 1e6
        const y = g.switch_local.y_nm / 1e6
        const i = ours.findIndex(
          (p) =>
            p.number === g.number &&
            Math.abs(p.at.x - x) < TOLERANCE_MM &&
            Math.abs(p.at.y - y) < TOLERANCE_MM,
        )
        expect(
          i,
          `${footprint.reference} pad "${g.number}" at (${x}, ${y})`,
        ).toBeGreaterThanOrEqual(0)
        expect(padCopperLayers(ours[i]!)).toEqual(g.layers)
        ours.splice(i, 1)
      }
    }
  })
})

describe('placePads', () => {
  const pad = parseFootprintPads(`(footprint "X"
    (pad "1" smd custom (at 1 0.5 30) (size 1 1) (drill 1 (offset 0.2 0.3)) (layers "F.Cu" "F.Mask")
      (primitives (gr_poly (pts (xy 0 0) (xy 1 0.5) (xy 0 1))))))`).pads

  // a point in the pad frame, through the pad's own placement, to switch-local
  const toLocal = (
    p: { at: { x: number; y: number; rot: number } },
    q: { x: number; y: number },
  ) => {
    const rad = (p.at.rot * Math.PI) / 180
    return {
      x: p.at.x + q.x * Math.cos(rad) + q.y * Math.sin(rad),
      y: p.at.y - q.x * Math.sin(rad) + q.y * Math.cos(rad),
    }
  }

  it('mirrors BACK pads top to bottom before rotating, and flips layers', () => {
    const [front] = pad
    const [back] = placePads(pad, { x: 5, y: 4, rotation: 90, side: 'BACK' })
    expect(back!.layers).toEqual(['B.Cu', 'B.Mask'])
    const framePoints = (p: typeof front) => {
      const poly = p!.primitives![0]!
      if (poly.type !== 'poly') throw new Error('expected a polygon')
      return [p!.at, p!.drill!.offset, ...poly.points].slice(1)
    }
    // every pad-frame point lands where mirroring the footprint, then rotating
    // it 90° counter-clockwise and moving it puts it: (x, y) -> (5 - y, 4 - x)
    const ours = framePoints(back)
    framePoints(front).forEach((q, i) => {
      const f = toLocal(front!, q)
      const actual = toLocal(back!, ours[i]!)
      expect(actual.x).toBeCloseTo(5 - f.y, 9)
      expect(actual.y).toBeCloseTo(4 - f.x, 9)
    })
    expect(back!.at.x).toBeCloseTo(5 - 0.5, 9)
    expect(back!.at.y).toBeCloseTo(4 - 1, 9)
  })

  it('leaves the library pads untouched', () => {
    const before = JSON.stringify(pad)
    placePads(pad, { x: 1, y: 1, rotation: 45, side: 'BACK' })
    expect(JSON.stringify(pad)).toBe(before)
  })
})
