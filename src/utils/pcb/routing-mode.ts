/**
 * Routing modes of the PCB generator settings. The backend knows three
 * routing values (kbplacer's built-in router); switch-diode tracks come either
 * from that router (automatic) or from a drawn track preset. A preset mode is
 * one whose settings hold a `trackPreset`, empty until something is drawn.
 */
import type { PcbSettings } from '@/types/pcb'

export type RoutingMode =
  'Disabled' | 'Switch-Diode only' | 'Switch-Diode only (preset)' | 'Full' | 'Full (preset)'

export interface RoutingModeOption {
  value: RoutingMode
  label: string
  /** The backend routing value. */
  routing: 'Disabled' | 'Switch-Diode only' | 'Full'
  /** Switch-diode tracks come from the drawn preset. */
  preset: boolean
}

export const ROUTING_MODES: readonly RoutingModeOption[] = [
  { value: 'Disabled', label: 'Disabled', routing: 'Disabled', preset: false },
  {
    value: 'Switch-Diode only',
    label: 'Switch-diode only (automatic)',
    routing: 'Switch-Diode only',
    preset: false,
  },
  {
    value: 'Switch-Diode only (preset)',
    label: 'Switch-diode only (preset)',
    routing: 'Switch-Diode only',
    preset: true,
  },
  { value: 'Full', label: 'Full (automatic)', routing: 'Full', preset: false },
  { value: 'Full (preset)', label: 'Full (preset)', routing: 'Full', preset: true },
]

export function routingModeOption(mode: RoutingMode): RoutingModeOption {
  return ROUTING_MODES.find((o) => o.value === mode)!
}

/** The mode of the settings: their routing value plus whether they hold a preset. */
export function routingMode(settings: Pick<PcbSettings, 'routing' | 'trackPreset'>): RoutingMode {
  const preset = settings.trackPreset !== undefined
  const option = ROUTING_MODES.find((o) => o.routing === settings.routing && o.preset === preset)
  // a preset with routing disabled isn't a mode (the settings validator drops it)
  return option?.value ?? (settings.routing as RoutingMode)
}
