import { describe, it, expect } from 'vitest'
import {
  MAX_TRACK_PRESET_ITEMS,
  trackPresetFromWire,
  trackPresetToWire,
  validateWireTrackPreset,
} from '../track-preset'
import type { TrackPreset, WireTrackPreset } from '@/types/tracks'

// kle-ng default preset: SW pad 2 to D pad 2 (A) of an MX switch with a
// SOD-123F diode at 5.08 4 90 BACK, on B.Cu.
const DEFAULT_PRESET: WireTrackPreset = {
  version: 1,
  items: [
    {
      type: 'track',
      start: { x_nm: 2540000, y_nm: -5080000 },
      end: { x_nm: 2540000, y_nm: 60000 },
      width_nm: 250000,
      layer: 'B.Cu',
    },
    {
      type: 'track',
      start: { x_nm: 2540000, y_nm: 60000 },
      end: { x_nm: 5080000, y_nm: 2600000 },
      width_nm: 250000,
      layer: 'B.Cu',
    },
  ],
}

const VIA = {
  type: 'via',
  position: { x_nm: 1000000, y_nm: -2000000 },
  diameter_nm: 600000,
  drill_diameter_nm: 300000,
}

const track = (fields: Record<string, unknown>) => ({ ...DEFAULT_PRESET.items[0], ...fields })
const withItems = (...items: unknown[]) => ({ version: 1, items })

describe('validateWireTrackPreset', () => {
  it('accepts tracks and vias', () => {
    const result = validateWireTrackPreset({
      ...DEFAULT_PRESET,
      items: [...DEFAULT_PRESET.items, VIA],
    })
    expect(result).toEqual({
      valid: true,
      preset: { ...DEFAULT_PRESET, items: [...DEFAULT_PRESET.items, VIA] },
    })
  })

  it('keeps basis as is', () => {
    const basis = { switchFootprint: 'SW_Cherry_MX_PCB_1.00u' }
    const result = validateWireTrackPreset({ ...DEFAULT_PRESET, basis })
    expect(result.valid && result.preset.basis).toEqual(basis)
  })

  it.each([
    ['not an object', [1], "'tracks' must be an object"],
    ['a newer version', { ...DEFAULT_PRESET, version: 2 }, "'tracks.version' must be 1, got 2"],
    ['no items', withItems(), "'tracks.items' must be a non-empty array"],
    ['diode placement', { ...DEFAULT_PRESET, diodes: [] }, "'tracks.diodes' must not be set"],
    ['an unknown field', { ...DEFAULT_PRESET, extra: 1 }, "'tracks.extra' is not a known field"],
    ['a non-object basis', { ...DEFAULT_PRESET, basis: 'x' }, "'tracks.basis' must be an object"],
    ['an arc', withItems({ type: 'arc' }), "'tracks.items[0]' is an arc, arcs are not supported"],
    [
      'an unknown type',
      withItems({ type: 'zone' }),
      '\'tracks.items[0].type\' must be "track" or "via"',
    ],
    [
      'a non-integer coordinate',
      withItems(track({ start: { x_nm: 0.5, y_nm: 0 } })),
      "'tracks.items[0].start.x_nm' must be an integer number of nanometres, got 0.5",
    ],
    [
      'a string coordinate',
      withItems(track({ end: { x_nm: '1', y_nm: 0 } })),
      "'tracks.items[0].end.x_nm' must be an integer",
    ],
    [
      'an unknown vector field',
      withItems(track({ start: { x_nm: 0, y_nm: 0, z_nm: 0 } })),
      "'tracks.items[0].start.z_nm' is not a known field",
    ],
    [
      'a missing field',
      withItems({ type: 'track', start: { x_nm: 0, y_nm: 0 } }),
      "is missing 'end'",
    ],
    [
      'a zero width',
      withItems(track({ width_nm: 0 })),
      "'tracks.items[0].width_nm' must be positive",
    ],
    [
      'an inner layer',
      withItems(track({ layer: 'In1.Cu' })),
      '\'tracks.items[0].layer\' must be F.Cu or B.Cu, got "In1.Cu"',
    ],
    [
      'a zero-length track',
      withItems(track({ end: { x_nm: 2540000, y_nm: -5080000 } })),
      'start and end must differ',
    ],
    [
      'a via drill as large as the via',
      withItems({ ...VIA, drill_diameter_nm: 600000 }),
      'drill_diameter_nm must be smaller than diameter_nm',
    ],
    [
      'too many items',
      withItems(...Array.from({ length: MAX_TRACK_PRESET_ITEMS + 1 }, () => VIA)),
      `has more than ${MAX_TRACK_PRESET_ITEMS} items`,
    ],
  ])('rejects %s', (_, value, error) => {
    const result = validateWireTrackPreset(value)
    expect(result.valid).toBe(false)
    expect(!result.valid && result.error).toContain(error)
  })
})

describe('track preset conversion', () => {
  it('converts nm to mm and back without changes', () => {
    const preset = trackPresetFromWire(DEFAULT_PRESET)
    expect(preset.items[0]).toEqual({
      type: 'track',
      start: { x: 2.54, y: -5.08 },
      end: { x: 2.54, y: 0.06 },
      width: 0.25,
      layer: 'B.Cu',
    })
    expect(trackPresetToWire(preset)).toEqual(DEFAULT_PRESET)
  })

  it('converts vias', () => {
    const wire = { version: 1, items: [VIA] } as WireTrackPreset
    const preset = trackPresetFromWire(wire)
    expect(preset.items[0]).toEqual({
      type: 'via',
      position: { x: 1, y: -2 },
      diameter: 0.6,
      drillDiameter: 0.3,
    })
    expect(trackPresetToWire(preset)).toEqual(wire)
  })

  it('drops editor ids and rounds mm to whole nanometres', () => {
    const preset: TrackPreset = {
      version: 1,
      items: [
        {
          type: 'track',
          id: 't1',
          start: { x: 0.1 + 0.2, y: -1.0000004 },
          end: { x: 2.5400006, y: 0 },
          width: 0.25,
          layer: 'F.Cu',
        },
      ],
    }
    expect(trackPresetToWire(preset).items[0]).toEqual({
      type: 'track',
      start: { x_nm: 300000, y_nm: -1000000 },
      end: { x_nm: 2540001, y_nm: 0 },
      width_nm: 250000,
      layer: 'F.Cu',
    })
  })

  it('keeps shared vertices identical in nm', () => {
    const corner = { x: 2.5400004, y: 0.0600004 }
    const preset: TrackPreset = {
      version: 1,
      items: [
        { type: 'track', start: { x: 2.54, y: -5.08 }, end: corner, width: 0.25, layer: 'B.Cu' },
        { type: 'track', start: corner, end: { x: 5.08, y: 2.6 }, width: 0.25, layer: 'B.Cu' },
      ],
    }
    const [first, second] = trackPresetToWire(preset).items
    expect(first!.type === 'track' && first!.end).toEqual(second!.type === 'track' && second!.start)
  })

  it('rejects arcs', () => {
    const preset: TrackPreset = {
      version: 1,
      items: [
        {
          type: 'arc',
          start: { x: 0, y: 0 },
          mid: { x: 1, y: 1 },
          end: { x: 2, y: 0 },
          width: 0.25,
          layer: 'F.Cu',
        },
      ],
    }
    expect(() => trackPresetToWire(preset)).toThrow('not supported')
  })
})
