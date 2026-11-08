/**
 * JSCAD stabilizer cutout generators.
 * No maker.js dependency.
 *
 * Each generator returns two Geom2 objects (left pad, right pad) positioned
 * relative to the key center at the origin (with isVertical rotation applied).
 * Callers use placeGeom2() to apply total rotation and key-center translation.
 */
import * as jscadModeling from '@jscad/modeling'
import { fmt, fmtVec2, formatPoints, type Geom2, ScriptShapeRegistry } from './geom-utils'
import {
  getCherryMxStabilizerSpacing,
  getAlpsStabilizerSpacing,
  getMxBasicStabDimensions,
  getMxSpecLeftPadVertices,
  ALPS_STAB,
} from '../plate-dimensions'

const { rectangle, roundedRectangle, polygon } = jscadModeling.primitives
const { translate, rotateZ } = jscadModeling.transforms

/**
 * The turn (degrees, CCW) the generators below give a key taller than wide: the
 * stabilizer then runs along the key's height.
 */
export function stabVerticalTurnDeg(opts: StabCutoutOptions): number {
  return opts.keyHeight > opts.keyWidth ? -90 : 0
}

export interface StabCutoutOptions {
  keyWidth: number
  keyHeight: number
  filletRadius?: number
  sizeAdjust?: number
}

// ---------------------------------------------------------------------------
// MX Basic / Tight / Bidirectional
// ---------------------------------------------------------------------------

/**
 * Create Cherry MX basic/tight/bidirectional stabilizer geometries.
 *
 * Returns [leftGeom, rightGeom] where each pad is positioned relative to
 * key center at origin (including isVertical rotation). Returns null if key
 * is too small to need a stabilizer.
 */
export function createMxBasicStabGeoms(
  type: 'mx-basic' | 'mx-tight' | 'mx-bidirectional',
  opts: StabCutoutOptions,
): [Geom2, Geom2] | null {
  const { keyWidth, keyHeight, filletRadius = 0, sizeAdjust = 0 } = opts
  const isVertical = keyHeight > keyWidth
  const keySize = isVertical ? keyHeight : keyWidth

  const spacing = getCherryMxStabilizerSpacing(keySize)
  if (spacing === null) return null

  const { width: stabWidth, height: stabHeight, moveYBase } = getMxBasicStabDimensions(type)
  const w = stabWidth - sizeAdjust
  const h = stabHeight - sizeAdjust
  const maxFillet = Math.min(stabWidth, stabHeight) / 2
  const clampedFillet = Math.min(filletRadius, maxFillet)

  // Pad center Y in local (horizontal) stab space:
  // moveYBase is the bottom edge for zero-kerf pad; center = moveYBase + stabHeight/2.
  // The sizeAdjust terms cancel when computing the center from the maker.js bottom-left
  // formula (moveYBase + sizeAdjust/2) + (stabHeight - sizeAdjust)/2 = moveYBase + stabHeight/2,
  // so the center is invariant with respect to kerf.
  const localCenterY = moveYBase + stabHeight / 2

  function makePad(xOffset: number): Geom2 {
    const pad: Geom2 =
      clampedFillet > 0
        ? (roundedRectangle({ size: [w, h], roundRadius: clampedFillet }) as Geom2)
        : (rectangle({ size: [w, h] }) as Geom2)
    return translate([xOffset, localCenterY, 0], pad) as Geom2
  }

  let leftGeom = makePad(-spacing)
  let rightGeom = makePad(spacing)

  if (isVertical) {
    const angle = -Math.PI / 2
    leftGeom = rotateZ(angle, leftGeom) as Geom2
    rightGeom = rotateZ(angle, rightGeom) as Geom2
  }

  return [leftGeom, rightGeom]
}

