/**
 * Pad geometry of KiCad footprints, for the PCB generator track editor.
 *
 * `parseFootprintPads` reads a .kicad_mod file. scripts/generate-footprint-pads.mjs
 * runs it at build time and commits public/data/footprints/pads/<name>.json,
 * because CI and Vercel have no KiCad libraries. `placePads` puts the pads of
 * a placed footprint into the switch-local frame the way kbplacer does.
 *
 * All coordinates are mm, relative to the footprint origin, +Y down, and pad
 * rotations are KiCad orientations (counter-clockwise on screen), like the
 * coordinate contract in src/utils/footprintUtils.ts.
 *
 * Imported by a Node script, so it uses `.ts` import paths and only erasable
 * TypeScript syntax.
 */

import { atom, child, children, head, num, parseSExpr, SExprError } from './sexpr.ts'
import type { SExpr } from './sexpr.ts'
import { mirrorForSide, placePoint, type Placement } from './transform.ts'

export type PadType = 'thru_hole' | 'smd' | 'connect' | 'np_thru_hole'
export type PadShape = 'circle' | 'rect' | 'oval' | 'roundrect' | 'trapezoid' | 'custom'

export interface PadPoint {
  x: number
  y: number
}

/** A primitive of a custom pad, in the pad's own frame (unrotated). */
export type PadPrimitive =
  | { type: 'poly'; points: PadPoint[]; width: number }
  | { type: 'circle'; center: PadPoint; radius: number; width: number }

export interface PadDrill {
  /** Drill size; `w === h` for a round drill, otherwise an oval slot. */
  w: number
  h: number
  /** Offset of the drill from the pad position, in the pad's own frame. */
  offset: PadPoint
}

export interface FootprintPad {
  /** Pad number; empty for mechanical holes. Several pads may share a number. */
  number: string
  type: PadType
  /**
   * Copper shape. Chamfered corners are not recorded (the pad is treated as
   * its full roundrect/rect, which is conservative for clearance), and a
   * trapezoid is treated as its bounding rect for the same reason.
   */
  shape: PadShape
  at: { x: number; y: number; rot: number }
  size: { w: number; h: number }
  /** Corner radius ratio of a roundrect pad (radius = ratio × min(w, h)). */
  rratio?: number
  drill?: PadDrill
  /** KiCad layer names with wildcards expanded (`*.Cu` → F.Cu, B.Cu). */
  layers: string[]
  /** Custom pad: anchor shape (sized by `size`) plus primitives. */
  anchor?: 'circle' | 'rect'
  primitives?: PadPrimitive[]
}

export interface FootprintPads {
  footprint: string
  pads: FootprintPad[]
}

const PAD_TYPES: readonly string[] = ['thru_hole', 'smd', 'connect', 'np_thru_hole']
const PAD_SHAPES: readonly string[] = ['circle', 'rect', 'oval', 'roundrect', 'trapezoid', 'custom']

function expandLayers(layers: string[]): string[] {
  const out: string[] = []
  for (const layer of layers) {
    const wildcard = /^(\*|F&B)\.(.+)$/.exec(layer)
    out.push(...(wildcard ? [`F.${wildcard[2]}`, `B.${wildcard[2]}`] : [layer]))
  }
  return [...new Set(out)]
}

function point(node: SExpr[] | undefined): PadPoint {
  return { x: num(node, 1), y: num(node, 2) }
}

function listAtoms(node: SExpr[] | undefined): string[] {
  return (node ?? []).slice(1).filter((v): v is string => typeof v === 'string')
}

function parseDrill(node: SExpr[]): PadDrill {
  const values = node.slice(1).filter((v): v is string => typeof v === 'string')
  const oval = values[0] === 'oval'
  const sizes = (oval ? values.slice(1) : values).map(Number)
  const w = sizes[0]
  if (w === undefined || !Number.isFinite(w)) throw new SExprError('Invalid pad drill')
  const h = oval && sizes[1] !== undefined ? sizes[1] : w
  const offset = child(node, 'offset')
  return { w, h, offset: offset ? point(offset) : { x: 0, y: 0 } }
}

