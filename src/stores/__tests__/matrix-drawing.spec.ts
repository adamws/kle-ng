import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useMatrixDrawingStore } from '../matrix-drawing'
import { computeSegmentKeys } from '@/utils/matrix-segment'
import type { Key } from '../keyboard'

// Helper: build a plain key at the given layout position with an optional label
const makeKey = (x: number, y: number, label = ''): Key => {
  const labels = new Array(12).fill('')
  labels[0] = label
  return { x, y, width: 1, height: 1, labels } as Key
}

describe('Matrix Drawing Store', () => {
  let store: ReturnType<typeof useMatrixDrawingStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useMatrixDrawingStore()
  })

  describe('completeSequence', () => {
    it('stores a two-key wire when intermediate keys were skipped', () => {
      // A direct (shift) connection produces a sequence with only the endpoints
      const a = makeKey(0, 0)
      const c = makeKey(2, 0)

      store.enableDrawing('row')
      store.addKeyToSequence(a)
      store.addKeyToSequence(c)
      store.completeSequence()

      expect(store.completedRows.get(0)).toEqual([a, c])
      expect(store.currentSequence).toHaveLength(0)
    })

    it('merges a single key into an existing row instead of creating a new one', () => {
      const a = makeKey(0, 0, '0,')
      const b = makeKey(1, 0, '0,')
      const d = makeKey(3, 0)
      const allKeys = [a, b, d]

      store.enableDrawing('row')
      store.completedRows.set(0, [a, b])

      // Clicking a key that already belongs to row 0 continues that row
      expect(store.canAddKeyToSequence(a, allKeys)).toBe(true)
      store.addKeyToSequence(a)
      store.setInsertAfterIndex(1, b)

      store.addKeyToSequence(d)
      store.completeSequence()

      expect(store.completedRows.size).toBe(1)
      expect(store.completedRows.get(0)).toEqual([a, b, d])
    })
  })

  describe('segment commit (computeSegmentKeys + store)', () => {
    it('rejects a swept key that would duplicate a matrix position of an earlier key in the same segment', () => {
      // Column mode with rows already assigned. The sweep picks up two keys that
      // share row 3 - only the first may join, the second would produce a
      // duplicate "3,<col>" once the sequence completes.
      const a = makeKey(0, 0, '0,')
      const b = makeKey(0, 1, '3,')
      const c = makeKey(0.4, 2, '3,')
      const allKeys = [a, b, c]

      store.enableDrawing('column')
      store.addKeyToSequence(a)

      const { legalKeys, illegalKeys } = computeSegmentKeys({
        lastKey: a,
        targetKey: c,
        allKeys,
        sensitivity: 0,
        direct: false,
        isInSequence: (k) => store.currentSequence.includes(k),
        canAdd: (k) => store.canAddKeyToSequence(k, allKeys),
        onAccept: (k) => store.addKeyToSequence(k),
      })

      expect(legalKeys).toEqual([b])
      expect(illegalKeys).toEqual([c])
      expect(store.currentSequence).toEqual([a, b])
    })
  })

  describe('canAddKeyToSequence', () => {
    it('rejects a key that belongs to a different row', () => {
      const a = makeKey(0, 0, '0,')
      const other = makeKey(0, 1, '1,')
      const allKeys = [a, other]

      store.enableDrawing('row')
      store.completedRows.set(0, [a])
      store.completedRows.set(1, [other])

      // Start continuing row 0
      expect(store.canAddKeyToSequence(a, allKeys)).toBe(true)
      store.addKeyToSequence(a)

      // A key from row 1 cannot join the row 0 sequence
      expect(store.canAddKeyToSequence(other, allKeys)).toBe(false)
    })
  })
})