/**
 * Build script lines for a Cherry MX basic/tight/bidirectional stab pair.
 *
 * @param varName - Base variable name (e.g. 'stab_0')
 * @param type - Stab type
 * @param opts - Stab options
 * @param keyCenterX - Key center X (final placement)
 * @param keyCenterY - Key center Y (final placement)
 * @param totalRotDeg - Combined layout + stab rotation in degrees (CCW positive)
 * @param comment - Optional comment for the union line
 */
export function buildMxBasicStabScript(
  varName: string,
  type: 'mx-basic' | 'mx-tight' | 'mx-bidirectional',
  opts: StabCutoutOptions,
  keyCenterX: number,
  keyCenterY: number,
  totalRotDeg: number,
  comment?: string,
  registry?: ScriptShapeRegistry,
): string[] | null {
  const { keyWidth, keyHeight, filletRadius = 0, sizeAdjust = 0 } = opts
  const isVertical = keyHeight > keyWidth
  const keySize = isVertical ? keyHeight : keyWidth

  const spacing = getCherryMxStabilizerSpacing(keySize)
  if (spacing === null) return null

  const { width: stabWidth, height: stabHeight, moveYBase } = getMxBasicStabDimensions(type)
  const w = stabWidth - sizeAdjust
  const h = stabHeight - sizeAdjust
  const maxFillet = Math.min(stabWidth, stabHeight) / 2
  const clampedFillet = Math.min(filletRadius, maxFillet)
  const localCenterY = moveYBase + stabHeight / 2

  // Compute final pad centers: rotate isVertical (-90°) then totalRotDeg, then key center offset
  const angle = (isVertical ? -90 : 0) + totalRotDeg
  const rad = angle * (Math.PI / 180)
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)

  function rotatePoint(lx: number, ly: number): [number, number] {
    return [
      Math.round((lx * cos - ly * sin) * 1000) / 1000,
      Math.round((lx * sin + ly * cos) * 1000) / 1000,
    ]
  }

  const [lx, ly] = rotatePoint(-spacing, localCenterY)
  const [rx, ry] = rotatePoint(spacing, localCenterY)

  const roundStr = clampedFillet > 0 ? `, roundRadius: ${fmt(clampedFillet)}` : ''
  const primitiveExpr =
    clampedFillet > 0
      ? `roundedRectangle({ size: [${fmt(w)}, ${fmt(h)}]${roundStr} })`
      : `rectangle({ size: [${fmt(w)}, ${fmt(h)}] })`

  let shapeExpr: string
  if (registry) {
    const shapeKey = `mxbasic_${type}:${fmt(w)}:${fmt(h)}:${fmt(clampedFillet)}`
    shapeExpr = registry.getOrCreate(shapeKey, 'stab_pad', primitiveExpr)
  } else {
    shapeExpr = primitiveExpr
  }

  const rectRotDeg = (isVertical ? -90 : 0) + totalRotDeg
  let aPrimitive = shapeExpr
  let bPrimitive = shapeExpr
  if (rectRotDeg !== 0) {
    const rectRad = fmt(rectRotDeg * (Math.PI / 180))
    aPrimitive = `rotateZ(${rectRad}, ${aPrimitive})`
    bPrimitive = `rotateZ(${rectRad}, ${bPrimitive})`
  }

  const lines: string[] = []
  const subA = `${varName}_a`
  const subB = `${varName}_b`
  lines.push(
    `const ${subA} = translate(${fmtVec2(keyCenterX + lx, keyCenterY + ly)}, ${aPrimitive})`,
  )
  lines.push(
    `const ${subB} = translate(${fmtVec2(keyCenterX + rx, keyCenterY + ry)}, ${bPrimitive})`,
  )
  const suffix = comment ? `  // ${comment}` : ''
  lines.push(`const ${varName} = union(${subA}, ${subB})${suffix}`)
  return lines
}

// ---------------------------------------------------------------------------
// MX Spec
// ---------------------------------------------------------------------------

