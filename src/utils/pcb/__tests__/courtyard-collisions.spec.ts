import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'
import { placeCourtyard, type Courtyard } from '@/utils/kicad/courtyard'
import { placePads, type FootprintPads } from '@/utils/kicad/footprint-pads'
import type { Placement } from '@/utils/kicad/transform'
import {
  findCourtyardCollisions,
  holesOf,
  KEY_PITCH,
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
const load = (name: string): FootprintPads =>
  JSON.parse(readFileSync(resolve(PADS_DIR, `${name}.json`), 'utf8'))
const NONE: Courtyard = { front: [], back: [] }

const part = (owner: string, name: string, placement: Placement): CourtyardPart => {
  const fp = load(name)
  return {
    owner,
    courtyard: placeCourtyard(fp.courtyard ?? NONE, placement),
    holes: holesOf(placePads(fp.pads, placement)),
  }
}
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
      { a: 'SW', b: 'D', side: 'front', neighbour: null },
    ])
    expect(found[0]!.outlines).toHaveLength(2)
  })

  it("finds a back diode under a hotswap socket's back courtyard", () => {
    const parts = [
      part('SW', 'SW_Hotswap_Kailh_MX_1.00u', SWITCH),
      part('D', 'D_SOD-123F', { ...DIODE, x: 0, y: -4.8 }),
    ]
    // the bodies overlap, and a socket hole reaches into the diode's courtyard
    expect(findCourtyardCollisions(parts).map((c) => `${c.kind} ${c.a} ${c.side}`)).toEqual([
      'overlap SW back',
      'hole SW back',
    ])
    // below the socket, clear of the switch's holes
    const clear = [
      part('SW', 'SW_Hotswap_Kailh_MX_1.00u', SWITCH),
      part('D', 'D_SOD-123F', { ...DIODE, rotation: 0, x: 4, y: 4 }),
    ]
    expect(findCourtyardCollisions(clear)).toEqual([])
  })

  it('is clear for every switch with the default diode', () => {
    const switches = readdirSync(PADS_DIR).filter((f) => f.startsWith('SW_'))
    expect(switches.length).toBeGreaterThan(10)
    const colliding = switches.filter((file) => {
      const parts = [
        part('SW', file.replace(/\.json$/, ''), SWITCH),
        part('D', 'D_SOD-123F', DIODE),
      ]
      return findCourtyardCollisions(parts, NEIGHBOUR_OFFSETS).length > 0
    })
    expect(colliding).toEqual([])
  })

  it("finds a THT diode's pins inside the switch housing on the other side", () => {
    // on the back at the SMD default: its leads come through under the switch
    const parts = [
      part('SW', 'SW_Cherry_MX_PCB_1.00u', SWITCH),
      part('D', 'D_DO-35_SOD27_P7.62mm_Horizontal', DIODE),
    ]
    const found = findCourtyardCollisions(parts, NEIGHBOUR_OFFSETS)
    expect(found.map((c) => `${c.kind} ${c.a} ${c.b} ${c.side}`)).toContain('hole D SW front')
  })

  it('is clear for a THT diode beside the switch', () => {
    // pin 1 (the origin) at (8.89, 3.81), turned 90°: pin 2 at (8.89, -3.81)
    const parts = [
      part('SW', 'SW_Cherry_MX_PCB_1.00u', SWITCH),
      part('D', 'D_DO-35_SOD27_P7.62mm_Horizontal', {
        x: 8.89,
        y: 3.81,
        rotation: 90,
        side: 'BACK',
      }),
    ]
    expect(findCourtyardCollisions(parts, NEIGHBOUR_OFFSETS)).toEqual([])
  })

  it("finds a front diode past the key's edge in the next key's switch", () => {
    const parts = [
      part('SW', 'SW_Cherry_MX_PCB_1.00u', SWITCH),
      part('D', 'D_SOD-123F', { ...DIODE, side: 'FRONT', y: 12 }),
    ]
    expect(findCourtyardCollisions(parts)).toEqual([])
    const found = findCourtyardCollisions(parts, NEIGHBOUR_OFFSETS)
    expect(found.map(({ a, b, side, neighbour }) => ({ a, b, side, neighbour }))).toEqual([
      { a: 'D', b: 'SW', side: 'front', neighbour: 'b' },
    ])
  })

  it('says which neighbouring key a part collides with, once per key', () => {
    const parts = [
      part('SW', 'SW_Cherry_MX_PCB_1.00u', SWITCH),
      part('D', 'D_SOD-123F', { ...DIODE, side: 'FRONT', y: 12 }),
    ]
    expect(findCourtyardCollisions(parts).map((c) => c.offset)).toEqual([])
    const found = findCourtyardCollisions(parts, NEIGHBOUR_OFFSETS)
    // the key below, nowhere else
    expect(found.map((c) => c.offset)).toEqual([{ x: 0, y: KEY_PITCH }])
    // and within the key no offset
    const own = findCourtyardCollisions([
      part('SW', 'SW_Cherry_MX_PCB_1.00u', SWITCH),
      part('D', 'D_SOD-123F', { ...DIODE, side: 'FRONT' }),
    ])
    expect(own.map((c) => c.offset)).toEqual([null])
  })
})
