/**
 * Main plate building logic
 *
 * This module orchestrates the generation of switch cutout plates from keyboard layouts.
 * It handles coordinate transformation, cutout positioning, and export to SVG/DXF.
 */

import type MakerJs from 'makerjs'
import type { Key } from '@adamws/kle-serial'
import * as jscadModeling from '@jscad/modeling'
import { serialize as serializeStl } from '@jscad/stl-serializer'
import type {
  CutoutType,
  PlateGenerationResult,
  KeyCutoutPosition,
  StabilizerType,
  OutlineSettings,
  MountingHolesSettings,
  CustomHolesSettings,
  BacksideFeature,
} from '@/types/plate'
import { getMakerJs } from '@/utils/makerjs-loader'
import { getKeyCenterMm } from '@/utils/keyboard-geometry'
import { D } from '@/utils/decimal-math'
import {
  positionCutout,
  getCutoutGenerator,
  createStabilizerAlpsModel,
  createStabilizerMxBasicModel,
  createStabilizerMxSpecModel,
} from './cutout-generator'
import {
  type Geom2,
  type Geom3,
  type BacksideCut3D,
  placeGeom2,
  extractGeom2Points,
  fmt,
  fmtVec2,
  formatPoints,
  ScriptShapeRegistry,
  createRectangleSwitchGeom,
  buildRectangleSwitchScript,
  createCherryMxOpenableGeom,
  buildCherryMxOpenableScript,
  isRectangleSwitchType,
  createStabGeoms,
  buildStabScript,
  type StabType,
  createCircleHoleGeom,
  buildCircleHoleScript,
  createCherryMxSnapNotchCuts,
  createStabBacksideCut,
  STAB_BACKSIDE_OVERHANGS,
  createRotaryEncoderBacksideCut,
  ENCODER_CUTOUT_RADIUS,
  ENCODER_PCB_CUTOUT_SIZE,
} from './jscad-cutouts'

/** Per-key `sm` (switch mount) value identifying an EC11 rotary encoder. */
const ENCODER_SWITCH_MOUNT = 'rot_ec11'

/**
 * Options for building a plate
 */
export interface PlateBuilderOptions {
  /** Type of cutout to generate */
  cutoutType: CutoutType
  /** Type of stabilizer cutout to generate */
  stabilizerType?: StabilizerType
  /** Fillet (corner rounding) radius in mm for switch cutouts */
  filletRadius?: number
  /** Fillet (corner rounding) radius in mm for stabilizer cutouts */
  stabilizerFilletRadius?: number
  /** Size adjustment in mm. Positive = shrink, negative = expand (default: 0) */
  sizeAdjust?: number
  /** Horizontal spacing between key units in mm (default: 19.05) */
  spacingX?: number
  /** Vertical spacing between key units in mm (default: 19.05) */
  spacingY?: number
  /** Custom cutout width in mm (for custom-rectangle type) */
  customCutoutWidth?: number
  /** Custom cutout height in mm (for custom-rectangle type) */
  customCutoutHeight?: number
  /** Merge overlapping cutouts into simplified paths (default: false) */
  mergeCutouts?: boolean
  /**
   * Rotary encoder mounting style. false (default) = PCB build (14×14 rectangular
   * through-cutout); true = handwired screw-in mount (circular cutout + backside pocket).
   */
  rotaryEncoderHandwired?: boolean
  /** Outline generation settings */
  outline?: OutlineSettings
  /** Mounting holes settings */
  mountingHoles?: MountingHolesSettings
  /** Custom holes settings */
  customHoles?: CustomHolesSettings
  /** Plate thickness in mm for 3D export (default: 1.5) */
  thickness?: number
  /** Backside (back-face) features applied during 3D generation only */
  backsideFeatures?: BacksideFeature[]
  /** Cut depth in mm from back face for all backside features (default: 1.0) */
  backsideDepth?: number
}

/**
 * Default spacing values (standard MX spacing)
 */
const DEFAULT_SPACING_X = 19.05
const DEFAULT_SPACING_Y = 19.05

/**
 * Error thrown when plate generation fails
 */
export class PlateBuilderError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PlateBuilderError'
  }
}

/**
 * A named JSCAD geometry entry used for both STL boolean operations and script generation.
 * The same `geom` object is used for both outputs — guaranteeing they are always identical.
 */
interface JscadNamedGeom {
  /** Variable name in the generated JSCAD script (e.g. 'switch_0', 'stab_3') */
  varName: string
  /** The actual geometry used for boolean operations (STL and script assembly) */
  geom: Geom2
  /**
   * Script lines to emit for this shape. The last line must assign `varName`.
   * If absent, falls back to polygon point extraction from `geom`.
   */
  scriptLines?: string[]
}

/**
 * Extend the viewBox of an SVG by adding padding on all sides.
 * This prevents strokes at the edges from being clipped.
 *
 * @param svg - The SVG string to modify
 * @param padding - Padding to add on each side (in the same units as viewBox)
 * @returns SVG string with extended viewBox
 */
function extendSvgViewBox(svg: string, padding: number): string {
  const viewBoxMatch = svg.match(/viewBox="([^"]+)"/)
  if (!viewBoxMatch || !viewBoxMatch[1]) return svg

  const parts = viewBoxMatch[1].split(/\s+/).map(Number)
  if (parts.length !== 4) return svg

  const [minX, minY, width, height] = parts as [number, number, number, number]

  const newMinX = minX - padding
  const newMinY = minY - padding
  const newWidth = width + padding * 2
  const newHeight = height + padding * 2

  const newViewBox = `${newMinX} ${newMinY} ${newWidth} ${newHeight}`

  return svg.replace(/viewBox="[^"]+"/, `viewBox="${newViewBox}"`)
}

const KEY_SORT = (a: Key, b: Key) => {
  const dy = D.sub(a.y, b.y)
  return dy !== 0 ? dy : D.sub(a.x, b.x)
}

/**
 * Filter keys to only those that should have switch/stab cutouts.
 * Excludes decal keys and ghost keys.
 */
function filterCutoutKeys(keys: Key[]): Key[] {
  return keys.filter((key) => !key.decal && !key.ghost).sort(KEY_SORT)
}

/**
 * Filter keys that should contribute to outline generation.
 * Excludes decal keys only — ghost keys are included so they can
 * be used to adjust the tight outline shape without producing cutouts.
 */
function filterOutlineKeys(keys: Key[]): Key[] {
  return keys.filter((key) => !key.decal).sort(KEY_SORT)
}

/**
 * Convert a KLE key to a cutout position with coordinate transformation.
 *
 * Positions are computed relative to originCenterMm (the first key's center in mm),
 * with the origin key's top-left cutout corner placed at (0, 0).
 *
 * Coordinate transformation:
 * - KLE: +Y down, clockwise rotation
 * - Maker.js: +Y up, counter-clockwise rotation
 */
