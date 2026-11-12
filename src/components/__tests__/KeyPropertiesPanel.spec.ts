import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import KeyPropertiesPanel from '../KeyPropertiesPanel.vue'
import ColorPicker from '../ColorPicker.vue'
import { useKeyboardStore } from '@/stores/keyboard'
import { useCharacterPickerStore } from '@/stores/characterPicker'
import { Key } from '@adamws/kle-serial'

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(() => null),
}
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

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
      expect(positionContents[0]).toBeDefined()
      expect(positionContents[1]).toBeDefined()
      expect(positionContents[0]!.exists()).toBe(true)
      expect(positionContents[1]!.exists()).toBe(true)

      const basicPositionCols = positionContents[0]!.findAll('.mb-2:first-child .col-6')
      expect(basicPositionCols.length).toBe(2) // X, Y

      const advancedPositionCols = positionContents[1]!.findAll('.mb-2:first-child .col-3')
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
      // Create a non-rectangular key (ISO Enter)
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

      // Should have "Clear all" buttons for labels and text sizes
      const clearButtons = wrapper.findAll('.clear-labels-btn')
      expect(clearButtons.length).toBe(3)
      expect(
        clearButtons.some((button) => button.attributes('title') === 'Clear all top labels'),
      ).toBe(true)
      expect(
        clearButtons.some((button) => button.attributes('title') === 'Clear all front labels'),
      ).toBe(true)
      expect(
        clearButtons.some((button) => button.attributes('title') === 'Clear all text sizes'),
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

  describe('Multi-selection labels', () => {
    const mountWithKeys = (...keys: Key[]) => {
      store.keys = keys
      store.selectedKeys = keys
      return mount(KeyPropertiesPanel, { global: { plugins: [pinia] } })
    }

    it('shows labels shared by all selected keys and marks differing ones as mixed', async () => {
      const key1 = new Key()
      key1.labels = ['A', 'x', '', '', '', '', '', '', '', '', '', '']
      const key2 = new Key()
      key2.labels = ['A', 'y', '', '', '', '', '', '', '', '', '', '']
      const wrapper = mountWithKeys(key1, key2)
      await wrapper.vm.$nextTick()

      const topLeft = wrapper.get('[data-testid="labels-grid"] input[title="Top Left"]')
      const topCenter = wrapper.get('[data-testid="labels-grid"] input[title="Top Center"]')
      const topRight = wrapper.get('[data-testid="labels-grid"] input[title="Top Right"]')

      expect((topLeft.element as HTMLInputElement).value).toBe('A')
      expect(topLeft.attributes('placeholder')).toBeUndefined()
      expect((topCenter.element as HTMLInputElement).value).toBe('')
      expect(topCenter.attributes('placeholder')).toBe('Mixed')
      expect((topRight.element as HTMLInputElement).value).toBe('')
      expect(topRight.attributes('placeholder')).toBeUndefined()
    })

    it('keeps every typed character when editing a label of multiple keys', async () => {
      const key1 = new Key()
      const key2 = new Key()
      const wrapper = mountWithKeys(key1, key2)
      await wrapper.vm.$nextTick()

      const input = wrapper.get('[data-testid="labels-grid"] input[title="Top Left"]')
      const el = input.element as HTMLInputElement
      // Type one character at a time, appending to whatever the input holds
      // after the panel re-syncs from the keys, as a browser would.
      for (const char of 'test') {
        await input.setValue(el.value + char)
        await wrapper.vm.$nextTick()
      }

      expect(el.value).toBe('test')
      expect(store.selectedKeys.map((key) => key.labels[0])).toEqual(['test', 'test'])
    })
  })

  describe('Label Color Behavior', () => {
    // The first 12 ColorPicker instances in KeyPropertiesPanel correspond to label
    // positions 0–11 (top-left … front top-right). Indices 12 and 13 are the key
    // background color and default text color pickers respectively.
    const getLabelColorPickers = (wrapper: ReturnType<typeof mount>) =>
      wrapper.findAllComponents(ColorPicker).slice(0, 12)

    describe('labelColors initialization', () => {
      it('shows stored color for a label position that has text (single selection)', async () => {
        const key = new Key()
        key.labels[0] = 'Q'
        key.textColor[0] = '#0000ff'
        store.keys = [key]
        store.selectedKeys = [key]

        const wrapper = mount(KeyPropertiesPanel, { global: { plugins: [pinia] } })
        await wrapper.vm.$nextTick()

        expect(getLabelColorPickers(wrapper)[0]?.props('modelValue')).toBe('#0000ff')
      })

      it('shows default color for a position with no label text even if textColor is stored (single selection)', async () => {
        // Regression: a stale textColor entry from a prior operation must not
        // appear in the panel when the label at that position is empty.
        const key = new Key()
        key.labels[0] = ''
        key.textColor[0] = '#ff0000' // stale leftover
        store.keys = [key]
        store.selectedKeys = [key]

        const wrapper = mount(KeyPropertiesPanel, { global: { plugins: [pinia] } })
        await wrapper.vm.$nextTick()

        expect(getLabelColorPickers(wrapper)[0]?.props('modelValue')).toBe(key.default.textColor)
      })

      it('shows first-key colors for used positions and default for empty positions (multi selection)', async () => {
        const key1 = new Key()
        key1.labels[0] = 'A'
        key1.textColor[0] = '#0000ff'
        key1.labels[1] = '' // position 1 unused on key1

        const key2 = new Key()
        key2.labels[0] = 'B'
        key2.textColor[0] = '#00ff00'
        key2.labels[1] = 'C'
        key2.textColor[1] = '#ff0000'

        store.keys = [key1, key2]
        store.selectedKeys = [key1, key2]

        const wrapper = mount(KeyPropertiesPanel, { global: { plugins: [pinia] } })
        await wrapper.vm.$nextTick()

        const pickers = getLabelColorPickers(wrapper)
        // Position 0 has text on key1 → shows key1's stored color
        expect(pickers[0]?.props('modelValue')).toBe('#0000ff')
        // Position 1 has no text on key1 → shows default, even though key2 has one
        expect(pickers[1]?.props('modelValue')).toBe(key1.default.textColor)
      })
    })

    describe('applying color changes', () => {
      it('writes textColor only to keys that have label text at the target position', async () => {
        const keyWithLabel = new Key()
        keyWithLabel.labels[0] = 'Q'
        const keyWithoutLabel = new Key()
        // keyWithoutLabel has no text at position 0

        store.keys = [keyWithLabel, keyWithoutLabel]
        store.selectedKeys = [keyWithLabel, keyWithoutLabel]

        const wrapper = mount(KeyPropertiesPanel, { global: { plugins: [pinia] } })
        await wrapper.vm.$nextTick()

        // Simulate: update:modelValue syncs labelColors[0], then change commits
        const pickers = getLabelColorPickers(wrapper)
        await pickers[0]?.vm.$emit('update:modelValue', '#ff0000')
        await pickers[0]?.vm.$emit('change', '#ff0000')
        await wrapper.vm.$nextTick()

        expect(keyWithLabel.textColor[0]).toBe('#ff0000')
        // Key with no label must not receive the color
        expect(keyWithoutLabel.textColor[0]).toBe('')
      })

      it('clears any stale textColor on keys that have no label at the changed position', async () => {
        const key = new Key()
        key.labels[0] = ''
        key.textColor[0] = '#ff0000' // stale leftover

        store.keys = [key]
        store.selectedKeys = [key]

        const wrapper = mount(KeyPropertiesPanel, { global: { plugins: [pinia] } })
        await wrapper.vm.$nextTick()

        const pickers = getLabelColorPickers(wrapper)
        await pickers[0]?.vm.$emit('update:modelValue', '#00ff00')
        await pickers[0]?.vm.$emit('change', '#00ff00')
        await wrapper.vm.$nextTick()

        // Stale entry is cleared — no color stored for an unused label position
        expect(key.textColor[0]).toBe('')
      })

      it('does not write any color to the layout when no selected key uses that label position', async () => {
        // Regression: "select all, set bottom-left color, but no key uses bottom-left"
        // must leave textColor empty for all keys at that position.
        const key1 = new Key()
        key1.labels[0] = 'A' // only position 0 is used
        const key2 = new Key()
        key2.labels[0] = 'B'

        store.keys = [key1, key2]
        store.selectedKeys = [key1, key2]

        const wrapper = mount(KeyPropertiesPanel, { global: { plugins: [pinia] } })
        await wrapper.vm.$nextTick()

        const pickers = getLabelColorPickers(wrapper)
        // Position 6 (bottom-left) — unused by all selected keys
        await pickers[6]?.vm.$emit('update:modelValue', '#ff0000')
        await pickers[6]?.vm.$emit('change', '#ff0000')
        await wrapper.vm.$nextTick()

        expect(key1.textColor[6]).toBe('')
        expect(key2.textColor[6]).toBe('')
      })
    })
  })

  describe('Stepped and non-rectangular keys', () => {
    const mountWith = async (key: Key) => {
      store.keys = [key]
      store.selectedKeys = [key]
      const wrapper = mount(KeyPropertiesPanel, { global: { plugins: [pinia] } })
      await wrapper.vm.$nextTick()
      return wrapper
    }

    it('checking Step splits a wide key so the step is visible right away', async () => {
      const key = new Key()
      key.width = 1.75
      key.width2 = 1.75
      const wrapper = await mountWith(key)

      await wrapper.find('#steppedCheck').setValue(true)

      expect(key).toMatchObject({ stepped: true, width: 1.25, width2: 1.75 })
      expect(wrapper.find('[data-testid="shape-size-summary"]').text()).toContain(
        '1.25U raised of 1.75U',
      )
      expect(wrapper.find('[data-testid="shape-make-rectangular"]').text()).toBe('Remove Step')
    })

    it('explains on hover why Step is disabled for a 1U key', async () => {
      const oneU = await mountWith(new Key())
      expect(oneU.find('#steppedCheck').attributes('disabled')).toBeDefined()
      expect(oneU.find('[data-testid="stepped-option"]').attributes('title')).toContain(
        'wider or taller than 1U',
      )

      const wide = new Key()
      wide.width = 1.75
      wide.width2 = 1.75
      const wrapper = await mountWith(wide)
      expect(wrapper.find('#steppedCheck').attributes('disabled')).toBeUndefined()
      expect(wrapper.find('[data-testid="stepped-option"]').attributes('title')).toBeUndefined()
    })

    it('unchecking Step restores the full-width key', async () => {
      const key = new Key()
      key.width = 1.25
      key.width2 = 1.75
      key.stepped = true
      const wrapper = await mountWith(key)

      await wrapper.find('#steppedCheck').setValue(false)

      expect(key).toMatchObject({ stepped: false, width: 1.75, width2: 1.75 })
      expect(wrapper.find('[data-testid="shape-size-box"]').exists()).toBe(false)
    })

    it('Remove Step keeps the full width, not the raised part', async () => {
      const key = new Key()
      key.width = 1.25
      key.width2 = 1.75
      key.stepped = true
      const wrapper = await mountWith(key)

      await wrapper.find('[data-testid="shape-make-rectangular"]').trigger('click')

      expect(key.width).toBe(1.75)
      expect(key.stepped).toBeFalsy()
    })

    it('points non-rectangular keys at Advanced view, which the button opens', async () => {
      const key = new Key()
      Object.assign(key, { width: 1.25, height: 2, width2: 1.5, height2: 1, x2: -0.25 })
      const wrapper = await mountWith(key)

      expect(wrapper.find('[data-testid="shape-size-summary"]').text()).toContain(
        '1.25×2U + 1.5×1U',
      )
      expect(wrapper.find('[data-testid="shape-make-rectangular"]').text()).toBe('Make Rectangular')
      await wrapper.find('[data-testid="shape-edit-advanced"]').trigger('click')
      expect(wrapper.find('.toggle-mode-btn').text()).toBe('Basic')
    })
  })

  describe('Rotary Encoder Functionality', () => {
    it('should disable height inputs when rotary encoder is selected', async () => {
      // Create a rotary encoder key
      const encoderKey = new Key()
      encoderKey.sm = 'rot_ec11'
      encoderKey.width = 2
      encoderKey.height = 2

      store.keys = [encoderKey]
      store.selectedKeys = [encoderKey]

      const wrapper = mount(KeyPropertiesPanel, {
        global: {
          plugins: [pinia],
        },
      })

      await wrapper.vm.$nextTick()

      // Find height inputs and verify they are disabled
      const heightInputs = wrapper.findAll('input[title="Height"]')
      expect(heightInputs.length).toBeGreaterThan(0)

      heightInputs.forEach((input) => {
        expect(input.attributes('disabled')).toBeDefined()
      })

      // Find all height-related inputs (primary and secondary)
      const allHeightInputs = wrapper.findAll(
        'input[title="Height"], input[title="Secondary Height"]',
      )
      // All height inputs should be disabled for rotary encoders
      allHeightInputs.forEach((input) => {
        expect(input.attributes('disabled')).toBeDefined()
      })
    })

    it('should synchronize height with width when width changes on rotary encoder', async () => {
      // Create a rotary encoder key
      const encoderKey = new Key()
      encoderKey.sm = 'rot_ec11'
      encoderKey.width = 1.5
      encoderKey.height = 1.5

      store.keys = [encoderKey]
      store.selectedKeys = [encoderKey]

      const wrapper = mount(KeyPropertiesPanel, {
        global: {
          plugins: [pinia],
        },
      })

      await wrapper.vm.$nextTick()

      // Mock saveState to track when it's called
      const saveStateSpy = vi.spyOn(store, 'saveState')

      // Find width input and change its value
      const widthInput = wrapper.find('input[title="Width"]')
      expect(widthInput.exists()).toBe(true)

      // Simulate width change
      await widthInput.setValue('2.5')
      await widthInput.trigger('blur')
      await wrapper.vm.$nextTick()

      // Verify that height was synchronized with width
      expect(encoderKey.width).toBe(2.5)
      expect(encoderKey.height).toBe(2.5)
      expect(encoderKey.height2).toBe(2.5)
      expect(saveStateSpy).toHaveBeenCalled()
    })

    it('should set height equal to width when converting key to rotary encoder', async () => {
      // Create a normal rectangular key with different width and height
      const normalKey = new Key()
      normalKey.width = 2
      normalKey.height = 1.5
      normalKey.sm = ''

      store.keys = [normalKey]
      store.selectedKeys = [normalKey]

      const wrapper = mount(KeyPropertiesPanel, {
        global: {
          plugins: [pinia],
        },
      })

      await wrapper.vm.$nextTick()

      // Mock saveState
      const saveStateSpy = vi.spyOn(store, 'saveState')

      // Find the rotary encoder checkbox (switch mount option)
      const rotaryEncoderCheckbox = wrapper.find('#rotaryEncoderCheck')
      expect(rotaryEncoderCheckbox.exists()).toBe(true)

      // Enable rotary encoder
      await rotaryEncoderCheckbox.setValue(true)
      await wrapper.vm.$nextTick()

      // Verify that height was set to match width
      expect(normalKey.sm).toBe('rot_ec11')
      expect(normalKey.width).toBe(2)
      expect(normalKey.height).toBe(2) // Should be synchronized to width
      expect(normalKey.height2).toBe(2)
      expect(saveStateSpy).toHaveBeenCalled()
    })

    it('should handle non-rectangular keys when converting to rotary encoder', async () => {
      // Create a non-rectangular key (like ISO Enter)
      const isoKey = new Key()
      isoKey.width = 1.25
      isoKey.height = 2
      isoKey.width2 = 1.5
      isoKey.height2 = 1
      isoKey.x2 = -0.25
      isoKey.y2 = 0
      isoKey.sm = ''

      store.keys = [isoKey]
      store.selectedKeys = [isoKey]

      const wrapper = mount(KeyPropertiesPanel, {
        global: {
          plugins: [pinia],
        },
      })

      await wrapper.vm.$nextTick()

      // Find the rotary encoder checkbox
      const rotaryEncoderCheckbox = wrapper.find('#rotaryEncoderCheck')
      expect(rotaryEncoderCheckbox.exists()).toBe(true)

      // Enable rotary encoder
      await rotaryEncoderCheckbox.setValue(true)
      await wrapper.vm.$nextTick()

      // Verify that the key was converted properly
      expect(isoKey.sm).toBe('rot_ec11')
      expect(isoKey.x2).toBe(0) // Reset secondary position
      expect(isoKey.y2).toBe(0)
      expect(isoKey.width2).toBe(isoKey.width) // Secondary width matches primary
      expect(isoKey.height).toBe(isoKey.width) // Height matches width
      expect(isoKey.height2).toBe(isoKey.width) // Secondary height matches width
    })

    it('should not allow height inputs to be enabled for rotary encoders', async () => {
      // Create a rotary encoder key
      const encoderKey = new Key()
      encoderKey.sm = 'rot_ec11'
      encoderKey.width = 1.5
      encoderKey.height = 1.5

      store.keys = [encoderKey]
      store.selectedKeys = [encoderKey]

      const wrapper = mount(KeyPropertiesPanel, {
        global: {
          plugins: [pinia],
        },
      })

      await wrapper.vm.$nextTick()

      // Verify height inputs remain disabled
      const heightInputs = wrapper.findAll('input[title="Height"]')
      heightInputs.forEach((input) => {
        expect(input.attributes('disabled')).toBeDefined()
        expect((input.element as HTMLInputElement).disabled).toBe(true)
      })

      // Now disable rotary encoder
      const rotaryEncoderCheckbox = wrapper.find('#rotaryEncoderCheck')
      await rotaryEncoderCheckbox.setValue(false)
      await wrapper.vm.$nextTick()

      // Verify height inputs are now enabled
      const heightInputsAfter = wrapper.findAll('input[title="Height"]')
      heightInputsAfter.forEach((input) => {
        expect(input.attributes('disabled')).toBeUndefined()
      })
    })
  })

  describe('Per-Label Text Size', () => {
    it('commits a typed value into an empty field on blur without pressing Enter', async () => {
      // Regression test: this field is bound one-way (:model-value, not v-model) with
      // value-on-clear=null and reference-value set — the exact wiring reported broken.
      const key = new Key()
      store.keys = [key]
      store.selectedKeys = [key]

      const wrapper = mount(KeyPropertiesPanel, {
        global: { plugins: [pinia] },
      })
      await wrapper.vm.$nextTick()

      const saveStateSpy = vi.spyOn(store, 'saveState')

      const input = wrapper.find('input[title^="Text size for Top Left"]')
      expect(input.exists()).toBe(true)

      ;(input.element as HTMLInputElement).value = '5'
      await input.trigger('input')
      await input.trigger('blur')
      await wrapper.vm.$nextTick()

      expect(key.textSize[0]).toBe(5)
      expect(saveStateSpy).toHaveBeenCalledTimes(1)
    })

    it('previews the shared Default Text Size (not the field min) while the typed value is invalid', async () => {
      // Regression test: an invalid per-label value must render as the actual
      // default (key.default.textSize, normally 3) — not the field's unrelated
      // min of 1, which is just the lower bound of the allowed range.
      const key = new Key()
      store.keys = [key]
      store.selectedKeys = [key]

      const wrapper = mount(KeyPropertiesPanel, {
        global: { plugins: [pinia] },
      })
      await wrapper.vm.$nextTick()

      expect(key.default.textSize).toBe(3)

      const input = wrapper.find('input[title^="Text size for Top Left"]')
      expect(input.exists()).toBe(true)

      ;(input.element as HTMLInputElement).value = '15' // out of range (max is 9)
      await input.trigger('input')
      await wrapper.vm.$nextTick()

      expect(key.textSize[0]).toBe(3)
    })
  })

  describe('Position field invalid/clear default', () => {
    it('falls back to 0, not the field minimum, when X is cleared', async () => {
      const key = new Key()
      key.x = 5
      store.keys = [key]
      store.selectedKeys = [key]

      const wrapper = mount(KeyPropertiesPanel, {
        global: { plugins: [pinia] },
      })
      await wrapper.vm.$nextTick()

      const input = wrapper.find('input[title="X Position"]')
      expect(input.exists()).toBe(true)

      ;(input.element as HTMLInputElement).value = ''
      await input.trigger('input')
      await input.trigger('blur')
      await wrapper.vm.$nextTick()

      // Should default to 0, not the field's min (-100)
      expect(key.x).toBe(0)
    })

    it('falls back to 1, not the field minimum, when Width is cleared', async () => {
      const key = new Key()
      key.width = 2
      store.keys = [key]
      store.selectedKeys = [key]

      const wrapper = mount(KeyPropertiesPanel, {
        global: { plugins: [pinia] },
      })
      await wrapper.vm.$nextTick()

      const input = wrapper.find('input[title="Width"]')
      expect(input.exists()).toBe(true)

      ;(input.element as HTMLInputElement).value = ''
      await input.trigger('input')
      await input.trigger('blur')
      await wrapper.vm.$nextTick()

      // Should default to 1 (a standard 1U key), not the field's min (0.25)
      expect(key.width).toBe(1)
    })

    it('falls back to 3, not the field minimum, when Default Text Size is cleared', async () => {
      const key = new Key()
      key.default.textSize = 5
      store.keys = [key]
      store.selectedKeys = [key]

      const wrapper = mount(KeyPropertiesPanel, {
        global: { plugins: [pinia] },
      })
      await wrapper.vm.$nextTick()

      const input = wrapper.find('input[title="Default text size for all labels"]')
      expect(input.exists()).toBe(true)

      ;(input.element as HTMLInputElement).value = ''
      await input.trigger('input')
      await input.trigger('blur')
      await wrapper.vm.$nextTick()

      // Should default to 3 (the key model's actual default text size), not the field's min (1)
      expect(key.default.textSize).toBe(3)
    })
  })

  describe('Position field invalid input reverts (undo regression)', () => {
    // Invalid/out-of-range text must never touch the key model — the field
    // stays flagged but the live value doesn't change — and saveState() must
    // not fire for a discarded edit that never actually changed anything.
    it('keeps X at its original value throughout typing invalid text, and reverts cleanly on blur', async () => {
      const key = new Key()
      key.x = 5
      store.keys = [key]
      store.selectedKeys = [key]

      const wrapper = mount(KeyPropertiesPanel, { global: { plugins: [pinia] } })
      await wrapper.vm.$nextTick()

      const saveStateSpy = vi.spyOn(store, 'saveState')

      const input = wrapper.find('input[title="X Position"]')
      ;(input.element as HTMLInputElement).value = 'abc'
      await input.trigger('input')

      expect(key.x).toBe(5)
      expect(input.classes()).toContain('is-invalid')

      await input.trigger('blur')
      await wrapper.vm.$nextTick()

      expect(key.x).toBe(5)
      expect((input.element as HTMLInputElement).value).toBe('5')
      expect(input.classes()).not.toContain('is-invalid')
      expect(saveStateSpy).not.toHaveBeenCalled()
    })

    it('keeps Width at its original value throughout typing an out-of-range value, and reverts cleanly on blur', async () => {
      const key = new Key()
      key.width = 2
      store.keys = [key]
      store.selectedKeys = [key]

      const wrapper = mount(KeyPropertiesPanel, { global: { plugins: [pinia] } })
      await wrapper.vm.$nextTick()

      const saveStateSpy = vi.spyOn(store, 'saveState')

      const input = wrapper.find('input[title="Width"]')
      ;(input.element as HTMLInputElement).value = '999'
      await input.trigger('input')

      expect(key.width).toBe(2)

      await input.trigger('blur')
      await wrapper.vm.$nextTick()

      expect(key.width).toBe(2)
      expect(saveStateSpy).not.toHaveBeenCalled()
    })

    it('keeps Default Text Size at its original value throughout typing invalid text, despite its one-way binding, and reverts cleanly on blur', async () => {
      // Uses :model-value, not v-model — distinct code path from X/Width above.
      const key = new Key()
      key.default.textSize = 5
      store.keys = [key]
      store.selectedKeys = [key]

      const wrapper = mount(KeyPropertiesPanel, { global: { plugins: [pinia] } })
      await wrapper.vm.$nextTick()

      const saveStateSpy = vi.spyOn(store, 'saveState')

      const input = wrapper.find('input[title="Default text size for all labels"]')
      ;(input.element as HTMLInputElement).value = 'abc'
      await input.trigger('input')

      expect(key.default.textSize).toBe(5)

      await input.trigger('blur')
      await wrapper.vm.$nextTick()

      expect(key.default.textSize).toBe(5)
      expect(saveStateSpy).not.toHaveBeenCalled()
    })
  })

  describe('Key Color / Text Color validation', () => {
    it('does not push invalid text into the key model while typing, and flags the field invalid', async () => {
      const key = new Key()
      key.color = '#123456'
      store.keys = [key]
      store.selectedKeys = [key]

      const wrapper = mount(KeyPropertiesPanel, { global: { plugins: [pinia] } })
      await wrapper.vm.$nextTick()

      const input = wrapper.find('input[title="Key Color"]')
      expect(input.exists()).toBe(true)

      ;(input.element as HTMLInputElement).value = 'zzz'
      await input.trigger('input')
      await wrapper.vm.$nextTick()

      // Invalid text must not corrupt the rendered key's color
      expect(key.color).toBe('#123456')
      expect(input.classes()).toContain('is-invalid')
      expect(input.attributes('aria-invalid')).toBe('true')
    })

    it('updates the key color live while typing a valid hex value, before blur', async () => {
      const key = new Key()
      key.color = '#123456'
      store.keys = [key]
      store.selectedKeys = [key]

      const wrapper = mount(KeyPropertiesPanel, { global: { plugins: [pinia] } })
      await wrapper.vm.$nextTick()

      const input = wrapper.find('input[title="Key Color"]')
      ;(input.element as HTMLInputElement).value = '#abcdef'
      await input.trigger('input')
      await wrapper.vm.$nextTick()

      expect(key.color).toBe('#abcdef')
      expect(input.classes()).not.toContain('is-invalid')
    })

    it("discards an invalid typed color on commit, reverting the field to the key's actual color", async () => {
      const key = new Key()
      key.color = '#123456'
      store.keys = [key]
      store.selectedKeys = [key]

      const wrapper = mount(KeyPropertiesPanel, { global: { plugins: [pinia] } })
      await wrapper.vm.$nextTick()

      const saveStateSpy = vi.spyOn(store, 'saveState')

      const input = wrapper.find('input[title="Key Color"]')
      ;(input.element as HTMLInputElement).value = 'zzz'
      await input.trigger('input')
      // Native text inputs fire 'change' on blur when the value has changed
      await input.trigger('change')
      await wrapper.vm.$nextTick()

      expect(key.color).toBe('#123456')
      expect((input.element as HTMLInputElement).value).toBe('#123456')
      expect(input.classes()).not.toContain('is-invalid')
      expect(saveStateSpy).not.toHaveBeenCalled()
    })

    it('commits a valid typed text color on blur without pressing Enter', async () => {
      const key = new Key()
      store.keys = [key]
      store.selectedKeys = [key]

      const wrapper = mount(KeyPropertiesPanel, { global: { plugins: [pinia] } })
      await wrapper.vm.$nextTick()

      const saveStateSpy = vi.spyOn(store, 'saveState')

      const input = wrapper.find('input[title="Text Color"]')
      ;(input.element as HTMLInputElement).value = '#ff00ff'
      await input.trigger('input')
      await input.trigger('change')
      await wrapper.vm.$nextTick()

      expect(key.default.textColor).toBe('#ff00ff')
      expect(saveStateSpy).toHaveBeenCalledTimes(1)
    })
  })

  describe('layout preview mode disabling', () => {
    it('fieldset is disabled in preview mode even when keys are selected', async () => {
      store.addKey()
      const wrapper = mount(KeyPropertiesPanel, {
        global: { plugins: [pinia] },
      })
      await wrapper.vm.$nextTick()

      // Fieldset should be enabled with a key selected
      const fieldset = wrapper.find('fieldset')
      expect(fieldset.attributes('disabled')).toBeUndefined()

      // Enter preview mode
      store.setDisplayLayoutChoices(new Map([[0, 1]]))
      await wrapper.vm.$nextTick()

      // Fieldset should now be disabled
      expect(fieldset.attributes('disabled')).toBeDefined()
    })
  })

  describe('Character Picker Integration', () => {
    it('reports the focused top-label index and cursor position on focus', async () => {
      store.addKey()
      const wrapper = mount(KeyPropertiesPanel, { global: { plugins: [pinia] } })
      await wrapper.vm.$nextTick()

      const characterPickerStore = useCharacterPickerStore()

      const topGrid = wrapper.get('[data-testid="labels-grid"]')
      const input = topGrid.get('input[title="Top Left"]')
      const inputEl = input.element as HTMLInputElement
      inputEl.value = 'ab'
      inputEl.setSelectionRange(1, 1)

      await input.trigger('focus')

      expect(characterPickerStore.activeLabelIndex).toBe(0)
      expect(characterPickerStore.activeCursorPos).toBe(1)
    })

    it('reports the focused front-label index (9-11), distinct from the top-label grid', async () => {
      store.addKey()
      const wrapper = mount(KeyPropertiesPanel, { global: { plugins: [pinia] } })
      await wrapper.vm.$nextTick()

      const characterPickerStore = useCharacterPickerStore()

      // Front labels reuse the top-labels' "Top Left"/"Top Center"/"Top Right"
      // titles, so scope by the second `.labels-grid` container to reach index 9.
      const frontGrid = wrapper.findAll('.labels-grid')[1]
      expect(frontGrid).toBeDefined()
      const input = frontGrid!.get('input[title="Top Left"]')
      const inputEl = input.element as HTMLInputElement
      inputEl.value = 'xyz'
      inputEl.setSelectionRange(2, 2)

      await input.trigger('focus')

      expect(characterPickerStore.activeLabelIndex).toBe(9)
      expect(characterPickerStore.activeCursorPos).toBe(2)
    })

    it('updates the cursor position on keyup without changing the active index', async () => {
      store.addKey()
      const wrapper = mount(KeyPropertiesPanel, { global: { plugins: [pinia] } })
      await wrapper.vm.$nextTick()

      const characterPickerStore = useCharacterPickerStore()

      const topGrid = wrapper.get('[data-testid="labels-grid"]')
      const input = topGrid.get('input[title="Top Center"]')
      const inputEl = input.element as HTMLInputElement
      inputEl.value = 'hello'
      inputEl.setSelectionRange(5, 5)

      await input.trigger('keyup')

      expect(characterPickerStore.activeLabelIndex).toBe(1)
      expect(characterPickerStore.activeCursorPos).toBe(5)
    })
  })
})
