/**
 * What a track preset was drawn for (`preset.basis`), and whether the PCB
 * settings changed since: a preset only connects the pads it was drawn
 * around, so a different footprint or diode placement makes it stale.
 *
 * The editor records the switch and diode footprints and the diode placement
 * on every edit. kbplacer's `to-json` writes `switchFootprint` and
 * `diodeFootprints` (resolved names, e.g. `..._1.00u`). Only fields present in
 * the basis are compared, so a hand-written preset without one is never stale.
 */
import type { PcbSettings } from '@/types/pcb'
import { FLOAT_EPS } from './units'

// a type, not an interface, so it fits the free-form `basis` record
export type EditorBasis = {
  switchFootprint: string
  diodeFootprint: string
  diodePositionX: number
  diodePositionY: number
  diodeRotation: number
  diodeSide: 'FRONT' | 'BACK'
}

export interface BasisChange {
  /** What changed, for the banner. */
  label: string
  was: string
  now: string
}

export function presetBasis(settings: PcbSettings): EditorBasis {
  return {
    switchFootprint: settings.switchFootprint,
    diodeFootprint: settings.diodeFootprint,
    diodePositionX: settings.diodePositionX,
    diodePositionY: settings.diodePositionY,
    diodeRotation: settings.diodeRotation,
    diodeSide: settings.diodeSide,
  }
}

/** Footprint names compared at 1u: the preset is drawn on a 1u switch. */
const footprint = (name: string) => name.replace('{:.2f}', '1.00')
/** `Lib:Name` → `Name`, for display. */
const shortName = (name: string) => footprint(name).split(':').pop()!
const mm = (v: number) => `${+v.toFixed(3)}`

/** Settings that differ from `basis`, empty when the preset still fits. */
export function basisChanges(
  basis: Record<string, unknown> | undefined,
  settings: PcbSettings,
): BasisChange[] {
  if (!basis) return []
  const changes: BasisChange[] = []

  const compareFootprint = (label: string, was: unknown, now: string) => {
    if (typeof was === 'string' && footprint(was) !== footprint(now)) {
      changes.push({ label, was: shortName(was), now: shortName(now) })
    }
  }
  compareFootprint('switch footprint', basis.switchFootprint, settings.switchFootprint)
  const diode = Array.isArray(basis.diodeFootprints)
    ? basis.diodeFootprints[0]
    : basis.diodeFootprint
  compareFootprint('diode footprint', diode, settings.diodeFootprint)

  const { diodePositionX: x, diodePositionY: y, diodeRotation: rot, diodeSide: side } = basis
  if (typeof x === 'number' && typeof y === 'number') {
    const now = { x: settings.diodePositionX, y: settings.diodePositionY }
    if (Math.abs(x - now.x) > FLOAT_EPS || Math.abs(y - now.y) > FLOAT_EPS) {
      changes.push({
        label: 'diode position',
        was: `${mm(x)}, ${mm(y)} mm`,
        now: `${mm(now.x)}, ${mm(now.y)} mm`,
      })
    }
  }
  if (typeof rot === 'number' && Math.abs(rot - settings.diodeRotation) > FLOAT_EPS) {
    changes.push({ label: 'diode rotation', was: `${rot}°`, now: `${settings.diodeRotation}°` })
  }
  if (typeof side === 'string' && side !== settings.diodeSide) {
    changes.push({ label: 'diode side', was: side, now: settings.diodeSide })
  }
  return changes
}
