import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'
import { placeCourtyard, type Courtyard } from '@/utils/kicad/courtyard'
import type { FootprintPads } from '@/utils/kicad/footprint-pads'
import type { Placement } from '@/utils/kicad/transform'
import {
  findCourtyardCollisions,
  NEIGHBOUR_OFFSETS,
  outlinesOverlap,
  type CourtyardPart,
} from '../courtyard-collisions'

const square = (x: number, y: number, s: number) => [
  { x, y },
  { x: x + s, y },
  { x: x + s, y: y + s },
  { x, y: y + s },
]

describe('outlinesOverlap', () => {
  it('needs shared area, not just a shared edge or corner', () => {
    expect(outlinesOverlap(square(0, 0, 2), square(1, 1, 2))).toBe(true)
    expect(outlinesOverlap(square(0, 0, 2), square(2, 0, 2))).toBe(false)
    expect(outlinesOverlap(square(0, 0, 2), square(2, 2, 2))).toBe(false)
    expect(outlinesOverlap(square(0, 0, 2), square(5, 0, 2))).toBe(false)
  })

  it('finds an outline inside another, and coincident outlines', () => {
    expect(outlinesOverlap(square(0, 0, 10), square(2, 2, 1))).toBe(true)
    expect(outlinesOverlap(square(2, 2, 1), square(0, 0, 10))).toBe(true)
    // inside, sharing part of an edge
    expect(outlinesOverlap(square(0, 0, 10), square(0, 2, 1))).toBe(true)
    expect(outlinesOverlap(square(0, 0, 2), square(0, 0, 2))).toBe(true)
  })

  it('lets a part sit in the notch of a concave outline', () => {
    // an L: 4 × 4 with its 2 × 2 top-right quarter cut out
    const l = [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 2 },
      { x: 4, y: 2 },
      { x: 4, y: 4 },
      { x: 0, y: 4 },
    ]
    expect(outlinesOverlap(l, square(2.5, 0.5, 1))).toBe(false)
    expect(outlinesOverlap(l, square(1.5, 0.5, 1))).toBe(true)
  })
})

const PADS_DIR = resolve(__dirname, '../../../../public/data/footprints/pads')
const courtyardOf = (name: string): Courtyard =>
  (JSON.parse(readFileSync(resolve(PADS_DIR, `${name}.json`), 'utf8')) as FootprintPads).courtyard!

const part = (owner: string, name: string, placement: Placement): CourtyardPart => ({
  owner,
  courtyard: placeCourtyard(courtyardOf(name), placement),
})
const SWITCH = { x: 0, y: 0, rotation: 0, side: 'FRONT' } as const
const DIODE = { x: 5.08, y: 4, rotation: 90, side: 'BACK' } as const

describe('findCourtyardCollisions', () => {
  it('is clear for the defaults: an MX switch and a back SOD-123F', () => {
    const parts = [part('SW', 'SW_Cherry_MX_PCB_1.00u', SWITCH), part('D', 'D_SOD-123F', DIODE)]
    expect(findCourtyardCollisions(parts, NEIGHBOUR_OFFSETS)).toEqual([])
  })

  it('finds a front diode under the switch', () => {
    const parts = [
      part('SW', 'SW_Cherry_MX_PCB_1.00u', SWITCH),
      part('D', 'D_SOD-123F', { ...DIODE, side: 'FRONT' }),
    ]
    const found = findCourtyardCollisions(parts, NEIGHBOUR_OFFSETS)
    expect(found.map(({ a, b, side, neighbour }) => ({ a, b, side, neighbour }))).toEqual([
      { a: 'SW', b: 'D', side: 'front', neighbour: false },
    ])
    expect(found[0]!.outlines).toHaveLength(2)
  })

  it("finds a back diode under a hotswap socket's back courtyard", () => {
    const parts = [
      part('SW', 'SW_Hotswap_Kailh_MX_1.00u', SWITCH),
      part('D', 'D_SOD-123F', { ...DIODE, x: 0, y: -4.8 }),
    ]
    expect(findCourtyardCollisions(parts).map((c) => c.side)).toEqual(['back'])
    // the socket's notch around the centre is free
    const clear = [
      part('SW', 'SW_Hotswap_Kailh_MX_1.00u', SWITCH),
      part('D', 'D_SOD-123F', { ...DIODE, rotation: 0, x: 2, y: 1 }),
    ]
    expect(findCourtyardCollisions(clear)).toEqual([])
  })

  it("finds a front diode past the key's edge in the next key's switch", () => {
    const parts = [
      part('SW', 'SW_Cherry_MX_PCB_1.00u', SWITCH),
      part('D', 'D_SOD-123F', { ...DIODE, side: 'FRONT', y: 12 }),
    ]
    expect(findCourtyardCollisions(parts)).toEqual([])
    const found = findCourtyardCollisions(parts, NEIGHBOUR_OFFSETS)
    expect(found.map(({ a, b, side, neighbour }) => ({ a, b, side, neighbour }))).toEqual([
      { a: 'D', b: 'SW', side: 'front', neighbour: true },
    ])
  })
})
