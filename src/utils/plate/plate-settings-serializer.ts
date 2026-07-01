import type {
  PlateSettings,
  OutlineSettings,
  MountingHolesSettings,
  CustomHolesSettings,
  CutoutType,
  StabilizerType,
  BacksideFeatureType,
  BacksideFeature,
} from '@/types/plate'

// ---------------------------------------------------------------------------
// JSON format interfaces (all fields optional — deserializer falls back to defaults)
// ---------------------------------------------------------------------------

export interface PlateSettingsJsonCutout {
  switchType?: CutoutType
  stabilizerType?: StabilizerType
  switchFilletRadius?: number
  /** Omitted when stabilizerType === 'none' */
  stabilizerFilletRadius?: number
  kerf?: number
  merge?: boolean
  /** Only present when switchType === 'custom-rectangle' */
  width?: number
  /** Only present when switchType === 'custom-rectangle' */
  height?: number
}

export interface PlateSettingsJsonMountingHoles {
  diameter?: number
  edgeDistance?: number
}

export interface PlateSettingsJsonCustomHole {
  diameter: number
  offsetX: number
  offsetY: number
}

export interface PlateSettingsJsonHoles {
  /** Presence implies mountingHoles.enabled = true */
  mounting?: PlateSettingsJsonMountingHoles
  /** Presence implies customHoles.enabled = true */
  custom?: PlateSettingsJsonCustomHole[]
}

export interface PlateSettingsJsonOutlineNone {
  outlineType: 'none'
}

export interface PlateSettingsJsonOutlineRectangular {
  outlineType: 'rectangular'
  marginTop?: number
  marginBottom?: number
  marginLeft?: number
  marginRight?: number
  filletRadius?: number
  mergeWithCutouts?: boolean
}

export interface PlateSettingsJsonOutlineTight {
  outlineType: 'tight'
  tightMargin?: number
  filletRadius?: number
  mergeWithCutouts?: boolean
}

export type PlateSettingsJsonOutline =
  PlateSettingsJsonOutlineNone | PlateSettingsJsonOutlineRectangular | PlateSettingsJsonOutlineTight

export interface PlateSettingsJsonBacksideFeature {
  type: BacksideFeatureType
}

export interface PlateSettingsJsonThreed {
  /** Enabled backside features (presence of a feature entry implies enabled: true) */
  backsideFeatures?: PlateSettingsJsonBacksideFeature[]
  /** Cut depth in mm from back face for all backside features */
  backsideDepth?: number
}

export interface PlateSettingsJson {
  cutout?: PlateSettingsJsonCutout
  holes?: PlateSettingsJsonHoles
  outline?: PlateSettingsJsonOutline
  thickness?: number
  threed?: PlateSettingsJsonThreed
}

// ---------------------------------------------------------------------------
// Serializer: PlateSettings → PlateSettingsJson (minimal, grouped)
// ---------------------------------------------------------------------------

export function serializePlateSettings(s: PlateSettings): PlateSettingsJson {
  // Cutout section
  const cutout: PlateSettingsJsonCutout = {
    switchType: s.cutoutType,
    stabilizerType: s.stabilizerType,
    switchFilletRadius: s.filletRadius,
    kerf: s.sizeAdjust,
    merge: s.mergeCutouts,
  }
  if (s.stabilizerType !== 'none') {
    cutout.stabilizerFilletRadius = s.stabilizerFilletRadius
  }
  if (s.cutoutType === 'custom-rectangle') {
    cutout.width = s.customCutoutWidth
    cutout.height = s.customCutoutHeight
  }

  // Holes section — omit entirely when nothing active
  let holes: PlateSettingsJsonHoles | undefined
  const hasMounting = s.mountingHoles.enabled
  const hasCustom = s.customHoles.enabled
  if (hasMounting || hasCustom) {
    holes = {}
    if (hasMounting) {
      holes.mounting = {
        diameter: s.mountingHoles.diameter,
        edgeDistance: s.mountingHoles.edgeDistance,
      }
    }
    if (hasCustom) {
      holes.custom = s.customHoles.holes.map((h) => ({
        diameter: h.diameter,
        offsetX: h.offsetX,
        offsetY: h.offsetY,
      }))
    }
  }

  // Outline section — conditional fields by outlineType
  let outline: PlateSettingsJsonOutline
  if (s.outline.outlineType === 'rectangular') {
    outline = {
      outlineType: 'rectangular',
      marginTop: s.outline.marginTop,
      marginBottom: s.outline.marginBottom,
      marginLeft: s.outline.marginLeft,
      marginRight: s.outline.marginRight,
      filletRadius: s.outline.filletRadius,
      mergeWithCutouts: s.outline.mergeWithCutouts,
    }
  } else if (s.outline.outlineType === 'tight') {
    outline = {
      outlineType: 'tight',
      tightMargin: s.outline.tightMargin,
      filletRadius: s.outline.filletRadius,
      mergeWithCutouts: s.outline.mergeWithCutouts,
    }
  } else {
    outline = { outlineType: 'none' }
  }

  // Threed section — always present so backsideDepth is persisted (stab clearances are
  // unconditional and depend on this value regardless of whether a feature is enabled)
  const enabledFeatures = s.backsideFeatures.filter((f) => f.enabled)
  const threed: PlateSettingsJsonThreed = { backsideDepth: s.backsideDepth }
  if (enabledFeatures.length > 0) {
    threed.backsideFeatures = enabledFeatures.map((f) => ({ type: f.type }))
  }

  const result: PlateSettingsJson = { cutout, outline, thickness: s.thickness, threed }
  if (holes !== undefined) result.holes = holes
  return result
}

