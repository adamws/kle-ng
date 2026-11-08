/**
 * JSCAD geometry for plate backside (back-face) features.
 * These are 3D solids subtracted from the extruded plate on the back face,
 * used for features like snap-in notches and stabilizer clearance. They do not
 * appear in 2D SVG/DXF output.
 */
import * as jscadModeling from '@jscad/modeling'
import { fmt, ScriptShapeRegistry, type Geom2 } from './geom-utils'
import {
  createStabGeoms,
  stabVerticalTurnDeg,
  type StabCutoutOptions,
  type StabType,
} from './stabilizer-cutouts'

/** Width of the snap notch rectangle (mm). */
const SNAP_NOTCH_WIDTH = 7
/** Cherry MX switch cutout height (mm). */
const MX_CUTOUT_HEIGHT = 14
/** How far the notch extends beyond the top/bottom edges of the switch cutout (mm). */
const SNAP_NOTCH_OVERHANG = 1.5
/** Total notch height: spans the full switch cutout plus overhang on each side. */
const SNAP_NOTCH_HEIGHT = MX_CUTOUT_HEIGHT + 2 * SNAP_NOTCH_OVERHANG

// ---------------------------------------------------------------------------
// Stabilizer backside overhang offsets — tune per type as geometry is finalised
// ---------------------------------------------------------------------------

/** Extra clearance (mm) added beyond the stab bbox on each side for a backside cut. */
export interface StabBacksideOverhang {
  left: number
  right: number
  top: number
  bottom: number
  /**
   * Mirror the pocket about the switch centre, to the farther of its sides: an MX
   * stabilizer housing sits on the switch row, while its cutout is not symmetric.
   */
  symmetric: boolean
}

/** Per-stabilizer-type overhang offsets. */
export const STAB_BACKSIDE_OVERHANGS: Record<StabType, StabBacksideOverhang> = {
  'mx-basic': { left: 0, right: 0, top: 3.5, bottom: 1.75, symmetric: true },
  'mx-tight': { left: 0, right: 0, top: 3.5, bottom: 1.75, symmetric: true },
  'mx-bidirectional': { left: 0, right: 0, top: 1.75, bottom: 1.75, symmetric: true },
  'mx-spec': { left: 0, right: 0, top: 1.31, bottom: 3, symmetric: true },
  'mx-spec-narrow': { left: 0, right: 0, top: 1.31, bottom: 3, symmetric: true },
  // the slots sit below the switch centre; not validated against hardware yet
  'alps-aek': { left: 0, right: 0, top: 0, bottom: 0, symmetric: false },
  'alps-at101': { left: 0, right: 0, top: 0, bottom: 0, symmetric: false },
}

/**
 * A pocket cut into the plate from the back face (z = 0) up to `depth`: its
 * placed footprint, which the STL takes out of the plate's bottom layer
 * with a 2D boolean (see buildStl).
 */
export interface BacksideCut3D {
  varName: string
  /** Placed outline of the pocket on the back face. */
  footprint: Geom2
  /** How far the pocket reaches into the plate, mm. */
  depth: number
  /** JSCAD script lines; last line assigns `varName`. */
  scriptLines: string[]
}

/** A rectangle centred at (cx, cy) in its own frame, turned and placed on the back face. */
export function placedRectangle(
  width: number,
  height: number,
  cx: number,
  cy: number,
  rotationDeg: number,
  x: number,
  y: number,
): Geom2 {
  const { rectangle } = jscadModeling.primitives
  const { translate, rotateZ } = jscadModeling.transforms
  const local = rectangle({ size: [width, height], center: [cx, cy] }) as Geom2
  const rotated =
    rotationDeg !== 0 ? (rotateZ(rotationDeg * (Math.PI / 180), local) as Geom2) : local
  return translate([x, y, 0], rotated) as Geom2
}

// ---------------------------------------------------------------------------
// Snap-notch cut
// ---------------------------------------------------------------------------

/**
 * Build the Cherry MX snap-notch cut for a single key position.
 *
 * A single rectangle (7mm wide × 17mm tall) centered on the key, cutting from
 * the back face (z = 0) upward by `depth` mm.
 */
export function createCherryMxSnapNotchCuts(
  index: number,
  keyCenterX: number,
  keyCenterY: number,
  rotationDeg: number,
  depth: number,
  registry?: ScriptShapeRegistry,
): BacksideCut3D {
  const footprint = placedRectangle(
    SNAP_NOTCH_WIDTH,
    SNAP_NOTCH_HEIGHT,
    0,
    0,
    rotationDeg,
    keyCenterX,
    keyCenterY,
  )

  const rotRad = rotationDeg * (Math.PI / 180)
  const varName = `snap_notch_${index}`
  const w = fmt(SNAP_NOTCH_WIDTH)
  const nh = fmt(SNAP_NOTCH_HEIGHT)
  const d = fmt(depth)
  const dHalf = fmt(depth / 2)
  const cx = fmt(keyCenterX)
  const cy = fmt(keyCenterY)

  const cuboidExpr = `translate([0, 0, ${dHalf}], cuboid({ size: [${w}, ${nh}, ${d}] }))`
  const localExprFull = rotationDeg !== 0 ? `rotateZ(${fmt(rotRad)}, ${cuboidExpr})` : cuboidExpr

  let localExpr: string
  if (registry) {
    const shapeKey = `snap_notch:${w}:${nh}:${d}:${rotationDeg}`
    localExpr = registry.getOrCreate(shapeKey, 'snap_notch_shape', localExprFull)
  } else {
    localExpr = localExprFull
  }

  const finalExpr =
    keyCenterX !== 0 || keyCenterY !== 0 ? `translate([${cx}, ${cy}, 0], ${localExpr})` : localExpr

  return {
    varName,
    footprint,
    depth,
    scriptLines: [`const ${varName} = ${finalExpr}`],
  }
}

