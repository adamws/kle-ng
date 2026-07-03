import {
  CUTOUT_TYPE_VALUES,
  STABILIZER_TYPE_VALUES,
  BACKSIDE_FEATURE_TYPE_VALUES,
} from '@/types/plate'
import type { CutoutType, StabilizerType, BacksideFeatureType } from '@/types/plate'
import type { PlateSettingsJson } from './plate-settings-serializer'

export type ValidationResult =
  { valid: true; json: PlateSettingsJson; warnings: string[] } | { valid: false; error: string }

const OUTLINE_TYPES = ['none', 'rectangular', 'tight'] as const

// cutout sub-object known keys
const KNOWN_CUTOUT_KEYS_BASE = new Set([
  'switchType',
  'switchFilletRadius',
  'stabilizerType',
  'stabilizerFilletRadius',
  'kerf',
  'merge',
  'rotaryEncoderHandwired',
])
const KNOWN_CUTOUT_CUSTOM_KEYS = new Set(['width', 'height'])

const KNOWN_OUTLINE_KEYS_NONE = new Set(['outlineType'])
const KNOWN_OUTLINE_KEYS_RECTANGULAR = new Set([
  'outlineType',
  'marginTop',
  'marginBottom',
  'marginLeft',
  'marginRight',
  'filletRadius',
  'mergeWithCutouts',
])
const KNOWN_OUTLINE_KEYS_TIGHT = new Set([
  'outlineType',
  'tightMargin',
  'filletRadius',
  'mergeWithCutouts',
])

const KNOWN_HOLES_KEYS = new Set(['mounting', 'custom'])
const KNOWN_MOUNTING_KEYS = new Set(['diameter', 'edgeDistance'])
const KNOWN_HOLE_KEYS = new Set(['diameter', 'offsetX', 'offsetY'])

const KNOWN_THREED_KEYS = new Set(['backsideFeatures', 'backsideDepth'])
const KNOWN_BACKSIDE_FEATURE_KEYS = new Set(['type'])

const KNOWN_TOP_LEVEL_KEYS = new Set(['cutout', 'thickness', 'outline', 'holes', 'threed'])

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && isFinite(v)
}

