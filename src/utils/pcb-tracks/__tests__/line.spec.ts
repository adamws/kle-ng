import { describe, expect, it } from 'vitest'
import type { TrackItem, TrackSegment } from '@/types/tracks'
import { assembleLine, isFreeEnd, isLineCorner, replaceLine, simplifyChain } from '../line'
import { buildInitialTrace, dirOf } from '../direction45'

const t = (x1: number, y1: number, x2: number, y2: number, width = 0.25): TrackSegment => ({
  type: 'track',
  start: { x: x1, y: y1 },
  end: { x: x2, y: y2 },
  width,
  layer: 'B.Cu',
})

describe('direction45', () => {
  it('rounds vectors to the eight directions, clockwise from north (+Y down)', () => {
    expect([dirOf({ x: 0, y: -1 }), dirOf({ x: 1, y: 1 }), dirOf({ x: -3, y: 0.1 })]).toEqual([
      0, 3, 6,
    ])
    expect(dirOf({ x: 0, y: 0 })).toBeNull()
  })

  it('builds mitered 45° traces', () => {
    const p0 = { x: 0, y: 0 }
    expect(buildInitialTrace(p0, { x: 5, y: 2 }, false)).toEqual([
      p0,
      { x: 3, y: 0 },
      { x: 5, y: 2 },
    ])
    expect(buildInitialTrace(p0, { x: 5, y: 2 }, true)).toEqual([
      p0,
      { x: 2, y: 2 },
      { x: 5, y: 2 },
    ])
    expect(buildInitialTrace(p0, { x: 2, y: 2 }, false)).toHaveLength(2)
  })
})

describe('lines', () => {
  const items: TrackItem[] = [
    t(0, 5, 0, 0), // reversed on purpose
    t(0, 5, 5, 5),
    t(5, 5, 5, 8, 0.4), // other width: ends the line
    t(9, 9, 10, 9),
  ]

  it('assembles the chain through two-track corners of one width', () => {
    const line = assembleLine(items, [], 1)
    expect(line.items).toEqual([0, 1])
    expect(line.points).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: 5 },
      { x: 5, y: 5 },
    ])
    expect(isLineCorner(items, [], { x: 0, y: 5 }, 'B.Cu')).toBe(true)
    expect(isLineCorner(items, [], { x: 5, y: 5 }, 'B.Cu')).toBe(false)
    expect(isFreeEnd(items, [], { x: 0, y: 0 }, 'B.Cu')).toBe(true)
  })

  it("replaces a line in its first item's place and direction", () => {
    const line = assembleLine(items, [], 1)
    const r = replaceLine(items, line, [
      { x: 0, y: 0 },
      { x: 0, y: 6 },
      { x: 5, y: 6 },
    ])
    // item 0 ran from the corner to the start, so the chain is written backwards
    expect(r.items.slice(0, 2)).toEqual([t(5, 6, 0, 6), t(0, 6, 0, 0)])
    expect(r.items.slice(2)).toEqual(items.slice(2))
    expect(r.changed).toEqual([0, 1])
  })

  it('simplifies repeated and collinear points', () => {
    const P = (x: number, y: number) => ({ x, y })
    expect(simplifyChain([P(0, 0), P(0, 0), P(0, 2), P(0, 5), P(3, 8), P(3, 8)])).toEqual([
      P(0, 0),
      P(0, 5),
      P(3, 8),
    ])
  })
})
