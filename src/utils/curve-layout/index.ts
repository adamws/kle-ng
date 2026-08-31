/**
 * Curve Layout — public entry point.
 *
 * Everything here is pure: no store access, no Vue, no DOM. The tool's UI layer owns the spine
 * and the options; this module answers the single question "where does each key go".
 *
 * @module curve-layout
 */

export {
  buildArcLengthTable,
  computeBlockFrame,
  cubicDerivative,
  cubicPoint,
  cubicSecondDerivative,
  curvatureAt,
  defaultSpineForKeys,
  frameAtDistance,
  pointAtDistance,
  projectOntoFrame,
  tAtDistance,
  tangentAtDistance,
  unitTangent,
  type ArcLengthTable,
  type BlockFrame,
  type CurveSpine,
  type Point,
  type SpineFrame,
} from './spine'

export {
  layoutKeysOnCurve,
  verifyNoCollisions,
  type CurveLayoutOptions,
  type CurveLayoutResult,
  type KeyPlacement,
} from './pack'

/** Defaults the tool opens with. */
export const DEFAULT_CURVE_LAYOUT_OPTIONS = {
  gap: 0,
  followCurve: true,
} as const
