import { describe, expect, it } from 'vitest'
import type { TrackItem, TrackSegment } from '@/types/tracks'
import { cleanupTracks, dragCorner, dragSegment, snapSegmentOffset } from '../drag'

const t = (x1: number, y1: number, x2: number, y2: number, width = 0.25): TrackSegment => ({
  type: 'track',
  start: { x: x1, y: y1 },
  end: { x: x2, y: y2 },
  width,
  layer: 'B.Cu',
})
const pts = (items: readonly TrackItem[]) =>
  items.map((i) => (i.type === 'track' ? [i.start.x, i.start.y, i.end.x, i.end.y] : null))

describe('dragSegment', () => {
  it('moves a segment sideways, its neighbours follow along their own lines', () => {
    const items = [t(0, 0, 0, 5), t(0, 5, 5, 5), t(5, 5, 5, 10)]
    const r = dragSegment(items, [], 1, 1)!
    expect(pts(r.items)).toEqual([
      [0, 0, 0, 6],
      [0, 6, 5, 6],
      [5, 6, 5, 10],
    ])
    expect(r.changed).toEqual([0, 1, 2])
    // the shared corner is one point
    expect(r.items[0]!.type === 'track' && r.items[0]!.end).toEqual(
      r.items[1]!.type === 'track' && r.items[1]!.start,
    )
  })

  it('stops where a neighbour would turn back', () => {
    const items = [t(0, 0, 0, 5), t(0, 5, 5, 5), t(5, 5, 5, 7)]
    expect(pts(dragSegment(items, [], 1, 2)!.items)[2]).toEqual([5, 7, 5, 7])
    expect(dragSegment(items, [], 1, 2.5)).toBeNull()
  })

  it('joins ends that stay put with 45° tracks', () => {
    const r = dragSegment([t(0, 0, 5, 0)], [], 0, 1)!
    expect(pts(r.items)).toEqual([
      [0, 0, 1, 1],
      [1, 1, 4, 1],
      [4, 1, 5, 0],
    ])
    expect(r.item).toBe(1)
    expect(r.changed).toEqual([0, 1, 2])
  })

  it('aligns a bend with the target pad, the short track vanishes', () => {
    // vertical from a pad, a diagonal that misses the target (3, 8) by a bit
    const items = [t(0, 0, 0, 4.8), t(0, 4.8, 3, 7.8), t(3, 7.8, 3, 8)]
    const seg = items[1]!
    const offset = snapSegmentOffset(seg, 0.13, [{ x: 3, y: 8 }], 0.25, 0.1)
    const r = dragSegment(items, [], 1, offset)!
    expect(pts(cleanupTracks(r.items, []).items)).toEqual([
      [0, 0, 0, 5],
      [0, 5, 3, 8],
    ])
  })
})

describe('snapSegmentOffset', () => {
  it('snaps to grid lines along the segment', () => {
    expect(snapSegmentOffset(t(0, 0.1, 5, 0.1), 0.2, [], 0.25, 0.01)).toBeCloseTo(0.15)
    // a diagonal snaps at grid/√2
    const diag = snapSegmentOffset(t(0, 0, 1, 1), 0.2, [], 0.25, 0.01)
    expect(diag).toBeCloseTo(0.25 / Math.SQRT2)
  })
})

describe('dragCorner', () => {
  it('moves every track end at the corner', () => {
    const r = dragCorner([t(0, 0, 1, 1), t(1, 1, 2, 1)], { x: 1, y: 1 }, 'B.Cu', { x: 1, y: 2 })
    expect(pts(r.items)).toEqual([
      [0, 0, 1, 2],
      [1, 2, 2, 1],
    ])
    expect(r.changed).toEqual([0, 1])
  })
})

describe('cleanupTracks', () => {
  it('drops zero-length tracks and merges collinear ones, keeping order and direction', () => {
    const r = cleanupTracks([t(0, 0, 0, 2), t(0, 2, 0, 2), t(0, 2, 0, 5), t(0, 5, 3, 8)], [])
    expect(pts(r.items)).toEqual([
      [0, 0, 0, 5],
      [0, 5, 3, 8],
    ])
    expect(r.map).toEqual([0, null, 0, 1])
  })

  it('keeps tracks of other widths, T junctions and joints with three tracks', () => {
    const widths = [t(0, 0, 0, 2), t(0, 2, 0, 5, 0.4)]
    expect(cleanupTracks(widths, []).items).toHaveLength(2)
    const tee = [t(0, 0, 0, 2), t(0, 2, 0, 5), t(-1, 2, 1, 2)]
    expect(cleanupTracks(tee, []).items).toHaveLength(3)
  })
})
