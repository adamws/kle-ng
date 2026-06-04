/**
 * Tests for VIA rotary encoder detection used by the PCB generator.
 */

import { describe, it, expect } from 'vitest'
import { applyViaEncoderSwitchMount } from '../pcb-encoder'

// Helper: build a kle-internal-style key with a label at the center (index 4).
function keyWithCenterLabel(label: string | null) {
  const labels: (string | null)[] = [null, null, null, null, label]
  return { labels, x: 0, y: 0, sm: '' }
}

describe('pcb-encoder', () => {
  describe('applyViaEncoderSwitchMount', () => {
    it('sets sm="rot_ec11" on encoder keys only', () => {
      const layout = {
        meta: {},
        keys: [keyWithCenterLabel('e0'), keyWithCenterLabel('A')],
      }

      const result = applyViaEncoderSwitchMount(layout)

      expect(result.keys[0]!.sm).toBe('rot_ec11')
      expect(result.keys[1]!.sm).toBe('')
    })

    it('detects multi-digit encoder indices', () => {
      const layout = { meta: {}, keys: [keyWithCenterLabel('e12')] }
      expect(applyViaEncoderSwitchMount(layout).keys[0]!.sm).toBe('rot_ec11')
    })

    it('ignores encoder labels at a non-center position', () => {
      const layout = { meta: {}, keys: [{ labels: ['e0'], x: 0, y: 0, sm: '' }] }
      const result = applyViaEncoderSwitchMount(layout)
      expect(result).toBe(layout)
      expect(result.keys[0]!.sm).toBe('')
    })

    it('ignores non-matching center labels', () => {
      const layout = {
        meta: {},
        keys: [keyWithCenterLabel('encoder'), keyWithCenterLabel('1'), keyWithCenterLabel('')],
      }
      expect(applyViaEncoderSwitchMount(layout)).toBe(layout)
    })

    it('returns the input unchanged for nullish layouts', () => {
      expect(applyViaEncoderSwitchMount(null)).toBe(null)
      expect(applyViaEncoderSwitchMount(undefined)).toBe(undefined)
    })

    it('preserves the encoder label (backend clears it on its side)', () => {
      const layout = { meta: {}, keys: [keyWithCenterLabel('e3')] }
      const result = applyViaEncoderSwitchMount(layout)
      expect(result.keys[0]!.labels[4]).toBe('e3')
    })

    it('does not mutate the input layout', () => {
      const original = { meta: {}, keys: [keyWithCenterLabel('e0')] }
      const result = applyViaEncoderSwitchMount(original)

      expect(original.keys[0]!.sm).toBe('')
      expect(result).not.toBe(original)
      expect(result.keys).not.toBe(original.keys)
      expect(result.keys[0]).not.toBe(original.keys[0])
    })

    it('returns the input unchanged when there are no keys', () => {
      const layout = { meta: {} }
      expect(applyViaEncoderSwitchMount(layout)).toBe(layout)
    })

    it('returns the input unchanged when keys exist but none are encoders', () => {
      const layout = { meta: {}, keys: [keyWithCenterLabel('A'), keyWithCenterLabel('B')] }
      const result = applyViaEncoderSwitchMount(layout)
      // No encoders: skip the copy entirely and hand back the same references.
      expect(result).toBe(layout)
      expect(result.keys).toBe(layout.keys)
      expect(result.keys[0]).toBe(layout.keys[0])
    })
  })
})
