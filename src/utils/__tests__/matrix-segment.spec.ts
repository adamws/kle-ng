import { describe, it, expect } from 'vitest'
import { computeSegmentKeys } from '../matrix-segment'
import type { Key } from '@/stores/keyboard'

// Helper: build a plain key at the given layout position
const key = (x: number, y: number, width = 1, height = 1) => ({ x, y, width, height }) as Key

const allowAll = () => true
const denyNone = () => false

describe('computeSegmentKeys', () => {
  describe('gap filling (direct = false)', () => {
    it('collects intermediate keys along the line', () => {
      const a = key(0, 0)
      const b = key(1, 0)
      const c = key(2, 0)
      const keys = [a, b, c]

      const { legalKeys, illegalKeys } = computeSegmentKeys({
        lastKey: a,
        targetKey: c,
        allKeys: keys,
        sensitivity: 0.3,
        direct: false,
        isInSequence: (k) => k === a,
        canAdd: allowAll,
      })

      expect(legalKeys).toEqual([b, c])
      expect(illegalKeys).toEqual([])
    })

    it('splits legal and illegal keys while preserving traversal order', () => {
      const a = key(0, 0)
      const b = key(1, 0)
      const c = key(2, 0)
      const d = key(3, 0)
      const keys = [a, b, c, d]

      const { legalKeys, illegalKeys } = computeSegmentKeys({
        lastKey: a,
        targetKey: d,
        allKeys: keys,
        sensitivity: 0.3,
        direct: false,
        isInSequence: (k) => k === a,
        canAdd: (k) => k !== c,
      })

      expect(legalKeys).toEqual([b, d])
      expect(illegalKeys).toEqual([c])
    })

    it('excludes keys already in the sequence from both results', () => {
      const a = key(0, 0)
      const b = key(1, 0)
      const c = key(2, 0)
      const keys = [a, b, c]

      const { legalKeys, illegalKeys } = computeSegmentKeys({
        lastKey: a,
        targetKey: c,
        allKeys: keys,
        sensitivity: 0.3,
        direct: false,
        isInSequence: (k) => k === a || k === b,
        canAdd: allowAll,
      })

      expect(legalKeys).toEqual([c])
      expect(illegalKeys).toEqual([])
    })

    it('appends the target key exactly once when the sweep misses it', () => {
      const a = key(0, 0)
      const b = key(1, 0)
      // Target is far off the line axis, so a strict sensitivity excludes it
      const target = key(3, 4)
      const keys = [a, b, target]

      const { legalKeys } = computeSegmentKeys({
        lastKey: a,
        targetKey: target,
        allKeys: keys,
        sensitivity: 0.99,
        direct: false,
        isInSequence: (k) => k === a,
        canAdd: allowAll,
      })

      expect(legalKeys.filter((k) => k === target)).toHaveLength(1)
      expect(legalKeys[legalKeys.length - 1]).toBe(target)
    })
  })

  describe('onAccept (incremental validation)', () => {
    it('reports each accepted key before validating the next candidate', () => {
      const a = key(0, 0)
      const b = key(1, 0)
      const c = key(2, 0)
      const keys = [a, b, c]

      const accepted: Key[] = []

      const { legalKeys } = computeSegmentKeys({
        lastKey: a,
        targetKey: c,
        allKeys: keys,
        sensitivity: 0.3,
        direct: false,
        isInSequence: (k) => k === a,
        // Reject any key that shares nothing but is validated after b was taken
        canAdd: (k) => !accepted.includes(b) || k !== c,
        onAccept: (k) => accepted.push(k),
      })

      // c is rejected because b was already accepted when c is validated
      expect(accepted).toEqual([b])
      expect(legalKeys).toEqual([b])
    })

    it('is optional - omitting it leaves the batch behaviour unchanged', () => {
      const a = key(0, 0)
      const b = key(1, 0)

      const { legalKeys } = computeSegmentKeys({
        lastKey: a,
        targetKey: b,
        allKeys: [a, b],
        sensitivity: 0.3,
        direct: false,
        isInSequence: (k) => k === a,
        canAdd: allowAll,
      })

      expect(legalKeys).toEqual([b])
    })
  })

  describe('direct point-to-point (direct = true)', () => {
    it('adds only the target key, skipping keys in between', () => {
      const a = key(0, 0)
      const b = key(1, 0)
      const c = key(2, 0)
      const keys = [a, b, c]

      const { legalKeys, illegalKeys } = computeSegmentKeys({
        lastKey: a,
        targetKey: c,
        allKeys: keys,
        sensitivity: 0.3,
        direct: true,
        isInSequence: (k) => k === a,
        canAdd: allowAll,
      })

      expect(legalKeys).toEqual([c])
      expect(illegalKeys).toEqual([])
    })

    it('still reports an illegal target as illegal', () => {
      const a = key(0, 0)
      const c = key(2, 0)

      const { legalKeys, illegalKeys } = computeSegmentKeys({
        lastKey: a,
        targetKey: c,
        allKeys: [a, c],
        sensitivity: 0.3,
        direct: true,
        isInSequence: (k) => k === a,
        canAdd: denyNone,
      })

      expect(legalKeys).toEqual([])
      expect(illegalKeys).toEqual([c])
    })

    it('connects opposite corners of a 3x3 grid without the center key (issue #72)', () => {
      // 3x3 grid of 1u keys
      const grid: Key[] = []
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
          grid.push(key(col, row))
        }
      }
      const topLeft = grid[0]!
      const center = grid[4]!
      const bottomRight = grid[8]!

      const options = {
        lastKey: topLeft,
        targetKey: bottomRight,
        allKeys: grid,
        sensitivity: 0,
        isInSequence: (k: Key) => k === topLeft,
        canAdd: allowAll,
      }

      const direct = computeSegmentKeys({ ...options, direct: true })
      expect(direct.legalKeys).toEqual([bottomRight])
      expect(direct.legalKeys).not.toContain(center)

      // Without the modifier the diagonal still sweeps up the center key
      const swept = computeSegmentKeys({ ...options, direct: false })
      expect(swept.legalKeys).toContain(center)
      expect(swept.legalKeys).toContain(bottomRight)
    })
  })
})
