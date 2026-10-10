import { describe, expect, it } from 'vitest'
import { ROUTING_MODES, routingMode, routingModeOption } from '../routing-mode'

describe('routing modes', () => {
  const preset = { version: 1 as const, items: [] }

  it('derives the mode from the routing value and the presence of a preset', () => {
    expect(routingMode({ routing: 'Disabled', trackPreset: undefined })).toBe('Disabled')
    expect(routingMode({ routing: 'Full', trackPreset: undefined })).toBe('Full')
    expect(routingMode({ routing: 'Full', trackPreset: preset })).toBe('Full (preset)')
    expect(routingMode({ routing: 'Switch-Diode only', trackPreset: preset })).toBe(
      'Switch-Diode only (preset)',
    )
  })

  it('maps every mode back to its routing value', () => {
    for (const option of ROUTING_MODES) {
      const settings = {
        routing: option.routing,
        trackPreset: option.preset ? preset : undefined,
      }
      expect(routingMode(settings)).toBe(option.value)
      expect(routingModeOption(option.value)).toBe(option)
    }
  })
})
