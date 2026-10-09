import { describe, it, expect } from 'vitest'
import {
  circlePath,
  drillPath,
  padCopperPaths,
  padTransform,
  roundedRectPath,
} from '../pcb-tracks/pad-paths'
import type { FootprintPad } from '../kicad/footprint-pads'

const pad = (overrides: Partial<FootprintPad>): FootprintPad => ({
  number: '1',
  type: 'smd',
  shape: 'rect',
  at: { x: 0, y: 0, rot: 0 },
  size: { w: 2, h: 1 },
  layers: ['F.Cu'],
  ...overrides,
})

describe('pad paths', () => {
  it('draws a rect pad as a closed rectangle', () => {
    expect(padCopperPaths(pad({}))).toEqual([{ d: 'M-1 -0.5H1V0.5H-1Z', strokeWidth: 0 }])
  })

  it('rounds roundrect corners by rratio of the shorter side', () => {
    const [path] = padCopperPaths(pad({ shape: 'roundrect', rratio: 0.25 }))
    expect(path!.d).toBe(roundedRectPath(0, 0, 2, 1, 0.25))
    expect(path!.d).toContain('A0.25 0.25')
  })

  it('draws an oval as a stadium and a circle as two arcs', () => {
    expect(padCopperPaths(pad({ shape: 'oval' }))[0]!.d).toBe(roundedRectPath(0, 0, 2, 1, 0.5))
    expect(padCopperPaths(pad({ shape: 'circle', size: { w: 2.5, h: 2.5 } }))[0]!.d).toBe(
      circlePath(0, 0, 1.25),
    )
    expect(circlePath(0, 0, 1)).toBe('M-1 0A1 1 0 1 0 1 0A1 1 0 1 0 -1 0Z')
  })

  it('draws a custom pad as its anchor plus primitives', () => {
    const paths = padCopperPaths(
      pad({
        shape: 'custom',
        anchor: 'circle',
        size: { w: 1, h: 1 },
        primitives: [
          {
            type: 'poly',
            points: [
              { x: 0, y: 0 },
              { x: 2, y: 0 },
              { x: 2, y: 1 },
            ],
            width: 0.1,
          },
        ],
      }),
    )
    expect(paths).toEqual([
      { d: circlePath(0, 0, 0.5), strokeWidth: 0 },
      { d: 'M0 0L2 0L2 1Z', strokeWidth: 0.1 },
    ])
  })

  it('draws drills with their offset, slots as stadiums', () => {
    expect(drillPath({ w: 1, h: 1, offset: { x: 0.5, y: 0 } })).toBe(circlePath(0.5, 0, 0.5))
    expect(drillPath({ w: 1, h: 2, offset: { x: 0, y: 0 } })).toBe(roundedRectPath(0, 0, 1, 2, 0.5))
  })

  it('places pads with the KiCad rotation negated for SVG', () => {
    expect(padTransform(pad({ at: { x: 1, y: 2, rot: 90 } }))).toBe('translate(1 2) rotate(-90)')
    expect(padTransform(pad({ at: { x: 1, y: 2, rot: 360 } }))).toBe('translate(1 2)')
  })
})
