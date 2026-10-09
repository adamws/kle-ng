/**
 * Nets of the switch-diode pair, kbplacer's fixed convention
 * (kbplacer/board_builder.py): switch pad 1 → COL, diode pad 1 (K) → ROW,
 * switch pad 2 and diode pad 2 (A) → SW_D. Every pad sharing a number gets
 * the net, so duplicated pads (hybrid, reversible) may be bridged.
 *
 * Other pads (LED, capacitor, mechanical) are obstacles: null.
 */
import type { FootprintPad } from '@/utils/kicad/footprint-pads'

/** A pad placed in the switch-local frame, with the footprint it belongs to. */
export interface PlacedPad {
  /** Unique key, `<owner>:<index>` (e.g. `SW:3`, `D:0`). */
  key: string
  /** Reference prefix of the footprint: SW, D, LED, C. */
  owner: string
  pad: FootprintPad
}

export type NetName = 'COL' | 'ROW' | 'SW_D'

export function padNet(owner: string, number: string): NetName | null {
  if (owner === 'SW') return number === '1' ? 'COL' : number === '2' ? 'SW_D' : null
  if (owner === 'D') return number === '1' ? 'ROW' : number === '2' ? 'SW_D' : null
  return null
}

/** Net of a placed pad; NPTH pads never have one. */
export function placedPadNet(p: PlacedPad): NetName | null {
  return p.pad.type === 'np_thru_hole' ? null : padNet(p.owner, p.pad.number)
}
