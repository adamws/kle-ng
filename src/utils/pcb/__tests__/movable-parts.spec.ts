import { describe, it, expect } from 'vitest'
import type { PcbSettings } from '@/types/pcb'
import { padInfos } from '@/utils/pcb-tracks/connectivity'
import type { FootprintPad } from '@/utils/kicad/footprint-pads'
import type { CourtyardPart } from '../courtyard-collisions'
import {
  isMovablePart,
  partAt,
  partPlacement,
  rotateClockwise,
  setPartPlacement,
} from '../movable-parts'

const square = (x: number, y: number, s: number) => [
  { x, y },
  { x: x + s, y },
  { x: x + s, y: y + s },
  { x, y: y + s },
]

const part = (owner: string, outline: { x: number; y: number }[]): CourtyardPart => ({
  owner,
  courtyard: { front: [], back: [outline] },
  holes: [],
})

const smdPad = (x: number, y: number): FootprintPad => ({
  number: '1',
  type: 'smd',
  shape: 'rect',
  at: { x, y, rot: 0 },
  size: { w: 1, h: 1 },
  layers: ['B.Cu'],
})

describe('movable parts', () => {
  it('reads and writes the placement fields of each part', () => {
    const settings = {
      diodePositionX: 5.08,
      diodePositionY: 4,
      diodeRotation: 90,
      ledPositionX: 0,
      ledPositionY: 5.25,
      ledRotation: 0,
      ledCapacitorPositionX: 5.5,
      ledCapacitorPositionY: 5.75,
      ledCapacitorRotation: 180,
    } as PcbSettings
    expect(partPlacement(settings, 'D')).toEqual({ x: 5.08, y: 4, rotation: 90 })
    expect(partPlacement(settings, 'C')).toEqual({ x: 5.5, y: 5.75, rotation: 180 })

    setPartPlacement(settings, 'LED', { x: 1, y: 2 })
    expect(partPlacement(settings, 'LED')).toEqual({ x: 1, y: 2, rotation: 0 })
    setPartPlacement(settings, 'LED', { rotation: 270 })
    expect(settings.ledRotation).toBe(270)
    // the others are untouched
    expect(partPlacement(settings, 'D')).toEqual({ x: 5.08, y: 4, rotation: 90 })
  })

  it('turns a quarter clockwise on screen (KiCad angles are counter-clockwise)', () => {
    expect([90, 0, 270, 180, 45, -90, 450].map(rotateClockwise)).toEqual([
      0, 270, 180, 90, 315, 180, 0,
    ])
  })

  it('knows the parts it can move: not the switch', () => {
    expect(['D', 'LED', 'C', 'SW', null].map(isMovablePart)).toEqual([
      true,
      true,
      true,
      false,
      false,
    ])
  })

  it('picks the smallest courtyard around a point, never the switch', () => {
    const parts = [
      part('SW', square(-7, -7, 14)),
      part('D', square(0, 0, 6)),
      part('C', square(4, 4, 2)),
    ]
    expect(partAt({ x: 5, y: 5 }, [], parts)).toBe('C')
    expect(partAt({ x: 1, y: 1 }, [], parts)).toBe('D')
    expect(partAt({ x: -3, y: -3 }, [], parts)).toBeNull()
    expect(partAt({ x: 20, y: 20 }, [], parts)).toBeNull()
  })

  it('prefers the owner of the pad under the point', () => {
    const parts = [part('D', square(0, 0, 6)), part('C', square(4, 4, 2))]
    const pads = padInfos([{ key: 'D:0', owner: 'D', pad: smdPad(5, 5) }])
    expect(partAt({ x: 5, y: 5 }, pads, parts)).toBe('D')
    // the switch's pads don't pick it
    const swPads = padInfos([{ key: 'SW:0', owner: 'SW', pad: smdPad(5, 5) }])
    expect(partAt({ x: 5, y: 5 }, swPads, parts)).toBe('C')
  })
})
