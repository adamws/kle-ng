import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import CustomColorPicker from '../CustomColorPicker.vue'
import * as recentlyUsedColorsModule from '../../utils/recently-used-colors'

// Mock CustomNumberInput
vi.mock('../CustomNumberInput.vue', () => ({
  default: {
    name: 'CustomNumberInput',
    props: ['modelValue', 'min', 'max', 'step', 'size'],
    emits: ['update:modelValue'],
    template: `
      <input
        :value="modelValue"
        @input="$emit('update:modelValue', parseInt($event.target.value) || 0)"
        type="number"
        :min="min"
        :max="max"
        data-testid="custom-number-input"
      />
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

describe('CustomColorPicker', () => {
  let wrapper: VueWrapper

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks()
    mockRecentlyUsedColorsManager.getRecentlyUsedColors.mockReturnValue([])

    wrapper = mount(CustomColorPicker, {
      props: {
        modelValue: '#FF0000',
      },
    })
  })

  describe('Component Structure', () => {
    it('renders correctly', () => {
      expect(wrapper.find('.custom-color-picker').exists()).toBe(true)
      expect(wrapper.find('.saturation-picker').exists()).toBe(true)
      expect(wrapper.find('.sketch-controls').exists()).toBe(true)
      expect(wrapper.find('.color-inputs').exists()).toBe(true)
      expect(wrapper.find('.color-presets').exists()).toBe(true)
    })

    it('renders saturation picker canvas', () => {
      const canvas = wrapper.find('.saturation-canvas')
      expect(canvas.exists()).toBe(true)
      expect(canvas.attributes('width')).toBe('250')
      expect(canvas.attributes('height')).toBe('150')
    })

    it('renders hue slider', () => {
      expect(wrapper.find('.hue-slider').exists()).toBe(true)
      expect(wrapper.find('.hue-pointer').exists()).toBe(true)
    })

    it('renders color preview', () => {
      expect(wrapper.find('.sketch-color-wrap').exists()).toBe(true)
      expect(wrapper.find('.sketch-active-color').exists()).toBe(true)
    })

    it('renders input fields', () => {
      expect(wrapper.find('input[placeholder="000000"]').exists()).toBe(true)
      expect(wrapper.findAllComponents({ name: 'CustomNumberInput' })).toHaveLength(3)
    })

    it('renders 24 preset colors', () => {
      const presetColors = wrapper.findAll('.preset-color')
      expect(presetColors).toHaveLength(24)
    })
  })

  describe('Props and Initial State', () => {
    it('initializes with correct color value', () => {
      const hexInput = wrapper.find('input[placeholder="000000"]')
      expect((hexInput.element as HTMLInputElement).value).toBe('FF0000')
    })

    it('updates when modelValue prop changes', async () => {
      await wrapper.setProps({ modelValue: '#00FF00' })

      const hexInput = wrapper.find('input[placeholder="000000"]')
      expect((hexInput.element as HTMLInputElement).value).toBe('00FF00')
    })

    it('initializes RGB inputs correctly', () => {
      const rgbInputs = wrapper.findAllComponents({ name: 'CustomNumberInput' })
      const rInput = rgbInputs[0]
      expect(rInput).toBeDefined()
      expect(rInput!.props('modelValue')).toBe(255) // R
      const gInput = rgbInputs[1]
      expect(gInput).toBeDefined()
      expect(gInput!.props('modelValue')).toBe(0) // G
      const bInput = rgbInputs[2]
      expect(bInput).toBeDefined()
      expect(bInput!.props('modelValue')).toBe(0) // B
    })
  })

  describe('Hex Input', () => {
    it('validates hex input correctly', async () => {
      const hexInput = wrapper.find('input[placeholder="000000"]')

      // Valid hex input
      await hexInput.setValue('00FF00')
      await hexInput.trigger('input')

      expect(wrapper.emitted('update:modelValue')).toBeTruthy()
      expect(wrapper.emitted('update:modelValue')![0]).toEqual(['#00ff00'])
    })

    it('handles invalid hex input', async () => {
      const hexInput = wrapper.find('input[placeholder="000000"]')

      // Invalid characters should be filtered
      await hexInput.setValue('GGHHII')
      await hexInput.trigger('input')

      // Should filter out invalid characters
      expect((hexInput.element as HTMLInputElement).value).toBe('')
    })

    it('handles partial hex input', async () => {
      const hexInput = wrapper.find('input[placeholder="000000"]')

      // Partial hex (less than 6 characters) should not emit
      await hexInput.setValue('FF')
      await hexInput.trigger('input')

      expect((hexInput.element as HTMLInputElement).value).toBe('FF')
      // Should not emit update for incomplete hex
    })

    it('removes # prefix from input', async () => {
      const hexInput = wrapper.find('input[placeholder="000000"]')

      await hexInput.setValue('#FF0000')
      await hexInput.trigger('input')

      expect((hexInput.element as HTMLInputElement).value).toBe('FF0000')
    })

    it('limits input to 6 characters', async () => {
      const hexInput = wrapper.find('input[placeholder="000000"]')

      await hexInput.setValue('FF0000EXTRA')
      await hexInput.trigger('input')

      expect((hexInput.element as HTMLInputElement).value).toBe('FF0000')
    })
  })

  describe('RGB Inputs', () => {
    it('updates color when R value changes', async () => {
      const rgbInputs = wrapper.findAllComponents({ name: 'CustomNumberInput' })
      const rInput = rgbInputs[0]
      expect(rInput).toBeDefined()

      await rInput!.vm.$emit('update:modelValue', 128)

      expect(wrapper.emitted('update:modelValue')).toBeTruthy()
      expect(wrapper.emitted('update:modelValue')![0]).toEqual(['#800000'])
    })

    it('updates color when G value changes', async () => {
      const rgbInputs = wrapper.findAllComponents({ name: 'CustomNumberInput' })
      const gInput = rgbInputs[1]
      expect(gInput).toBeDefined()

      await gInput!.vm.$emit('update:modelValue', 128)

      expect(wrapper.emitted('update:modelValue')).toBeTruthy()
      expect(wrapper.emitted('update:modelValue')![0]).toEqual(['#ff8000'])
    })

    it('updates color when B value changes', async () => {
      const rgbInputs = wrapper.findAllComponents({ name: 'CustomNumberInput' })
      const bInput = rgbInputs[2]
      expect(bInput).toBeDefined()

      await bInput!.vm.$emit('update:modelValue', 128)

      expect(wrapper.emitted('update:modelValue')).toBeTruthy()
      expect(wrapper.emitted('update:modelValue')![0]).toEqual(['#ff0080'])
    })

    it('handles undefined RGB values', async () => {
      const rgbInputs = wrapper.findAllComponents({ name: 'CustomNumberInput' })
      const rInput = rgbInputs[0]
      expect(rInput).toBeDefined()

      await rInput!.vm.$emit('update:modelValue', undefined)

      // Should default to 0 for undefined values
      expect(wrapper.emitted('update:modelValue')).toBeTruthy()
      expect(wrapper.emitted('update:modelValue')![0]).toEqual(['#000000'])
    })
  })

  describe('Preset Colors', () => {
    it('selects preset color correctly', async () => {
      const presetColors = wrapper.findAll('.preset-color')
      const secondPreset = presetColors[1]
      expect(secondPreset).toBeDefined()

      // Click on second preset color (orange)
      await secondPreset!.trigger('click')

      expect(wrapper.emitted('update:modelValue')).toBeTruthy()
      // The color goes through HSV conversion which may cause slight variations due to rounding
      const emittedEvents = wrapper.emitted('update:modelValue')
      expect(emittedEvents).toBeDefined()
      const firstEvent = emittedEvents![0]
      expect(firstEvent).toBeDefined()
      const emittedColor = firstEvent![0] as string
      expect(emittedColor.toLowerCase()).toBe('#f5a422')
    })

    it('updates all inputs when preset is selected', async () => {
      const presetColors = wrapper.findAll('.preset-color')
      const greenPreset = presetColors[4]
      expect(greenPreset).toBeDefined()

      // Click on green preset
      await greenPreset!.trigger('click')
      await wrapper.vm.$nextTick()

      const hexInput = wrapper.find('input[placeholder="000000"]')
      expect((hexInput.element as HTMLInputElement).value).toBe('7ED321')
    })
  })

  describe('Saturation Picker', () => {
    it('handles mouse down on saturation canvas', async () => {
      const canvas = wrapper.find('.saturation-canvas')

      // Mock getBoundingClientRect
      canvas.element.getBoundingClientRect = vi.fn(() => ({
        left: 0,
        top: 0,
        width: 250,
        height: 150,
        x: 0,
        y: 0,
        right: 250,
        bottom: 150,
        toJSON: vi.fn(),
      }))

      await canvas.trigger('mousedown', { clientX: 125, clientY: 75 })

      expect(wrapper.emitted('update:modelValue')).toBeTruthy()
    })
  })

  describe('Hue Slider', () => {
    it('handles mouse down on hue slider', async () => {
      const hueSlider = wrapper.find('.hue-slider')

      // Mock getBoundingClientRect
      hueSlider.element.getBoundingClientRect = vi.fn(() => ({
        left: 0,
        top: 0,
        width: 250,
        height: 10,
        x: 0,
        y: 0,
        right: 250,
        bottom: 10,
        toJSON: vi.fn(),
      }))

      await hueSlider.trigger('mousedown', { clientX: 125, clientY: 5 })

      expect(wrapper.emitted('update:modelValue')).toBeTruthy()
    })
  })

  describe('Color Preview', () => {
    it('displays current color in preview', () => {
      const colorPreview = wrapper.find('.sketch-active-color')
      const style = colorPreview.attributes('style')

      expect(style).toContain('background: rgb(255, 0, 0)')
    })

    it('updates preview when color changes', async () => {
      await wrapper.setProps({ modelValue: '#00FF00' })

      const colorPreview = wrapper.find('.sketch-active-color')
      const style = colorPreview.attributes('style')

      expect(style).toContain('background: rgb(0, 255, 0)')
    })
  })

  describe('External Updates', () => {
    it('synchronizes all inputs when external prop changes', async () => {
      await wrapper.setProps({ modelValue: '#8040C0' })
      await wrapper.vm.$nextTick()

      const hexInput = wrapper.find('input[placeholder="000000"]')
      expect((hexInput.element as HTMLInputElement).value).toBe('8040C0')

      const rgbInputs = wrapper.findAllComponents({ name: 'CustomNumberInput' })
      const rInput = rgbInputs[0]
      expect(rInput).toBeDefined()
      expect(rInput!.props('modelValue')).toBe(128) // R
      const gInput = rgbInputs[1]
      expect(gInput).toBeDefined()
      expect(gInput!.props('modelValue')).toBe(64) // G
      const bInput = rgbInputs[2]
      expect(bInput).toBeDefined()
      expect(bInput!.props('modelValue')).toBe(192) // B
    })
  })

  describe('Recently Used Colors', () => {
    it('does not render recently used colors section when empty', () => {
      expect(wrapper.find('.recently-used-colors').exists()).toBe(false)
    })

    it('renders recently used colors section when colors are available', async () => {
      mockRecentlyUsedColorsManager.getRecentlyUsedColors.mockReturnValue(['#ff0000', '#00ff00'])

      // Remount to trigger onMounted
      wrapper = mount(CustomColorPicker, {
        props: {
          modelValue: '#FF0000',
        },
      })

      await wrapper.vm.$nextTick()

      expect(wrapper.find('.recently-used-colors').exists()).toBe(true)
      expect(wrapper.find('.recently-used-header').text()).toBe('Recently used colors')
      expect(wrapper.find('.recently-used-grid').findAll('.recently-used-color')).toHaveLength(2)
    })

    it('renders recently used colors with correct styles', async () => {
      mockRecentlyUsedColorsManager.getRecentlyUsedColors.mockReturnValue(['#ff0000', '#00ff00'])

      wrapper = mount(CustomColorPicker, {
        props: {
          modelValue: '#FF0000',
        },
      })

      await wrapper.vm.$nextTick()

      const lastUsedColors = wrapper.find('.recently-used-grid').findAll('.recently-used-color')
      const firstUsedColor = lastUsedColors[0]
      expect(firstUsedColor).toBeDefined()
      expect(firstUsedColor!.attributes('style')).toContain('background-color: rgb(255, 0, 0)')
      const secondUsedColor = lastUsedColors[1]
      expect(secondUsedColor).toBeDefined()
      expect(secondUsedColor!.attributes('style')).toContain('background-color: rgb(0, 255, 0)')
    })

    it('selects last used color when clicked', async () => {
      mockRecentlyUsedColorsManager.getRecentlyUsedColors.mockReturnValue(['#ff0000', '#00ff00'])

      wrapper = mount(CustomColorPicker, {
        props: {
          modelValue: '#000000',
        },
      })

      await wrapper.vm.$nextTick()

      const lastUsedColors = wrapper.find('.recently-used-grid').findAll('.recently-used-color')
      const secondUsedColor = lastUsedColors[1]
      expect(secondUsedColor).toBeDefined()
      await secondUsedColor!.trigger('click')

      expect(wrapper.emitted('update:modelValue')).toBeTruthy()
      expect(wrapper.emitted('update:modelValue')![0]).toEqual(['#00ff00'])
    })

    it('does not add color to last used during color changes', async () => {
      const hexInput = wrapper.find('input[placeholder="000000"]')

      await hexInput.setValue('00FF00')
      await hexInput.trigger('input')

      expect(mockRecentlyUsedColorsManager.addColor).not.toHaveBeenCalled()
    })

    it('does not add color to last used when preset is selected', async () => {
      const presetColors = wrapper.findAll('.preset-color')
      const secondPreset = presetColors[1]
      expect(secondPreset).toBeDefined()

      await secondPreset!.trigger('click')

      expect(mockRecentlyUsedColorsManager.addColor).not.toHaveBeenCalled()
    })

    it('does not add color to last used when RGB input changes', async () => {
      const rgbInputs = wrapper.findAllComponents({ name: 'CustomNumberInput' })
      const rInput = rgbInputs[0]
      expect(rInput).toBeDefined()

      await rInput!.vm.$emit('update:modelValue', 128)

      expect(mockRecentlyUsedColorsManager.addColor).not.toHaveBeenCalled()
    })

    it('loads recently used colors on mount', () => {
      expect(mockRecentlyUsedColorsManager.getRecentlyUsedColors).toHaveBeenCalled()
    })

    it('exposes refreshRecentlyUsedColors method', () => {
      const vm = wrapper.vm as { refreshRecentlyUsedColors?: () => void }
      expect(vm.refreshRecentlyUsedColors).toBeDefined()
      expect(typeof vm.refreshRecentlyUsedColors).toBe('function')
    })

    it('refreshes recently used colors when method is called', () => {
      vi.clearAllMocks()
      const vm = wrapper.vm as unknown as { refreshRecentlyUsedColors: () => void }
      vm.refreshRecentlyUsedColors()
      expect(mockRecentlyUsedColorsManager.getRecentlyUsedColors).toHaveBeenCalled()
    })
  })
})