/**
 * Create Cherry MX spec stabilizer geometries (left and right pads).
 *
 * Left pad is a 16-vertex polygon including wire channel going to x=+spacing.
 * Right pad is the mirror (negate X + reverse winding).
 * Both pads are translated (left to -spacing, right to +spacing) and the
 * wire channels meet at x=0 when the pads are unioned.
 * isVertical rotation is applied before returning.
 */
export function createMxSpecStabGeoms(
  opts: StabCutoutOptions & { narrowChannel?: boolean },
): [Geom2, Geom2] | null {
  const { keyWidth, keyHeight, sizeAdjust = 0, narrowChannel = false } = opts
  const isVertical = keyHeight > keyWidth
  const keySize = isVertical ? keyHeight : keyWidth

  const spacing = getCherryMxStabilizerSpacing(keySize)
  if (spacing === null) return null

  const k = sizeAdjust / 2
  const leftPts = getMxSpecLeftPadVertices(k, spacing, keySize, narrowChannel)

  // Mirror right pad: negate X gives CCW (mirroring reverses CW→CCW winding)
  const rightPts = leftPts.map(([x, y]) => [-x, y] as [number, number])

  const leftPad = translate([-spacing, 0, 0], polygon({ points: [...leftPts].reverse() })) as Geom2
  const rightPad = translate([spacing, 0, 0], polygon({ points: rightPts })) as Geom2

  if (isVertical) {
    const angle = -Math.PI / 2
    return [rotateZ(angle, leftPad) as Geom2, rotateZ(angle, rightPad) as Geom2]
  }
  return [leftPad, rightPad]
}

/**
 * Build script lines for a Cherry MX spec stab pair.
 * Emits polygon({ points: [...] }) with exact spec vertices.
 */
export function buildMxSpecStabScript(
  varName: string,
  opts: StabCutoutOptions & { narrowChannel?: boolean },
  keyCenterX: number,
  keyCenterY: number,
  totalRotDeg: number,
  comment?: string,
  registry?: ScriptShapeRegistry,
): string[] | null {
  const { keyWidth, keyHeight, sizeAdjust = 0, narrowChannel = false } = opts
  const isVertical = keyHeight > keyWidth
  const keySize = isVertical ? keyHeight : keyWidth

  const spacing = getCherryMxStabilizerSpacing(keySize)
  if (spacing === null) return null

  const k = sizeAdjust / 2
  const leftPts = getMxSpecLeftPadVertices(k, spacing, keySize, narrowChannel)
  const rightPts = leftPts.map(([x, y]) => [-x, y] as [number, number])

  const rotDeg = (isVertical ? -90 : 0) + totalRotDeg
  const rotRad = rotDeg * (Math.PI / 180)

  let leftShapeVar: string | undefined
  let rightShapeVar: string | undefined
  if (registry) {
    const shapeKey = `mxspec:${fmt(k)}:${fmt(spacing)}:${narrowChannel}`
    leftShapeVar = registry.getOrCreate(
      `${shapeKey}:left`,
      'stab_left_pad',
      `polygon({ points: ${formatPoints([...leftPts].reverse())} })`,
    )
    rightShapeVar = registry.getOrCreate(
      `${shapeKey}:right`,
      'stab_right_pad',
      `polygon({ points: ${formatPoints(rightPts)} })`,
    )
  }

  function buildPadExpr(pts: [number, number][], localOffsetX: number, shapeVar?: string): string {
    let expr = shapeVar ?? `polygon({ points: ${formatPoints(pts)} })`
    expr = `translate([${fmt(localOffsetX)}, 0, 0], ${expr})`
    if (rotDeg !== 0) {
      expr = `rotateZ(${fmt(rotRad)}, ${expr})`
    }
    if (keyCenterX !== 0 || keyCenterY !== 0) {
      expr = `translate(${fmtVec2(keyCenterX, keyCenterY)}, ${expr})`
    }
    return expr
  }

  const lines: string[] = []
  const subA = `${varName}_a`
  const subB = `${varName}_b`
  lines.push(`const ${subA} = ${buildPadExpr([...leftPts].reverse(), -spacing, leftShapeVar)}`)
  lines.push(`const ${subB} = ${buildPadExpr(rightPts, spacing, rightShapeVar)}`)
  const suffix = comment ? `  // ${comment}` : ''
  lines.push(`const ${varName} = union(${subA}, ${subB})${suffix}`)
  return lines
}