function keyToCutoutPosition(
  key: Key,
  cutoutType: CutoutType,
  spacingX: number,
  spacingY: number,
  originCenterMm: { x: number; y: number },
  customWidth?: number,
  customHeight?: number,
): KeyCutoutPosition {
  const generator = getCutoutGenerator(cutoutType, customWidth, customHeight)
  const centerMm = getKeyCenterMm(key, spacingX, spacingY)

  return {
    centerX: D.sub(D.sub(centerMm.x, originCenterMm.x), D.div(generator.width, 2)),
    centerY: D.sub(D.sub(originCenterMm.y, centerMm.y), D.div(generator.height, 2)),
    rotationAngle: -(key.rotation_angle || 0),
    width: generator.width,
    height: generator.height,
    footprintWidth: generator.width + ((key.width || 1) - 1) * spacingX,
    footprintHeight: generator.height + ((key.height || 1) - 1) * spacingY,
  }
}

/**
 * Bounding box for cutouts
 */
interface CutoutBounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

/**
 * Calculate the bounding box of all cutouts using maker.js modelExtents.
 *
 * @param makerjs - The maker.js module
 * @param plateModel - The plate model containing all cutouts
 * @returns Bounding box coordinates in mm
 */
function calculateCutoutsBounds(makerjs: typeof MakerJs, plateModel: MakerJs.IModel): CutoutBounds {
  const extents = makerjs.measure.modelExtents(plateModel)
  if (!extents) {
    throw new PlateBuilderError('Cannot calculate bounds for empty plate model')
  }
  return {
    minX: extents.low[0]!,
    minY: extents.low[1]!,
    maxX: extents.high[0]!,
    maxY: extents.high[1]!,
  }
}

/**
 * Create an outline rectangle model around the cutouts with specified margins.
 *
 * @param makerjs - The maker.js module
 * @param bounds - Bounding box of the cutouts
 * @param margins - Margins to add on each side (top, bottom, left, right)
 * @param filletRadius - Corner rounding radius in mm (0 = sharp corners)
 * @returns Outline rectangle model
 */
function createOutlineModel(
  makerjs: typeof MakerJs,
  bounds: CutoutBounds,
  margins: { top: number; bottom: number; left: number; right: number },
  filletRadius: number = 0,
): MakerJs.IModel {
  const outlineWidth = bounds.maxX - bounds.minX + margins.left + margins.right
  const outlineHeight = bounds.maxY - bounds.minY + margins.top + margins.bottom

  let outlineModel: MakerJs.IModel

  if (filletRadius > 0) {
    // Use RoundRectangle for filleted corners
    outlineModel = new makerjs.models.RoundRectangle(outlineWidth, outlineHeight, filletRadius)
  } else {
    // Use regular Rectangle for sharp corners
    outlineModel = new makerjs.models.Rectangle(outlineWidth, outlineHeight)
  }

  outlineModel.origin = [bounds.minX - margins.left, bounds.minY - margins.bottom]

  return outlineModel
}

/**
 * Create a tight outline model that closely follows the key cluster shape.
 *
 * For each cutout position, a RoundRectangle padded by `margin` on all sides is created using
 * the same rotation convention as positionCutout. All padded shapes are then unioned
 * iteratively. This avoids the inner/outer ring artefact that expandPaths produces on
 * closed paths (it only creates outer boundaries).
 *
 * Corner radius equals `margin`, so rounded corners appear automatically.
 *
 * @param makerjs - The maker.js module
 * @param cutoutPositions - Array of cutout positions (each has center, size, rotation)
 * @param margin - Expansion distance in mm (also sets corner radius)
 * @returns Tight outline model (may be multiple disconnected loops for split keyboards)
 */
function createTightOutlineModel(
  makerjs: typeof MakerJs,
  cutoutPositions: KeyCutoutPosition[],
  margin: number,
): MakerJs.IModel {
  const paddedModels: Record<string, MakerJs.IModel> = {}
  const keys: string[] = []

  for (let i = 0; i < cutoutPositions.length; i++) {
    const pos = cutoutPositions[i]!
    // Use the key's full footprint (key.width * spacingX, key.height * spacingY) as the base
    // rectangle so that non-1U keys (2U, ISO enter, etc.) are properly covered without needing
    // extra outline rectangles.
    const paddedWidth = pos.footprintWidth + 2 * margin
    const paddedHeight = pos.footprintHeight + 2 * margin

    // Create Rectangle with bottom-left at local [0, 0]
    let padded: MakerJs.IModel = new makerjs.models.Rectangle(paddedWidth, paddedHeight)

    // Center at world origin so rotation happens around the footprint center
    padded = makerjs.model.move(padded, [-paddedWidth / 2, -paddedHeight / 2])

    // Rotate around world [0,0] (= the key center) — same convention as positionCutout
    if (pos.rotationAngle !== 0) {
      padded = makerjs.model.rotate(padded, pos.rotationAngle, [0, 0])
    }

    // Place at key center.
    // pos.centerX is the bottom-left of the cutout, so pos.centerX + pos.width/2 = key center.
    // makerjs.model.move SETS the origin (not additive).
    const keyCenterX = pos.centerX + pos.width / 2
    const keyCenterY = pos.centerY + pos.height / 2
    padded = makerjs.model.move(padded, [
      keyCenterX - paddedWidth / 2,
      keyCenterY - paddedHeight / 2,
    ])

    const k = `padded_${i}`
    paddedModels[k] = padded
    keys.push(k)
  }

  // Iteratively union all padded models.
  // Non-overlapping shapes (e.g. split keyboard halves) are kept as separate loops.
  let result: MakerJs.IModel = {
    models: { [keys[0]!]: makerjs.model.clone(paddedModels[keys[0]!]!) },
  }
  for (let i = 1; i < keys.length; i++) {
    const next: MakerJs.IModel = {
      models: { [keys[i]!]: makerjs.model.clone(paddedModels[keys[i]!]!) },
    }
    makerjs.model.combineUnion(result, next)
    result = {
      models: { ...result.models, ...next.models },
      paths: { ...result.paths, ...next.paths },
    }
  }

  return result
}

/**
 * Create corner mounting holes based on outline bounds.
 *
 * @param makerjs - The maker.js module
 * @param bounds - Bounding box of the cutouts
 * @param margins - Outline margins (to calculate outline corners)
 * @param mountingHoles - Mounting hole settings
 * @returns Record of mounting hole models
 */