function parsePrimitives(node: SExpr[]): PadPrimitive[] {
  const out: PadPrimitive[] = []
  for (const p of node.slice(1)) {
    if (!Array.isArray(p)) continue
    const width = child(p, 'width') ? num(child(p, 'width'), 1) : 0
    switch (head(p)) {
      case 'gr_poly':
        out.push({ type: 'poly', points: children(child(p, 'pts') ?? [], 'xy').map(point), width })
        break
      case 'gr_rect': {
        const s = point(child(p, 'start'))
        const e = point(child(p, 'end'))
        const points = [
          { x: s.x, y: s.y },
          { x: e.x, y: s.y },
          { x: e.x, y: e.y },
          { x: s.x, y: e.y },
        ]
        out.push({ type: 'poly', points, width })
        break
      }
      case 'gr_circle': {
        const center = point(child(p, 'center'))
        const end = point(child(p, 'end'))
        const radius = Math.hypot(end.x - center.x, end.y - center.y)
        out.push({ type: 'circle', center, radius, width })
        break
      }
      default:
        throw new SExprError(`Unsupported custom pad primitive: ${head(p)}`)
    }
  }
  return out
}

function parsePad(node: SExpr[]): FootprintPad {
  const number = atom(node, 1) ?? ''
  const type = atom(node, 2) ?? ''
  const shape = atom(node, 3) ?? ''
  if (!PAD_TYPES.includes(type)) throw new SExprError(`Unknown pad type: ${type}`)
  if (!PAD_SHAPES.includes(shape)) throw new SExprError(`Unknown pad shape: ${shape}`)

  const at = child(node, 'at')
  const size = child(node, 'size')
  const pad: FootprintPad = {
    number,
    type: type as PadType,
    shape: shape as PadShape,
    at: { x: num(at, 1), y: num(at, 2), rot: atom(at, 3) !== undefined ? num(at, 3) : 0 },
    size: { w: num(size, 1), h: num(size, 2) },
    layers: expandLayers(listAtoms(child(node, 'layers'))),
  }
  const rratio = child(node, 'roundrect_rratio')
  if (shape === 'roundrect' && rratio) pad.rratio = num(rratio, 1)
  const drill = child(node, 'drill')
  if (drill) pad.drill = parseDrill(drill)
  if (shape === 'custom') {
    const anchor = atom(child(child(node, 'options') ?? [], 'anchor'), 1)
    pad.anchor = anchor === 'circle' ? 'circle' : 'rect'
    const primitives = child(node, 'primitives')
    pad.primitives = primitives ? parsePrimitives(primitives) : []
  }
  return pad
}

/** Parses the pads of a .kicad_mod footprint. */
export function parseFootprintPads(kicadModText: string): FootprintPads {
  const root = parseSExpr(kicadModText)
  const kind = head(root)
  if (kind !== 'footprint' && kind !== 'module') {
    throw new SExprError(`Not a KiCad footprint: (${kind ?? '?'} ...)`)
  }
  const pads = children(root, 'pad').map(parsePad)

  return { footprint: atom(root as SExpr[], 1) ?? '', pads }
}

// Placement (kbplacer's coordinate contract, see transform.ts and footprintUtils.ts)

export type PadPlacement = Placement

function flipLayer(layer: string): string {
  if (layer.startsWith('F.')) return `B.${layer.slice(2)}`
  if (layer.startsWith('B.')) return `F.${layer.slice(2)}`
  return layer
}

/**
 * Places a footprint's pads in the switch-local frame, the way kbplacer
 * places an element relative to its switch: a BACK footprint is mirrored top
 * to bottom (y → −y) with F/B layers swapped, then rotated by the placement
 * orientation and moved by its offset.
 *
 * A placed pad has the same shape as a library pad: `at` is the switch-local
 * centre and `at.rot` the switch-local orientation. Mirroring is folded into
 * the pad-frame data (drill offset, primitives), which is mirrored too, so
 * the pad frame stays a plain rotation.
 */
export function placePads(pads: readonly FootprintPad[], placement: PadPlacement): FootprintPad[] {
  const back = placement.side === 'BACK'
  const mirror = (p: PadPoint): PadPoint => mirrorForSide(p, placement.side)
  return pads.map((pad) => {
    const center = placePoint(pad.at, placement)
    const placed: FootprintPad = {
      ...pad,
      at: {
        x: center.x,
        y: center.y,
        rot: (back ? -pad.at.rot : pad.at.rot) + placement.rotation,
      },
      size: { ...pad.size },
      layers: back ? pad.layers.map(flipLayer) : [...pad.layers],
    }
    if (pad.drill) placed.drill = { ...pad.drill, offset: mirror(pad.drill.offset) }
    if (pad.primitives) {
      placed.primitives = pad.primitives.map((prim) =>
        prim.type === 'poly'
          ? { ...prim, points: prim.points.map(mirror) }
          : { ...prim, center: mirror(prim.center) },
      )
    }
    return placed
  })
}

/** Copper layers a pad has copper on (drilled pads on both, SMD on its side). */
export function padCopperLayers(pad: FootprintPad): ('F.Cu' | 'B.Cu')[] {
  return (['F.Cu', 'B.Cu'] as const).filter((l) => pad.layers.includes(l))
}
