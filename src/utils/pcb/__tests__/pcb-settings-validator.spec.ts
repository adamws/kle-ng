import { describe, it, expect } from 'vitest'
import { validatePcbSettingsJson } from '../pcb-settings-validator'

function expectValid(text: string) {
  const result = validatePcbSettingsJson(text)
  if (!result.valid) throw new Error(`expected valid, got error: ${result.error}`)
  return result
}

function expectInvalid(text: string) {
  const result = validatePcbSettingsJson(text)
  if (result.valid) throw new Error('expected invalid, got valid')
  return result
}

describe('validatePcbSettingsJson', () => {
  it('accepts a well-formed grouped document', () => {
    const result = expectValid(
      JSON.stringify({
        switch: { footprint: 'SW', rotation: 0, side: 'FRONT' },
        stabilizerFootprint: 'STAB',
        diode: { footprint: 'D', rotation: 90, side: 'BACK', offsetX: 5, offsetY: 4 },
        routing: 'Full',
        led: {
          footprint: 'LED',
          side: 'BACK',
          offsetX: 0,
          offsetY: 5.25,
          capacitor: { footprint: 'C', side: 'BACK', offsetX: 5.5, offsetY: 5.75 },
        },
      }),
    )
    expect(result.warnings).toEqual([])
  })

  it('rejects invalid JSON syntax', () => {
    expect(expectInvalid('{ not json').error).toBeTruthy()
  })

  it('rejects a non-object root', () => {
    expect(expectInvalid('[]').error).toMatch(/Root value/)
    expect(expectInvalid('42').error).toMatch(/Root value/)
  })

  it('rejects the old flat format (top-level switchFootprint)', () => {
    const result = expectInvalid(JSON.stringify({ switchFootprint: 'SW', routing: 'Full' }))
    expect(result.error).toMatch(/older settings format/)
  })

  it('rejects a non-string footprint', () => {
    expect(expectInvalid(JSON.stringify({ switch: { footprint: 5 } })).error).toMatch(
      /switch\.footprint/,
    )
    expect(expectInvalid(JSON.stringify({ stabilizerFootprint: 5 })).error).toMatch(
      /stabilizerFootprint/,
    )
  })

  it('rejects a non-finite numeric field', () => {
    expect(expectInvalid(JSON.stringify({ diode: { offsetX: 'x' } })).error).toMatch(
      /diode\.offsetX/,
    )
  })

  it('rejects an invalid side value', () => {
    expect(expectInvalid(JSON.stringify({ switch: { side: 'TOP' } })).error).toMatch(/switch\.side/)
  })

  it('rejects an invalid routing value', () => {
    expect(expectInvalid(JSON.stringify({ routing: 'Bogus' })).error).toMatch(/routing/)
  })

  it('rejects a non-object sub-section', () => {
    expect(expectInvalid(JSON.stringify({ switch: 'x' })).error).toMatch(
      /'switch' must be an object/,
    )
    expect(expectInvalid(JSON.stringify({ led: { capacitor: 5 } })).error).toMatch(
      /'led\.capacitor' must be an object/,
    )
  })

  it('warns on unknown fields at every level', () => {
    const result = expectValid(
      JSON.stringify({
        switch: { footprint: 'SW', bogusSwitch: 1 },
        led: { footprint: 'LED', capacitor: { footprint: 'C', bogusCap: 2 } },
        topLevelBogus: true,
      }),
    )
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        'Unknown field: switch.bogusSwitch',
        'Unknown field: led.capacitor.bogusCap',
        'Unknown field: topLevelBogus',
      ]),
    )
  })

  it('accepts an empty object (all defaults)', () => {
    const result = expectValid('{}')
    expect(result.warnings).toEqual([])
  })
})