// ---------------------------------------------------------------------------
// Deserializer: PlateSettingsJson → PlateSettings (falls back to defaults)
// ---------------------------------------------------------------------------

export function deserializePlateSettings(
  json: PlateSettingsJson,
  defaults: PlateSettings,
): PlateSettings {
  const c = json.cutout

  // Outline
  const jsonOutline = json.outline
  let outline: OutlineSettings
  if (jsonOutline?.outlineType === 'rectangular') {
    outline = {
      outlineType: 'rectangular',
      marginTop: jsonOutline.marginTop ?? defaults.outline.marginTop,
      marginBottom: jsonOutline.marginBottom ?? defaults.outline.marginBottom,
      marginLeft: jsonOutline.marginLeft ?? defaults.outline.marginLeft,
      marginRight: jsonOutline.marginRight ?? defaults.outline.marginRight,
      filletRadius: jsonOutline.filletRadius ?? defaults.outline.filletRadius,
      mergeWithCutouts: jsonOutline.mergeWithCutouts ?? defaults.outline.mergeWithCutouts,
      tightMargin: defaults.outline.tightMargin,
    }
  } else if (jsonOutline?.outlineType === 'tight') {
    outline = {
      outlineType: 'tight',
      tightMargin: jsonOutline.tightMargin ?? defaults.outline.tightMargin,
      filletRadius: jsonOutline.filletRadius ?? defaults.outline.filletRadius,
      mergeWithCutouts: jsonOutline.mergeWithCutouts ?? defaults.outline.mergeWithCutouts,
      marginTop: defaults.outline.marginTop,
      marginBottom: defaults.outline.marginBottom,
      marginLeft: defaults.outline.marginLeft,
      marginRight: defaults.outline.marginRight,
    }
  } else {
    outline = { ...defaults.outline }
  }

  // Mounting holes — presence of holes.mounting implies enabled
  const mountingHoles: MountingHolesSettings = {
    enabled: json.holes?.mounting !== undefined,
    diameter: json.holes?.mounting?.diameter ?? defaults.mountingHoles.diameter,
    edgeDistance: json.holes?.mounting?.edgeDistance ?? defaults.mountingHoles.edgeDistance,
  }

  // Custom holes — presence of holes.custom implies enabled
  const rawCustom = json.holes?.custom
  const customHoles: CustomHolesSettings = {
    enabled: rawCustom !== undefined,
    holes: (rawCustom ?? []).map((h, i) => ({
      id: `hole_${i}`,
      diameter: h.diameter,
      offsetX: h.offsetX,
      offsetY: h.offsetY,
    })),
  }

  // Backside features — merge JSON enabled features over the defaults list
  const defaultFeatureMap = new Map<BacksideFeatureType, BacksideFeature>(
    defaults.backsideFeatures.map((f) => [f.type, f]),
  )
  const jsonFeatureMap = new Map<BacksideFeatureType, PlateSettingsJsonBacksideFeature>(
    (json.threed?.backsideFeatures ?? []).map((f) => [f.type, f]),
  )
  const backsideFeatures: BacksideFeature[] = defaults.backsideFeatures.map((def) => {
    const fromJson = jsonFeatureMap.get(def.type)
    if (fromJson) {
      return { type: def.type, enabled: true }
    }
    return { ...def }
  })
  // Include any JSON features not present in defaults (forward compat)
  for (const [type] of jsonFeatureMap) {
    if (!defaultFeatureMap.has(type)) {
      backsideFeatures.push({ type, enabled: true })
    }
  }
  // Migration: old format stored depth per-feature; new format uses shared backsideDepth.
  // If the new field is absent, use the first feature's depth as fallback.
  const legacyFeatureDepth = (
    json.threed?.backsideFeatures?.[0] as Record<string, unknown> | undefined
  )?.depth as number | undefined
  const backsideDepth = json.threed?.backsideDepth ?? legacyFeatureDepth ?? defaults.backsideDepth

  return {
    cutoutType: c?.switchType ?? defaults.cutoutType,
    stabilizerType: c?.stabilizerType ?? defaults.stabilizerType,
    filletRadius: c?.switchFilletRadius ?? defaults.filletRadius,
    stabilizerFilletRadius: c?.stabilizerFilletRadius ?? defaults.stabilizerFilletRadius,
    sizeAdjust: c?.kerf ?? defaults.sizeAdjust,
    mergeCutouts: c?.merge ?? defaults.mergeCutouts,
    customCutoutWidth: c?.width ?? defaults.customCutoutWidth,
    customCutoutHeight: c?.height ?? defaults.customCutoutHeight,
    thickness: json.thickness ?? defaults.thickness,
    outline,
    mountingHoles,
    customHoles,
    backsideFeatures,
    backsideDepth,
  }
}
