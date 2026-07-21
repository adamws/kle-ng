import { describe, it, expect } from 'vitest'
import {
  getLedFootprintFilename,
  getCapacitorFootprintFilename,
  calculateCompositeViewBoxMulti,
  type OffsetFootprint,
} from '../footprintUtils'
import type { ViewBox } from '@/types/footprint'

describe('footprintUtils — LED chain helpers', () => {
  describe('getLedFootprintFilename', () => {
    it('extracts the footprint name after the library separator', () => {
      expect(
        getLedFootprintFilename('LED_SMD:LED_SK6812MINI-E_3.2x2.8mm_P1.5mm_ReverseMount'),
      ).toBe('LED_SK6812MINI-E_3.2x2.8mm_P1.5mm_ReverseMount.svg')
    })

    it('falls back for malformed values', () => {
      expect(getLedFootprintFilename('no-separator')).toBe(
        'LED_SK6812MINI-E_3.2x2.8mm_P1.5mm_ReverseMount.svg',
      )
    })
  })

  describe('getCapacitorFootprintFilename', () => {
    it('extracts the footprint name after the library separator', () => {
      expect(getCapacitorFootprintFilename('Capacitor_SMD:C_0402_1005Metric')).toBe(
        'C_0402_1005Metric.svg',
      )
    })

    it('falls back for malformed values', () => {
      expect(getCapacitorFootprintFilename('bad')).toBe('C_0402_1005Metric.svg')
    })
  })

  describe('calculateCompositeViewBoxMulti', () => {
    const switchVB: ViewBox = { x: 0, y: 0, width: 10, height: 10 }

    it('unions the switch bounds with a single offset footprint (no rotation)', () => {
      const offsets: OffsetFootprint[] = [
        { vb: { x: 0, y: 0, width: 2, height: 2 }, offsetX: 5, offsetY: 0, rotation: 0 },
      ]

      // Switch centered → [-5,5]². Offset footprint spans x:[4,6], y:[-1,1].
      // Union x:[-5,6] y:[-5,5], padded by 1 → "-6 -6 13 12".
      expect(calculateCompositeViewBoxMulti(switchVB, offsets, 0, 1)).toBe('-6 -6 13 12')
    })

    it('expands the box to include multiple offset footprints (LED + capacitor)', () => {
      const offsets: OffsetFootprint[] = [
        { vb: { x: 0, y: 0, width: 2, height: 2 }, offsetX: 0, offsetY: 5, rotation: 0 }, // diode below
        { vb: { x: 0, y: 0, width: 3.5, height: 3.5 }, offsetX: 0, offsetY: 8, rotation: 0 }, // LED further below
      ]

      const [, minY, , height] = calculateCompositeViewBoxMulti(switchVB, offsets, 0, 0)
        .split(' ')
        .map(Number)

      // LED at offsetY 8 with half-height 1.75 reaches y=9.75, beyond the switch (5).
      expect(minY).toBe(-5)
      expect(height).toBeCloseTo(9.75 - -5, 6)
    })
  })
})
