import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import ColorPicker from '../ColorPicker.vue'
import * as recentlyUsedColorsModule from '../../utils/recently-used-colors'

// Mock CustomColorPicker
vi.mock('../CustomColorPicker.vue', () => ({
  default: {
    name: 'CustomColorPicker',
    props: ['modelValue'],
    emits: ['update:modelValue'],
    setup() {
      return {
        refreshRecentlyUsedColors: vi.fn(),
      }
    },
    template: `
      <div class="custom-color-picker-mock">
        <button
          @click="$emit('update:modelValue', '#ff0000')"
          data-testid="mock-color-change"
        >
          Change Color
        </button>
      </div>
    `,
  },
}))

// Mock recently used colors manager
vi.mock('../../utils/recently-used-colors', () => ({
  recentlyUsedColorsManager: {
    getRecentlyUsedColors: vi.fn(() => []),
    addColor: vi.fn(),
    clear: vi.fn(),
  },
}))

// Get references to the mocked functions
const mockRecentlyUsedColorsManager = vi.mocked(recentlyUsedColorsModule.recentlyUsedColorsManager)

describe('ColorPicker', () => {
  let wrapper: VueWrapper

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks()

    wrapper = mount(ColorPicker, {
      props: {
        modelValue: '#000000',
      },
    })
  })

  describe('Recently Used Colors Tracking', () => {
    it('does not track color during selection', async () => {
      // Open the picker
      await wrapper.find('.color-picker-button').trigger('click')

      // Simulate color change in CustomColorPicker
      await wrapper.find('[data-testid="mock-color-change"]').trigger('click')

      // Should not add to recently used colors yet
      expect(mockRecentlyUsedColorsManager.addColor).not.toHaveBeenCalled()
    })

    it('tracks color when OK button is clicked', async () => {
      // Open the picker
      await wrapper.find('.color-picker-button').trigger('click')

      // Simulate color change
      await wrapper.find('[data-testid="mock-color-change"]').trigger('click')

      // Click OK button
      await wrapper.find('.btn-primary').trigger('click')

      // Should add to recently used colors
      expect(mockRecentlyUsedColorsManager.addColor).toHaveBeenCalledWith('#ff0000')
    })

    it('does not track color when Cancel button is clicked', async () => {
      // Open the picker
      await wrapper.find('.color-picker-button').trigger('click')

      // Simulate color change
      await wrapper.find('[data-testid="mock-color-change"]').trigger('click')

      // Click Cancel button
      await wrapper.find('.btn-secondary').trigger('click')

      // Should not add to recently used colors
      expect(mockRecentlyUsedColorsManager.addColor).not.toHaveBeenCalled()
    })

    it('does not track color when clicking outside (auto-cancel)', async () => {
      // Open the picker
      await wrapper.find('.color-picker-button').trigger('click')

      // Simulate color change
      await wrapper.find('[data-testid="mock-color-change"]').trigger('click')

      // Simulate clicking outside
      const clickEvent = new Event('click')
      Object.defineProperty(clickEvent, 'target', {
        value: document.body,
        enumerable: true,
      })
      document.dispatchEvent(clickEvent)

      await wrapper.vm.$nextTick()

      // Should not add to recently used colors (cancels changes)
      expect(mockRecentlyUsedColorsManager.addColor).not.toHaveBeenCalled()
    })

    it('tracks color when pressing Enter key', async () => {
      // Open the picker
      await wrapper.find('.color-picker-button').trigger('click')

      // Simulate color change
      await wrapper.find('[data-testid="mock-color-change"]').trigger('click')

      // Simulate Enter key press
      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' })
      document.dispatchEvent(enterEvent)

      await wrapper.vm.$nextTick()

      // Should add to recently used colors
      expect(mockRecentlyUsedColorsManager.addColor).toHaveBeenCalledWith('#ff0000')
    })

    it('does not track color when pressing Escape key', async () => {
      // Open the picker
      await wrapper.find('.color-picker-button').trigger('click')

      // Simulate color change
      await wrapper.find('[data-testid="mock-color-change"]').trigger('click')

      // Simulate Escape key press
      const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' })
      document.dispatchEvent(escapeEvent)

      await wrapper.vm.$nextTick()

      // Should not add to recently used colors
      expect(mockRecentlyUsedColorsManager.addColor).not.toHaveBeenCalled()
    })

    it('refreshes CustomColorPicker recently used colors after accepting', async () => {
      // Open the picker
      await wrapper.find('.color-picker-button').trigger('click')

      // Get the CustomColorPicker component ref
      const customColorPicker = wrapper.findComponent({ name: 'CustomColorPicker' })

      // Simulate color change
      await wrapper.find('[data-testid="mock-color-change"]').trigger('click')

      // Click OK button
      await wrapper.find('.btn-primary').trigger('click')

      // Should have called refreshRecentlyUsedColors on the CustomColorPicker
      expect(customColorPicker.vm.refreshRecentlyUsedColors).toHaveBeenCalled()
    })
  })

  describe('Component Behavior', () => {
    it('opens and closes picker correctly', async () => {
      expect(wrapper.find('.color-picker-popup').exists()).toBe(false)

      // Open picker
      await wrapper.find('.color-picker-button').trigger('click')
      expect(wrapper.find('.color-picker-popup').exists()).toBe(true)

      // Close with OK
      await wrapper.find('.btn-primary').trigger('click')
      expect(wrapper.find('.color-picker-popup').exists()).toBe(false)
    })

    it('updates color value during selection', async () => {
      // Open the picker
      await wrapper.find('.color-picker-button').trigger('click')

      // Simulate color change
      await wrapper.find('[data-testid="mock-color-change"]').trigger('click')

      // Color value should be updated (check via emitted events)
      expect(wrapper.emitted('update:modelValue')).toBeTruthy()
      expect(wrapper.emitted('update:modelValue')![0]).toEqual(['#ff0000'])
    })

    it('emits events when accepting changes', async () => {
      // Open the picker
      await wrapper.find('.color-picker-button').trigger('click')

      // Simulate color change
      await wrapper.find('[data-testid="mock-color-change"]').trigger('click')

      // Click OK button
      await wrapper.find('.btn-primary').trigger('click')

      // Should emit change and input events
      expect(wrapper.emitted('change')).toBeTruthy()
      expect(wrapper.emitted('input')).toBeTruthy()
      expect(wrapper.emitted('change')![0]).toEqual(['#ff0000'])
      expect(wrapper.emitted('input')![0]).toEqual(['#ff0000'])
    })

    it('restores original value when canceling', async () => {
      const originalColor = '#000000'

      // Open the picker
      await wrapper.find('.color-picker-button').trigger('click')

      // Simulate color change
      await wrapper.find('[data-testid="mock-color-change"]').trigger('click')

      // Click Cancel button
      await wrapper.find('.btn-secondary').trigger('click')

      // Should emit events with original value
      expect(wrapper.emitted('update:modelValue')).toBeTruthy()
      expect(wrapper.emitted('change')).toBeTruthy()
      expect(wrapper.emitted('input')).toBeTruthy()
      const finalEmissions = wrapper.emitted('change')!
      expect(finalEmissions[finalEmissions.length - 1]).toEqual([originalColor])
    })
  })
})