export function validatePlateSettingsJson(text: string): ValidationResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (err) {
    return { valid: false, error: (err as SyntaxError).message }
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { valid: false, error: 'Root value must be a JSON object' }
  }

  const obj = parsed as Record<string, unknown>

  // Fast-reject old format (has top-level 'cutoutType' key)
  if ('cutoutType' in obj) {
    return {
      valid: false,
      error: 'Unsupported format: this appears to be an older settings format',
    }
  }
  const warnings: string[] = []

  // Validate cutout sub-object
  if ('cutout' in obj) {
    if (obj.cutout === null || typeof obj.cutout !== 'object' || Array.isArray(obj.cutout)) {
      return { valid: false, error: "'cutout' must be an object" }
    }
    const cutout = obj.cutout as Record<string, unknown>

    if ('switchType' in cutout && !CUTOUT_TYPE_VALUES.includes(cutout.switchType as CutoutType)) {
      return {
        valid: false,
        error: `Invalid value for 'cutout.switchType': ${JSON.stringify(cutout.switchType)}`,
      }
    }
    if (
      'stabilizerType' in cutout &&
      !STABILIZER_TYPE_VALUES.includes(cutout.stabilizerType as StabilizerType)
    ) {
      return {
        valid: false,
        error: `Invalid value for 'cutout.stabilizerType': ${JSON.stringify(cutout.stabilizerType)}`,
      }
    }

    for (const key of ['switchFilletRadius', 'kerf'] as const) {
      if (key in cutout && !isFiniteNumber(cutout[key])) {
        return { valid: false, error: `'cutout.${key}' must be a finite number` }
      }
    }

    if ('stabilizerFilletRadius' in cutout && !isFiniteNumber(cutout.stabilizerFilletRadius)) {
      return { valid: false, error: `'cutout.stabilizerFilletRadius' must be a finite number` }
    }

    if ('merge' in cutout && typeof cutout.merge !== 'boolean') {
      return { valid: false, error: `'cutout.merge' must be a boolean` }
    }

    if ('rotaryEncoderHandwired' in cutout && typeof cutout.rotaryEncoderHandwired !== 'boolean') {
      return { valid: false, error: `'cutout.rotaryEncoderHandwired' must be a boolean` }
    }

    // Validate width/height as numbers whenever present (regardless of switchType)
    for (const key of ['width', 'height'] as const) {
      if (key in cutout && !isFiniteNumber(cutout[key])) {
        return { valid: false, error: `'cutout.${key}' must be a finite number` }
      }
    }

    const switchType = cutout.switchType as string | undefined
    if (switchType === 'custom-rectangle') {
      for (const key of Object.keys(cutout)) {
        if (!KNOWN_CUTOUT_KEYS_BASE.has(key) && !KNOWN_CUTOUT_CUSTOM_KEYS.has(key))
          warnings.push(`Unknown field: cutout.${key}`)
      }
    } else {
      for (const key of Object.keys(cutout)) {
        if (!KNOWN_CUTOUT_KEYS_BASE.has(key)) warnings.push(`Unknown field: cutout.${key}`)
      }
    }
  }

  // Validate thickness
  if ('thickness' in obj && !isFiniteNumber(obj.thickness)) {
    return { valid: false, error: `'thickness' must be a finite number` }
  }

  // Validate outline sub-object
  if ('outline' in obj) {
    if (obj.outline === null || typeof obj.outline !== 'object' || Array.isArray(obj.outline)) {
      return { valid: false, error: "'outline' must be an object" }
    }
    const outline = obj.outline as Record<string, unknown>

    if (!('outlineType' in outline)) {
      return { valid: false, error: "Missing required field 'outline.outlineType'" }
    }
    const outlineType = outline.outlineType

    if (!OUTLINE_TYPES.includes(outlineType as (typeof OUTLINE_TYPES)[number])) {
      return {
        valid: false,
        error: `Invalid value for 'outline.outlineType': ${JSON.stringify(outlineType)}`,
      }
    }

    if (outlineType === 'rectangular') {
      for (const key of [
        'marginTop',
        'marginBottom',
        'marginLeft',
        'marginRight',
        'filletRadius',
      ] as const) {
        if (key in outline && !isFiniteNumber(outline[key])) {
          return { valid: false, error: `'outline.${key}' must be a finite number` }
        }
      }
      if ('mergeWithCutouts' in outline && typeof outline.mergeWithCutouts !== 'boolean') {
        return { valid: false, error: `'outline.mergeWithCutouts' must be a boolean` }
      }
      for (const key of Object.keys(outline)) {
        if (!KNOWN_OUTLINE_KEYS_RECTANGULAR.has(key)) warnings.push(`Unknown field: outline.${key}`)
      }
    } else if (outlineType === 'tight') {
      if ('tightMargin' in outline && !isFiniteNumber(outline.tightMargin)) {
        return { valid: false, error: `'outline.tightMargin' must be a finite number` }
      }
      if ('filletRadius' in outline && !isFiniteNumber(outline.filletRadius)) {
        return { valid: false, error: `'outline.filletRadius' must be a finite number` }
      }
      if ('mergeWithCutouts' in outline && typeof outline.mergeWithCutouts !== 'boolean') {
        return { valid: false, error: `'outline.mergeWithCutouts' must be a boolean` }
      }
      for (const key of Object.keys(outline)) {
        if (!KNOWN_OUTLINE_KEYS_TIGHT.has(key)) warnings.push(`Unknown field: outline.${key}`)
      }
    } else {
      for (const key of Object.keys(outline)) {
        if (!KNOWN_OUTLINE_KEYS_NONE.has(key)) warnings.push(`Unknown field: outline.${key}`)
      }
    }
  }

  // Validate holes sub-object (groups mounting and custom holes)
  if ('holes' in obj) {
    if (obj.holes === null || typeof obj.holes !== 'object' || Array.isArray(obj.holes)) {
      return { valid: false, error: "'holes' must be an object" }
    }
    const holes = obj.holes as Record<string, unknown>

    // Validate holes.mounting (optional — presence implies enabled)
    if ('mounting' in holes) {
      if (
        holes.mounting === null ||
        typeof holes.mounting !== 'object' ||
        Array.isArray(holes.mounting)
      ) {
        return { valid: false, error: "'holes.mounting' must be an object" }
      }
      const mh = holes.mounting as Record<string, unknown>
      for (const key of ['diameter', 'edgeDistance'] as const) {
        if (key in mh && !isFiniteNumber(mh[key])) {
          return { valid: false, error: `'holes.mounting.${key}' must be a finite number` }
        }
      }
      for (const key of Object.keys(mh)) {
        if (!KNOWN_MOUNTING_KEYS.has(key)) warnings.push(`Unknown field: holes.mounting.${key}`)
      }
    }

    // Validate holes.custom (optional — presence implies enabled)
    if ('custom' in holes) {
      if (!Array.isArray(holes.custom)) {
        return { valid: false, error: "'holes.custom' must be an array" }
      }
      for (let i = 0; i < holes.custom.length; i++) {
        const hole = holes.custom[i]
        if (hole === null || typeof hole !== 'object' || Array.isArray(hole)) {
          return { valid: false, error: `'holes.custom[${i}]' must be an object` }
        }
        const h = hole as Record<string, unknown>
        for (const key of ['diameter', 'offsetX', 'offsetY'] as const) {
          if (!isFiniteNumber(h[key])) {
            return {
              valid: false,
              error: `'holes.custom[${i}].${key}' must be a finite number`,
            }
          }
        }
        for (const key of Object.keys(h)) {
          if (!KNOWN_HOLE_KEYS.has(key)) warnings.push(`Unknown field: holes.custom[${i}].${key}`)
        }
      }
    }

    for (const key of Object.keys(holes)) {
      if (!KNOWN_HOLES_KEYS.has(key)) warnings.push(`Unknown field: holes.${key}`)
    }
  }

  // Validate threed sub-object
  if ('threed' in obj) {
    if (obj.threed === null || typeof obj.threed !== 'object' || Array.isArray(obj.threed)) {
      return { valid: false, error: "'threed' must be an object" }
    }
    const threed = obj.threed as Record<string, unknown>

    if ('backsideFeatures' in threed) {
      if (!Array.isArray(threed.backsideFeatures)) {
        return { valid: false, error: "'threed.backsideFeatures' must be an array" }
      }
      for (let i = 0; i < threed.backsideFeatures.length; i++) {
        const feat = threed.backsideFeatures[i]
        if (feat === null || typeof feat !== 'object' || Array.isArray(feat)) {
          return { valid: false, error: `'threed.backsideFeatures[${i}]' must be an object` }
        }
        const f = feat as Record<string, unknown>
        if (!('type' in f)) {
          return { valid: false, error: `'threed.backsideFeatures[${i}].type' is required` }
        }
        if (!BACKSIDE_FEATURE_TYPE_VALUES.includes(f.type as BacksideFeatureType)) {
          return {
            valid: false,
            error: `Invalid value for 'threed.backsideFeatures[${i}].type': ${JSON.stringify(f.type)}`,
          }
        }
        for (const key of Object.keys(f)) {
          if (!KNOWN_BACKSIDE_FEATURE_KEYS.has(key))
            warnings.push(`Unknown field: threed.backsideFeatures[${i}].${key}`)
        }
      }
    }

    if ('backsideDepth' in threed && !isFiniteNumber(threed.backsideDepth)) {
      return { valid: false, error: "'threed.backsideDepth' must be a finite number" }
    }

    for (const key of Object.keys(threed)) {
      if (!KNOWN_THREED_KEYS.has(key)) warnings.push(`Unknown field: threed.${key}`)
    }
  }

  // Unknown top-level keys
  for (const key of Object.keys(obj)) {
    if (!KNOWN_TOP_LEVEL_KEYS.has(key)) warnings.push(`Unknown field: ${key}`)
  }

  return { valid: true, json: parsed as PlateSettingsJson, warnings }
}
