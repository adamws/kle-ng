import { describe, it, expect } from 'vitest'
import { computeReadingOrder } from '../reading-order'
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

function labeled(row: number, col: number, overrides: Partial<Key> = {}): Key {
  const key = makeKey(overrides)
  key.labels[0] = `${row},${col}`
  return key
}

describe('computeReadingOrder', () => {
  it('returns row-major order for a scrambled flat grid', () => {
    const keys = [
      makeKey({ x: 1, y: 1 }), // row1 col1
      makeKey({ x: 0, y: 0 }), // row0 col0
      makeKey({ x: 0, y: 1 }), // row1 col0
      makeKey({ x: 1, y: 0 }), // row0 col1
    ]

    const result = computeReadingOrder(keys)

    expect(result.map((k) => [k.x, k.y])).toEqual([
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ])
  })

  it('interleaves a split board correctly even when the right half was added first', () => {
    // Right half (x=5,6) pushed into the array before the left half (x=0,1) is finished.
    const keys = [
      makeKey({ x: 5, y: 0 }),
      makeKey({ x: 6, y: 0 }),
      makeKey({ x: 0, y: 0 }),
      makeKey({ x: 1, y: 0 }),
    ]

    const result = computeReadingOrder(keys)

    expect(result.map((k) => k.x)).toEqual([0, 1, 5, 6])
  })

  it('reproduces the corne_rotated.json thumb-row order from a shuffled input', () => {
    // resources/extra_layouts/corne_rotated.json thumb row, expected left-to-right order:
    // flat(3.5), r15(4.6), r30(5.77), r-30(8.23), r-15(9.4), flat(10.5)
    const flatLeft = makeKey({ x: 3.5, y: 3.158 })
    const r15 = makeKey({
      x: 4.6,
      y: 3.305,
      rotation_angle: 15,
      rotation_x: 5.1,
      rotation_y: 3.805,
    })
    const r30 = makeKey({
      x: 5.77,
      y: 3.255,
      height: 1.5,
      rotation_angle: 30,
      rotation_x: 6.27,
      rotation_y: 4.005,
    })
    const rNeg30 = makeKey({
      x: 8.23,
      y: 3.255,
      height: 1.5,
      rotation_angle: -30,
      rotation_x: 8.73,
      rotation_y: 4.005,
    })
    const rNeg15 = makeKey({
      x: 9.4,
      y: 3.305,
      rotation_angle: -15,
      rotation_x: 9.9,
      rotation_y: 3.805,
    })
    const flatRight = makeKey({ x: 10.5, y: 3.158 })

    const shuffled = [rNeg15, flatLeft, rNeg30, flatRight, r30, r15]

    const result = computeReadingOrder(shuffled)

    expect(result).toEqual([flatLeft, r15, r30, rNeg30, rNeg15, flatRight])
  })

  it('prefers a full, unique matrix-label annotation over the geometric guess', () => {
    // Geometrically these two keys are on the same row (y=0), which would sort by x
    // (col0 before col1) — but the labels explicitly say the reverse, and that should win.
    const a = labeled(0, 1, { x: 0, y: 0 })
    const b = labeled(0, 0, { x: 1, y: 0 })

    const result = computeReadingOrder([a, b])

    expect(result).toEqual([b, a])
  })

  it('falls back to the geometric path when matrix labels are duplicated', () => {
    const a = labeled(0, 0, { x: 0, y: 0 })
    const b = labeled(0, 0, { x: 1, y: 0 }) // duplicate row,col — disqualifies the fast path

    const result = computeReadingOrder([a, b])

    // Geometric fallback: row-major by world center → a (x=0) before b (x=1).
    expect(result).toEqual([a, b])
  })

  it('falls back to the geometric path when matrix labels are only partially present', () => {
    const a = labeled(0, 0, { x: 1, y: 0 })
    const b = makeKey({ x: 0, y: 0 }) // no label

    const result = computeReadingOrder([a, b])

    expect(result).toEqual([b, a])
  })

  it('excludes ghost and decal keys and does not let them affect indices', () => {
    const ghost = makeKey({ x: -1, y: -1, ghost: true })
    const decal = makeKey({ x: -1, y: 1, decal: true })
    const a = makeKey({ x: 0, y: 0 })
    const b = makeKey({ x: 1, y: 0 })

    const result = computeReadingOrder([ghost, a, decal, b])

    expect(result).toEqual([a, b])
  })

  it('returns an empty array when there are no regular keys', () => {
    expect(computeReadingOrder([])).toEqual([])
    expect(computeReadingOrder([makeKey({ ghost: true })])).toEqual([])
  })
})