// ---------------------------------------------------------------------------
// Alps AEK / AT101
// ---------------------------------------------------------------------------

/**
 * Create Alps stabilizer geometries (AEK or AT101).
 */
export function createAlpsStabGeoms(
  type: 'alps-aek' | 'alps-at101',
  opts: StabCutoutOptions,
): [Geom2, Geom2] | null {
  const { keyWidth, keyHeight, filletRadius = 0, sizeAdjust = 0 } = opts
  const isVertical = keyHeight > keyWidth
  const keySize = isVertical ? keyHeight : keyWidth

  const spacing = getAlpsStabilizerSpacing(keySize, type === 'alps-at101')
  if (spacing === null) return null

  const { width: stabWidth, height: stabHeight, moveYBase } = ALPS_STAB
  const w = stabWidth - sizeAdjust
  const h = stabHeight - sizeAdjust
  const maxFillet = Math.min(stabWidth, stabHeight) / 2
  const clampedFillet = Math.min(filletRadius, maxFillet)
  const localCenterY = moveYBase + stabHeight / 2

  function makePad(xOffset: number): Geom2 {
    const pad: Geom2 =
      clampedFillet > 0
        ? (roundedRectangle({ size: [w, h], roundRadius: clampedFillet }) as Geom2)
        : (rectangle({ size: [w, h] }) as Geom2)
    return translate([xOffset, localCenterY, 0], pad) as Geom2
  }

  let leftGeom = makePad(-spacing)
  let rightGeom = makePad(spacing)

  if (isVertical) {
    const angle = -Math.PI / 2
    leftGeom = rotateZ(angle, leftGeom) as Geom2
    rightGeom = rotateZ(angle, rightGeom) as Geom2
  }

  return [leftGeom, rightGeom]
}

/**
 * Build script lines for an Alps stab pair.
 */
export function buildAlpsStabScript(
  varName: string,
  type: 'alps-aek' | 'alps-at101',
  opts: StabCutoutOptions,
  keyCenterX: number,
  keyCenterY: number,
  totalRotDeg: number,
  comment?: string,
  registry?: ScriptShapeRegistry,
): string[] | null {
  const { keyWidth, keyHeight, filletRadius = 0, sizeAdjust = 0 } = opts
  const isVertical = keyHeight > keyWidth
  const keySize = isVertical ? keyHeight : keyWidth

  const spacing = getAlpsStabilizerSpacing(keySize, type === 'alps-at101')
  if (spacing === null) return null

  const { width: stabWidth, height: stabHeight, moveYBase } = ALPS_STAB
  const w = stabWidth - sizeAdjust
  const h = stabHeight - sizeAdjust
  const maxFillet = Math.min(stabWidth, stabHeight) / 2
  const clampedFillet = Math.min(filletRadius, maxFillet)
  const localCenterY = moveYBase + stabHeight / 2

  const angle = (isVertical ? -90 : 0) + totalRotDeg
  const rad = angle * (Math.PI / 180)
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)

  function rotatePoint(lx: number, ly: number): [number, number] {
    return [
      Math.round((lx * cos - ly * sin) * 1000) / 1000,
      Math.round((lx * sin + ly * cos) * 1000) / 1000,
    ]
  }

  const [lx, ly] = rotatePoint(-spacing, localCenterY)
  const [rx, ry] = rotatePoint(spacing, localCenterY)

  const roundStr = clampedFillet > 0 ? `, roundRadius: ${fmt(clampedFillet)}` : ''
  const primitiveExpr =
    clampedFillet > 0
      ? `roundedRectangle({ size: [${fmt(w)}, ${fmt(h)}]${roundStr} })`
      : `rectangle({ size: [${fmt(w)}, ${fmt(h)}] })`

  let shapeExpr: string
  if (registry) {
    const shapeKey = `alps_${type}:${fmt(w)}:${fmt(h)}:${fmt(clampedFillet)}`
    shapeExpr = registry.getOrCreate(shapeKey, 'stab_pad', primitiveExpr)
  } else {
    shapeExpr = primitiveExpr
  }

  const rectRotDeg = (isVertical ? -90 : 0) + totalRotDeg
  let aPrimitive = shapeExpr
  let bPrimitive = shapeExpr
  if (rectRotDeg !== 0) {
    const rectRad = fmt(rectRotDeg * (Math.PI / 180))
    aPrimitive = `rotateZ(${rectRad}, ${aPrimitive})`
    bPrimitive = `rotateZ(${rectRad}, ${bPrimitive})`
  }

  const lines: string[] = []
  const subA = `${varName}_a`
  const subB = `${varName}_b`
  lines.push(
    `const ${subA} = translate(${fmtVec2(keyCenterX + lx, keyCenterY + ly)}, ${aPrimitive})`,
  )
  lines.push(
    `const ${subB} = translate(${fmtVec2(keyCenterX + rx, keyCenterY + ry)}, ${bPrimitive})`,
  )
  const suffix = comment ? `  // ${comment}` : ''
  lines.push(`const ${varName} = union(${subA}, ${subB})${suffix}`)
  return lines
}

