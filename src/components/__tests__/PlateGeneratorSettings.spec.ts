import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import PlateGeneratorSettings from '../PlateGeneratorSettings.vue'
import { usePlateGeneratorStore } from '@/stores/plateGenerator'

describe('PlateGeneratorSettings', () => {
  let pinia: ReturnType<typeof createPinia>

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
  })

  describe('Kerf (Size Adjustment) invalid/clear default', () => {
    it('falls back to 0, not the field minimum, when Kerf is cleared or invalid', async () => {
      const store = usePlateGeneratorStore()
      store.settings.sizeAdjust = 0.25

      const wrapper = mount(PlateGeneratorSettings, {
        global: { plugins: [pinia] },
      })
      await wrapper.vm.$nextTick()

      const input = wrapper.find('input[title="Cutout size adjustment in millimeters"]')
      expect(input.exists()).toBe(true)

      ;(input.element as HTMLInputElement).value = ''
      await input.trigger('input')
      await input.trigger('blur')
      await wrapper.vm.$nextTick()

      // Should default to 0, not the field's min (-0.5)
      expect(store.settings.sizeAdjust).toBe(0)
    })
  })

  describe('Custom cutout size invalid/clear default', () => {
    it('falls back to 14, not the field minimum, when Custom Cutout Width is cleared or invalid', async () => {
      const store = usePlateGeneratorStore()
      store.settings.cutoutType = 'custom-rectangle'
      store.settings.customCutoutWidth = 20

      const wrapper = mount(PlateGeneratorSettings, {
        global: { plugins: [pinia] },
      })
      await wrapper.vm.$nextTick()

      const input = wrapper.find('input[title="Custom cutout width in millimeters"]')
      expect(input.exists()).toBe(true)

      ;(input.element as HTMLInputElement).value = ''
      await input.trigger('input')
      await input.trigger('blur')
      await wrapper.vm.$nextTick()

      // Should default to 14, not the field's min (0.01)
      expect(store.settings.customCutoutWidth).toBe(14)
    })
  })

  describe('Fillet radius invalid/clear default', () => {
    it('falls back to the default 0 when the switch fillet radius is cleared or invalid', async () => {
      const store = usePlateGeneratorStore()
      store.settings.filletRadius = 1

      const wrapper = mount(PlateGeneratorSettings, {
        global: { plugins: [pinia] },
      })
      await wrapper.vm.$nextTick()

      const input = wrapper.find(
        'input[title="Corner rounding radius for switch cutouts in millimeters"]',
      )
      expect(input.exists()).toBe(true)

      ;(input.element as HTMLInputElement).value = ''
      await input.trigger('input')
      await input.trigger('blur')
      await wrapper.vm.$nextTick()

      expect(store.settings.filletRadius).toBe(0)
    })
  })
})
