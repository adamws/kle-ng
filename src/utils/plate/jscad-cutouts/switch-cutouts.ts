/**
 * JSCAD switch cutout generators.
 * No maker.js dependency.
 *
 * All shapes are centered at the origin. Callers use placeGeom2() to position them.
 */
import * as jscadModeling from '@jscad/modeling'
import { fmt, fmtVec2, type Geom2, ScriptShapeRegistry } from './geom-utils'

const { rectangle, roundedRectangle } = jscadModeling.primitives
const { union } = jscadModeling.booleans
const { translate } = jscadModeling.transforms

export interface SwitchCutoutOptions {
  /** Cutout width in mm (after sizeAdjust applied by caller) */
  width: number
  /** Cutout height in mm (after sizeAdjust applied by caller) */
  height: number
  /** Corner fillet radius in mm (0 = sharp corners) */
  filletRadius?: number
  /**
   * Total kerf compensation in mm (positive = shrink).
   * Used by cherry-mx-openable to also shrink notch dimensions, matching
   * the maker.js implementation which applies k = sizeAdjust/2 per side.
   */
  sizeAdjust?: number
}

/**
 * Create a rectangular (or rounded-rectangle) switch cutout geometry.
 * Used for: cherry-mx-basic, alps-skcm, alps-skcp, kailh-choc-cpg1350,
 * kailh-choc-cpg1232, custom-rectangle.
 */
export function createRectangleSwitchGeom(opts: SwitchCutoutOptions): Geom2 {
  const { width, height, filletRadius = 0 } = opts
  if (filletRadius > 0) {
    return roundedRectangle({ size: [width, height], roundRadius: filletRadius }) as Geom2
  }
  return rectangle({ size: [width, height] }) as Geom2
}

/**
 * Build JSCAD script lines for a rectangle/roundedRectangle switch cutout.
 *
 * @param varName - Variable name (e.g. 'switch_0')
 * @param opts - Cutout options
 * @param centerX - Final center X in mm
 * @param centerY - Final center Y in mm
 * @param rotationDeg - Rotation in degrees (CCW positive)
 * @param comment - Optional inline comment
 */
export function buildRectangleSwitchScript(
  varName: string,
  opts: SwitchCutoutOptions,
  centerX: number,
  centerY: number,
  rotationDeg: number,
  comment?: string,
  registry?: ScriptShapeRegistry,
): string[] {
  const { width, height, filletRadius = 0 } = opts
  const roundStr = filletRadius > 0 ? `, roundRadius: ${fmt(filletRadius)}` : ''
  const sizeStr = `size: [${fmt(width)}, ${fmt(height)}]`
  const primitiveExpr =
    filletRadius > 0 ? `roundedRectangle({ ${sizeStr}${roundStr} })` : `rectangle({ ${sizeStr} })`

  let expr: string
  if (registry) {
    const shapeKey = `rect:${fmt(width)}:${fmt(height)}:${fmt(filletRadius)}`
    expr = registry.getOrCreate(shapeKey, 'switch_shape', primitiveExpr)
  } else {
    expr = primitiveExpr
  }

  if (rotationDeg !== 0) {
    expr = `rotateZ(${fmt(rotationDeg * (Math.PI / 180))}, ${expr})`
  }
  if (centerX !== 0 || centerY !== 0) {
    expr = `translate(${fmtVec2(centerX, centerY)}, ${expr})`
  }
  const suffix = comment ? `  // ${comment}` : ''
  return [`const ${varName} = ${expr}${suffix}`]
}

/**
 * Cherry MX Openable cutout constants.
 * 14x14mm base with 4 symmetrical rectangular notches on left and right edges.
 */
const MX_OPENABLE_NOTCH_WIDTH = 0.8
const MX_OPENABLE_NOTCH_HEIGHT = 3.1
const MX_OPENABLE_NOTCH_OFFSET = 4.45 // distance from center to notch center

/**
 * Create a Cherry MX Openable cutout geometry.
 *
 * Constructed as: union(base, 4 notch rectangles)
 * Notches extend OUTWARD from each side of the base (same geometry as the maker.js
 * implementation in CherryMxOpenableCutout.createModel). No arcs — all features are rectangles.
 */
