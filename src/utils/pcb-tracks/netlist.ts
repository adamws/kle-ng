/**
 * Nets of a key's parts, kbplacer's fixed convention
 * (kbplacer/board_builder.py): switch pad 1 → COL, diode pad 1 (K) → ROW,
 * switch pad 2 and diode pad 2 (A) → SW_D. With the per-key LED, its
 * SK6812MINI-E pins 1 → GND, 2 → DIN, 3 → VCC, 4 → DOUT, and the decoupling
 * capacitor's pad 1 → VCC, pad 2 → GND. Every pad sharing a number gets the
 * net, so duplicated pads (hybrid, reversible) may be bridged.
 *
 * DIN and DOUT are this key's ends of the LED chain (the previous and next
 * LED), so they are different nets. Other pads (mechanical) are obstacles: null.
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

/** The key matrix nets, which presets connect: the ratsnest shows these only. */
export type MatrixNet = 'COL' | 'ROW' | 'SW_D'
export type NetName = MatrixNet | 'VCC' | 'GND' | 'DIN' | 'DOUT'

const PAD_NETS = new Map<string, NetName>([
  ['SW:1', 'COL'],
  ['SW:2', 'SW_D'],
  ['D:1', 'ROW'],
  ['D:2', 'SW_D'],
  ['LED:1', 'GND'],
  ['LED:2', 'DIN'],
  ['LED:3', 'VCC'],
  ['LED:4', 'DOUT'],
  ['C:1', 'VCC'],
  ['C:2', 'GND'],
])

export function padNet(owner: string, number: string): NetName | null {
  return PAD_NETS.get(`${owner}:${number}`) ?? null
}

export function isMatrixNet(net: NetName): net is MatrixNet {
  return net === 'COL' || net === 'ROW' || net === 'SW_D'
}

/** Net of a placed pad; NPTH pads never have one. */
export function placedPadNet(p: PlacedPad): NetName | null {
  return p.pad.type === 'np_thru_hole' ? null : padNet(p.owner, p.pad.number)
}
