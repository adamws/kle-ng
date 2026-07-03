/**
 * JSCAD geometry for rotary encoder (EC11) cutouts.
 *
 * Encoder keys (`sm === 'rot_ec11'`) use a fixed, non-configurable footprint:
 * - a centered circular through-plate cutout (see ENCODER_CUTOUT_RADIUS), built
 *   in the 2D path via the shared circle-hole primitives, and
 * - a centered square backside pocket (this module) that clears the encoder body
 *   on the back face, subtracted from the extruded plate for STL/JSCAD output only.
 */
import * as jscadModeling from '@jscad/modeling'
import { fmt, ScriptShapeRegistry } from './geom-utils'
import type { BacksideCut3D, Geom3 } from './backside-features'

/**
 * Radius of the circular encoder through-plate cutout (mm), used for the
 * screw-in (handwired) mount. Sized for the EC11 threaded bushing.
 */
export const ENCODER_CUTOUT_RADIUS = 4
/** Side length of the square encoder backside clearance pocket (mm). Handwired mount only. */
export const ENCODER_BACKSIDE_SIZE = 15
/**
 * Side length of the square through-cutout (mm) used for PCB-mounted encoders.
 * Matches the standard Cherry MX 14×14mm switch opening — the EC11 footprint is
 * MX-compatible, so the encoder occupies a normal switch position on the PCB.
 */
export const ENCODER_PCB_CUTOUT_SIZE = 14

/**
 * Build the rotary-encoder backside clearance cut for a single key position.
 *
 * A 15×15mm square pocket centered on the key, cutting from the back face
 * (z = 0) upward by `depth` mm. The pocket is square and centered so no
 * rotation is applied. Mirrors createCherryMxSnapNotchCuts.
 */
export function createRotaryEncoderBacksideCut(
  index: number,
  keyCenterX: number,
  keyCenterY: number,
  depth: number,
  registry?: ScriptShapeRegistry,
): BacksideCut3D {
  const { cuboid } = jscadModeling.primitives
  const { translate } = jscadModeling.transforms

  const localGeom = translate(
    [0, 0, depth / 2],
    cuboid({ size: [ENCODER_BACKSIDE_SIZE, ENCODER_BACKSIDE_SIZE, depth] }),
  ) as Geom3

  const positioned = translate([keyCenterX, keyCenterY, 0], localGeom) as Geom3

  const varName = `encoder_backside_${index}`
  const size = fmt(ENCODER_BACKSIDE_SIZE)
  const d = fmt(depth)
  const dHalf = fmt(depth / 2)
  const cx = fmt(keyCenterX)
  const cy = fmt(keyCenterY)

  const cuboidExpr = `translate([0, 0, ${dHalf}], cuboid({ size: [${size}, ${size}, ${d}] }))`

  let localExpr: string
  if (registry) {
    const shapeKey = `encoder_backside:${size}:${size}:${d}`
    localExpr = registry.getOrCreate(shapeKey, 'encoder_backside_shape', cuboidExpr)
  } else {
    localExpr = cuboidExpr
  }

  const finalExpr =
    keyCenterX !== 0 || keyCenterY !== 0 ? `translate([${cx}, ${cy}, 0], ${localExpr})` : localExpr

  return {
    varName,
    geom: positioned,
    scriptLines: [`const ${varName} = ${finalExpr}`],
  }
}
