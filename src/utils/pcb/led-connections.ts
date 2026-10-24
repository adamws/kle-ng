/**
 * The LED's supply connection to its decoupling capacitor, as the generator
 * makes it (kbplacer/board_builder.py): SK6812MINI-E pinout LED pad 3 → VCC,
 * capacitor pad 1 → VCC. GND (LED pad 1, capacitor pad 2) is left out: it is
 * usually connected through a ground plane, not a track between the two.
 *
 * The preview draws it as a dashed line, so the capacitor can be placed next
 * to the pad it decouples. It isn't a net of the track editor: its presets
 * connect the switch and diode only.
 */
import type { Vec } from '@/utils/pcb-tracks/distance'
import type { PlacedPad } from '@/utils/pcb-tracks/netlist'

export interface LedConnection {
  net: 'VCC'
  from: Vec
  to: Vec
}

const LED_VCC_PAD = '3'
const CAPACITOR_VCC_PAD = '1'

/**
 * The line between the closest LED and capacitor VCC pads (a footprint may
 * repeat a pad number); none without the capacitor.
 */
export function ledCapacitorConnections(pads: readonly PlacedPad[]): LedConnection[] {
  const centres = (owner: string, number: string) =>
    pads
      .filter((p) => p.owner === owner && p.pad.number === number && p.pad.type !== 'np_thru_hole')
      .map((p) => ({ x: p.pad.at.x, y: p.pad.at.y }))
  let best: (LedConnection & { d: number }) | null = null
  for (const from of centres('LED', LED_VCC_PAD)) {
    for (const to of centres('C', CAPACITOR_VCC_PAD)) {
      const d = Math.hypot(to.x - from.x, to.y - from.y)
      if (!best || d < best.d) best = { net: 'VCC', from, to, d }
    }
  }
  return best ? [{ net: 'VCC', from: best.from, to: best.to }] : []
}
