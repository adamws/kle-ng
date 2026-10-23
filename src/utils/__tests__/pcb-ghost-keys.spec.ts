/**
 * Tests for ghost key filtering used by the PCB generator.
 */

import { describe, it, expect } from 'vitest'
import { stripGhostKeys } from '../pcb-ghost-keys'

describe('pcb-ghost-keys', () => {
  describe('stripGhostKeys', () => {
    it('removes ghost keys only', () => {
      const layout = {
        meta: {},
        keys: [
          { labels: ['0,0'], ghost: false },
          { labels: ['OLED'], ghost: true },
          { labels: ['0,1'], decal: true },
        ],
      }

      const result = stripGhostKeys(layout)

      expect(result.keys.map((k) => k.labels[0])).toEqual(['0,0', '0,1'])
    })

    it('does not mutate the input layout', () => {
      const layout = { meta: {}, keys: [{ labels: ['OLED'], ghost: true }] }
      stripGhostKeys(layout)
      expect(layout.keys).toHaveLength(1)
    })

    it('returns the input unchanged when there are no ghost keys', () => {
      const layout = { meta: {}, keys: [{ labels: ['0,0'], ghost: false }] }
      expect(stripGhostKeys(layout)).toBe(layout)
    })

    it('handles layouts without keys', () => {
      expect(stripGhostKeys(null)).toBeNull()
      const layout = { meta: {} }
      expect(stripGhostKeys(layout)).toBe(layout)
    })
  })
})
