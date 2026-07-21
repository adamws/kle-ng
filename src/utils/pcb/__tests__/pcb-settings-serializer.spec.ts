import { describe, it, expect } from 'vitest'
import { serializePcbSettings, deserializePcbSettings } from '../pcb-settings-serializer'
import type { PcbSettings } from '@/types/pcb'

const DEFAULTS: PcbSettings = {
  switchFootprint: 'Switch_Keyboard_Cherry_MX:SW_Cherry_MX_PCB_{:.2f}u',
  stabilizerFootprint: 'Mounting_Keyboard_Stabilizer:Stabilizer_Cherry_MX_{:.2f}u',
  diodeFootprint: 'Diode_SMD:D_SOD-123F',
  routing: 'Full',
  switchRotation: 0,
  switchSide: 'FRONT',
  diodeRotation: 90,
  diodeSide: 'BACK',
  diodePositionX: 5.08,
  diodePositionY: 4.0,
  createLedSchFile: false,
  skipLedDecoupling: false,
  ledFootprint: 'LED_SMD:LED_SK6812MINI-E_3.2x2.8mm_P1.5mm_ReverseMount',
  ledCapacitorFootprint: 'Capacitor_SMD:C_0603_1608Metric',
  ledRotation: 0,
  ledSide: 'BACK',
  ledPositionX: 0,
  ledPositionY: 5.25,
  ledCapacitorRotation: 0,
  ledCapacitorSide: 'BACK',
  ledCapacitorPositionX: 5.5,
  ledCapacitorPositionY: 5.75,
}

describe('serializePcbSettings', () => {
  it('groups switch and diode fields and maps positions to offsets', () => {
    const json = serializePcbSettings(DEFAULTS)

    expect(json.switch).toEqual({
      footprint: DEFAULTS.switchFootprint,
      rotation: 0,
      side: 'FRONT',
    })
    expect(json.stabilizerFootprint).toBe(DEFAULTS.stabilizerFootprint)
    expect(json.diode).toEqual({
      footprint: DEFAULTS.diodeFootprint,
      rotation: 90,
      side: 'BACK',
      offsetX: 5.08,
      offsetY: 4.0,
    })
    expect(json.routing).toBe('Full')
  })

  it('omits the led section when the feature is disabled', () => {
    const json = serializePcbSettings({ ...DEFAULTS, createLedSchFile: false })
    expect(json.led).toBeUndefined()
  })

  it('emits the led section (with capacitor) when enabled and decoupling is on', () => {
    const json = serializePcbSettings({
      ...DEFAULTS,
      createLedSchFile: true,
      skipLedDecoupling: false,
    })
    expect(json.led).toBeDefined()
    expect(json.led?.footprint).toBe(DEFAULTS.ledFootprint)
    expect(json.led?.offsetY).toBe(5.25)
    expect(json.led?.capacitor).toEqual({
      footprint: DEFAULTS.ledCapacitorFootprint,
      rotation: 0,
      side: 'BACK',
      offsetX: 5.5,
      offsetY: 5.75,
    })
  })

  it('omits the capacitor when decoupling is skipped', () => {
    const json = serializePcbSettings({
      ...DEFAULTS,
      createLedSchFile: true,
      skipLedDecoupling: true,
    })
    expect(json.led).toBeDefined()
    expect(json.led?.capacitor).toBeUndefined()
  })
})

describe('deserializePcbSettings', () => {
  it('falls back to defaults for missing fields', () => {
    const result = deserializePcbSettings({ routing: 'Disabled' }, DEFAULTS)
    expect(result).toEqual({ ...DEFAULTS, routing: 'Disabled' })
  })

  it('treats presence of led as enabling the feature', () => {
    const result = deserializePcbSettings({ led: { footprint: 'LED:X' } }, DEFAULTS)
    expect(result.createLedSchFile).toBe(true)
    // No capacitor sub-section ⇒ decoupling skipped
    expect(result.skipLedDecoupling).toBe(true)
    expect(result.ledFootprint).toBe('LED:X')
  })

  it('enables decoupling when a capacitor sub-section is present', () => {
    const result = deserializePcbSettings(
      { led: { footprint: 'LED:X', capacitor: { footprint: 'Cap:Y' } } },
      DEFAULTS,
    )
    expect(result.createLedSchFile).toBe(true)
    expect(result.skipLedDecoupling).toBe(false)
    expect(result.ledCapacitorFootprint).toBe('Cap:Y')
  })
})

describe('round-trip', () => {
  it('preserves an all-enabled configuration', () => {
    const original: PcbSettings = {
      ...DEFAULTS,
      switchFootprint: 'Custom:SW',
      switchRotation: 180,
      switchSide: 'BACK',
      routing: 'Switch-Diode only',
      createLedSchFile: true,
      skipLedDecoupling: false,
      ledPositionX: 1.1,
      ledPositionY: 2.2,
      ledCapacitorPositionX: 3.3,
      ledCapacitorPositionY: 4.4,
    }
    const back = deserializePcbSettings(serializePcbSettings(original), DEFAULTS)
    expect(back).toEqual(original)
  })

  it('preserves a minimal (LED-off) configuration', () => {
    const original: PcbSettings = { ...DEFAULTS, createLedSchFile: false }
    const back = deserializePcbSettings(serializePcbSettings(original), DEFAULTS)
    expect(back).toEqual(original)
  })
})