function createCornerMountingHoles(
  makerjs: typeof MakerJs,
  bounds: CutoutBounds,
  margins: { top: number; bottom: number; left: number; right: number },
  mountingHoles: MountingHolesSettings,
): Record<string, MakerJs.IModel> {
  const holeRadius = mountingHoles.diameter / 2
  const edgeDist = mountingHoles.edgeDistance

  // Calculate outline dimensions
  const outlineLeft = bounds.minX - margins.left
  const outlineBottom = bounds.minY - margins.bottom
  const outlineRight = bounds.maxX + margins.right
  const outlineTop = bounds.maxY + margins.top

  // Calculate hole positions (absolute coordinates)
  const left = outlineLeft + edgeDist
  const right = outlineRight - edgeDist
  const bottom = outlineBottom + edgeDist
  const top = outlineTop - edgeDist

  const holes: Record<string, MakerJs.IModel> = {}

  holes.holeBottomLeft = new makerjs.models.Ellipse(holeRadius, holeRadius)
  holes.holeBottomLeft.origin = [left, bottom]

  holes.holeBottomRight = new makerjs.models.Ellipse(holeRadius, holeRadius)
  holes.holeBottomRight.origin = [right, bottom]

  holes.holeTopLeft = new makerjs.models.Ellipse(holeRadius, holeRadius)
  holes.holeTopLeft.origin = [left, top]

  holes.holeTopRight = new makerjs.models.Ellipse(holeRadius, holeRadius)
  holes.holeTopRight.origin = [right, top]

  return holes
}

/**
 * Create custom holes at specified positions.
 *
 * @param makerjs - The maker.js module
 * @param customHoles - Custom holes settings
 * @param spacingX - Horizontal spacing between key units in mm
 * @param spacingY - Vertical spacing between key units in mm
 * @returns Record of custom hole models
 */
function createCustomHoles(
  makerjs: typeof MakerJs,
  customHoles: CustomHolesSettings,
  spacingX: number,
  spacingY: number,
): Record<string, MakerJs.IModel> {
  const holes: Record<string, MakerJs.IModel> = {}

  for (const hole of customHoles.holes) {
    const holeRadius = hole.diameter / 2
    // Convert from keyboard units (U) to mm
    const x = hole.offsetX * spacingX
    // Y axis is inverted in maker.js (positive Y is up)
    const y = -hole.offsetY * spacingY

    const holeModel = new makerjs.models.Ellipse(holeRadius, holeRadius)
    holeModel.origin = [x, y]
    holes[`customHole_${hole.id}`] = holeModel
  }

  return holes
}

/**
 * Merge overlapping cutouts into simplified paths using maker.js combineUnion.
 * This reduces complexity when stabilizer cutouts overlap with switch cutouts.
 *
 * @param makerjs - The maker.js module
 * @param cutoutModels - Record of individual cutout models
 * @returns Record with merged models
 */
function mergeOverlappingCutouts(
  makerjs: typeof MakerJs,
  cutoutModels: Record<string, MakerJs.IModel>,
): Record<string, MakerJs.IModel> {
  const modelNames = Object.keys(cutoutModels)
  if (modelNames.length === 0) {
    return {}
  }

  // Start with the first model as the base for merging
  let mergedModel: MakerJs.IModel = {
    models: { [modelNames[0]!]: makerjs.model.clone(cutoutModels[modelNames[0]!]!) },
  }

  // Iteratively combine each subsequent model using union
  for (let i = 1; i < modelNames.length; i++) {
    const nextModel: MakerJs.IModel = {
      models: { [modelNames[i]!]: makerjs.model.clone(cutoutModels[modelNames[i]!]!) },
    }

    // combineUnion merges two models, keeping the union of both areas
    // This handles overlapping shapes by creating a single merged outline
    makerjs.model.combineUnion(mergedModel, nextModel)

    // After combineUnion, nextModel contains the union result
    // We need to collect both models' remaining paths
    mergedModel = {
      models: {
        ...mergedModel.models,
        ...nextModel.models,
      },
      paths: {
        ...mergedModel.paths,
        ...nextModel.paths,
      },
    }
  }

  return { merged: mergedModel }
}

/**
 * Extract a sanitized, human-readable label from a key for use in code comments.
 */
function sanitizeLabel(key: Key): string {
  const raw = (key.labels || []).find((l) => l && l.trim()) || ''
  return raw
    .replace(/<[^>]+>/g, '')
    .replace(/\n[\s\S]*/g, '')
    .trim()
    .slice(0, 20)
}

/**
 * Convert a maker.js outline model to a JSCAD Geom2 polygon.
 * This is the ONE remaining use of makerjs.chain.toKeyPoints — acceptable
 * because the tight outline union is complex enough to warrant maker.js.
 * Uses a generous segment size (1mm arc facet) for outline fillet arcs.
 */
function outlineToGeom2(makerjs: typeof MakerJs, outlineModel: MakerJs.IModel): Geom2 {
  const { polygon } = jscadModeling.primitives
  const { union } = jscadModeling.booleans
  const maxArcFacet = 0.5 // mm — tighter than old PLATE_ARC_FACET_MM=1 for better arc quality

  const chainsResult = makerjs.model.findChains(outlineModel, { pointMatchingDistance: 0.005 })
  const chains: MakerJs.IChain[] = Array.isArray(chainsResult)
    ? chainsResult
    : ([] as MakerJs.IChain[]).concat(...Object.values(chainsResult))

  const polys: Geom2[] = chains
    .filter((c) => c.endless)
    .map((c) => {
      const raw = makerjs.chain.toKeyPoints(c, maxArcFacet) as number[][]
      const pts = raw.map(
        (p) =>
          [Math.round(p[0]! * 1000) / 1000, Math.round(p[1]! * 1000) / 1000] as [number, number],
      )
      let area = 0
      for (let i = 0, n = pts.length; i < n; i++) {
        const [x0, y0] = pts[i]!
        const [x1, y1] = pts[(i + 1) % n]!
        area += x0 * y1 - x1 * y0
      }
      const ccwPts = area < 0 ? pts.slice().reverse() : pts
      return polygon({ points: ccwPts }) as Geom2
    })

  if (polys.length === 0) throw new PlateBuilderError('Outline model produced no closed chains')
  return polys.reduce((a, b) => union(a, b) as Geom2)
}

/**
 * Build an ASCII STL string using pure @jscad/modeling v2 booleans.
 * No maker.js chain extraction — all geometry is pre-built as Geom2.
 */
