/**
 * DRC, connectivity and ratsnest over real pad data: the default MX switch
 * with the SOD-123F diode at 5.08 4 90 BACK (the kle-ng default), placed with
 * the committed pad JSON.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'
import { placePads, type FootprintPads } from '@/utils/kicad/footprint-pads'
import type { TrackItem, TrackSegment } from '@/types/tracks'
import { UnionFind } from '../connectivity'
import { runDrc } from '../drc'
import { padNet, type PlacedPad } from '../netlist'
import { padCopperShapes, padHoleShape } from '../shapes'
import { shapeContains } from '../distance'

const PADS_DIR = resolve(__dirname, '../../../../public/data/footprints/pads')
const load = (name: string): FootprintPads =>
  JSON.parse(readFileSync(resolve(PADS_DIR, `${name}.json`), 'utf8'))

function placed(
  switchName = 'SW_Cherry_MX_PCB_1.00u',
  diode = { x: 5.08, y: 4, rotation: 90, side: 'BACK' as const },
): PlacedPad[] {
  const sw = placePads(load(switchName).pads, { x: 0, y: 0, rotation: 0, side: 'FRONT' })
  const d = placePads(load('D_SOD-123F').pads, diode)
  return [
    ...sw.map((pad, i) => ({ key: `SW:${i}`, owner: 'SW', pad })),
    ...d.map((pad, i) => ({ key: `D:${i}`, owner: 'D', pad })),
  ]
}

const track = (
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  layer: 'F.Cu' | 'B.Cu' = 'B.Cu',
  width = 0.25,
): TrackSegment => ({ type: 'track', start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, width, layer })

// kle-ng default preset: SW pad 2 (2.54, -5.08) to D pad 2 (A, 5.08 2.6) on B.Cu
const DEFAULT_PRESET: TrackItem[] = [track(2.54, -5.08, 2.54, 0.06), track(2.54, 0.06, 5.08, 2.6)]

describe('netlist', () => {
  it('follows kbplacer’s convention', () => {
    expect(padNet('SW', '1')).toBe('COL')
    expect(padNet('SW', '2')).toBe('SW_D')
    expect(padNet('D', '1')).toBe('ROW')
    expect(padNet('D', '2')).toBe('SW_D')
    expect(padNet('SW', '')).toBeNull()
    expect(padNet('LED', '2')).toBeNull()
  })
})

describe('UnionFind', () => {
  it('joins sets transitively', () => {
    const uf = new UnionFind(5)
    uf.union(0, 1)
    uf.union(3, 4)
    uf.union(1, 4)
    expect(uf.find(0)).toBe(uf.find(3))
    expect(uf.find(2)).not.toBe(uf.find(0))
  })
})

describe('pad shapes', () => {
  it('match the placed pad geometry', () => {
    const pads = placed()
    const anode = pads.find((p) => p.owner === 'D' && p.pad.number === '2')!
    // SOD-123F pad: 1.1 × 1.1 roundrect, rotated with the diode
    const [shape] = padCopperShapes(anode.pad)
    expect(shapeContains(shape!, { x: 5.08, y: 2.6 })).toBe(true)
    expect(shapeContains(shape!, { x: 5.08 + 0.54, y: 2.6 })).toBe(true)
    expect(shapeContains(shape!, { x: 5.08 + 0.6, y: 2.6 })).toBe(false)
    const centreHole = pads.find((p) => p.pad.type === 'np_thru_hole' && p.pad.at.x === 0)!
    expect(padCopperShapes(centreHole.pad)).toEqual([])
    expect(padHoleShape(centreHole.pad)!.r).toBe(2)
  })
})

describe('runDrc', () => {
  it('passes the default preset (DRC-clean in KiCad) and leaves no ratsnest', () => {
    const result = runDrc(placed(), DEFAULT_PRESET)
    expect(result.violations).toEqual([])
    expect(result.ratsnest).toEqual([])
  })

  it('shows the SW pad 2 to D pad 2 ratsnest without tracks', () => {
    const { ratsnest, violations } = runDrc(placed(), [])
    expect(violations).toEqual([])
    expect(ratsnest).toHaveLength(1)
    expect(ratsnest[0]!.net).toBe('SW_D')
    const ends = [ratsnest[0]!.from, ratsnest[0]!.to].map((p) => [p.x, p.y])
    expect(ends).toContainEqual([2.54, -5.08])
    expect(ends.map(([x, y]) => [Number(x!.toFixed(6)), Number(y!.toFixed(6))])).toContainEqual([
      5.08, 2.6,
    ])
  })

  it('attaches the ratsnest to the nearest end of a partial route', () => {
    const { ratsnest } = runDrc(placed(), [DEFAULT_PRESET[0]!])
    expect(ratsnest).toHaveLength(1)
    const ends = [ratsnest[0]!.from, ratsnest[0]!.to]
    expect(ends).toContainEqual({ x: 2.54, y: 0.06 })
  })

  it('reports a short between SW pad 2 and the diode cathode', () => {
    // straight down to K (5.08, 5.4), crossing A on the way
    const { violations } = runDrc(placed(), [
      track(2.54, -5.08, 2.54, 5.4),
      track(2.54, 5.4, 5.08, 5.4),
    ])
    const short = violations.find((v) => v.kind === 'short')
    expect(short?.message).toMatch(/SW pad 2 \(SW_D\)/)
    expect(short?.message).toMatch(/D pad 1 \(ROW\)/)
  })

  // a horizontal track above SW pad 1 (-3.81, -2.54, r 1.25), `gap` from its edge
  const abovePad1 = (gap: number) => {
    const y = -2.54 - 1.25 - 0.125 - gap
    return track(-6, y, -2, y)
  }

  it('reports clearance to a pad of another net', () => {
    const { violations } = runDrc(placed(), [abovePad1(0.15)])
    expect(violations).toHaveLength(1)
    expect(violations[0]!.kind).toBe('clearance')
    expect(violations[0]!.message).toMatch(/SW pad 1 is 0.150 mm, needs 0.200 mm/)
    expect(violations[0]!.pads).toEqual(['SW:0'])
  })

  it('is stricter than the clearance by the safety margin', () => {
    expect(runDrc(placed(), [abovePad1(0.202)]).violations).toEqual([])
    // exactly at the limit is rejected, so nm rounding can't push it below in kbplacer
    expect(runDrc(placed(), [abovePad1(0.2)]).violations.map((v) => v.kind)).toEqual(['clearance'])
  })

  it('ignores pads on other layers', () => {
    // SOD-123F is on B.Cu, so an F.Cu track over it is fine
    const { violations } = runDrc(placed(), [track(4, 4, 6, 4, 'F.Cu')])
    expect(violations).toEqual([])
  })

  it('reports hole clearance to NPTH on every layer', () => {
    // 0.2 mm from the side hole (5.08, 0, r 0.875): fine for copper, not for holes
    const y = 0.875 + 0.125 + 0.2
    const { violations } = runDrc(placed(), [track(3, y, 7, y, 'F.Cu')])
    expect(violations.map((v) => v.kind)).toEqual(['hole-clearance'])
    expect(violations[0]!.message).toMatch(/SW hole is 0.200 mm, needs 0.250 mm/)
  })

  it('reports track to track clearance between nets, not within one', () => {
    const fromSw2 = track(2.54, -5.08, 2.54, -3)
    const floating = track(2.84, -3, 2.84, -1) // 0.05 mm from the first track's end, no net
    const v = runDrc(placed(), [fromSw2, floating]).violations
    expect(v.map((x) => x.kind)).toEqual(['clearance'])
    expect(v[0]!.items).toEqual([0, 1])

    // a T junction joins them into one net
    const joined = track(2.54, -4, 4, -4)
    expect(runDrc(placed(), [fromSw2, joined]).violations).toEqual([])
  })

  it('treats two routes to the same net as one net', () => {
    // separate stubs from SW pad 2 and from D pad 2 that pass close to each other
    const a = track(2.54, -5.08, 2.54, -1)
    const b = track(5.08, 2.6, 2.7, 0.22)
    const { violations, ratsnest } = runDrc(placed(), [a, b])
    expect(violations).toEqual([])
    expect(ratsnest).toHaveLength(1)
  })

  it('warns about items leaving the key cell', () => {
    const { violations } = runDrc(placed(), [track(2.54, -5.08, 2.54, -9.6)])
    expect(violations.map((v) => [v.kind, v.severity])).toEqual([['out-of-cell', 'warning']])
  })

  it('checks vias: copper, hole to hole, and connection across layers', () => {
    const via = {
      type: 'via' as const,
      position: { x: 2.54, y: -1 },
      diameter: 0.6,
      drillDiameter: 0.3,
    }
    const front = track(2.54, -1, 5.08, 1.54, 'F.Cu')
    const back = track(5.08, 1.54, 5.08, 2.6)
    const route: TrackItem[] = [track(2.54, -5.08, 2.54, -1, 'B.Cu'), via, front]
    // the route reaches 5.08 1.54 on F.Cu; finishing on B.Cu needs a via there, so the
    // B.Cu stub stays its own cluster with D pad 2: ratsnest remains
    expect(runDrc(placed(), [...route, back]).ratsnest).toHaveLength(1)
    // a via next to the side hole breaks hole to hole and hole clearance
    const bad = { ...via, position: { x: 5.08, y: -1.2 } }
    const kinds = runDrc(placed(), [bad]).violations.map((v) => v.kind)
    expect(kinds).toContain('hole-to-hole')
    expect(kinds).toContain('hole-clearance')
  })

  it('connects overlapping pads of one net (hybrid MX/Alps pin 1)', () => {
    const { ratsnest } = runDrc(placed('SW_Hybrid_Cherry_MX_Alps_1.00u'), [])
    expect(ratsnest.map((l) => l.net)).toEqual(['SW_D'])
  })

  it('nets every pad sharing a number, so duplicates need joining', () => {
    const pads = placed()
    const pad2 = pads.find((p) => p.owner === 'SW' && p.pad.number === '2')!
    const twin = { ...pad2, key: 'SW:9', pad: { ...pad2.pad, at: { x: -2.54, y: -5.08, rot: 0 } } }
    const { ratsnest } = runDrc([...pads, twin], [])
    expect(ratsnest.filter((l) => l.net === 'SW_D')).toHaveLength(2)
  })
})
