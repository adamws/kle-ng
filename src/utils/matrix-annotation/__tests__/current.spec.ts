import { describe, it, expect } from 'vitest'
import { currentAnnotationAlgorithm } from '../current'
import type { Key } from '@/stores/keyboard'

function makeKey(overrides: Partial<Key> = {}): Key {
  const emptyLabels = ['', '', '', '', '', '', '', '', '', '', '', ''] as [string,string,string,string,string,string,string,string,string,string,string,string]
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

function makeGrid(rows: number, cols: number): Key[] {
  const keys: Key[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      keys.push(makeKey({ x: c, y: r }))
    }
  }
  return keys
}

describe('currentAnnotationAlgorithm', () => {
  describe('rectangular grid', () => {
    it('annotates a 2x2 grid correctly', () => {
      const keys = makeGrid(2, 2)
      const result = currentAnnotationAlgorithm.annotate(keys)

      expect(result.status).toBe('success')
      expect(result.warnings).toHaveLength(0)

      // Row 0: keys at y=0 (indices 0,1)
      expect(result.assignments[0]).toEqual({ row: 0, col: 0 })
      expect(result.assignments[1]).toEqual({ row: 0, col: 1 })
      // Row 1: keys at y=1 (indices 2,3)
      expect(result.assignments[2]).toEqual({ row: 1, col: 0 })
      expect(result.assignments[3]).toEqual({ row: 1, col: 1 })
    })

    it('annotates a 4x12 ortholinear grid', () => {
      const keys = makeGrid(4, 12)
      const result = currentAnnotationAlgorithm.annotate(keys)

      expect(result.status).toBe('success')
      expect(result.assignments).toHaveLength(48)
      expect(result.assignments[0]).toEqual({ row: 0, col: 0 })
      expect(result.assignments[47]).toEqual({ row: 3, col: 11 })
    })

    it('re-indexes non-zero-based raw row/col positions', () => {
      // Keys whose Math.round centers are at rows 2,3 and cols 5,6
      const keys = [
        makeKey({ x: 4.6, y: 1.6 }), // center (5.1, 2.1) → round (5, 2)
        makeKey({ x: 5.6, y: 1.6 }), // center (6.1, 2.1) → round (6, 2)
        makeKey({ x: 4.6, y: 2.6 }), // center (5.1, 3.1) → round (5, 3)
        makeKey({ x: 5.6, y: 2.6 }), // center (6.1, 3.1) → round (6, 3)
      ]
      const result = currentAnnotationAlgorithm.annotate(keys)

      expect(result.status).toBe('success')
      // Should be re-indexed to 0,1
      const rows = new Set(result.assignments.map((a) => a?.row))
      const cols = new Set(result.assignments.map((a) => a?.col))
      expect([...rows].sort()).toEqual([0, 1])
      expect([...cols].sort()).toEqual([0, 1])
    })
  })

  describe('ghost and decal keys', () => {
    it('excludes ghost keys from annotation', () => {
      const keys = [
        makeKey({ x: 0, y: 0, ghost: true }),
        makeKey({ x: 1, y: 0 }),
      ]
      const result = currentAnnotationAlgorithm.annotate(keys)

      expect(result.assignments[0]).toBeNull()
      expect(result.assignments[1]).toMatchObject({ row: 0, col: 0 })
      expect(result.status).toBe('success')
    })

    it('excludes decal keys from annotation', () => {
      const keys = [
        makeKey({ x: 0, y: 0, decal: true }),
        makeKey({ x: 1, y: 0 }),
      ]
      const result = currentAnnotationAlgorithm.annotate(keys)

      expect(result.assignments[0]).toBeNull()
      expect(result.assignments[1]).toMatchObject({ row: 0, col: 0 })
    })
  })

  describe('does not mutate input keys', () => {
    it('leaves input key properties unchanged after annotation', () => {
      const keys = [
        makeKey({ x: 0, y: 0, rotation_angle: 30, rotation_x: 5, rotation_y: 5 }),
      ]
      const rotationAngleBefore = keys[0]!.rotation_angle
      const labels6Before = keys[0]!.labels[6]

      currentAnnotationAlgorithm.annotate(keys)

      expect(keys[0]!.rotation_angle).toBe(rotationAngleBefore)
      expect(keys[0]!.labels[6]).toBe(labels6Before)
    })
  })

  describe('rotation-aware path', () => {
    it('handles a simple rotated 2-key cluster', () => {
      // Two keys with the same rotation group (angle=30, same rx/ry)
      // They should get distinct row,col assignments
      const keys = [
        makeKey({ x: 0, y: 0, width: 1, height: 1, rotation_angle: 30, rotation_x: 2, rotation_y: 2 }),
        makeKey({ x: 1, y: 0, width: 1, height: 1, rotation_angle: 30, rotation_x: 2, rotation_y: 2 }),
      ]
      const result = currentAnnotationAlgorithm.annotate(keys)

      expect(result.status).toBe('success')
      // Both keys assigned
      const a0 = result.assignments[0]
      const a1 = result.assignments[1]
      expect(a0).not.toBeNull()
      expect(a1).not.toBeNull()
      // They should not share the same (row, col)
      expect(`${a0?.row},${a0?.col}`).not.toBe(`${a1?.row},${a1?.col}`)
    })
  })

  describe('duplicate handling', () => {
    it('produces partial status when keys collide and get dropped', () => {
      // Two keys with identical centers after rounding → duplicate
      const keys = [
        makeKey({ x: 0, y: 0 }), // center (0.5, 0.5) → round (1, 1)
        makeKey({ x: 0, y: 0 }), // same center, same round → duplicate
        makeKey({ x: 2, y: 0 }), // unique
      ]
      const result = currentAnnotationAlgorithm.annotate(keys)

      // One key dropped → partial
      expect(result.status).toBe('partial')
      // At least one warning about duplicates or fallback
      expect(result.warnings.length).toBeGreaterThan(0)
    })
  })

  describe('assignments array alignment', () => {
    it('returns assignments array same length as input', () => {
      const keys = makeGrid(3, 5)
      const result = currentAnnotationAlgorithm.annotate(keys)
      expect(result.assignments).toHaveLength(keys.length)
    })

    it('handles empty key array', () => {
      const result = currentAnnotationAlgorithm.annotate([])
      expect(result.assignments).toHaveLength(0)
      expect(result.status).toBe('success')
    })

    it('handles all-ghost layout', () => {
      const keys = [makeKey({ ghost: true }), makeKey({ ghost: true })]
      const result = currentAnnotationAlgorithm.annotate(keys)
      expect(result.assignments[0]).toBeNull()
      expect(result.assignments[1]).toBeNull()
      expect(result.status).toBe('success')
    })
  })
})