function buildStl(
  outlineGeom: Geom2,
  cutoutGeoms: Geom2[],
  thickness: number,
  backsideCuts: Geom3[] = [],
): string | undefined {
  const { extrudeLinear } = jscadModeling.extrusions
  const { subtract, union } = jscadModeling.booleans

  let plate2D: Geom2 = outlineGeom
  if (cutoutGeoms.length > 0) {
    const allCutouts = cutoutGeoms.reduce((a, b) => union(a, b) as Geom2)
    plate2D = subtract(outlineGeom, allCutouts) as Geom2
  }

  let solid = extrudeLinear({ height: thickness }, plate2D)
  if (backsideCuts.length > 0) {
    solid = subtract(solid, ...backsideCuts)
  }

  const output = serializeStl({ binary: false }, solid)
  return Array.isArray(output) ? output.join('') : String(output)
}

/**
 * Generate a human-readable OpenJSCAD v2 script for the plate.
 *
 * Uses JscadNamedGeom entries — the same geometry objects used for STL booleans
 * are serialized to script text, guaranteeing script and STL are always identical.
 * Compatible with https://openjscad.xyz/
 */
function buildJscadScript(
  outlineNamedGeom: JscadNamedGeom,
  cutouts: JscadNamedGeom[],
  options: {
    thickness: number
    cutoutType: CutoutType
    stabilizerType: StabilizerType
    outlineScriptLines?: string[]
    registry?: ScriptShapeRegistry
    backsideCuts?: BacksideCut3D[]
  },
): string {
  const {
    thickness,
    cutoutType,
    stabilizerType,
    outlineScriptLines,
    registry,
    backsideCuts = [],
  } = options
  const date = new Date().toISOString().split('T')[0]

  const registryLines = registry?.getDefinitionLines() ?? []

  // Scan all script lines to determine which imports are needed
  const allLines: string[] = [
    ...(outlineNamedGeom.scriptLines ?? outlineScriptLines ?? []),
    ...registryLines,
    ...cutouts.flatMap((c) => c.scriptLines ?? []),
    ...backsideCuts.flatMap((b) => b.scriptLines),
  ]

  const usesRectangle = allLines.some((l) => /\brectangle\(/.test(l))
  const usesRoundedRectangle = allLines.some((l) => /\broundedRectangle\(/.test(l))
  const usesCircle = allLines.some((l) => /\bcircle\(/.test(l))
  const usesPolygon = allLines.some((l) => /\bpolygon\(/.test(l))
  const usesCuboid = allLines.some((l) => /\bcuboid\(/.test(l))
  const usesTranslate = allLines.some((l) => /\btranslate\(/.test(l))
  const usesRotateZ = allLines.some((l) => /\brotateZ\(/.test(l))

  const primitiveNames: string[] = ['polygon'] // always need polygon for outline fallback
  if (usesRectangle && !primitiveNames.includes('rectangle')) primitiveNames.push('rectangle')
  if (usesRoundedRectangle) primitiveNames.push('roundedRectangle')
  if (usesCircle) primitiveNames.push('circle')
  if (usesCuboid) primitiveNames.push('cuboid')
  if (!usesPolygon) {
    // polygon may not be used if no fallback extraction needed; still include for safety
  }
  // deduplicate and sort
  const primitiveImports = [...new Set(primitiveNames)].sort()
  const transformNames: string[] = []
  if (usesTranslate) transformNames.push('translate')
  if (usesRotateZ) transformNames.push('rotateZ')
  const transformImports = [...new Set(transformNames)].sort()

  const lines: string[] = []

  // Header
  lines.push(`/**`)
  lines.push(` * Keyboard Plate - Generated by KLE-NG`)
  lines.push(` *`)
  lines.push(` * Cutout type: ${cutoutType}`)
  lines.push(` * Stabilizer type: ${stabilizerType}`)
  lines.push(` * Plate thickness: ${thickness} mm`)
  lines.push(` * Generated: ${date}`)
  lines.push(` *`)
  lines.push(` * This file uses the @jscad/modeling API (OpenJSCAD v2).`)
  lines.push(` * Open with: https://openjscad.xyz/`)
  lines.push(` */`)
  lines.push(`const jscad = require('@jscad/modeling')`)
  lines.push(`const { ${primitiveImports.join(', ')} } = jscad.primitives`)
  if (transformImports.length > 0) {
    lines.push(`const { ${transformImports.join(', ')} } = jscad.transforms`)
  }
  lines.push(`const { extrudeLinear } = jscad.extrusions`)
  lines.push(`const { subtract, union } = jscad.booleans`)
  lines.push(``)
  lines.push(`const THICKNESS = ${thickness} // mm`)
  lines.push(``)

  // Outline
  lines.push(`// --- Plate outline ---`)
  if (outlineNamedGeom.scriptLines && outlineNamedGeom.scriptLines.length > 0) {
    lines.push(...outlineNamedGeom.scriptLines)
  } else {
    // Fallback: extract polygon points from geom2 (tight outline, no parametric form).
    // A split keyboard produces multiple disjoint chains in the Geom2 union — each must
    // become its own polygon(), then all are union()'d into the final outline variable.
    const rawOutlines = jscadModeling.geometries.geom2.toOutlines(
      outlineNamedGeom.geom,
    ) as number[][][]
    const varName = outlineNamedGeom.varName
    if (rawOutlines.length <= 1) {
      const pts = extractGeom2Points(outlineNamedGeom.geom)
      lines.push(`const ${varName} = polygon({ points: ${formatPoints(pts)} })`)
    } else {
      const subVars: string[] = []
      for (let oi = 0; oi < rawOutlines.length; oi++) {
        const subVar = `${varName}_${oi}`
        const rawPts = rawOutlines[oi]!.map(
          (p) =>
            [Math.round(p[0]! * 1000) / 1000, Math.round(p[1]! * 1000) / 1000] as [number, number],
        )
        let area = 0
        for (let i = 0, n = rawPts.length; i < n; i++) {
          const [x0, y0] = rawPts[i]!
          const [x1, y1] = rawPts[(i + 1) % n]!
          area += x0 * y1 - x1 * y0
        }
        const pts: [number, number][] = area < 0 ? rawPts.slice().reverse() : rawPts
        lines.push(`const ${subVar} = polygon({ points: ${formatPoints(pts)} })`)
        subVars.push(subVar)
      }
      lines.push(`const ${varName} = union(${subVars.join(', ')})`)
    }
  }
  lines.push(``)

  // Shared shape definitions (deduplicated primitives referenced by multiple cutouts)
  if (registryLines.length > 0) {
    lines.push(`// --- Shared shapes ---`)
    lines.push(...registryLines)
    lines.push(``)
  }

  // Separate cutouts by type for grouped output
  const switchLines: string[] = []
  const stabLines: string[] = []
  const holeLines: string[] = []
  const allCutoutVars: string[] = []

  for (const entry of cutouts) {
    const scriptBlock: string[] =
      entry.scriptLines && entry.scriptLines.length > 0
        ? entry.scriptLines
        : [
            `const ${entry.varName} = polygon({ points: ${formatPoints(extractGeom2Points(entry.geom))} })`,
          ]

    if (entry.varName.startsWith('switch_')) {
      switchLines.push(...scriptBlock)
    } else if (entry.varName.startsWith('stab_')) {
      stabLines.push(...scriptBlock)
    } else {
      holeLines.push(...scriptBlock)
    }
    allCutoutVars.push(entry.varName)
  }

  if (switchLines.length > 0) {
    lines.push(`// --- Switch cutouts ---`)
    lines.push(...switchLines)
    lines.push(``)
  }
  if (stabLines.length > 0) {
    lines.push(`// --- Stabilizer cutouts ---`)
    lines.push(...stabLines)
    lines.push(``)
  }
  if (holeLines.length > 0) {
    lines.push(`// --- Holes ---`)
    lines.push(...holeLines)
    lines.push(``)
  }

  // Backside cuts (3D only)
  if (backsideCuts.length > 0) {
    lines.push(`// --- Backside features ---`)
    for (const cut of backsideCuts) {
      lines.push(...cut.scriptLines)
    }
    lines.push(``)
  }

  // Assembly
  const outlineVar = outlineNamedGeom.varName
  lines.push(`// --- Assembly ---`)
  if (allCutoutVars.length === 0) {
    lines.push(`const plate2d = ${outlineVar}`)
  } else if (allCutoutVars.length === 1) {
    lines.push(`const plate2d = subtract(${outlineVar}, ${allCutoutVars[0]})`)
  } else {
    lines.push(`const allCutouts = union(`)
    lines.push(`  ${allCutoutVars.join(',\n  ')}`)
    lines.push(`)`)
    lines.push(`const plate2d = subtract(${outlineVar}, allCutouts)`)
  }
  lines.push(`const plate3d = extrudeLinear({ height: THICKNESS }, plate2d)`)
  if (backsideCuts.length === 0) {
    lines.push(`const finalPlate = plate3d`)
  } else if (backsideCuts.length === 1) {
    lines.push(`const finalPlate = subtract(plate3d, ${backsideCuts[0]!.varName})`)
  } else {
    lines.push(`const allBacksideCuts = union(`)
    lines.push(`  ${backsideCuts.map((b) => b.varName).join(',\n  ')}`)
    lines.push(`)`)
    lines.push(`const finalPlate = subtract(plate3d, allBacksideCuts)`)
  }
  lines.push(``)
  lines.push(`const main = () => finalPlate`)
  lines.push(``)
  lines.push(`module.exports = { main }`)

  return lines.join('\n')
}

/**
 * Build a plate from a keyboard layout.
 *
 * @param keys - Array of keys from the keyboard layout
 * @param options - Build options including cutout type and spacing
 * @returns PlateGenerationResult with SVG and DXF
 * @throws PlateBuilderError if generation fails
 */
export async function buildPlate(
  keys: Key[],
  options: PlateBuilderOptions,
): Promise<PlateGenerationResult> {
  const {
    cutoutType,
    stabilizerType = 'none',
    filletRadius = 0,
    stabilizerFilletRadius = 0,
    sizeAdjust = 0,
    spacingX = DEFAULT_SPACING_X,
    spacingY = DEFAULT_SPACING_Y,
    customCutoutWidth,
    customCutoutHeight,
    mergeCutouts = false,
    rotaryEncoderHandwired = false,
    outline,
    mountingHoles,
    customHoles,
    thickness = 1.5,
    backsideFeatures = [],
    backsideDepth = 0,
  } = options

  // Load maker.js
  const makerjs = await getMakerJs()

  // Keys that get switch/stab cutouts (no decals, no ghosts)
  const cutoutKeys = filterCutoutKeys(keys)

  // Check for empty layout
  if (cutoutKeys.length === 0) {
    throw new PlateBuilderError(
      'No valid keys found. All keys are either decal or ghost keys, or the layout is empty.',
    )
  }

  // Use the first non-ghost key's center as the coordinate origin
  const originCenterMm = getKeyCenterMm(cutoutKeys[0]!, spacingX, spacingY)

  // Convert cutout keys to positions (used for switch/stab geometry)
  const cutoutPositions = cutoutKeys.map((key) =>
    keyToCutoutPosition(
      key,
      cutoutType,
      spacingX,
      spacingY,
      originCenterMm,
      customCutoutWidth,
      customCutoutHeight,
    ),
  )

  // Keys that contribute to outline (includes ghost keys)
  const outlineKeys = filterOutlineKeys(keys)
  const outlinePositions = outlineKeys.map((key) =>
    keyToCutoutPosition(
      key,
      cutoutType,
      spacingX,
      spacingY,
      originCenterMm,
      customCutoutWidth,
      customCutoutHeight,
    ),
  )

  // Shared shape registry — deduplicates primitive expressions across JSCAD script output
  const scriptShapeRegistry = new ScriptShapeRegistry()

  // Create cutout models (maker.js — for SVG/DXF) and JSCAD native geoms (for STL/script)
  const cutoutModels: Record<string, MakerJs.IModel> = {}
  const namedGeoms: JscadNamedGeom[] = []
  const stabBacksideCuts: BacksideCut3D[] = []

  for (let i = 0; i < cutoutPositions.length; i++) {
    const position = cutoutPositions[i]
    const key = cutoutKeys[i]
    if (!position) continue

    // The switch generator's width/height cancel out here, so this is the true
    // key center regardless of the configured cutout type.
    const keyCenterX = position.centerX + position.width / 2
    const keyCenterY = position.centerY + position.height / 2

    // --- Rotary encoder override (sm === 'rot_ec11') ---
    // Encoders never get a stabilizer or Cherry MX snap notch. The cutout shape
    // depends on the mounting style:
    //  • PCB build (default): standard 14×14mm rectangular through-cutout — the
    //    encoder is soldered to the PCB and sits in a normal switch position.
    //  • Handwired build: circular screw-in cutout (kerf-compensated) plus a
    //    15×15mm backside clearance pocket (added later, 3D only).
    if (key?.sm === ENCODER_SWITCH_MOUNT) {
      const label = sanitizeLabel(key)
      const varName = `switch_${i}`

      if (rotaryEncoderHandwired) {
        const encoderRadius = ENCODER_CUTOUT_RADIUS - sizeAdjust / 2

        // Maker.js side (SVG/DXF)
        const encoderModel = new makerjs.models.Ellipse(encoderRadius, encoderRadius)
        encoderModel.origin = [keyCenterX, keyCenterY]
        cutoutModels[`cutout_${i}`] = encoderModel

        // JSCAD side (STL + script) — reuse circle-hole primitives, keep switch_ prefix
        const comment = [label ? `"${label}"` : '', 'encoder (handwired)'].filter(Boolean).join(' ')
        namedGeoms.push({
          varName,
          geom: placeGeom2(createCircleHoleGeom(encoderRadius), keyCenterX, keyCenterY, 0),
          scriptLines: buildCircleHoleScript(
            varName,
            encoderRadius,
            keyCenterX,
            keyCenterY,
            comment,
          ),
        })
      } else {
        // PCB build: 14×14mm rectangle, cut through the full plate thickness.
        const switchRotDeg = position.rotationAngle - (key.switchRotation || 0)

        // Maker.js side (SVG/DXF) — reuse the standard 14×14 Cherry MX generator.
        cutoutModels[`cutout_${i}`] = await positionCutout(
          position,
          'cherry-mx-basic',
          filletRadius,
          sizeAdjust,
          undefined,
          undefined,
          key.switchRotation || 0,
        )

        // JSCAD side (STL + script)
        const w = ENCODER_PCB_CUTOUT_SIZE - sizeAdjust
        const h = ENCODER_PCB_CUTOUT_SIZE - sizeAdjust
        const comment = [label ? `"${label}"` : '', 'encoder (PCB)'].filter(Boolean).join(' ')
        namedGeoms.push({
          varName,
          geom: placeGeom2(
            createRectangleSwitchGeom({ width: w, height: h, filletRadius }),
            keyCenterX,
            keyCenterY,
            switchRotDeg,
          ),
          scriptLines: buildRectangleSwitchScript(
            varName,
            { width: w, height: h, filletRadius },
            keyCenterX,
            keyCenterY,
            switchRotDeg,
            comment,
            scriptShapeRegistry,
          ),
        })
      }
      continue
    }

    // --- Maker.js side (SVG/DXF, unchanged) ---
    const cutoutModel = await positionCutout(
      position,
      cutoutType,
      filletRadius,
      sizeAdjust,
      customCutoutWidth,
      customCutoutHeight,
      key?.switchRotation || 0,
    )
    cutoutModels[`cutout_${i}`] = cutoutModel

    // --- JSCAD side (STL + script) ---
    const gen = getCutoutGenerator(cutoutType, customCutoutWidth, customCutoutHeight)
    const w = gen.width - sizeAdjust
    const h = gen.height - sizeAdjust
    const switchRotDeg = position.rotationAngle - (key?.switchRotation || 0)

    const label = key ? sanitizeLabel(key) : ''
    const size = key ? `${key.width ?? 1}u` : ''
    const switchComment = [label ? `"${label}"` : '', size].filter(Boolean).join(' ')
    const varName = `switch_${i}`

    let switchGeom: Geom2
    let scriptLines: string[]
    if (isRectangleSwitchType(cutoutType)) {
      switchGeom = placeGeom2(
        createRectangleSwitchGeom({ width: w, height: h, filletRadius }),
        keyCenterX,
        keyCenterY,
        switchRotDeg,
      )
      scriptLines = buildRectangleSwitchScript(
        varName,
        { width: w, height: h, filletRadius },
        keyCenterX,
        keyCenterY,
        switchRotDeg,
        switchComment,
        scriptShapeRegistry,
      )
    } else {
      // cherry-mx-openable
      switchGeom = placeGeom2(
        createCherryMxOpenableGeom({ width: w, height: h, filletRadius, sizeAdjust }),
        keyCenterX,
        keyCenterY,
        switchRotDeg,
      )
      scriptLines = buildCherryMxOpenableScript(
        varName,
        { width: w, height: h, filletRadius, sizeAdjust },
        keyCenterX,
        keyCenterY,
        switchRotDeg,
        switchComment,
      )
    }
    namedGeoms.push({ varName, geom: switchGeom, scriptLines })

    // Create stabilizer cutout if enabled
    if (stabilizerType !== 'none' && key) {
      const keyWidth = key.width || 1
      const keyHeight = key.height || 1
      const totalStabRotation = position.rotationAngle - (key.stabRotation || 0)
      const stabKeyCenterX = D.add(position.centerX, D.div(position.width, 2))
      const stabKeyCenterY = D.add(position.centerY, D.div(position.height, 2))

      // Maker.js stab model (SVG/DXF)
      let stabModel: MakerJs.IModel | null
      if (stabilizerType === 'mx-spec' || stabilizerType === 'mx-spec-narrow') {
        stabModel = createStabilizerMxSpecModel(
          makerjs,
          keyWidth,
          keyHeight,
          stabilizerFilletRadius,
          sizeAdjust,
          stabilizerType === 'mx-spec-narrow',
        )
      } else if (
        stabilizerType === 'mx-basic' ||
        stabilizerType === 'mx-bidirectional' ||
        stabilizerType === 'mx-tight'
      ) {
        stabModel = createStabilizerMxBasicModel(
          makerjs,
          stabilizerType,
          keyWidth,
          keyHeight,
          stabilizerFilletRadius,
          sizeAdjust,
        )
      } else {
        stabModel = createStabilizerAlpsModel(
          makerjs,
          stabilizerType,
          keyWidth,
          keyHeight,
          stabilizerFilletRadius,
          sizeAdjust,
        )
      }
      if (stabModel) {
        let positionedStab = stabModel
        if (totalStabRotation !== 0) {
          positionedStab = makerjs.model.rotate(positionedStab, totalStabRotation, [0, 0])
        }
        positionedStab = makerjs.model.move(positionedStab, [stabKeyCenterX, stabKeyCenterY])
        cutoutModels[`stabilizer_${i}`] = positionedStab
      }

      // JSCAD stab geoms
      const stabVarName = `stab_${i}`
      const stabComment = label
        ? `stabilizer for "${label}" (switch ${i})`
        : `stabilizer for switch ${i}`
      const stabOpts = {
        keyWidth,
        keyHeight,
        filletRadius: stabilizerFilletRadius,
        sizeAdjust,
      }
      const stabGeomPair = createStabGeoms(stabilizerType as StabType, stabOpts)
      if (stabGeomPair) {
        const [leftGeom, rightGeom] = stabGeomPair

        // Measure local bbox before placement for the backside clearance cut
        const localUnion = jscadModeling.booleans.union(leftGeom, rightGeom) as Geom2
        const localBbox = jscadModeling.measurements.measureBoundingBox(localUnion) as [
          [number, number, number],
          [number, number, number],
        ]

        const placedLeft = placeGeom2(leftGeom, stabKeyCenterX, stabKeyCenterY, totalStabRotation)
        const placedRight = placeGeom2(rightGeom, stabKeyCenterX, stabKeyCenterY, totalStabRotation)
        const stabGeom = jscadModeling.booleans.union(placedLeft, placedRight) as Geom2
        const stabScriptLines = buildStabScript(
          stabilizerType as StabType,
          stabVarName,
          stabOpts,
          stabKeyCenterX,
          stabKeyCenterY,
          totalStabRotation,
          stabComment,
          scriptShapeRegistry,
        )
        namedGeoms.push({
          varName: stabVarName,
          geom: stabGeom,
          scriptLines: stabScriptLines ?? undefined,
        })

        if (backsideDepth > 0) {
          const stabBacksideCut = createStabBacksideCut(
            i,
            stabKeyCenterX,
            stabKeyCenterY,
            totalStabRotation,
            backsideDepth,
            localBbox,
            STAB_BACKSIDE_OVERHANGS[stabilizerType as StabType],
            scriptShapeRegistry,
          )
          if (stabBacksideCut) stabBacksideCuts.push(stabBacksideCut)
        }
      }
    }
  }

  // Merge overlapping cutouts if enabled
  let finalCutoutModels: Record<string, MakerJs.IModel> = cutoutModels
  if (mergeCutouts) {
    finalCutoutModels = mergeOverlappingCutouts(makerjs, cutoutModels)
  }

  // Create the main plate model with all cutouts
  const plateModel: MakerJs.IModel = {
    models: finalCutoutModels,
    units: makerjs.unitType.Millimeter,
  }

  // Calculate bounds for outline and mounting holes
  const bounds = calculateCutoutsBounds(makerjs, plateModel)
  const outlineMargins = outline
    ? {
        top: outline.marginTop,
        bottom: outline.marginBottom,
        left: outline.marginLeft,
        right: outline.marginRight,
      }
    : { top: 0, bottom: 0, left: 0, right: 0 }

  // Add corner mounting holes to cutouts (rectangular outline only — tight has no fixed corners)
  if (mountingHoles?.enabled && outline?.outlineType === 'rectangular') {
    const holeRadius = mountingHoles.diameter / 2
    const edgeDist = mountingHoles.edgeDistance
    const { left: mLeft, right: mRight, top: mTop, bottom: mBottom } = outlineMargins
    const hLeft = bounds.minX - mLeft + edgeDist
    const hRight = bounds.maxX + mRight - edgeDist
    const hBottom = bounds.minY - mBottom + edgeDist
    const hTop = bounds.maxY + mTop - edgeDist
    const cornerPositions: [string, [number, number]][] = [
      ['holeBottomLeft', [hLeft, hBottom]],
      ['holeBottomRight', [hRight, hBottom]],
      ['holeTopLeft', [hLeft, hTop]],
      ['holeTopRight', [hRight, hTop]],
    ]
    const holeModels = createCornerMountingHoles(makerjs, bounds, outlineMargins, mountingHoles)
    Object.assign(plateModel.models!, holeModels)
    for (const [name, [cx, cy]] of cornerPositions) {
      const varName = name.replace(/[^a-zA-Z0-9_]/g, '_')
      namedGeoms.push({
        varName,
        geom: placeGeom2(createCircleHoleGeom(holeRadius), cx, cy, 0),
        scriptLines: buildCircleHoleScript(varName, holeRadius, cx, cy),
      })
    }
  }

  // Add custom holes
  if (customHoles?.enabled && customHoles.holes.length > 0) {
    const customHoleModels = createCustomHoles(makerjs, customHoles, spacingX, spacingY)
    Object.assign(plateModel.models!, customHoleModels)
    for (let idx = 0; idx < customHoles.holes.length; idx++) {
      const hole = customHoles.holes[idx]!
      const radius = hole.diameter / 2
      const cx = hole.offsetX * spacingX
      const cy = -hole.offsetY * spacingY
      const varName = `customHole_${idx}`
      namedGeoms.push({
        varName,
        geom: placeGeom2(createCircleHoleGeom(radius), cx, cy, 0),
        scriptLines: buildCircleHoleScript(varName, radius, cx, cy),
      })
    }
  }

  // Create outline model if enabled
  let outlineModel: MakerJs.IModel | null = null
  if (outline?.outlineType === 'tight') {
    outlineModel = createTightOutlineModel(makerjs, outlinePositions, outline.tightMargin)
    // Apply fillet AFTER the union is fully built — not during per-key rect creation.
    // chain.fillet clips the existing paths in-place and returns new arc paths to merge in.
    if (outline.filletRadius > 0) {
      const chains = makerjs.model.findChains(outlineModel) as MakerJs.IChain[]
      if (chains) {
        const allFilletPaths: Record<string, MakerJs.IPath> = {}
        chains.forEach((chain, chainIndex) => {
          const filletModel = makerjs.chain.fillet(chain, outline.filletRadius)
          if (filletModel?.paths) {
            for (const key in filletModel.paths) {
              allFilletPaths[`c${chainIndex}_${key}`] = filletModel.paths[key]!
            }
          }
        })
        outlineModel.paths = { ...outlineModel.paths, ...allFilletPaths }
      }
    }
  } else if (outline?.outlineType === 'rectangular') {
    outlineModel = createOutlineModel(makerjs, bounds, outlineMargins, outline.filletRadius)
  }

  // Build JSCAD outline geom — rectangular outline uses parametric script; tight uses polygon fallback
  let outlineNamedGeom: JscadNamedGeom | null = null
  if (outlineModel) {
    // Clone and strip layers so path walker doesn't see styling tags during conversion
    const outlineClean = makerjs.model.clone(outlineModel)
    makerjs.model.walkPaths(outlineClean, (_mp: MakerJs.IModel, _pi: string, p: MakerJs.IPath) => {
      delete p.layer
    })
    const outlineGeom = outlineToGeom2(makerjs, outlineClean)

    let outlineScriptLines: string[] | undefined
    if (outline?.outlineType === 'rectangular') {
      const { left: mLeft, right: mRight, top: mTop, bottom: mBottom } = outlineMargins
      const ow = bounds.maxX - bounds.minX + mLeft + mRight
      const oh = bounds.maxY - bounds.minY + mTop + mBottom
      const ocx = bounds.minX - mLeft + ow / 2
      const ocy = bounds.minY - mBottom + oh / 2
      const fr = outline.filletRadius
      const roundStr = fr > 0 ? `, roundRadius: ${fmt(fr)}` : ''
      const prim =
        fr > 0
          ? `roundedRectangle({ size: [${fmt(ow)}, ${fmt(oh)}]${roundStr} })`
          : `rectangle({ size: [${fmt(ow)}, ${fmt(oh)}] })`
      const expr = ocx !== 0 || ocy !== 0 ? `translate(${fmtVec2(ocx, ocy)}, ${prim})` : prim
      outlineScriptLines = [`const outline = ${expr}`]
    }
    // Tight outline: no parametric form — polygon fallback used by buildJscadScript

    outlineNamedGeom = {
      varName: 'outline',
      geom: outlineGeom,
      scriptLines: outlineScriptLines,
    }
  }

  // Add origin cross marker to the preview model (not included in exports)
  const previewModel: MakerJs.IModel = {
    models: {
      plate: plateModel,
      ...(outlineModel && { outline: outlineModel }),
    },
    units: makerjs.unitType.Millimeter,
  }
  const crossSize = 3
  previewModel.paths = {
    originH: new makerjs.paths.Line([-crossSize, 0], [crossSize, 0]),
    originV: new makerjs.paths.Line([0, -crossSize], [0, crossSize]),
  }
  // Tag origin lines with a layer so we can style them differently
  previewModel.paths.originH!.layer = 'origin'
  previewModel.paths.originV!.layer = 'origin'

  // Tag outline paths with a layer for styling (walk nested models for tight outline)
  if (outlineModel) {
    makerjs.model.walkPaths(outlineModel, (_mp: MakerJs.IModel, _pi: string, p: MakerJs.IPath) => {
      p.layer = 'outline'
    })
  }

  // Generate SVG for preview
  const svgPreviewRaw = makerjs.exporter.toSVG(previewModel, {
    units: makerjs.unitType.Millimeter,
    stroke: 'currentColor',
    strokeWidth: '0.5mm',
    fill: 'none',
    useSvgPathOnly: true,
    svgAttrs: { width: '100%', height: '100%' },
    layerOptions: {
      origin: { stroke: 'red', strokeWidth: '0.3mm' },
      outline: { stroke: '#0066cc', strokeWidth: '0.5mm' },
    },
  })

  // Extend viewBox with padding to prevent edge strokes from being clipped
  const svgPreview = extendSvgViewBox(svgPreviewRaw, 1)

  // Generate SVG for download - uses actual mm units for CAD software
  const svgDownload = makerjs.exporter.toSVG(plateModel, {
    units: makerjs.unitType.Millimeter,
    stroke: '#000',
    strokeWidth: '0.25mm',
    fill: 'none',
    useSvgPathOnly: true,
  })

  // Generate DXF
  const dxfContent = makerjs.exporter.toDXF(plateModel, {
    units: makerjs.unitType.Millimeter,
    usePOLYLINE: true,
  })

  // Generate outline exports if enabled
  let outlineSvgPreview: string | undefined
  let outlineSvgDownload: string | undefined
  let outlineDxfContent: string | undefined
  let mergedSvgDownload: string | undefined
  let mergedDxfContent: string | undefined

  if (outlineModel) {
    const outlineOnlyModel: MakerJs.IModel = {
      models: { outline: outlineModel },
      units: makerjs.unitType.Millimeter,
    }

    // Generate merged exports if merge option is enabled
    if (outline?.mergeWithCutouts) {
      const mergedModel: MakerJs.IModel = {
        models: {
          plate: plateModel,
          outline: outlineModel,
        },
        units: makerjs.unitType.Millimeter,
      }

      mergedSvgDownload = makerjs.exporter.toSVG(mergedModel, {
        units: makerjs.unitType.Millimeter,
        stroke: '#000',
        strokeWidth: '0.25mm',
        fill: 'none',
        useSvgPathOnly: true,
      })

      mergedDxfContent = makerjs.exporter.toDXF(mergedModel, {
        units: makerjs.unitType.Millimeter,
        usePOLYLINE: true,
      })
    } else {
      // Generate separate outline exports
      outlineSvgDownload = makerjs.exporter.toSVG(outlineOnlyModel, {
        units: makerjs.unitType.Millimeter,
        stroke: '#000',
        strokeWidth: '0.25mm',
        fill: 'none',
        useSvgPathOnly: true,
      })

      outlineDxfContent = makerjs.exporter.toDXF(outlineOnlyModel, {
        units: makerjs.unitType.Millimeter,
        usePOLYLINE: true,
      })
    }
  }

  // Generate JSCAD script and STL when outline is enabled
  let jscadScript: string | undefined
  let stlData: string | undefined

  if (outlineNamedGeom) {
    // Build backside 3D cuts from enabled features + unconditional stab clearances
    const backsideCuts: BacksideCut3D[] = [...stabBacksideCuts]
    if (backsideDepth > 0) {
      for (const feature of backsideFeatures) {
        if (!feature.enabled) continue
        if (feature.type === 'cherry-mx-snap-notch') {
          for (let i = 0; i < cutoutPositions.length; i++) {
            const position = cutoutPositions[i]
            if (!position) continue
            // Encoders are not Cherry MX switches — no snap notch.
            if (cutoutKeys[i]?.sm === ENCODER_SWITCH_MOUNT) continue
            const keyCenterX = position.centerX + position.width / 2
            const keyCenterY = position.centerY + position.height / 2
            backsideCuts.push(
              createCherryMxSnapNotchCuts(
                i,
                keyCenterX,
                keyCenterY,
                position.rotationAngle,
                backsideDepth,
                scriptShapeRegistry,
              ),
            )
          }
        }
      }

      // Rotary encoder backside clearance pockets (15×15mm) — handwired screw-in
      // mount only. PCB-mounted encoders use a plain through-cutout with no pocket.
      if (rotaryEncoderHandwired) {
        for (let i = 0; i < cutoutPositions.length; i++) {
          const position = cutoutPositions[i]
          if (!position) continue
          if (cutoutKeys[i]?.sm !== ENCODER_SWITCH_MOUNT) continue
          const keyCenterX = position.centerX + position.width / 2
          const keyCenterY = position.centerY + position.height / 2
          backsideCuts.push(
            createRotaryEncoderBacksideCut(
              i,
              keyCenterX,
              keyCenterY,
              backsideDepth,
              scriptShapeRegistry,
            ),
          )
        }
      }
    }

    jscadScript = buildJscadScript(outlineNamedGeom, namedGeoms, {
      thickness,
      cutoutType,
      stabilizerType,
      registry: scriptShapeRegistry,
      backsideCuts,
    })

    try {
      stlData = buildStl(
        outlineNamedGeom.geom,
        namedGeoms.map((g) => g.geom),
        thickness,
        backsideCuts.map((b) => b.geom),
      )
    } catch (err) {
      console.warn('STL generation failed:', err)
    }
  }

  return {
    svgPreview,
    svgDownload,
    dxfContent,
    outlineSvgPreview,
    outlineSvgDownload,
    outlineDxfContent,
    mergedSvgDownload,
    mergedDxfContent,
    jscadScript,
    stlData,
  }
}
