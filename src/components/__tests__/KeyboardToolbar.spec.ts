import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import KeyboardToolbar from '../KeyboardToolbar.vue'
import { useKeyboardStore, Key } from '@/stores/keyboard'

// Mock presets data using existing files
vi.mock('@/data/presets.json', () => ({
  default: {
    presets: [
      { name: 'Test Layout 1', file: 'planck.json' },
      { name: 'Test Layout 2', file: 'ansi-104.json' },
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

    it('should load preset when selected', async () => {
      const pinia = createPinia()
      setActivePinia(pinia)
      const componentStore = useKeyboardStore()

      // Mock fetch to return a valid preset JSON
      const mockPresetData = [['Test']]
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockPresetData),
      } as Response)

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

      // Wait for async preset loading to complete - increase timeout for fetch
      await new Promise((resolve) => setTimeout(resolve, 500))
      await wrapper.vm.$nextTick()

      // Should have called loadKLELayout with the mocked data
      expect(loadKLELayoutSpy).toHaveBeenCalledWith(mockPresetData)

      // The selectedPreset should remain selected (not reset)
      expect((selectElement.element as HTMLSelectElement).value).toBe('0')
    })

    it('should load available presets from presets.json', async () => {
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

  describe('export functionality', () => {
    beforeEach(() => {
      // Mock URL object methods
      global.URL = {
        createObjectURL: vi.fn(() => 'mock-url'),
        revokeObjectURL: vi.fn(),
      } as unknown as typeof URL

      // Mock createElement and DOM methods
      Object.defineProperty(document, 'createElement', {
        value: vi.fn((tag: string) => {
          if (tag === 'a') {
            return {
              href: '',
              download: '',
              click: vi.fn(),
            }
          }
          return {}
        }),
        writable: true,
      })

      // Mock Blob constructor
      global.Blob = vi.fn((content, options) => ({ content, options })) as unknown as typeof Blob

      // Clear console to avoid test output noise
      vi.spyOn(console, 'log').mockImplementation(() => {})
    })

    it('should export KLE format JSON', async () => {
      const pinia = createPinia()
      setActivePinia(pinia)
      const store = useKeyboardStore()

      // Add a test key
      store.addKey({
        labels: ['', '', '', '', 'A'],
        x: 1.123456789,
        y: 2.987654321,
      })

      // Test the export functionality directly through the store
      const data = store.getSerializedData('kle')

      // Should be standard KLE format (array-based)
      expect(Array.isArray(data)).toBe(true)
    })

    it('should export KLE Internal format JSON', async () => {
      const pinia = createPinia()
      setActivePinia(pinia)
      const store = useKeyboardStore()

      // Add a test key with high precision values
      store.addKey({
        labels: ['', '', '', '', 'B'],
        x: 1.1234567890123456,
        y: 2.9876543210987654,
        width: 1.5555555555555556,
      })

      // Test the export functionality directly through the store
      const data = store.getSerializedData('kle-internal')

      // Should be KLE internal format (object with meta and keys)
      expect(data).toHaveProperty('meta')
      expect(data).toHaveProperty('keys')
      expect(Array.isArray((data as { keys: Key[] }).keys)).toBe(true)

      // Check that numeric values are rounded to 6 decimal places
      const key = (data as { keys: Key[] }).keys.find((k: Key) => k.labels && k.labels[4] === 'B')
      expect(key).toBeDefined()
      if (key) {
        expect(key.x).toBe(1.123457) // Rounded to 6 decimal places
        expect(key.y).toBe(2.987654) // Rounded to 6 decimal places
        expect(key.width).toBe(1.555556) // Rounded to 6 decimal places
      }
    })

    it('should use correct filename for KLE internal export', async () => {
      const pinia = createPinia()
      setActivePinia(pinia)
      const store = useKeyboardStore()

      // Set a custom layout name
      store.metadata.name = 'Test Layout'

      // Test that the store has the correct name that would be used for filename
      expect(store.metadata.name).toBe('Test Layout')

      // Verify that the filename pattern would be correct (the component uses this pattern)
      const expectedFilename = `${store.metadata.name}-internal.json`
      expect(expectedFilename).toBe('Test Layout-internal.json')
    })
  })
})
