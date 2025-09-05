import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import KeyPropertiesPanel from '../KeyPropertiesPanel.vue'
import { useKeyboardStore } from '@/stores/keyboard'
import { Key } from '@ijprest/kle-serial'

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(() => null),
}
global.localStorage = localStorageMock as Storage

describe('KeyPropertiesPanel', () => {
  let store: ReturnType<typeof useKeyboardStore>
  let pinia: ReturnType<typeof createPinia>

  beforeEach(() => {
    vi.clearAllMocks()
    pinia = createPinia()
    setActivePinia(pinia)
    store = useKeyboardStore()

    // Clear localStorage mock
    localStorageMock.getItem.mockReturnValue(null)
  })

  describe('Advanced Position Mode Toggle', () => {
    it('should start in basic mode by default', () => {
      const wrapper = mount(KeyPropertiesPanel, {
        global: {
          plugins: [pinia],
        },
      })

      const toggleButton = wrapper.find('.toggle-mode-btn')
      expect(toggleButton.exists()).toBe(true)
      expect(toggleButton.text()).toBe('Advanced')

      const title = wrapper.find('.property-group-title')
      expect(title.text()).toBe('Position & Rotation')
    })

    it('should load advanced mode preference from localStorage', () => {
      localStorageMock.getItem.mockReturnValue('true')

      const wrapper = mount(KeyPropertiesPanel, {
        global: {
          plugins: [pinia],
        },
      })

      const toggleButton = wrapper.find('.toggle-mode-btn')
      expect(toggleButton.text()).toBe('Basic')

      const title = wrapper.find('.property-group-title')
      expect(title.text()).toBe('Advanced Position & Rotation')
    })

    it('should toggle between basic and advanced modes', async () => {
      const wrapper = mount(KeyPropertiesPanel, {
        global: {
          plugins: [pinia],
        },
      })

      const toggleButton = wrapper.find('.toggle-mode-btn')

      // Start in basic mode
      expect(toggleButton.text()).toBe('Advanced')
      expect(wrapper.find('.property-group-title').text()).toBe('Position & Rotation')

      // Click to switch to advanced
      await toggleButton.trigger('click')

      expect(toggleButton.text()).toBe('Basic')
      expect(wrapper.find('.property-group-title').text()).toBe('Advanced Position & Rotation')

      // Should save preference to localStorage
      expect(localStorageMock.setItem).toHaveBeenCalledWith('kle-ng-advanced-position', 'true')

      // Click again to switch back to basic
      await toggleButton.trigger('click')

      expect(toggleButton.text()).toBe('Advanced')
      expect(wrapper.find('.property-group-title').text()).toBe('Position & Rotation')
      expect(localStorageMock.setItem).toHaveBeenCalledWith('kle-ng-advanced-position', 'false')
    })

    it('should have consistent layout between basic and advanced modes', async () => {
      const wrapper = mount(KeyPropertiesPanel, {
        global: {
          plugins: [pinia],
        },
      })

      const positionContents = wrapper.findAll('.position-content')
      expect(positionContents.length).toBe(2) // One for basic, one for advanced

      // Both containers should exist for consistent layout
      expect(positionContents[0].exists()).toBe(true)
      expect(positionContents[1].exists()).toBe(true)

      // Advanced mode should have 4 columns for position (X, Y, X2, Y2)
      // Switch to advanced mode first
      await wrapper.find('.toggle-mode-btn').trigger('click')
      await wrapper.vm.$nextTick()

      const advancedPositionCols = wrapper.findAll(
        '.position-content:last-child .mb-2:first-child .col-3',
      )
      expect(advancedPositionCols.length).toBe(4) // X, Y, X2, Y2
    })

    it('should show secondary controls in advanced mode', async () => {
      const wrapper = mount(KeyPropertiesPanel, {
        global: {
          plugins: [pinia],
        },
      })

      // Switch to advanced mode
      const toggleButton = wrapper.find('.toggle-mode-btn')
      await toggleButton.trigger('click')
      await wrapper.vm.$nextTick()

      // Should show all secondary controls
      expect(wrapper.find('input[title="Secondary X Position"]').exists()).toBe(true)
      expect(wrapper.find('input[title="Secondary Y Position"]').exists()).toBe(true)
      expect(wrapper.find('input[title="Secondary Width"]').exists()).toBe(true)
      expect(wrapper.find('input[title="Secondary Height"]').exists()).toBe(true)
    })
  })

  describe('Component Integration', () => {
    it('should initialize with provided key data', async () => {
      // Add a key with secondary properties
      const testKey = new Key()
      testKey.x = 1.5
      testKey.y = 2.25
      testKey.width = 1.25
      testKey.height = 1
      testKey.x2 = 0.5
      testKey.y2 = 0.25
      testKey.width2 = 1.75
      testKey.height2 = 0.75

      store.keys = [testKey]
      store.selectedKeys = [testKey]

      const wrapper = mount(KeyPropertiesPanel, {
        global: {
          plugins: [pinia],
        },
      })

      // Wait for component to initialize
      await wrapper.vm.$nextTick()

      // Switch to advanced mode to see all fields
      await wrapper.find('.toggle-mode-btn').trigger('click')
      await wrapper.vm.$nextTick()

      // Verify the component has access to all secondary properties
      expect(wrapper.find('input[title="Secondary X Position"]').exists()).toBe(true)
      expect(wrapper.find('input[title="Secondary Y Position"]').exists()).toBe(true)
      expect(wrapper.find('input[title="Secondary Width"]').exists()).toBe(true)
      expect(wrapper.find('input[title="Secondary Height"]').exists()).toBe(true)
    })

    it('should handle keys without secondary properties gracefully', async () => {
      const basicKey = new Key()
      basicKey.x = 1
      basicKey.y = 2
      basicKey.width = 1
      basicKey.height = 1

      store.keys = [basicKey]
      store.selectedKeys = [basicKey]

      const wrapper = mount(KeyPropertiesPanel, {
        global: {
          plugins: [pinia],
        },
      })

      await wrapper.vm.$nextTick()

      // Switch to advanced mode
      await wrapper.find('.toggle-mode-btn').trigger('click')
      await wrapper.vm.$nextTick()

      // Should still show all secondary input fields (with default values)
      expect(wrapper.find('input[title="Secondary X Position"]').exists()).toBe(true)
      expect(wrapper.find('input[title="Secondary Y Position"]').exists()).toBe(true)
      expect(wrapper.find('input[title="Secondary Width"]').exists()).toBe(true)
      expect(wrapper.find('input[title="Secondary Height"]').exists()).toBe(true)
    })

    it('should mount and render without errors when keys have secondary properties', () => {
      const testKey = new Key()
      testKey.x2 = 0.5
      testKey.y2 = 0.25
      testKey.width2 = 1.5
      testKey.height2 = 0.75
      store.keys = [testKey]
      store.selectedKeys = [testKey]

      const wrapper = mount(KeyPropertiesPanel, {
        global: {
          plugins: [pinia],
        },
      })

      // Should render successfully without errors
      expect(wrapper.find('.property-group').exists()).toBe(true)
      expect(wrapper.find('.toggle-mode-btn').exists()).toBe(true)
    })
  })

  describe('Mode-specific behavior', () => {
    it('should show non-rectangular warning only in basic mode', async () => {
      // Create a J-shaped key (ISO Enter)
      const isoKey = new Key()
      isoKey.width = 1.25
      isoKey.width2 = 1.5
      isoKey.height = 2
      isoKey.height2 = 1
      isoKey.x2 = -0.25 // This makes it non-rectangular
      isoKey.y2 = 0
      store.keys = [isoKey]
      store.selectedKeys = [isoKey]

      const wrapper = mount(KeyPropertiesPanel, {
        global: {
          plugins: [pinia],
        },
      })

      await wrapper.vm.$nextTick()

      // In basic mode, should show basic title
      expect(wrapper.text()).toContain('Position & Rotation')

      // Switch to advanced mode
      await wrapper.find('.toggle-mode-btn').trigger('click')
      await wrapper.vm.$nextTick()

      // Should now be in advanced mode
      expect(wrapper.text()).toContain('Advanced Position & Rotation')
    })
  })

  describe('Clear Labels Functionality', () => {
    it('should have clear buttons for top and front labels', () => {
      const wrapper = mount(KeyPropertiesPanel, {
        global: {
          plugins: [pinia],
        },
      })

      // Should have "Clear all" buttons for both label sections
      const clearButtons = wrapper.findAll('.clear-labels-btn')
      expect(clearButtons.length).toBe(2)
      expect(
        clearButtons.some((button) => button.attributes('title') === 'Clear all top labels'),
      ).toBe(true)
      expect(
        clearButtons.some((button) => button.attributes('title') === 'Clear all front labels'),
      ).toBe(true)
    })

    it('should clear all top labels when clear top button is clicked', async () => {
      // Create a key with labels
      const testKey = new Key()
      testKey.labels = ['Q', 'q', '1', '', 'W', 'w', '', '', 'E', 'Front1', 'Front2', 'Front3']

      const wrapper = mount(KeyPropertiesPanel, {
        global: {
          plugins: [pinia],
        },
      })

      // Set store state after component mount to ensure reactivity
      store.keys = [testKey]
      store.selectedKeys = [testKey]

      await wrapper.vm.$nextTick()

      // Find and click the clear top labels button
      const clearTopButton = wrapper.find('button[title="Clear all top labels"]')
      expect(clearTopButton.exists()).toBe(true)

      await clearTopButton.trigger('click')
      await wrapper.vm.$nextTick()

      // Top labels (0-8) should be cleared
      for (let i = 0; i <= 8; i++) {
        expect(testKey.labels[i]).toBe('')
      }

      // Front labels (9-11) should remain unchanged
      expect(testKey.labels[9]).toBe('Front1')
      expect(testKey.labels[10]).toBe('Front2')
      expect(testKey.labels[11]).toBe('Front3')
    })

    it('should clear all front labels when clear front button is clicked', async () => {
      // Create a key with labels
      const testKey = new Key()
      testKey.labels = ['Q', 'q', '1', '', 'W', 'w', '', '', 'E', 'Front1', 'Front2', 'Front3']
      store.keys = [testKey]
      store.selectedKeys = [testKey]

      const wrapper = mount(KeyPropertiesPanel, {
        global: {
          plugins: [pinia],
        },
      })

      await wrapper.vm.$nextTick()

      // Find and click the clear front labels button
      const clearFrontButton = wrapper.find('button[title="Clear all front labels"]')
      expect(clearFrontButton.exists()).toBe(true)

      await clearFrontButton.trigger('click')
      await wrapper.vm.$nextTick()

      // Top labels (0-8) should remain unchanged
      expect(testKey.labels[0]).toBe('Q')
      expect(testKey.labels[1]).toBe('q')
      expect(testKey.labels[2]).toBe('1')
      expect(testKey.labels[4]).toBe('W')
      expect(testKey.labels[5]).toBe('w')
      expect(testKey.labels[8]).toBe('E')

      // Front labels (9-11) should be cleared
      expect(testKey.labels[9]).toBe('')
      expect(testKey.labels[10]).toBe('')
      expect(testKey.labels[11]).toBe('')
    })

    it('should clear labels for multiple selected keys', async () => {
      // Create multiple keys with labels
      const key1 = new Key()
      key1.labels = ['A', 'a', '1', '', '', '', '', '', '', 'F1', 'F2', 'F3']
      const key2 = new Key()
      key2.labels = ['B', 'b', '2', '', '', '', '', '', '', 'G1', 'G2', 'G3']

      store.keys = [key1, key2]
      store.selectedKeys = [key1, key2]

      const wrapper = mount(KeyPropertiesPanel, {
        global: {
          plugins: [pinia],
        },
      })

      await wrapper.vm.$nextTick()

      // Clear top labels
      const clearTopButton = wrapper.find('button[title="Clear all top labels"]')
      await clearTopButton.trigger('click')
      await wrapper.vm.$nextTick()

      // Both keys should have top labels cleared
      for (let i = 0; i <= 8; i++) {
        expect(key1.labels[i]).toBe('')
        expect(key2.labels[i]).toBe('')
      }

      // Front labels should remain
      expect(key1.labels[9]).toBe('F1')
      expect(key2.labels[9]).toBe('G1')
    })

    it('should disable clear buttons when no keys are selected', () => {
      store.keys = []
      store.selectedKeys = []

      const wrapper = mount(KeyPropertiesPanel, {
        global: {
          plugins: [pinia],
        },
      })

      const clearTopButton = wrapper.find('button[title="Clear all top labels"]')
      const clearFrontButton = wrapper.find('button[title="Clear all front labels"]')

      expect(clearTopButton.attributes('disabled')).toBeDefined()
      expect(clearFrontButton.attributes('disabled')).toBeDefined()
    })
  })
})
