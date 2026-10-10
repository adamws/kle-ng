import { describe, it, expect } from 'vitest'
import { snapToGrid, walk } from '../posture'
import type { Vec } from '../distance'

/** Segment a→b runs at a multiple of 45°. */
const is45 = (a: Vec, b: Vec) => {
  const dx = Math.abs(b.x - a.x)
  const dy = Math.abs(b.y - a.y)
  return dx < 1e-9 || dy < 1e-9 || Math.abs(dx - dy) < 1e-9
}

describe('snapToGrid', () => {
  it('snaps to multiples of the grid from the switch origin', () => {
    expect(snapToGrid({ x: 2.54, y: -5.08 }, 0.25)).toEqual({ x: 2.5, y: -5 })
    expect(snapToGrid({ x: 0.1, y: 0.13 }, 0.25)).toEqual({ x: 0, y: 0.25 })
  })

  it('keeps grid points exact in nanometres', () => {
    const p = snapToGrid({ x: 0.31, y: 0.69 }, 0.1)
    expect(p.x * 1e6).toBe(300000)
    expect(p.y * 1e6).toBe(700000)
  })
})

describe('walk', () => {
  const start = { x: 0, y: 0 }

  it('goes straight then diagonal in 45° mode, diagonal first when flipped', () => {
    const end = { x: 3, y: 1 }
    expect(walk(start, end, '45')).toEqual([start, { x: 2, y: 0 }, end])
    expect(walk(start, end, '45', true)).toEqual([start, { x: 1, y: 1 }, end])
  })

  it('keeps every segment at 45° multiples', () => {
    for (const end of [
      { x: 3, y: 1 },
      { x: -2, y: 5 },
      { x: -4, y: -1.5 },
      { x: 0.7, y: -2.2 },
    ]) {
      for (const flip of [false, true]) {
        const pts = walk(start, end, '45', flip)
        for (let i = 1; i < pts.length; i++) {
          expect(is45(pts[i - 1]!, pts[i]!)).toBe(true)
        }
      }
    }
  })

  it('makes an L in 90° mode', () => {
    const end = { x: 3, y: 1 }
    expect(walk(start, end, '90')).toEqual([start, { x: 3, y: 0 }, end])
    expect(walk(start, end, '90', true)).toEqual([start, { x: 0, y: 1 }, end])
  })

  it('drops the corner for straight and pure diagonal moves', () => {
    expect(walk(start, { x: 2, y: 2 }, '45')).toHaveLength(2)
    expect(walk(start, { x: 0, y: 2 }, '45')).toHaveLength(2)
    expect(walk(start, { x: 2, y: 0 }, '90')).toHaveLength(2)
    expect(walk(start, start, '45')).toEqual([start])
  })

  it('returns start and end as the same objects', () => {
    const end = { x: 3, y: 1 }
    const pts = walk(start, end, '45')
    expect(pts[0]).toBe(start)
    expect(pts[pts.length - 1]).toBe(end)
  })
})