export function createCherryMxOpenableGeom(opts: SwitchCutoutOptions): Geom2 {
  const { width, height, filletRadius = 0, sizeAdjust = 0 } = opts
  // width/height are already adjusted by the caller. sizeAdjust is additionally
  // needed here to shrink the notches, matching maker.js which applies k = sizeAdjust/2
  // per side to both notch width and height.
  const k = sizeAdjust / 2
  const base: Geom2 =
    filletRadius > 0
      ? (roundedRectangle({ size: [width, height], roundRadius: filletRadius }) as Geom2)
      : (rectangle({ size: [width, height] }) as Geom2)

  const nW = MX_OPENABLE_NOTCH_WIDTH - k
  const nH = MX_OPENABLE_NOTCH_HEIGHT - 2 * k
  const nOff = MX_OPENABLE_NOTCH_OFFSET

  // 4 notches: top and bottom on each side.
  // Each notch center is just outside the base edge (inner edge flush with base edge),
  // extending outward by nW — widening the total cutout to width + 2*nW.
  const rightX = width / 2 + nW / 2 // notch center X on right side
  const leftX = -(width / 2 + nW / 2)

  const notchRight = (y: number): Geom2 =>
    translate([rightX, y, 0], rectangle({ size: [nW, nH] })) as Geom2
  const notchLeft = (y: number): Geom2 =>
    translate([leftX, y, 0], rectangle({ size: [nW, nH] })) as Geom2

  const allNotches = union(
    notchRight(nOff),
    notchRight(-nOff),
    notchLeft(nOff),
    notchLeft(-nOff),
  ) as Geom2

  return union(base, allNotches) as Geom2
}

/**
 * Build JSCAD script lines for a Cherry MX Openable cutout.
 * Emits parametric union of base + 4 notch rectangles (no polygon point array).
 */
export function buildCherryMxOpenableScript(
  varName: string,
  opts: SwitchCutoutOptions,
  centerX: number,
  centerY: number,
  rotationDeg: number,
  comment?: string,
): string[] {
  const { width, height, filletRadius = 0, sizeAdjust = 0 } = opts
  const k = sizeAdjust / 2
  const nW = MX_OPENABLE_NOTCH_WIDTH - k
  const nH = MX_OPENABLE_NOTCH_HEIGHT - 2 * k
  const nOff = MX_OPENABLE_NOTCH_OFFSET
  const rightX = fmt(width / 2 + nW / 2)
  const leftX = fmt(-(width / 2 + nW / 2))
  const offStr = fmt(nOff)
  const negOffStr = fmt(-nOff)
  const notchSizeStr = `[${fmt(nW)}, ${fmt(nH)}]`

  const lines: string[] = []
  const b = varName
  const roundStr = filletRadius > 0 ? `, roundRadius: ${fmt(filletRadius)}` : ''
  const basePrimitive =
    filletRadius > 0
      ? `roundedRectangle({ size: [${fmt(width)}, ${fmt(height)}]${roundStr} })`
      : `rectangle({ size: [${fmt(width)}, ${fmt(height)}] })`
  lines.push(`const ${b}_base = ${basePrimitive}`)
  lines.push(
    `const ${b}_nr_top = translate([${rightX}, ${offStr}, 0], rectangle({ size: ${notchSizeStr} }))`,
  )
  lines.push(
    `const ${b}_nr_bot = translate([${rightX}, ${negOffStr}, 0], rectangle({ size: ${notchSizeStr} }))`,
  )
  lines.push(
    `const ${b}_nl_top = translate([${leftX}, ${offStr}, 0], rectangle({ size: ${notchSizeStr} }))`,
  )
  lines.push(
    `const ${b}_nl_bot = translate([${leftX}, ${negOffStr}, 0], rectangle({ size: ${notchSizeStr} }))`,
  )
  lines.push(`const ${b}_notches = union(${b}_nr_top, ${b}_nr_bot, ${b}_nl_top, ${b}_nl_bot)`)

  let inner = `union(${b}_base, ${b}_notches)`
  if (rotationDeg !== 0) {
    inner = `rotateZ(${fmt(rotationDeg * (Math.PI / 180))}, ${inner})`
  }
  if (centerX !== 0 || centerY !== 0) {
    inner = `translate(${fmtVec2(centerX, centerY)}, ${inner})`
  }
  const suffix = comment ? `  // ${comment}` : ''
  lines.push(`const ${varName} = ${inner}${suffix}`)
  return lines
}

