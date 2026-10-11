import { describe, it, expect } from 'vitest'
import { parseSExpr, type SExpr } from '../kicad/sexpr'
import { parseCourtyard, placeCourtyard } from '../kicad/courtyard'

const parse = (items: string) => parseCourtyard(parseSExpr(`(footprint "X" ${items})`) as SExpr[])
const round = (pts: { x: number; y: number }[]) =>
  pts.map((p) => ({ x: Math.round(p.x * 1000) / 1000, y: Math.round(p.y * 1000) / 1000 }))

describe('parseCourtyard', () => {
  it('chains lines in any order and direction into one outline', () => {
    const c = parse(`
      (fp_line (start 1 1) (end -1 1) (layer F.CrtYd) (width 0.05))
      (fp_line (start -1 -1) (end 1 -1) (layer F.CrtYd) (width 0.05))
      (fp_line (start -1 -1) (end -1 1) (layer F.CrtYd) (width 0.05))
      (fp_line (start 1 -1) (end 1 1) (layer F.CrtYd) (width 0.05))
      (fp_line (start -9 -9) (end 9 9) (layer Dwgs.User) (width 0.1))`)
    expect(c!.back).toEqual([])
    expect(c!.front).toHaveLength(1)
    expect(c!.front[0]).toEqual([
      { x: 1, y: 1 },
      { x: -1, y: 1 },
      { x: -1, y: -1 },
      { x: 1, y: -1 },
    ])
  })

  it('reads KiCad 6+ rects on either side', () => {
    const c = parse(`(fp_rect (start -2 -1) (end 2 1) (layer "B.CrtYd") (stroke (width 0.05)))`)
    expect(c).toEqual({
      front: [],
      back: [
        [
          { x: -2, y: -1 },
          { x: 2, y: -1 },
          { x: 2, y: 1 },
          { x: -2, y: 1 },
        ],
      ],
    })
  })

  it('follows KiCad 5 arcs (centre, start, clockwise angle) between lines', () => {
    // a 2 × 2 square with its top-left corner rounded (radius 1, centre (-1, -1))
    const c = parse(`
      (fp_arc (start -1 -1) (end -1 -2) (angle -90) (layer F.CrtYd) (width 0.05))
      (fp_line (start -1 -2) (end 2 -2) (layer F.CrtYd) (width 0.05))
      (fp_line (start 2 -2) (end 2 2) (layer F.CrtYd) (width 0.05))
      (fp_line (start 2 2) (end -2 2) (layer F.CrtYd) (width 0.05))
      (fp_line (start -2 2) (end -2 -1) (layer F.CrtYd) (width 0.05))`)
    const [outline] = c!.front
    expect(c!.front).toHaveLength(1)
    // the arc bulges up-left: its midpoint is at 135° from the centre
    const r = Math.SQRT1_2
    expect(round(outline!)).toContainEqual(round([{ x: -1 - r, y: -1 - r }])[0])
    expect(outline!.every((p) => p.x >= -2 - 1e-9 && p.y >= -2 - 1e-9)).toBe(true)
  })

  it('reads KiCad 6+ arcs through their mid point', () => {
    const c = parse(`
      (fp_arc (start 1 0) (mid 0 -1) (end -1 0) (layer F.CrtYd) (stroke (width 0.05)))
      (fp_line (start -1 0) (end 1 0) (layer F.CrtYd) (stroke (width 0.05)))`)
    const ys = c!.front[0]!.map((p) => p.y)
    expect(Math.min(...ys)).toBeCloseTo(-1, 6)
    expect(Math.max(...ys)).toBeCloseTo(0, 6)
  })

  it('is null without courtyard graphics', () => {
    expect(parse(`(fp_line (start 0 0) (end 1 1) (layer F.Fab) (width 0.1))`)).toBeNull()
  })
})

describe('placeCourtyard', () => {
  const c = {
    front: [
      [
        { x: 1, y: 2 },
        { x: 3, y: 2 },
        { x: 3, y: 4 },
      ],
    ],
    back: [],
  }

  it('moves and rotates like the pads', () => {
    const placed = placeCourtyard(c, { x: 10, y: 0, rotation: 90, side: 'FRONT' })
    expect(round(placed.front[0]!)).toEqual([
      { x: 12, y: -1 },
      { x: 12, y: -3 },
      { x: 14, y: -3 },
    ])
  })

  it('mirrors a back footprint and swaps its sides', () => {
    const placed = placeCourtyard(c, { x: 0, y: 0, rotation: 0, side: 'BACK' })
    expect(placed.front).toEqual([])
    expect(placed.back[0]).toEqual([
      { x: 1, y: -2 },
      { x: 3, y: -2 },
      { x: 3, y: -4 },
    ])
  })
})
