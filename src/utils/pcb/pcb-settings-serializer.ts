import type { PcbSettings } from '@/types/pcb'

// ---------------------------------------------------------------------------
// JSON format interfaces (all fields optional — deserializer falls back to defaults)
// ---------------------------------------------------------------------------

export interface PcbSettingsJsonSwitch {
  footprint?: string
  rotation?: number
  side?: 'FRONT' | 'BACK'
}

export interface PcbSettingsJsonDiode {
  footprint?: string
  rotation?: number
  side?: 'FRONT' | 'BACK'
  offsetX?: number
  offsetY?: number
}

export interface PcbSettingsJsonCapacitor {
  footprint?: string
  rotation?: number
  side?: 'FRONT' | 'BACK'
  offsetX?: number
  offsetY?: number
}

export interface PcbSettingsJsonLed {
  footprint?: string
  rotation?: number
  side?: 'FRONT' | 'BACK'
  offsetX?: number
  offsetY?: number
  /** Presence implies skipLedDecoupling = false (decoupling capacitors enabled) */
  capacitor?: PcbSettingsJsonCapacitor
}

export interface PcbSettingsJson {
  switch?: PcbSettingsJsonSwitch
  stabilizerFootprint?: string
  diode?: PcbSettingsJsonDiode
  routing?: string
  /** Presence implies createLedSchFile = true (per-key LED chain enabled) */
  led?: PcbSettingsJsonLed
}

// ---------------------------------------------------------------------------
// Serializer: PcbSettings → PcbSettingsJson (minimal, grouped)
// ---------------------------------------------------------------------------

export function serializePcbSettings(s: PcbSettings): PcbSettingsJson {
  const result: PcbSettingsJson = {
    switch: {
      footprint: s.switchFootprint,
      rotation: s.switchRotation,
      side: s.switchSide,
    },
    stabilizerFootprint: s.stabilizerFootprint,
    diode: {
      footprint: s.diodeFootprint,
      rotation: s.diodeRotation,
      side: s.diodeSide,
      offsetX: s.diodePositionX,
      offsetY: s.diodePositionY,
    },
    routing: s.routing,
  }

  // LED section — omitted entirely when the feature is disabled
  if (s.createLedSchFile) {
    const led: PcbSettingsJsonLed = {
      footprint: s.ledFootprint,
      rotation: s.ledRotation,
      side: s.ledSide,
      offsetX: s.ledPositionX,
      offsetY: s.ledPositionY,
    }
    // Capacitor sub-section — omitted when decoupling is skipped
    if (!s.skipLedDecoupling) {
      led.capacitor = {
        footprint: s.ledCapacitorFootprint,
        rotation: s.ledCapacitorRotation,
        side: s.ledCapacitorSide,
        offsetX: s.ledCapacitorPositionX,
        offsetY: s.ledCapacitorPositionY,
      }
    }
    result.led = led
  }

  return result
}

// ---------------------------------------------------------------------------
// Deserializer: PcbSettingsJson → PcbSettings (falls back to defaults)
// ---------------------------------------------------------------------------

export function deserializePcbSettings(json: PcbSettingsJson, defaults: PcbSettings): PcbSettings {
  const sw = json.switch
  const diode = json.diode
  const led = json.led
  const cap = led?.capacitor

  return {
    switchFootprint: sw?.footprint ?? defaults.switchFootprint,
    stabilizerFootprint: json.stabilizerFootprint ?? defaults.stabilizerFootprint,
    diodeFootprint: diode?.footprint ?? defaults.diodeFootprint,
    routing: json.routing ?? defaults.routing,
    // Switch
    switchRotation: sw?.rotation ?? defaults.switchRotation,
    switchSide: sw?.side ?? defaults.switchSide,
    // Diode
    diodeRotation: diode?.rotation ?? defaults.diodeRotation,
    diodeSide: diode?.side ?? defaults.diodeSide,
    diodePositionX: diode?.offsetX ?? defaults.diodePositionX,
    diodePositionY: diode?.offsetY ?? defaults.diodePositionY,
    // LED chain — presence of the led section implies the feature is enabled;
    // presence of the nested capacitor implies decoupling is NOT skipped.
    createLedSchFile: led !== undefined,
    skipLedDecoupling: led !== undefined ? cap === undefined : defaults.skipLedDecoupling,
    ledFootprint: led?.footprint ?? defaults.ledFootprint,
    ledRotation: led?.rotation ?? defaults.ledRotation,
    ledSide: led?.side ?? defaults.ledSide,
    ledPositionX: led?.offsetX ?? defaults.ledPositionX,
    ledPositionY: led?.offsetY ?? defaults.ledPositionY,
    ledCapacitorFootprint: cap?.footprint ?? defaults.ledCapacitorFootprint,
    ledCapacitorRotation: cap?.rotation ?? defaults.ledCapacitorRotation,
    ledCapacitorSide: cap?.side ?? defaults.ledCapacitorSide,
    ledCapacitorPositionX: cap?.offsetX ?? defaults.ledCapacitorPositionX,
    ledCapacitorPositionY: cap?.offsetY ?? defaults.ledCapacitorPositionY,
  }
}
