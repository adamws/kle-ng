import { describe, it, expect } from 'vitest'
import { tracksInBox } from '../selection'
import type { TrackItem } from '@/types/tracks'

const t = (x1: number, y1: number, x2: number, y2: number): TrackItem => ({
  type: 'track',
  start: { x: x1, y: y1 },
  end: { x: x2, y: y2 },
  width: 0.25,
  layer: 'B.Cu',
})
const items = [t(0, 0, 1, 0), t(0, 0, 5, 0), t(10, 10, 11, 11)]
const id = (p: { x: number; y: number }) => p

describe('tracksInBox', () => {
  it('selects enclosed tracks when dragging left to right', () => {
    expect(tracksInBox(items, { from: { x: -1, y: -1 }, to: { x: 2, y: 1 } }, id)).toEqual([0])
  })

  it('selects touched tracks when dragging right to left', () => {
    expect(tracksInBox(items, { from: { x: 2, y: 1 }, to: { x: -1, y: -1 } }, id)).toEqual([0, 1])
  })

  it('tests board positions and skips hidden tracks', () => {
    // rotated 90°: the 5 mm track now runs along y
    const rotate = (p: { x: number; y: number }) => ({ x: p.y, y: -p.x })
    expect(tracksInBox(items, { from: { x: -1, y: -6 }, to: { x: 1, y: 1 } }, rotate)).toEqual([
      0, 1,
    ])
    expect(
      tracksInBox(
        items,
        { from: { x: -1, y: -6 }, to: { x: 1, y: 1 } },
        rotate,
        (i) => i !== items[1],
      ),
    ).toEqual([0])
  })

  it('selects vias by their centre', () => {
    const via: TrackItem = {
      type: 'via',
      position: { x: 10, y: 10 },
      diameter: 0.6,
      drillDiameter: 0.3,
    }
    const withVia = [...items, via]
    expect(tracksInBox(withVia, { from: { x: 9, y: 9 }, to: { x: 10.1, y: 10.1 } }, id)).toEqual([
      3,
    ])
    expect(tracksInBox(withVia, { from: { x: 10.1, y: 10.1 }, to: { x: 9, y: 9 } }, id)).toEqual([
      2, 3,
    ])
  })
})
