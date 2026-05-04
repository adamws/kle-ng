import { describe, it, expect } from 'vitest'
import { scoreResult, calculateWireLength, getRegularKeysForScoring } from '../scoring'
import type { Key } from '../../src/stores/keyboard'
import type { AnnotationResult } from '../../src/utils/matrix-annotation'

function makeKey(overrides: Partial<Key> = {}): Key {
  const emptyLabels = ['','','','','','','','','','','',''] as [string,string,string,string,string,string,string,string,string,string,string,string]
  return {
    x: 0, y: 0, width: 1, height: 1,
    rotation_angle: 0, rotation_x: 0, rotation_y: 0,
    ghost: false, decal: false,
    labels: [...emptyLabels],
    color: '#cccccc',
    textColor: [...emptyLabels],
    textSize: [3,3,3,3,3,3,3,3,3,3,3,3],
    default: { textColor: '#000000', textSize: 3 },
    x2: 0, y2: 0, width2: 1, height2: 1,
    stepped: false, nub: false, profile: '', sm: '', sb: '', st: '',
    switchRotation: 0, stabRotation: 0,
    ...overrides,
  } as Key
}

function makeResult(
  assignments: AnnotationResult['assignments'],
  status: AnnotationResult['status'] = 'success',
): AnnotationResult {
  return { assignments, status, warnings: [] }
}

describe('getRegularKeysForScoring', () => {
  it('excludes ghost keys', () => {
    const keys = [makeKey({ ghost: true }), makeKey()]
    expect(getRegularKeysForScoring(keys)).toHaveLength(1)
  })

  it('excludes decal keys', () => {
    const keys = [makeKey({ decal: true }), makeKey()]
    expect(getRegularKeysForScoring(keys)).toHaveLength(1)
  })

  it('excludes non-default layout variants (choice != 0)', () => {
    // key with labels[8] = "0,1" means option=0, choice=1 (non-default)
    const nonDefault = makeKey()
    nonDefault.labels[8] = '0,1'
    const defaultLayout = makeKey()
    defaultLayout.labels[8] = '0,0'
    const plain = makeKey()
    const keys = [nonDefault, defaultLayout, plain]
    expect(getRegularKeysForScoring(keys)).toHaveLength(2)
  })
})

describe('calculateWireLength', () => {
  it('returns zero for single-key rows and cols', () => {
    const keys = [makeKey({ x: 0, y: 0 })]
    const assignments: AnnotationResult['assignments'] = [{ row: 0, col: 0 }]
    const { total } = calculateWireLength(keys, assignments)
    expect(total).toBe(0)
  })

  it('calculates row wire length for two horizontally adjacent keys', () => {
    const keys = [makeKey({ x: 0, y: 0 }), makeKey({ x: 1, y: 0 })]
    const assignments: AnnotationResult['assignments'] = [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
    ]
    const { row, col } = calculateWireLength(keys, assignments)
    // Centers: (0.5,0.5) and (1.5,0.5) → distance 1u
    expect(row).toBeCloseTo(1, 2)
    // Each key in its own col → no col wires
    expect(col).toBe(0)
  })

  it('calculates col wire length for two vertically adjacent keys', () => {
    const keys = [makeKey({ x: 0, y: 0 }), makeKey({ x: 0, y: 1 })]
    const assignments: AnnotationResult['assignments'] = [
      { row: 0, col: 0 },
      { row: 1, col: 0 },
    ]
    const { row, col } = calculateWireLength(keys, assignments)
    // Each key in its own row → no row wires
    expect(row).toBe(0)
    // Centers: (0.5,0.5) and (0.5,1.5) → distance 1u
    expect(col).toBeCloseTo(1, 2)
  })

  it('skips unassigned keys', () => {
    const keys = [makeKey({ x: 0, y: 0 }), makeKey({ x: 1, y: 0 })]
    const assignments: AnnotationResult['assignments'] = [
      { row: 0, col: 0 },
      null,
    ]
    const { total } = calculateWireLength(keys, assignments)
    expect(total).toBe(0)
  })
})

describe('scoreResult', () => {
  it('marks result as qualified when all regular keys are assigned', () => {
    const keys = [makeKey({ x: 0, y: 0 }), makeKey({ x: 1, y: 0 })]
    const result = makeResult([{ row: 0, col: 0 }, { row: 0, col: 1 }])
    const score = scoreResult('test', 'layout', keys, result, 5)
    expect(score.qualified).toBe(true)
    expect(score.numRows).toBe(1)
    expect(score.numCols).toBe(2)
    expect(score.matrixMax).toBe(2)
    expect(score.matrixSum).toBe(3)
    expect(score.unassignedKeys).toBe(0)
  })

  it('marks result as disqualified when a regular key has null assignment', () => {
    const keys = [makeKey({ x: 0, y: 0 }), makeKey({ x: 1, y: 0 })]
    const result = makeResult([{ row: 0, col: 0 }, { row: null, col: null }], 'partial')
    const score = scoreResult('test', 'layout', keys, result, 5)
    expect(score.qualified).toBe(false)
    expect(score.unassignedKeys).toBe(1)
    expect(score.matrixMax).toBe(Infinity)
  })

  it('excludes ghost keys from connectivity check', () => {
    const keys = [makeKey({ ghost: true }), makeKey({ x: 1, y: 0 })]
    // Ghost key gets null assignment; regular key gets assignment
    const result = makeResult([null, { row: 0, col: 0 }])
    const score = scoreResult('test', 'layout', keys, result, 5)
    expect(score.qualified).toBe(true)
  })

  it('computes matrix compactness: 6x6 beats 12x1', () => {
    const keys6x6 = Array.from({ length: 36 }, (_, i) =>
      makeKey({ x: i % 6, y: Math.floor(i / 6) }),
    )
    const assignments6x6: AnnotationResult['assignments'] = keys6x6.map((_, i) => ({
      row: Math.floor(i / 6),
      col: i % 6,
    }))
    const score6x6 = scoreResult('a', 'layout', keys6x6, makeResult(assignments6x6), 1)

    const keys12x1 = Array.from({ length: 12 }, (_, i) => makeKey({ x: i, y: 0 }))
    const assignments12x1: AnnotationResult['assignments'] = keys12x1.map((_, i) => ({
      row: 0,
      col: i,
    }))
    const score12x1 = scoreResult('b', 'layout', keys12x1, makeResult(assignments12x1), 1)

    expect(score6x6.matrixMax).toBe(6)
    expect(score12x1.matrixMax).toBe(12)
    expect(score6x6.matrixMax).toBeLessThan(score12x1.matrixMax)
  })
})