// ---------------------------------------------------------------------------
// Combined stab geom entry point
// ---------------------------------------------------------------------------

export type StabType =
  | 'mx-basic'
  | 'mx-tight'
  | 'mx-bidirectional'
  | 'mx-spec'
  | 'mx-spec-narrow'
  | 'alps-aek'
  | 'alps-at101'

/**
 * Create stab geoms for any stab type.
 * Returns [leftGeom, rightGeom] or null if key is too small.
 */
export function createStabGeoms(type: StabType, opts: StabCutoutOptions): [Geom2, Geom2] | null {
  if (type === 'mx-basic' || type === 'mx-tight' || type === 'mx-bidirectional') {
    return createMxBasicStabGeoms(type, opts)
  }
  if (type === 'mx-spec' || type === 'mx-spec-narrow') {
    return createMxSpecStabGeoms({ ...opts, narrowChannel: type === 'mx-spec-narrow' })
  }
  if (type === 'alps-aek' || type === 'alps-at101') {
    return createAlpsStabGeoms(type, opts)
  }
  return null
}

/**
 * Build script lines for any stab type.
 * Returns null if key is too small.
 */
export function buildStabScript(
  type: StabType,
  varName: string,
  opts: StabCutoutOptions,
  keyCenterX: number,
  keyCenterY: number,
  totalRotDeg: number,
  comment?: string,
  registry?: ScriptShapeRegistry,
): string[] | null {
  if (type === 'mx-basic' || type === 'mx-tight' || type === 'mx-bidirectional') {
    return buildMxBasicStabScript(
      varName,
      type,
      opts,
      keyCenterX,
      keyCenterY,
      totalRotDeg,
      comment,
      registry,
    )
  }
  if (type === 'mx-spec' || type === 'mx-spec-narrow') {
    return buildMxSpecStabScript(
      varName,
      { ...opts, narrowChannel: type === 'mx-spec-narrow' },
      keyCenterX,
      keyCenterY,
      totalRotDeg,
      comment,
      registry,
    )
  }
  if (type === 'alps-aek' || type === 'alps-at101') {
    return buildAlpsStabScript(
      varName,
      type,
      opts,
      keyCenterX,
      keyCenterY,
      totalRotDeg,
      comment,
      registry,
    )
  }
  return null
}
