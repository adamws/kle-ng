import { describe, it, expect } from 'vitest'
import type { FootprintPad } from '@/utils/kicad/footprint-pads'
import type { PlacedPad } from '@/utils/pcb-tracks/netlist'
import { ledCapacitorConnections } from '../led-connections'

const pad = (owner: string, number: string, x: number, y: number, type = 'smd'): PlacedPad => ({
  key: `${owner}:${number}:${x}`,
  owner,
  pad: {
    number,
    type,
    shape: 'rect',
    at: { x, y, rot: 0 },
    size: { w: 1, h: 1 },
    layers: ['B.Cu'],
  } as FootprintPad,
})

describe('ledCapacitorConnections', () => {
  const led = [
    pad('LED', '1', -2.7, 0.75),
    pad('LED', '2', -2.7, -0.75),
    pad('LED', '3', 2.7, -0.75),
    pad('LED', '4', 2.7, 0.75),
  ]

  it('joins LED VCC (3) to capacitor pad 1, not GND (a ground plane connects it)', () => {
    const cap = [pad('C', '1', 4.7, 5), pad('C', '2', 6.3, 5)]
    expect(ledCapacitorConnections([...led, ...cap])).toEqual([
      { net: 'VCC', from: { x: 2.7, y: -0.75 }, to: { x: 4.7, y: 5 } },
    ])
  })

  it('picks the closest of repeated pads, never a hole or another part', () => {
    const cap = [
      pad('C', '1', 10, 0),
      pad('C', '1', 3, -1),
      pad('C', '1', 2.7, -0.75, 'np_thru_hole'),
      pad('C', '2', 0, 0),
      pad('SW', '1', -2.7, 1),
    ]
    expect(ledCapacitorConnections([...led, ...cap])).toEqual([
      { net: 'VCC', from: { x: 2.7, y: -0.75 }, to: { x: 3, y: -1 } },
    ])
  })

  it('draws nothing without the capacitor', () => {
    expect(ledCapacitorConnections(led)).toEqual([])
  })
})
