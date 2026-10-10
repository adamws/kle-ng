import { describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { basisChanges, presetBasis } from '../basis'
import { usePcbGeneratorStore } from '@/stores/pcbGenerator'
import type { PcbSettings } from '@/types/pcb'

/** The default PCB settings with `change` applied. */
function settings(change: Partial<PcbSettings> = {}): PcbSettings {
  localStorage.clear()
  setActivePinia(createPinia())
  return { ...usePcbGeneratorStore().settings, ...change }
}

describe('preset basis', () => {
  it('fits the settings it was recorded from', () => {
    expect(basisChanges(presetBasis(settings()), settings())).toEqual([])
  })

  it('is never stale without a basis', () => {
    expect(basisChanges(undefined, settings({ diodePositionX: 0 }))).toEqual([])
    expect(basisChanges({ source: 'board.kicad_pcb' }, settings())).toEqual([])
  })

  it('names the changed footprints and diode placement', () => {
    const basis = presetBasis(settings())
    const now = settings({
      switchFootprint: 'Switch_Keyboard_Alps_Matias:SW_Alps_Matias_{:.2f}u',
      diodeFootprint: 'Diode_SMD:D_SOD-323',
      diodePositionY: 5,
      diodeRotation: 270,
      diodeSide: 'FRONT',
    })
    expect(basisChanges(basis, now)).toEqual([
      { label: 'switch footprint', was: 'SW_Cherry_MX_PCB_1.00u', now: 'SW_Alps_Matias_1.00u' },
      { label: 'diode footprint', was: 'D_SOD-123F', now: 'D_SOD-323' },
      { label: 'diode position', was: '5.08, 4 mm', now: '5.08, 5 mm' },
      { label: 'diode rotation', was: '90°', now: '270°' },
      { label: 'diode side', was: 'BACK', now: 'FRONT' },
    ])
  })

  it("reads kbplacer to-json's resolved footprint names", () => {
    const basis = {
      source: 'template.kicad_pcb',
      switchFootprint: 'Switch_Keyboard_Cherry_MX:SW_Cherry_MX_PCB_1.00u',
      diodeFootprints: ['Diode_SMD:D_SOD-123F'],
    }
    expect(basisChanges(basis, settings())).toEqual([])
    expect(
      basisChanges(basis, settings({ diodeFootprint: 'Diode_SMD:D_SOD-123' })).map((c) => c.label),
    ).toEqual(['diode footprint'])
  })
})
