import { describe, it, expect } from 'vitest'
import type { PlateSettings } from '@/types/plate'
import { serializePlateSettings, deserializePlateSettings } from '../plate-settings-serializer'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const baseDefaults: PlateSettings = {
  cutoutType: 'cherry-mx-basic',
  stabilizerType: 'mx-basic',
  filletRadius: 0.5,
  stabilizerFilletRadius: 0.5,
  sizeAdjust: 0,
  customCutoutWidth: 14,
  customCutoutHeight: 14,
  mergeCutouts: false,
  rotaryEncoderHandwired: false,
  thickness: 1.5,
  outline: {
    outlineType: 'none',
    marginTop: 5,
    marginBottom: 5,
    marginLeft: 5,
    marginRight: 5,
    tightMargin: 5,
    mergeWithCutouts: true,
    filletRadius: 1,
  },
  mountingHoles: { enabled: false, diameter: 3, edgeDistance: 3 },
  customHoles: { enabled: false, holes: [] },
  backsideFeatures: [{ type: 'cherry-mx-snap-notch', enabled: false }],
  backsideDepth: 0,
}

function makeSettings(overrides: Partial<PlateSettings> = {}): PlateSettings {
  return { ...baseDefaults, ...overrides }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('serializePlateSettings', () => {
  it('serializes default settings without holes section', () => {
    const json = serializePlateSettings(makeSettings())
    expect(json.holes).toBeUndefined()
  })

  it('includes holes.mounting when mountingHoles.enabled', () => {
    const json = serializePlateSettings(
      makeSettings({ mountingHoles: { enabled: true, diameter: 4, edgeDistance: 3 } }),
    )
    expect(json.holes?.mounting).toBeDefined()
    expect(json.holes?.mounting?.diameter).toBe(4)
  })

  it('omits holes section when mountingHoles disabled and customHoles disabled', () => {
    const json = serializePlateSettings(makeSettings())
    expect(json.holes).toBeUndefined()
  })

  it('includes holes.custom as empty array when customHoles.enabled with no holes', () => {
    const json = serializePlateSettings(makeSettings({ customHoles: { enabled: true, holes: [] } }))
    expect(json.holes?.custom).toEqual([])
  })

  it('includes holes.custom entries with diameter/offsetX/offsetY only (no id)', () => {
    const json = serializePlateSettings(
      makeSettings({
        customHoles: {
          enabled: true,
          holes: [{ id: 'hole_abc', diameter: 3, offsetX: 1, offsetY: 2 }],
        },
      }),
    )
    expect(json.holes?.custom?.[0]).toEqual({ diameter: 3, offsetX: 1, offsetY: 2 })
    expect((json.holes?.custom?.[0] as unknown as Record<string, unknown>).id).toBeUndefined()
  })

  it('omits stabilizerFilletRadius when stabilizerType is none', () => {
    const json = serializePlateSettings(makeSettings({ stabilizerType: 'none' }))
    expect(json.cutout?.stabilizerFilletRadius).toBeUndefined()
  })

  it('includes stabilizerFilletRadius when stabilizerType is not none', () => {
    const json = serializePlateSettings(
      makeSettings({ stabilizerType: 'mx-basic', stabilizerFilletRadius: 0.3 }),
    )
    expect(json.cutout?.stabilizerFilletRadius).toBe(0.3)
  })

  it('omits rotaryEncoderHandwired when false (PCB default), includes it when true', () => {
    const jsonPcb = serializePlateSettings(makeSettings({ rotaryEncoderHandwired: false }))
    expect(jsonPcb.cutout?.rotaryEncoderHandwired).toBeUndefined()

    const jsonHandwired = serializePlateSettings(makeSettings({ rotaryEncoderHandwired: true }))
    expect(jsonHandwired.cutout?.rotaryEncoderHandwired).toBe(true)
  })

  it('round-trips rotaryEncoderHandwired through serialize → deserialize', () => {
    const json = serializePlateSettings(makeSettings({ rotaryEncoderHandwired: true }))
    const restored = deserializePlateSettings(json, baseDefaults)
    expect(restored.rotaryEncoderHandwired).toBe(true)
  })

  it('includes width/height only for custom-rectangle switchType', () => {
    const jsonBasic = serializePlateSettings(makeSettings({ cutoutType: 'cherry-mx-basic' }))
    expect(jsonBasic.cutout?.width).toBeUndefined()

    const jsonCustom = serializePlateSettings(
      makeSettings({
        cutoutType: 'custom-rectangle',
        customCutoutWidth: 15,
        customCutoutHeight: 13,
      }),
    )
    expect(jsonCustom.cutout?.width).toBe(15)
    expect(jsonCustom.cutout?.height).toBe(13)
  })

  it('serializes rectangular outline', () => {
    const json = serializePlateSettings(
      makeSettings({
        outline: {
          outlineType: 'rectangular',
          marginTop: 3,
          marginBottom: 4,
          marginLeft: 5,
          marginRight: 6,
          filletRadius: 2,
          mergeWithCutouts: false,
          tightMargin: 5,
        },
      }),
    )
    expect(json.outline).toMatchObject({ outlineType: 'rectangular', marginTop: 3 })
  })

  it('serializes tight outline', () => {
    const json = serializePlateSettings(
      makeSettings({
        outline: {
          outlineType: 'tight',
          tightMargin: 4,
          filletRadius: 1,
          mergeWithCutouts: true,
          marginTop: 5,
          marginBottom: 5,
          marginLeft: 5,
          marginRight: 5,
        },
      }),
    )
    expect(json.outline).toMatchObject({ outlineType: 'tight', tightMargin: 4 })
  })
})

describe('deserializePlateSettings', () => {
  it('falls back to defaults for empty JSON', () => {
    const settings = deserializePlateSettings({}, baseDefaults)
    expect(settings.cutoutType).toBe(baseDefaults.cutoutType)
    expect(settings.thickness).toBe(baseDefaults.thickness)
  })

  it('applies cutout fields', () => {
    const settings = deserializePlateSettings(
      { cutout: { switchType: 'alps-skcm', kerf: 0.1 } },
      baseDefaults,
    )
    expect(settings.cutoutType).toBe('alps-skcm')
    expect(settings.sizeAdjust).toBe(0.1)
  })

  it('restores mounting holes with enabled=true when holes.mounting present', () => {
    const settings = deserializePlateSettings(
      { holes: { mounting: { diameter: 4 } } },
      baseDefaults,
    )
    expect(settings.mountingHoles.enabled).toBe(true)
    expect(settings.mountingHoles.diameter).toBe(4)
  })

  it('restores customHoles.enabled=true when holes.custom present (even empty array)', () => {
    const settings = deserializePlateSettings({ holes: { custom: [] } }, baseDefaults)
    expect(settings.customHoles.enabled).toBe(true)
    expect(settings.customHoles.holes).toHaveLength(0)
  })

  it('assigns stable index-based IDs to deserialized holes', () => {
    const holes = [
      { diameter: 3, offsetX: 1, offsetY: 2 },
      { diameter: 4, offsetX: 3, offsetY: 4 },
    ]
    const settings = deserializePlateSettings({ holes: { custom: holes } }, baseDefaults)
    expect(settings.customHoles.holes[0]!.id).toBe('hole_0')
    expect(settings.customHoles.holes[1]!.id).toBe('hole_1')
  })

  it('produces same IDs on repeated deserializations (stable)', () => {
    const json = { holes: { custom: [{ diameter: 3, offsetX: 0, offsetY: 0 }] } }
    const s1 = deserializePlateSettings(json, baseDefaults)
    const s2 = deserializePlateSettings(json, baseDefaults)
    expect(s1.customHoles.holes[0]!.id).toBe(s2.customHoles.holes[0]!.id)
  })

  it('respects default outlineType when outline is absent', () => {
    const defaultsWithRect: PlateSettings = {
      ...baseDefaults,
      outline: { ...baseDefaults.outline, outlineType: 'rectangular' },
    }
    const settings = deserializePlateSettings({}, defaultsWithRect)
    expect(settings.outline.outlineType).toBe('rectangular')
  })

  it('round-trips rectangular outline correctly', () => {
    const original = makeSettings({
      outline: {
        outlineType: 'rectangular',
        marginTop: 3,
        marginBottom: 4,
        marginLeft: 5,
        marginRight: 6,
        filletRadius: 2,
        mergeWithCutouts: false,
        tightMargin: 5,
      },
    })
    const json = serializePlateSettings(original)
    const restored = deserializePlateSettings(json, baseDefaults)
    expect(restored.outline.outlineType).toBe('rectangular')
    expect(restored.outline.marginTop).toBe(3)
    expect(restored.outline.marginRight).toBe(6)
    expect(restored.outline.mergeWithCutouts).toBe(false)
  })

  it('round-trips tight outline correctly', () => {
    const original = makeSettings({
      outline: {
        outlineType: 'tight',
        tightMargin: 4,
        filletRadius: 1,
        mergeWithCutouts: true,
        marginTop: 5,
        marginBottom: 5,
        marginLeft: 5,
        marginRight: 5,
      },
    })
    const json = serializePlateSettings(original)
    const restored = deserializePlateSettings(json, baseDefaults)
    expect(restored.outline.outlineType).toBe('tight')
    expect(restored.outline.tightMargin).toBe(4)
  })

  it('round-trips enabled+empty customHoles without losing enabled state', () => {
    const original = makeSettings({ customHoles: { enabled: true, holes: [] } })
    const json = serializePlateSettings(original)
    const restored = deserializePlateSettings(json, baseDefaults)
    expect(restored.customHoles.enabled).toBe(true)
    expect(restored.customHoles.holes).toHaveLength(0)
  })
})

describe('serialize → deserialize → serialize round-trip', () => {
  it('produces identical JSON for default settings', () => {
    const json1 = serializePlateSettings(baseDefaults)
    const restored = deserializePlateSettings(json1, baseDefaults)
    const json2 = serializePlateSettings(restored)
    expect(json2).toEqual(json1)
  })

  it('produces identical JSON for settings with custom holes', () => {
    const settings = makeSettings({
      customHoles: {
        enabled: true,
        holes: [{ id: 'hole_0', diameter: 3, offsetX: 1, offsetY: 2 }],
      },
    })
    const json1 = serializePlateSettings(settings)
    const restored = deserializePlateSettings(json1, baseDefaults)
    const json2 = serializePlateSettings(restored)
    expect(json2).toEqual(json1)
  })
})
