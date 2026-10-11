import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import PcbGeneratorSettings from '../PcbGeneratorSettings.vue'
import { usePcbGeneratorStore } from '@/stores/pcbGenerator'

describe('PcbGeneratorSettings', () => {
  let pinia: ReturnType<typeof createPinia>

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
  })

  describe('Diode position invalid/clear default', () => {
    it('falls back to 0, not the field step, when Diode Position X is cleared or invalid', async () => {
      const store = usePcbGeneratorStore()
      store.settings.diodePositionX = 5.08

      const wrapper = mount(PcbGeneratorSettings, {
        global: { plugins: [pinia] },
      })
      await wrapper.vm.$nextTick()

      const input = wrapper.find('input[title="Diode horizontal offset in millimeters"]')
      expect(input.exists()).toBe(true)

      ;(input.element as HTMLInputElement).value = ''
      await input.trigger('input')
      await input.trigger('blur')
      await wrapper.vm.$nextTick()

      // Should default to 0, not the field's step (0.1)
      expect(store.settings.diodePositionX).toBe(0)
    })

    it('falls back to 0, not the field step, when Diode Position Y is cleared or invalid', async () => {
      const store = usePcbGeneratorStore()
      store.settings.diodePositionY = 4.0

      const wrapper = mount(PcbGeneratorSettings, {
        global: { plugins: [pinia] },
      })
      await wrapper.vm.$nextTick()

      const input = wrapper.find('input[title="Diode vertical offset in millimeters"]')
      expect(input.exists()).toBe(true)

      ;(input.element as HTMLInputElement).value = ''
      await input.trigger('input')
      await input.trigger('blur')
      await wrapper.vm.$nextTick()

      expect(store.settings.diodePositionY).toBe(0)
    })
  })

  describe('Diode side', () => {
    it('shows the side next to the rotation and writes it to the settings', async () => {
      const store = usePcbGeneratorStore()
      const wrapper = mount(PcbGeneratorSettings, {
        global: { plugins: [pinia] },
      })
      await wrapper.vm.$nextTick()

      const side = wrapper.find('select#diodeSide')
      expect((side.element as HTMLSelectElement).value).toBe('BACK')
      // one row: Side, then Rotation
      const row = side.element.closest('.row')!
      expect([...row.querySelectorAll('select')].map((s) => s.id)).toEqual([
        'diodeSide',
        'diodeRotation',
      ])

      await side.setValue('FRONT')
      expect(store.settings.diodeSide).toBe('FRONT')
    })
  })
})
