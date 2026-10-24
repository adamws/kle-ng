/**
 * The LED's supply connection to its decoupling capacitor, as the generator
 * makes it (kbplacer/board_builder.py): SK6812MINI-E pinout LED pad 3 → VCC,
 * capacitor pad 1 → VCC. GND (LED pad 1, capacitor pad 2) is left out: it is
 * usually connected through a ground plane, not a track between the two.
 *
 * The preview draws it as a dashed line, so the capacitor can be placed next
 * to the pad it decouples. It isn't in the track editor's ratsnest (a preset
 * needn't route it), but a preset may route it, and then the line goes.
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
 * repeat a pad number); none without the capacitor, or when `connected` says
 * tracks join an LED and a capacitor VCC pad already.
 */
export function ledCapacitorConnections(
  pads: readonly PlacedPad[],
  connected: (a: PlacedPad, b: PlacedPad) => boolean = () => false,
): LedConnection[] {
  const vccPads = (owner: string, number: string) =>
    pads.filter(
      (p) => p.owner === owner && p.pad.number === number && p.pad.type !== 'np_thru_hole',
    )
  const leds = vccPads('LED', LED_VCC_PAD)
  const caps = vccPads('C', CAPACITOR_VCC_PAD)
  if (leds.some((a) => caps.some((b) => connected(a, b)))) return []
  const centre = (p: PlacedPad) => ({ x: p.pad.at.x, y: p.pad.at.y })
  let best: (LedConnection & { d: number }) | null = null
  for (const from of leds.map(centre)) {
    for (const to of caps.map(centre)) {
      const d = Math.hypot(to.x - from.x, to.y - from.y)
      if (!best || d < best.d) best = { net: 'VCC', from, to, d }
    }
  }
  return best ? [{ net: 'VCC', from: best.from, to: best.to }] : []
}
