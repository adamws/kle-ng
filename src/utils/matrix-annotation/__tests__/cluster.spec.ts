import { describe, it, expect } from 'vitest'
import { clusterAnnotationAlgorithm } from '../cluster'
import type { Key } from '@/stores/keyboard'

function makeKey(overrides: Partial<Key> = {}): Key {
  const emptyLabels = ['', '', '', '', '', '', '', '', '', '', '', ''] as [
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
  ]
  return {
    x: 0,
    y: 0,
    width: 1,
    height: 1,
    rotation_angle: 0,
    rotation_x: 0,
    rotation_y: 0,
    ghost: false,
    decal: false,
    labels: [...emptyLabels],
    color: '#cccccc',
    textColor: [...emptyLabels],
    textSize: [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
    default: { textColor: '#000000', textSize: 3 },
    x2: 0,
    y2: 0,
    width2: 1,
    height2: 1,
    stepped: false,
    nub: false,
    profile: '',
    sm: '',
    sb: '',
    st: '',
    switchRotation: 0,
    stabRotation: 0,
    ...overrides,
  } as Key
}

describe('clusterAnnotationAlgorithm', () => {
  describe('collision shifting — no key is ever dropped', () => {
    it('assigns distinct columns when two keys round to the same (row, col)', () => {
      // Both centers at y=0 round to row 0; both x centers (0.4+0.5=0.9, 0.6+0.5=1.1)
      // round to col 1 — a collision. The second key must be shifted to col 2.
      const keys = [makeKey({ x: 0.4, y: 0 }), makeKey({ x: 0.6, y: 0 })]
      const result = clusterAnnotationAlgorithm.annotate(keys)

      expect(result.status).toBe('success')
      const cols = result.assignments.map((a) => a?.col)
      expect(cols[0]).not.toBeNull()
      expect(cols[1]).not.toBeNull()
      expect(cols[0]).not.toEqual(cols[1])
    })

    it('assigns every key a unique (row, col) even when all keys share the same center', () => {
      // Pathological case: 4 keys all at (0, 0) → all round to (row=0, col=0).
      // Each must be shifted to the next free slot.
      const keys = [
        makeKey({ x: 0, y: 0 }),
        makeKey({ x: 0, y: 0 }),
        makeKey({ x: 0, y: 0 }),
        makeKey({ x: 0, y: 0 }),
      ]
      const result = clusterAnnotationAlgorithm.annotate(keys)

      expect(result.status).toBe('success')
      const pairs = result.assignments.map((a) => `${a?.row},${a?.col}`)
      const unique = new Set(pairs)
      expect(unique.size).toBe(4)
    })

    it('emits a warning when collisions are resolved', () => {
      const keys = [makeKey({ x: 0.4, y: 0 }), makeKey({ x: 0.6, y: 0 })]
      const result = clusterAnnotationAlgorithm.annotate(keys)
      const hasCollisionWarning = result.warnings.some(
        (w) => w.kind === 'algorithm-specific' && w.message.includes('collision'),
      )
      expect(hasCollisionWarning).toBe(true)
    })

    it('produces no collision warning for a clean grid with no overlapping centers', () => {
      const keys = [
        makeKey({ x: 0, y: 0 }),
        makeKey({ x: 1, y: 0 }),
        makeKey({ x: 0, y: 1 }),
        makeKey({ x: 1, y: 1 }),
      ]
      const result = clusterAnnotationAlgorithm.annotate(keys)
      const hasCollisionWarning = result.warnings.some(
        (w) => w.kind === 'algorithm-specific' && w.message.includes('collision'),
      )
      expect(hasCollisionWarning).toBe(false)
    })
  })

  describe('ghost and decal keys', () => {
    it('returns null assignments for ghost and decal keys', () => {
      const keys = [
        makeKey({ x: 0, y: 0, ghost: true }),
        makeKey({ x: 1, y: 0 }),
        makeKey({ x: 2, y: 0, decal: true }),
      ]
      const result = clusterAnnotationAlgorithm.annotate(keys)

      expect(result.assignments[0]).toBeNull()
      expect(result.assignments[1]).not.toBeNull()
      expect(result.assignments[2]).toBeNull()
    })

    it('returns success with all-null assignments when every key is ghost or decal', () => {
      const keys = [makeKey({ ghost: true }), makeKey({ decal: true })]
      const result = clusterAnnotationAlgorithm.annotate(keys)

      expect(result.status).toBe('success')
      expect(result.assignments).toHaveLength(2)
      expect(result.assignments[0]).toBeNull()
      expect(result.assignments[1]).toBeNull()
    })
  })

  describe('basic annotation correctness', () => {
    it('assigns zero-based dense row/col indices to a regular grid', () => {
      const keys = [
        makeKey({ x: 0, y: 0 }),
        makeKey({ x: 1, y: 0 }),
        makeKey({ x: 0, y: 1 }),
        makeKey({ x: 1, y: 1 }),
      ]
      const result = clusterAnnotationAlgorithm.annotate(keys)

      expect(result.status).toBe('success')
      // Row 0: keys 0 and 1; Row 1: keys 2 and 3
      expect(result.assignments[0]).toEqual({ row: 0, col: 0 })
      expect(result.assignments[1]).toEqual({ row: 0, col: 1 })
      expect(result.assignments[2]).toEqual({ row: 1, col: 0 })
      expect(result.assignments[3]).toEqual({ row: 1, col: 1 })
    })

    it('annotates a single key at (row=0, col=0)', () => {
      const result = clusterAnnotationAlgorithm.annotate([makeKey({ x: 5, y: 3 })])
      expect(result.status).toBe('success')
      expect(result.assignments[0]).toEqual({ row: 0, col: 0 })
    })

    it('records variant=world in meta for non-rotated layouts', () => {
      const result = clusterAnnotationAlgorithm.annotate([makeKey({ x: 0, y: 0 })])
      expect(result.meta?.variant).toBe('world')
    })
  })
})
