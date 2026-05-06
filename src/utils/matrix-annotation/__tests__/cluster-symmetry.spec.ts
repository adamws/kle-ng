import { describe, it, expect } from 'vitest'
import { clusterSymmetryAnnotationAlgorithm } from '../cluster-symmetry'
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

function makeGrid(rows: number, cols: number): Key[] {
  const keys: Key[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      keys.push(makeKey({ x: c, y: r }))
    }
  }
  return keys
}

describe('clusterSymmetryAnnotationAlgorithm', () => {
  describe('symmetric layouts', () => {
    it('treats a perfectly symmetric ortho grid as symmetric (output equals base)', () => {
      const keys = makeGrid(4, 6) // 4 rows × 6 cols, fully symmetric
      const result = clusterSymmetryAnnotationAlgorithm.annotate(keys)
      expect(result.status).toBe('success')
      expect(result.meta?.symmetry).toBe('enforced')
      // Pairs: 12 (3 columns per side × 4 rows)
      expect(result.meta?.symmetryPairs).toBe(12)
      // The base cluster output is already symmetric, so the assignments should
      // match the unmirrored cluster output exactly.
      const base = clusterAnnotationAlgorithm.annotate(keys)
      expect(result.assignments).toEqual(base.assignments)
    })

    it('forces right-side cols to be totalCols-1-leftCol on a symmetric split layout', () => {
      // Build a small split: 2 rows × (3 + 3) cols separated by a gap.
      const keys: Key[] = []
      for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 3; c++) keys.push(makeKey({ x: c, y: r })) // left
        for (let c = 0; c < 3; c++) keys.push(makeKey({ x: 5 + c, y: r })) // right with x-gap
      }
      const result = clusterSymmetryAnnotationAlgorithm.annotate(keys)
      expect(result.status).toBe('success')
      expect(result.meta?.symmetry).toBe('enforced')

      // Build a row→sorted-cols map and verify pairs sum to (totalCols-1).
      const totalCols = Math.max(...result.assignments.map((a) => a?.col ?? -1)) + 1
      const rows = new Map<number, { col: number; cx: number }[]>()
      const ax = (0 + 7) / 2 // axis = (xmin+xmax)/2 of centers (centers at cx 0.5..7.5)
      keys.forEach((k, i) => {
        const a = result.assignments[i]
        if (!a || a.row == null || a.col == null) return
        if (!rows.has(a.row)) rows.set(a.row, [])
        rows.get(a.row)!.push({ col: a.col, cx: k.x + 0.5 })
      })
      // For each pair (left key, right key) at the same row, cols must be mirror.
      for (const list of rows.values()) {
        const left = list.filter((e) => e.cx < ax).sort((a, b) => a.cx - b.cx)
        const right = list.filter((e) => e.cx > ax).sort((a, b) => a.cx - b.cx)
        expect(left.length).toBe(right.length)
        for (let i = 0; i < left.length; i++) {
          // Mirror twin of left[i] is right[left.length - 1 - i] (mirror cx order).
          const twin = right[left.length - 1 - i]!
          expect(twin.col).toBe(totalCols - 1 - left[i]!.col)
        }
      }
    })

    it('exposes meta with axis and pair count when symmetry is enforced', () => {
      const keys = makeGrid(3, 4)
      const result = clusterSymmetryAnnotationAlgorithm.annotate(keys)
      expect(result.meta?.symmetry).toBe('enforced')
      expect(typeof result.meta?.symmetryAxis).toBe('number')
      expect(result.meta?.symmetryPairs).toBe(6)
      expect(result.meta?.symmetryCenterKeys).toBe(0)
    })
  })

  describe('asymmetric layouts', () => {
    it('falls back when one side has an extra key', () => {
      // 3×3 grid with one extra key on the right side breaking mirror.
      const keys = makeGrid(3, 3)
      keys.push(makeKey({ x: 4, y: 1 })) // extra unpaired key
      const result = clusterSymmetryAnnotationAlgorithm.annotate(keys)
      expect(result.status).toBe('success')
      expect(result.meta?.symmetry).toBe('fallback')
      expect(result.meta?.symmetryFallbackReason).toBe('unpaired-key')
      // Output equals plain cluster output.
      const base = clusterAnnotationAlgorithm.annotate(keys)
      expect(result.assignments).toEqual(base.assignments)
    })

    it('falls back when row offsets break left-right cy match', () => {
      // 1×4 row but with the 3rd key (right side) y-shifted only.
      const keys = [
        makeKey({ x: 0, y: 0 }),
        makeKey({ x: 1, y: 0 }),
        makeKey({ x: 2, y: 0.2 }), // shifted only on the right side
        makeKey({ x: 3, y: 0 }),
      ]
      const result = clusterSymmetryAnnotationAlgorithm.annotate(keys)
      expect(result.meta?.symmetry).toBe('fallback')
      expect(result.meta?.symmetryFallbackReason).toBe('unpaired-key')
    })
  })

  describe('center keys', () => {
    it('keeps a center key on the symmetry column when total cols is odd', () => {
      // 5 keys in a row: 2 left, 1 center, 2 right.
      const keys = [
        makeKey({ x: 0, y: 0 }),
        makeKey({ x: 1, y: 0 }),
        makeKey({ x: 2, y: 0 }), // center
        makeKey({ x: 3, y: 0 }),
        makeKey({ x: 4, y: 0 }),
      ]
      const result = clusterSymmetryAnnotationAlgorithm.annotate(keys)
      expect(result.status).toBe('success')
      expect(result.meta?.symmetry).toBe('enforced')
      expect(result.meta?.symmetryCenterKeys).toBe(1)
      // Center key (index 2) should be at col 2 (middle of 5).
      expect(result.assignments[2]?.col).toBe(2)
      // Left should mirror right.
      expect(result.assignments[0]?.col).toBe(0)
      expect(result.assignments[4]?.col).toBe(4)
    })
  })

  describe('ghost and decal keys', () => {
    it('outputs null assignments for ghost and decal keys', () => {
      const keys = makeGrid(2, 2)
      keys[0]!.ghost = true
      keys[3]!.decal = true
      // After marking ghost/decal, the remaining 2 regular keys at (1,0) and (0,1)
      // are not mirror twins, so symmetry detection falls back to cluster.
      const result = clusterSymmetryAnnotationAlgorithm.annotate(keys)
      expect(result.assignments[0]).toBeNull()
      expect(result.assignments[3]).toBeNull()
    })
  })

  describe('empty input', () => {
    it('returns base output when there are no regular keys', () => {
      const keys = [makeKey({ ghost: true }), makeKey({ decal: true })]
      const result = clusterSymmetryAnnotationAlgorithm.annotate(keys)
      expect(result.status).toBe('success')
      expect(result.assignments).toHaveLength(2)
      expect(result.assignments[0]).toBeNull()
      expect(result.assignments[1]).toBeNull()
    })
  })
})
