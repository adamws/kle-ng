/**
 * Switch-diode track preset: validation of kbplacer's JSON preset format and
 * conversion to and from the editor's mm types.
 *
 * kbplacer (the PCB generator backend) is the authority on the format, the
 * rules here mirror kicad-kbplacer's docs/switch-preset.schema.json to give
 * feedback before a generator run.
 */
import type {
  CopperLayer,
  Pt,
  TrackItem,
  TrackPreset,
  WireTrackItem,
  WireTrackPreset,
  WireVector,
} from '@/types/tracks'

export const TRACK_PRESET_VERSION = 1
/** Backend service limit on the number of preset items. */
export const MAX_TRACK_PRESET_ITEMS = 500

const COPPER_LAYERS: readonly CopperLayer[] = ['F.Cu', 'B.Cu']
const NM_LIMIT = 2147483647 // kbplacer stores nm in 32-bit KiCad coordinates

export type TrackPresetValidation =
  { valid: true; preset: WireTrackPreset } | { valid: false; error: string }

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

class PresetError extends Error {}

function fail(path: string, message: string): never {
  throw new PresetError(`'${path}' ${message}`)
}

function checkKeys(obj: Record<string, unknown>, path: string, keys: readonly string[]) {
  for (const key of keys) {
    if (!(key in obj)) fail(path, `is missing '${key}'`)
  }
  for (const key of Object.keys(obj)) {
    if (!keys.includes(key)) fail(`${path}.${key}`, 'is not a known field')
  }
}

function nm(value: unknown, path: string, positive = false): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    fail(path, `must be an integer number of nanometres, got ${JSON.stringify(value)}`)
  }
  if (Math.abs(value) > NM_LIMIT) fail(path, 'is out of range')
  if (positive && value <= 0) fail(path, 'must be positive')
  return value
}

function vector(value: unknown, path: string): WireVector {
  if (!isPlainObject(value)) fail(path, 'must be an object with x_nm and y_nm')
  checkKeys(value, path, ['x_nm', 'y_nm'])
  return { x_nm: nm(value.x_nm, `${path}.x_nm`), y_nm: nm(value.y_nm, `${path}.y_nm`) }
}

function layer(value: unknown, path: string): CopperLayer {
  if (!COPPER_LAYERS.includes(value as CopperLayer)) {
    fail(path, `must be F.Cu or B.Cu, got ${JSON.stringify(value)}`)
  }
  return value as CopperLayer
}

function item(value: unknown, path: string): WireTrackItem {
  if (!isPlainObject(value)) fail(path, 'must be an object')
  switch (value.type) {
    case 'track': {
      checkKeys(value, path, ['type', 'start', 'end', 'width_nm', 'layer'])
      const start = vector(value.start, `${path}.start`)
      const end = vector(value.end, `${path}.end`)
      if (start.x_nm === end.x_nm && start.y_nm === end.y_nm) {
        fail(path, 'start and end must differ')
      }
      return {
        type: 'track',
        start,
        end,
        width_nm: nm(value.width_nm, `${path}.width_nm`, true),
        layer: layer(value.layer, `${path}.layer`),
      }
    }
    case 'via': {
      checkKeys(value, path, ['type', 'position', 'diameter_nm', 'drill_diameter_nm'])
      const diameter = nm(value.diameter_nm, `${path}.diameter_nm`, true)
      const drill = nm(value.drill_diameter_nm, `${path}.drill_diameter_nm`, true)
      if (drill >= diameter) fail(path, 'drill_diameter_nm must be smaller than diameter_nm')
      return {
        type: 'via',
        position: vector(value.position, `${path}.position`),
        diameter_nm: diameter,
        drill_diameter_nm: drill,
      }
    }
    case 'arc':
      return fail(path, 'is an arc, arcs are not supported yet')
    default:
      return fail(`${path}.type`, `must be "track" or "via", got ${JSON.stringify(value.type)}`)
  }
}

