/**
 * Type definitions for the Plate Generator feature
 */

/**
 * Available cutout types for switch plates.
 */
export type CutoutType =
  | 'cherry-mx-basic'
  | 'cherry-mx-openable'
  | 'alps-skcm'
  | 'alps-skcp'
  | 'kailh-choc-cpg1350'
  | 'kailh-choc-cpg1232'
  | 'custom-rectangle'

/**
 * Available stabilizer cutout types.
 */
export type StabilizerType =
  | 'mx-basic'
  | 'mx-bidirectional'
  | 'mx-tight'
  | 'mx-spec'
  | 'mx-spec-narrow'
  | 'alps-aek'
  | 'alps-at101'
  | 'none'

/**
 * A corner point in a custom outline polygon.
 * Positions are in keyboard units (U), relative to the plate origin.
 */
export interface OutlineSegment {
  id: string
  /** X position in keyboard units (U). +X right. */
  x: number
  /** Y position in keyboard units (U). +Y down (KLE convention). */
  y: number
}

/**
 * Settings for a custom (user-defined polygon) outline
 */
export interface CustomOutlineSettings {
  /** Ordered list of corner points in keyboard units (U). Shape auto-closes. */
  segments: OutlineSegment[]
  /** Snap grid size in keyboard units (U). 0 = no snap. Default 0.25. */
  gridSize: number
}

/**
 * Settings for plate outline generation
 */
export interface OutlineSettings {
  /** Outline mode: none (disabled), rectangle, or custom polygon */
  type: 'none' | 'rectangle' | 'custom'
  /** Top margin in mm (rectangle mode) */
  marginTop: number
  /** Bottom margin in mm (rectangle mode) */
  marginBottom: number
  /** Left margin in mm (rectangle mode) */
  marginLeft: number
  /** Right margin in mm (rectangle mode) */
  marginRight: number
  /** Merge outline with cutouts into a single file on download */
  mergeWithCutouts: boolean
  /** Fillet (corner rounding) radius in mm for outline corners. 0 = sharp corners. (rectangle mode) */
  filletRadius: number
  /** Custom outline definition (custom mode) */
  custom: CustomOutlineSettings
}

/**
 * Settings for mounting holes
 */
export interface MountingHolesSettings {
  /** Whether mounting holes are enabled */
  enabled: boolean
  /** Diameter of mounting holes in mm */
  diameter: number
  /** Distance from corner to hole center in mm */
  edgeDistance: number
}

/**
 * Definition for a single custom hole
 */
export interface CustomHole {
  /** Unique identifier for the hole */
  id: string
  /** Hole diameter in mm */
  diameter: number
  /** X offset from origin in keyboard units (U) */
  offsetX: number
  /** Y offset from origin in keyboard units (U) */
  offsetY: number
}

/**
 * Settings for custom holes
 */
export interface CustomHolesSettings {
  /** Whether custom holes are enabled */
  enabled: boolean
  /** Array of custom hole definitions */
  holes: CustomHole[]
}

/**
 * Settings for plate generation
 */
export interface PlateSettings {
  cutoutType: CutoutType
  /** Stabilizer cutout type. 'none' disables stabilizer cutouts. */
  stabilizerType: StabilizerType
  /** Fillet (corner rounding) radius in mm for switch cutouts. 0 = sharp corners. */
  filletRadius: number
  /** Fillet (corner rounding) radius in mm for stabilizer cutouts. 0 = sharp corners. */
  stabilizerFilletRadius: number
  /** Size adjustment in mm. Positive = shrink cutouts, negative = expand. */
  sizeAdjust: number
  /** Custom cutout width in mm (used when cutoutType is 'custom-rectangle'). */
  customCutoutWidth: number
  /** Custom cutout height in mm (used when cutoutType is 'custom-rectangle'). */
  customCutoutHeight: number
  /** Merge overlapping cutouts into simplified paths. */
  mergeCutouts: boolean
  /** Outline generation settings */
  outline: OutlineSettings
  /** Mounting holes settings */
  mountingHoles: MountingHolesSettings
  /** Custom holes settings */
  customHoles: CustomHolesSettings
}

/**
 * Position and rotation data for a single key cutout
 */
export interface KeyCutoutPosition {
  /** X center position in mm */
  centerX: number
  /** Y center position in mm (already transformed for maker.js coordinate system) */
  centerY: number
  /** Rotation angle in degrees (already negated for maker.js) */
  rotationAngle: number
  /** Cutout width in mm */
  width: number
  /** Cutout height in mm */
  height: number
}

/**
 * Result of plate generation containing all export formats
 */
export interface PlateGenerationResult {
  /** SVG content for preview (uses 100% dimensions to avoid scaling artifacts) */
  svgPreview: string
  /** SVG content for download (uses mm units for CAD software) */
  svgDownload: string
  /** DXF content as a string */
  dxfContent: string
  /** SVG content for outline download (optional, only when outline enabled) */
  outlineSvgDownload?: string
  /** DXF content for outline (optional, only when outline enabled) */
  outlineDxfContent?: string
  /** SVG content for merged cutouts + outline (optional, only when outline enabled and merge enabled) */
  mergedSvgDownload?: string
  /** DXF content for merged cutouts + outline (optional, only when outline enabled and merge enabled) */
  mergedDxfContent?: string
  /**
   * X position of the maker.js coordinate origin (0,0) in the preview SVG coordinate space (mm).
   * maker.js shifts all content so the bounding box starts at SVG (0,0), placing its own
   * origin at SVG (−extents.low[0], extents.high[1]).
   */
  svgOriginX: number
  /** Y position of the maker.js coordinate origin (0,0) in the preview SVG coordinate space (mm). */
  svgOriginY: number
}

/**
 * Generation status for UI state management
 */
export type GenerationStatus = 'idle' | 'loading' | 'generating' | 'success' | 'error'

/**
 * Generation state including status, error message, and result
 */
export interface GenerationState {
  status: GenerationStatus
  error: string | null
  result: PlateGenerationResult | null
}

/**
 * Option for cutout type dropdown
 */
export interface CutoutOption {
  value: CutoutType
  label: string
  description: string
}

/**
 * Option for stabilizer type dropdown
 */
export interface StabilizerOption {
  value: StabilizerType
  label: string
  description: string
}