/**
 * Cherry MX / Alps Hybrid cutout constants.
 * Overlapping Cherry MX (14x14) and Alps SKCM/L (15.5x12.8) rectangles sharing a
 * center. The passed width/height are the overall bounding box (Alps width by
 * Cherry height), already kerf-adjusted by the caller. The individual rectangle
 * dimensions are derived from those deltas so kerf is applied consistently.
 */
const HYBRID_WIDTH_DELTA = 15.5 - 14 // Alps wider than Cherry
const HYBRID_HEIGHT_DELTA = 14 - 12.8 // Cherry taller than Alps

/**
 * Create a Cherry MX / Alps Hybrid cutout geometry.
 *
 * Constructed as: union(cherryRect, alpsRect), both centered at the origin.
 * The union is the same 12-sided "plus" shape produced by the maker.js
 * CherryMxAlpsHybridCutout generator.
 */
export function createCherryMxAlpsHybridGeom(opts: SwitchCutoutOptions): Geom2 {
  const { width, height, filletRadius = 0 } = opts
  const cherryWidth = width - HYBRID_WIDTH_DELTA
  const cherryHeight = height
  const alpsWidth = width
  const alpsHeight = height - HYBRID_HEIGHT_DELTA

  const make = (w: number, h: number): Geom2 =>
    filletRadius > 0
      ? (roundedRectangle({ size: [w, h], roundRadius: filletRadius }) as Geom2)
      : (rectangle({ size: [w, h] }) as Geom2)

  return union(make(cherryWidth, cherryHeight), make(alpsWidth, alpsHeight)) as Geom2
}

/**
 * Build JSCAD script lines for a Cherry MX / Alps Hybrid cutout.
 * Emits a parametric union of the Cherry and Alps rectangles (no polygon array).
 */
export function buildCherryMxAlpsHybridScript(
  varName: string,
  opts: SwitchCutoutOptions,
  centerX: number,
  centerY: number,
  rotationDeg: number,
  comment?: string,
): string[] {
  const { width, height, filletRadius = 0 } = opts
  const cherryWidth = width - HYBRID_WIDTH_DELTA
  const cherryHeight = height
  const alpsWidth = width
  const alpsHeight = height - HYBRID_HEIGHT_DELTA
  const roundStr = filletRadius > 0 ? `, roundRadius: ${fmt(filletRadius)}` : ''
  const prim = filletRadius > 0 ? 'roundedRectangle' : 'rectangle'
  const rect = (w: number, h: number): string =>
    `${prim}({ size: [${fmt(w)}, ${fmt(h)}]${roundStr} })`

  const lines: string[] = []
  const b = varName
  lines.push(`const ${b}_cherry = ${rect(cherryWidth, cherryHeight)}`)
  lines.push(`const ${b}_alps = ${rect(alpsWidth, alpsHeight)}`)

  let inner = `union(${b}_cherry, ${b}_alps)`
  if (rotationDeg !== 0) {
    inner = `rotateZ(${fmt(rotationDeg * (Math.PI / 180))}, ${inner})`
  }
  if (centerX !== 0 || centerY !== 0) {
    inner = `translate(${fmtVec2(centerX, centerY)}, ${inner})`
  }
  const suffix = comment ? `  // ${comment}` : ''
  lines.push(`const ${varName} = ${inner}${suffix}`)
  return lines
}

// ---------------------------------------------------------------------------
// Dispatch helpers
// ---------------------------------------------------------------------------

/** Cutout types built from multiple primitives rather than a single rectangle. */
const NON_RECTANGLE_SWITCH_TYPES = new Set(['cherry-mx-openable', 'cherry-mx-alps-hybrid'])

/**
 * Determine if the given cutout type uses the simple rectangle generator.
 */
export function isRectangleSwitchType(cutoutType: string): boolean {
  return !NON_RECTANGLE_SWITCH_TYPES.has(cutoutType)
}