/**
 * Validates a preset in kbplacer's JSON format (the settings `tracks` group).
 * `allowEmpty`: an empty `items` is valid. The settings keep an empty preset
 * while a preset routing mode has nothing drawn yet; kbplacer needs items.
 */
export function validateWireTrackPreset(
  value: unknown,
  path = 'tracks',
  { allowEmpty = false } = {},
): TrackPresetValidation {
  try {
    if (!isPlainObject(value)) fail(path, 'must be an object')
    if (value.version !== TRACK_PRESET_VERSION) {
      fail(
        `${path}.version`,
        `must be ${TRACK_PRESET_VERSION}, got ${JSON.stringify(value.version)}`,
      )
    }
    if ('diodes' in value) {
      fail(`${path}.diodes`, 'must not be set, diode placement comes from the diode settings')
    }
    for (const key of Object.keys(value)) {
      if (!['version', 'items', 'basis'].includes(key))
        fail(`${path}.${key}`, 'is not a known field')
    }
    if ('basis' in value && !isPlainObject(value.basis)) fail(`${path}.basis`, 'must be an object')
    if (!Array.isArray(value.items) || (!allowEmpty && value.items.length === 0)) {
      fail(`${path}.items`, allowEmpty ? 'must be an array' : 'must be a non-empty array')
    }
    if (value.items.length > MAX_TRACK_PRESET_ITEMS) {
      fail(`${path}.items`, `has more than ${MAX_TRACK_PRESET_ITEMS} items`)
    }
    const preset: WireTrackPreset = {
      version: TRACK_PRESET_VERSION,
      items: value.items.map((v, i) => item(v, `${path}.items[${i}]`)),
    }
    if (isPlainObject(value.basis)) preset.basis = value.basis
    return { valid: true, preset }
  } catch (err) {
    if (err instanceof PresetError) return { valid: false, error: err.message }
    throw err
  }
}

const toMm = (v: WireVector): Pt => ({ x: v.x_nm / 1e6, y: v.y_nm / 1e6 })
const toNm = (mm: number): number => Math.round(mm * 1e6)
const toWireVector = (p: Pt): WireVector => ({ x_nm: toNm(p.x), y_nm: toNm(p.y) })

/** Converts a validated wire preset to the editor's mm types. */
export function trackPresetFromWire(wire: WireTrackPreset): TrackPreset {
  const preset: TrackPreset = {
    version: TRACK_PRESET_VERSION,
    items: wire.items.map((item): TrackItem => {
      if (item.type === 'track') {
        return {
          type: 'track',
          start: toMm(item.start),
          end: toMm(item.end),
          width: item.width_nm / 1e6,
          layer: item.layer,
        }
      }
      return {
        type: 'via',
        position: toMm(item.position),
        diameter: item.diameter_nm / 1e6,
        drillDiameter: item.drill_diameter_nm / 1e6,
      }
    }),
  }
  if (wire.basis) preset.basis = wire.basis
  return preset
}

/**
 * Converts an editor preset to kbplacer's JSON format. Editor ids are dropped.
 * Shared vertices come from equal mm values, so they stay bit-identical in nm
 * (kbplacer matches track ends exactly).
 */
export function trackPresetToWire(preset: TrackPreset): WireTrackPreset {
  const wire: WireTrackPreset = {
    version: TRACK_PRESET_VERSION,
    items: preset.items.map((item): WireTrackItem => {
      switch (item.type) {
        case 'track':
          return {
            type: 'track',
            start: toWireVector(item.start),
            end: toWireVector(item.end),
            width_nm: toNm(item.width),
            layer: item.layer,
          }
        case 'via':
          return {
            type: 'via',
            position: toWireVector(item.position),
            diameter_nm: toNm(item.diameter),
            drill_diameter_nm: toNm(item.drillDiameter),
          }
        case 'arc':
          throw new Error('Arc tracks are not supported yet')
      }
    }),
  }
  if (preset.basis) wire.basis = preset.basis
  return wire
}
