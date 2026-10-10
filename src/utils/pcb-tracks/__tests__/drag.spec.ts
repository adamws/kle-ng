/**
 * Drag geometry, cases worked from KiCad's pns_line.cpp (dragSegment45,
 * dragCorner45). Chains are point lists; results are simplified like the
 * store does each frame.
 */
import { describe, expect, it } from 'vitest'
import type { TrackSegment } from '@/types/tracks'
import type { Vec } from '../distance'
import {
  cleanupTracks,
  dragCorner45,
  dragSegment45,
  snapDraggedCorner,
  snapSegmentOffset,
} from '../drag'
import { simplifyChain } from '../line'

const P = (...xy: number[]): Vec[] => {
  const out: Vec[] = []
  for (let i = 0; i < xy.length; i += 2) out.push({ x: xy[i]!, y: xy[i + 1]! })
  return out
}
const flat = (pts: Vec[]) => simplifyChain(pts).flatMap((p) => [p.x, p.y])

describe('dragSegment45', () => {
  it('keeps neighbours at 90° corners on their own lines', () => {
    expect(flat(dragSegment45(P(0, 0, 0, 5, 5, 5, 5, 10), 1, { x: 2, y: 6 }))).toEqual([
      0, 0, 0, 6, 5, 6, 5, 10,
    ])
  })

  it('flips a neighbour at a 45° corner by 90° when dragged past its far end', () => {
    // SE from the start, then east (dragged), then south
    const line = P(0, 0, 2, 2, 6, 2, 6, 6)
    expect(flat(dragSegment45(line, 1, { x: 4, y: 1 }))).toEqual([0, 0, 1, 1, 6, 1, 6, 6])
    expect(flat(dragSegment45(line, 1, { x: 4, y: -1 }))).toEqual([0, 0, 1, -1, 6, -1, 6, 6])
  })

  it('joins fixed line ends with 45° tracks, the shorter way', () => {
    expect(flat(dragSegment45(P(0, 0, 5, 0), 0, { x: 2.5, y: 1 }))).toEqual([
      0, 0, 1, 1, 4, 1, 5, 0,
    ])
  })

  it('drops the dragged segment where the new neighbours cross', () => {
    // a V with a short flat bottom, pulled down below the point of the V
    expect(flat(dragSegment45(P(0, 0, 2, 2, 3, 2, 5, 0), 1, { x: 3, y: 3 }))).toEqual([
      0, 0, 2.5, 2.5, 5, 0,
    ])
  })

  it('lines a bend up with the target pad: the short track vanishes', () => {
    const line = P(0, 0, 0, 4.8, 3, 7.8, 3, 8)
    expect(flat(dragSegment45(line, 1, { x: 3, y: 8 }))).toEqual([0, 0, 0, 5, 3, 8])
  })

  it('keeps a collinear neighbour, starting a new piece next to it', () => {
    const r = flat(dragSegment45(P(0, 0, 0, 2, 0, 5), 1, { x: 1, y: 3 }))
    expect(r.slice(0, 4)).toEqual([0, 0, 0, 2])
    expect(r.slice(-2)).toEqual([0, 5])
  })
})

describe('dragCorner45', () => {
  it('moves a corner, rebuilding both sides at 45°', () => {
    expect(flat(dragCorner45(P(0, 0, 0, 5, 5, 5), 1, { x: 0, y: 6 }))).toEqual([
      0, 0, 0, 6, 1, 5, 5, 5,
    ])
  })

  it('moves a free line end, continuing its last segment', () => {
    expect(flat(dragCorner45(P(0, 0, 0, 4, 2, 6, 6, 6), 3, { x: 6, y: 8 }))).toEqual([
      0, 0, 0, 4, 2, 6, 4, 6, 6, 8,
    ])
  })

  it('walks back past a vertex the walk can not continue', () => {
    expect(flat(dragCorner45(P(0, 0, 0, 4, 2, 6, 6, 6), 3, { x: 1, y: 8 }))).toEqual([
      0, 0, 0, 4, 2, 6, 2, 7, 1, 8,
    ])
  })

  it('snaps to where nearby segment lines cross at 45°', () => {
    const line = P(0, 0, 0, 4, 1.2, 5.2, 5, 5.2)
    // SE and E lines cross at (1.2, 5.2); S and E meet at 90° and don't count
    const snapped = snapDraggedCorner(line, { x: 1.1, y: 5.1 }, 2, 0.2)
    expect(snapped.x).toBeCloseTo(1.2)
    expect(snapped.y).toBeCloseTo(5.2)
    expect(snapDraggedCorner(line, { x: 0.1, y: 5.1 }, 2, 0.2)).toEqual({ x: 0.1, y: 5.1 })
    expect(snapDraggedCorner(line, { x: 3, y: 3 }, 2, 0.2)).toEqual({ x: 3, y: 3 })
  })
})

describe('snapSegmentOffset', () => {
  const a = { x: 0, y: 0.1 }
  const b = { x: 5, y: 0.1 }
  it('snaps into line with an anchor, else to grid lines along the segment', () => {
    expect(snapSegmentOffset(a, b, 0.2, [], 0.25, 0.01)).toBeCloseTo(0.15)
    expect(snapSegmentOffset(a, b, 0.32, [{ x: 9, y: 0.4 }], 0.25, 0.05)).toBeCloseTo(0.3)
    // a diagonal snaps at grid/√2
    expect(snapSegmentOffset({ x: 0, y: 0 }, { x: 1, y: 1 }, 0.2, [], 0.25, 0.01)).toBeCloseTo(
      0.25 / Math.SQRT2,
    )
  })
})

const t = (x1: number, y1: number, x2: number, y2: number, width = 0.25): TrackSegment => ({
  type: 'track',
  start: { x: x1, y: y1 },
  end: { x: x2, y: y2 },
  width,
  layer: 'B.Cu',
})

describe('cleanupTracks', () => {
  it('drops zero-length tracks and merges collinear ones, keeping order and direction', () => {
    const r = cleanupTracks([t(0, 0, 0, 2), t(0, 2, 0, 2), t(0, 2, 0, 5), t(0, 5, 3, 8)], [])
    expect(r.items.map((i) => i.type === 'track' && [i.start, i.end])).toEqual([
      [
        { x: 0, y: 0 },
        { x: 0, y: 5 },
      ],
      [
        { x: 0, y: 5 },
        { x: 3, y: 8 },
      ],
    ])
    expect(r.map).toEqual([0, null, 0, 1])
  })

  it('keeps tracks of other widths and T junctions', () => {
    expect(cleanupTracks([t(0, 0, 0, 2), t(0, 2, 0, 5, 0.4)], []).items).toHaveLength(2)
    expect(cleanupTracks([t(0, 0, 0, 2), t(0, 2, 0, 5), t(-1, 2, 1, 2)], []).items).toHaveLength(3)
  })
})
