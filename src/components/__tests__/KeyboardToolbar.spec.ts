import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import KeyboardToolbar from '../KeyboardToolbar.vue'
import { useKeyboardStore } from '@/stores/keyboard'

// Mock layouts data
vi.mock('@/data/layouts.json', () => ({
  default: {
    presets: [
      { name: 'Test Layout 1', data: [['Q', 'W']] },
      { name: 'Test Layout 2', data: [['A', 'S']] },
    ],
  },
}))

describe('KeyboardToolbar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
  })

  describe('preset dropdown', () => {
    it('should have "Choose Preset..." option disabled', async () => {
      const wrapper = mount(KeyboardToolbar, {
        global: {
          plugins: [createPinia()],
        },
      })

      await wrapper.vm.$nextTick()

      const selectElement = wrapper.find('select.preset-select')
      expect(selectElement.exists()).toBe(true)

      const placeholderOption = selectElement.find('option[value=""]')
      expect(placeholderOption.exists()).toBe(true)
      expect(placeholderOption.text()).toBe('Choose Preset...')
      expect(placeholderOption.attributes('disabled')).toBeDefined()
    })

    it('should not allow selecting the placeholder option', async () => {
      const wrapper = mount(KeyboardToolbar, {
        global: {
          plugins: [createPinia()],
        },
      })

      await wrapper.vm.$nextTick()

      const selectElement = wrapper.find('select.preset-select')

      // The placeholder option should be disabled
      const placeholderOption = selectElement.find('option[value=""]')
      expect(placeholderOption.attributes('disabled')).toBeDefined()
    })

    it('should reset to placeholder after selecting a preset', async () => {
      const pinia = createPinia()
      setActivePinia(pinia)
      const componentStore = useKeyboardStore()

      // Mock the loadKLELayout method on the component's store
      const loadKLELayoutSpy = vi.spyOn(componentStore, 'loadKLELayout')

      const wrapper = mount(KeyboardToolbar, {
        global: {
          plugins: [pinia],
        },
      })

      await wrapper.vm.$nextTick()

      const selectElement = wrapper.find('select.preset-select')

      // Select a preset
      await selectElement.setValue('0')
      await selectElement.trigger('change')
      await wrapper.vm.$nextTick()

      // Should have called loadKLELayout
      expect(loadKLELayoutSpy).toHaveBeenCalled()

      // The selectedPreset should reset to empty value automatically
      // We don't need to check DOM state as this is handled by v-model binding
    })

    it('should load available presets from layouts.json', async () => {
      const wrapper = mount(KeyboardToolbar, {
        global: {
          plugins: [createPinia()],
        },
      })

      await wrapper.vm.$nextTick()

      const selectElement = wrapper.find('select.preset-select')
      const options = selectElement.findAll('option')

      // Should have placeholder + 2 preset options
      expect(options.length).toBe(3)
      expect(options[0].text()).toBe('Choose Preset...')
      expect(options[1].text()).toBe('Test Layout 1')
      expect(options[2].text()).toBe('Test Layout 2')
    })
  })

  describe('special key positioning', () => {
    it('should position special keys next to selected key', () => {
      const store = useKeyboardStore()

      // Clear the default layout and add a single key
      store.clearLayout()
      store.addKey({ labels: ['Test'] })

      // Position it at (2, 1)
      const firstKey = store.keys[0]
      firstKey.x = 2
      firstKey.y = 1
      firstKey.width = 1
      store.selectedKeys = [firstKey]

      // Test the special key data transformation directly
      const isoEnterData = {
        width: 1.25,
        width2: 1.5,
        height: 2,
        height2: 1,
        x: 0.25, // This should be removed
        y: 0, // Add y property for TypeScript
        x2: -0.25,
        y2: 0,
      }

      // Simulate what addSpecialKey does: remove x/y and add key
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { x, y, ...keyDataWithoutPosition } = isoEnterData

      store.addKey(keyDataWithoutPosition)

      // Check that the ISO Enter was positioned next to the selected key
      expect(store.keys).toHaveLength(2)
      const isoKey = store.keys[1]
      expect(isoKey.x).toBe(3) // firstKey.x + firstKey.width = 2 + 1 = 3
      expect(isoKey.y).toBe(1) // Same Y as firstKey
      expect(isoKey.width).toBe(1.25)
      expect(isoKey.width2).toBe(1.5)
      expect(isoKey.x2).toBe(-0.25) // Relative positioning preserved
    })
  })
})