// ---------------------------------------------------------------------------
// Stabilizer clearance cuts
// ---------------------------------------------------------------------------

/**
 * Build a stabilizer clearance cut for a single key position, or null when the
 * key has no stabilizer.
 *
 * Uses the bounding box of the actual stab geometry to derive the rectangle
 * dimensions, ensuring the backside cut stays synchronized with the stab cutout.
 * The box is measured in the stabilizer's own frame, the pair side by side: the
 * STAB_BACKSIDE_OVERHANGS offsets are relative to the stabilizer (top and bottom
 * are across its wire), so for a key taller than wide, whose stabilizer
 * createStabGeoms turns, the pocket is built unturned and turned with it.
 * The offsets extend the box on each side, and for MX stabilizers the pocket is
 * then mirrored about the switch centre.
 *
 * @param index - Key index (used to make variable names unique)
 * @param keyCenterX - Key center X in mm (JSCAD coordinate space)
 * @param keyCenterY - Key center Y in mm
 * @param totalStabRotationDeg - Total stab rotation in degrees (key rotation minus stabRotation), CCW positive
 * @param depth - Cut depth from back face in mm
 * @param type - Stabilizer type
 * @param opts - The stabilizer cutout's options (key size, fillet, kerf)
 */
export function createStabBacksideCut(
  index: number,
  keyCenterX: number,
  keyCenterY: number,
  totalStabRotationDeg: number,
  depth: number,
  type: StabType,
  opts: StabCutoutOptions,
  registry?: ScriptShapeRegistry,
): BacksideCut3D | null {
  const pair = createStabGeoms(type, opts)
  if (!pair) return null
  const { union } = jscadModeling.booleans
  const { rotateZ } = jscadModeling.transforms
  const { measureBoundingBox } = jscadModeling.measurements

  const turnDeg = stabVerticalTurnDeg(opts)
  const localPair = union(...pair) as Geom2
  const stabFrame =
    turnDeg !== 0 ? (rotateZ((-turnDeg * Math.PI) / 180, localPair) as Geom2) : localPair
  const [[minX, minY], [maxX, maxY]] = measureBoundingBox(stabFrame) as [number[], number[]]
  const overhang = STAB_BACKSIDE_OVERHANGS[type]
  const rotationDeg = totalStabRotationDeg + turnDeg
  let left = minX! - overhang.left
  let right = maxX! + overhang.right
  let bottom = minY! - overhang.bottom
  let top = maxY! + overhang.top
  if (overhang.symmetric) {
    // stab-local origin is the switch centre
    right = Math.max(right, -left)
    left = -right
    top = Math.max(top, -bottom)
    bottom = -top
  }
  const totalWidth = right - left
  const totalHeight = top - bottom
  const centerX = (left + right) / 2
  const centerY = (bottom + top) / 2

  const footprint = placedRectangle(
    totalWidth,
    totalHeight,
    centerX,
    centerY,
    rotationDeg,
    keyCenterX,
    keyCenterY,
  )

  const rotRad = rotationDeg * (Math.PI / 180)

  const varName = `stab_backside_${index}`
  const rectExpr = `translate([${fmt(centerX)}, ${fmt(centerY)}, ${fmt(depth / 2)}], cuboid({ size: [${fmt(totalWidth)}, ${fmt(totalHeight)}, ${fmt(depth)}] }))`
  const localExprFull = rotationDeg !== 0 ? `rotateZ(${fmt(rotRad)}, ${rectExpr})` : rectExpr

  let localExpr: string
  if (registry) {
    const shapeKey = `stab_backside:${fmt(centerX)}:${fmt(centerY)}:${fmt(totalWidth)}:${fmt(totalHeight)}:${fmt(depth)}:${rotationDeg}`
    localExpr = registry.getOrCreate(shapeKey, 'stab_backside_shape', localExprFull)
  } else {
    localExpr = localExprFull
  }

  const finalExpr =
    keyCenterX !== 0 || keyCenterY !== 0
      ? `translate([${fmt(keyCenterX)}, ${fmt(keyCenterY)}, 0], ${localExpr})`
      : localExpr

  return {
    varName,
    footprint,
    depth,
    scriptLines: [`const ${varName} = ${finalExpr}`],
  }
}
