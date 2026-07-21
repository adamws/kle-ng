import type { PcbSettingsJson } from './pcb-settings-serializer'

export type ValidationResult =
  { valid: true; json: PcbSettingsJson; warnings: string[] } | { valid: false; error: string }

const SIDE_VALUES = ['FRONT', 'BACK'] as const
const ROUTING_VALUES = ['Disabled', 'Switch-Diode only', 'Full'] as const

const KNOWN_TOP_LEVEL_KEYS = new Set(['switch', 'stabilizerFootprint', 'diode', 'routing', 'led'])
const KNOWN_SWITCH_KEYS = new Set(['footprint', 'rotation', 'side'])
const KNOWN_DIODE_KEYS = new Set(['footprint', 'rotation', 'side', 'offsetX', 'offsetY'])
const KNOWN_LED_KEYS = new Set(['footprint', 'rotation', 'side', 'offsetX', 'offsetY', 'capacitor'])
const KNOWN_CAPACITOR_KEYS = new Set(['footprint', 'rotation', 'side', 'offsetX', 'offsetY'])

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && isFinite(v)
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

/**
 * Validates the fields common to the switch/diode/led/capacitor placement objects
 * (footprint string, numeric rotation/offsets, FRONT/BACK side). Returns an error
 * string on failure, or null on success while pushing unknown-field warnings.
 */
function validatePlacement(
  obj: Record<string, unknown>,
  path: string,
  knownKeys: Set<string>,
  warnings: string[],
): string | null {
  if ('footprint' in obj && typeof obj.footprint !== 'string') {
    return `'${path}.footprint' must be a string`
  }
  for (const key of ['rotation', 'offsetX', 'offsetY'] as const) {
    if (key in obj && !isFiniteNumber(obj[key])) {
      return `'${path}.${key}' must be a finite number`
    }
  }
  if ('side' in obj && !SIDE_VALUES.includes(obj.side as (typeof SIDE_VALUES)[number])) {
    return `Invalid value for '${path}.side': ${JSON.stringify(obj.side)}`
  }
  for (const key of Object.keys(obj)) {
    if (!knownKeys.has(key)) warnings.push(`Unknown field: ${path}.${key}`)
  }
  return null
}

export function validatePcbSettingsJson(text: string): ValidationResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (err) {
    return { valid: false, error: (err as SyntaxError).message }
  }

  if (!isPlainObject(parsed)) {
    return { valid: false, error: 'Root value must be a JSON object' }
  }

  const obj = parsed

  // Fast-reject old flat format (has top-level 'switchFootprint' key)
  if ('switchFootprint' in obj) {
    return {
      valid: false,
      error: 'Unsupported format: this appears to be an older settings format',
    }
  }

  const warnings: string[] = []

  // switch sub-object
  if ('switch' in obj) {
    if (!isPlainObject(obj.switch)) {
      return { valid: false, error: "'switch' must be an object" }
    }
    const err = validatePlacement(obj.switch, 'switch', KNOWN_SWITCH_KEYS, warnings)
    if (err) return { valid: false, error: err }
  }

  // stabilizerFootprint
  if ('stabilizerFootprint' in obj && typeof obj.stabilizerFootprint !== 'string') {
    return { valid: false, error: `'stabilizerFootprint' must be a string` }
  }

  // diode sub-object
  if ('diode' in obj) {
    if (!isPlainObject(obj.diode)) {
      return { valid: false, error: "'diode' must be an object" }
    }
    const err = validatePlacement(obj.diode, 'diode', KNOWN_DIODE_KEYS, warnings)
    if (err) return { valid: false, error: err }
  }

  // routing
  if (
    'routing' in obj &&
    !ROUTING_VALUES.includes(obj.routing as (typeof ROUTING_VALUES)[number])
  ) {
    return { valid: false, error: `Invalid value for 'routing': ${JSON.stringify(obj.routing)}` }
  }

  // led sub-object (presence implies createLedSchFile = true)
  if ('led' in obj) {
    if (!isPlainObject(obj.led)) {
      return { valid: false, error: "'led' must be an object" }
    }
    const led = obj.led
    const err = validatePlacement(led, 'led', KNOWN_LED_KEYS, warnings)
    if (err) return { valid: false, error: err }

    // led.capacitor sub-object (presence implies skipLedDecoupling = false)
    if ('capacitor' in led) {
      if (!isPlainObject(led.capacitor)) {
        return { valid: false, error: "'led.capacitor' must be an object" }
      }
      const capErr = validatePlacement(
        led.capacitor,
        'led.capacitor',
        KNOWN_CAPACITOR_KEYS,
        warnings,
      )
      if (capErr) return { valid: false, error: capErr }
    }
  }

  // Unknown top-level keys
  for (const key of Object.keys(obj)) {
    if (!KNOWN_TOP_LEVEL_KEYS.has(key)) warnings.push(`Unknown field: ${key}`)
  }

  return { valid: true, json: parsed as PcbSettingsJson, warnings }
}
