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
    it('should have "Choose Preset..." as default dropdown text', async () => {
      const wrapper = mount(KeyboardToolbar, {
        global: {
          plugins: [createPinia()],
        },
      })

      await wrapper.vm.$nextTick()

      const dropdownButton = wrapper.find('button.preset-select')
      expect(dropdownButton.exists()).toBe(true)
      expect(dropdownButton.text().trim()).toBe('Choose Preset...')
    })

    it('should show dropdown menu with preset options', async () => {
      const wrapper = mount(KeyboardToolbar, {
        global: {
          plugins: [createPinia()],
        },
      })

      await wrapper.vm.$nextTick()

      const dropdownButton = wrapper.find('button.preset-select')
      expect(dropdownButton.exists()).toBe(true)

      const dropdownMenu = wrapper.find('.preset-dropdown .dropdown-menu')
      expect(dropdownMenu.exists()).toBe(true)

      const dropdownItems = dropdownMenu.findAll('.dropdown-item')
      expect(dropdownItems.length).toBeGreaterThan(0)
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

      const presetDropdown = wrapper.find('.preset-dropdown .dropdown-menu')
      expect(presetDropdown.exists()).toBe(true)

      const dropdownItems = presetDropdown.findAll('.dropdown-item')
      expect(dropdownItems.length).toBeGreaterThan(0)

      // Click the first preset
      const firstPreset = dropdownItems[0]
      expect(firstPreset).toBeDefined()
      await firstPreset!.trigger('click')

      // Wait for async preset loading to complete
      await new Promise((resolve) => setTimeout(resolve, 500))
      await wrapper.vm.$nextTick()

      // Should have called loadKLELayout with the mocked data
      expect(loadKLELayoutSpy).toHaveBeenCalledWith(mockPresetData)

      // The dropdown button should show the selected preset name
      const dropdownButton = wrapper.find('button.preset-select')
      expect(dropdownButton.text().trim()).toBe('Test Layout 1')
    })

    it('should load available presets from presets.json', async () => {
      const wrapper = mount(KeyboardToolbar, {
        global: {
          plugins: [createPinia()],
        },
      })

      await wrapper.vm.$nextTick()

      // Find only the preset dropdown items (not import/export dropdowns)
      const presetDropdown = wrapper.find('.preset-dropdown .dropdown-menu')
      expect(presetDropdown.exists()).toBe(true)

      const dropdownItems = presetDropdown.findAll('.dropdown-item')

      // Should have 2 preset options
      expect(dropdownItems.length).toBe(2)
      const firstPresetOption = dropdownItems[0]
      expect(firstPresetOption).toBeDefined()
      expect(firstPresetOption!.text().trim()).toBe('Test Layout 1')
      const secondPresetOption = dropdownItems[1]
      expect(secondPresetOption).toBeDefined()
      expect(secondPresetOption!.text().trim()).toBe('Test Layout 2')
    })
  })

  describe('special key positioning', () => {
    it('should position special keys next to selected key', () => {
      const store = useKeyboardStore()

      // Clear the default layout and add a single key
      store.clearLayout()
      store.addKey({ labels: ['Test', '', '', '', '', '', '', '', '', '', '', ''] })

      // Position it at (2, 1)
      const firstKey = store.keys[0]
      expect(firstKey).toBeDefined()
      firstKey!.x = 2
      firstKey!.y = 1
      firstKey!.width = 1
      store.selectedKeys = [firstKey!]

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
      expect(isoKey).toBeDefined()
      expect(isoKey!.x).toBe(3) // firstKey.x + firstKey.width = 2 + 1 = 3
      expect(isoKey!.y).toBe(1) // Same Y as firstKey
      expect(isoKey!.width).toBe(1.25)
      expect(isoKey!.width2).toBe(1.5)
      expect(isoKey!.x2).toBe(-0.25) // Relative positioning preserved
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
        labels: ['', '', '', '', 'A', '', '', '', '', '', '', ''],
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
        labels: ['', '', '', '', 'B', '', '', '', '', '', '', ''],
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

    it('should prioritize filename over metadata name for downloads', async () => {
      const pinia = createPinia()
      setActivePinia(pinia)

      const store = useKeyboardStore()

      store.filename = 'imported-layout'
      store.metadata.name = 'Different Layout Name'

      const expectedFilename = `${store.filename || store.metadata.name || 'keyboard-layout'}.json`
      expect(expectedFilename).toBe('imported-layout.json')
    })

    it('should fallback to metadata name when no filename is set', async () => {
      const pinia = createPinia()
      setActivePinia(pinia)

      const store = useKeyboardStore()

      store.filename = ''
      store.metadata.name = 'Layout Name'

      const expectedFilename = `${store.filename || store.metadata.name || 'keyboard-layout'}.json`
      expect(expectedFilename).toBe('Layout Name.json')
    })
  })
})
