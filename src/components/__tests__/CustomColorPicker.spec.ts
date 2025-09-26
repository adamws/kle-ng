import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, VueWrapper } from '@vue/test-utils'
import CustomColorPicker from '../CustomColorPicker.vue'

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

describe('CustomColorPicker', () => {
  let wrapper: VueWrapper

  beforeEach(() => {
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
      expect(rgbInputs[0].props('modelValue')).toBe(255) // R
      expect(rgbInputs[1].props('modelValue')).toBe(0) // G
      expect(rgbInputs[2].props('modelValue')).toBe(0) // B
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

      await rgbInputs[0].vm.$emit('update:modelValue', 128)

      expect(wrapper.emitted('update:modelValue')).toBeTruthy()
      expect(wrapper.emitted('update:modelValue')![0]).toEqual(['#800000'])
    })

    it('updates color when G value changes', async () => {
      const rgbInputs = wrapper.findAllComponents({ name: 'CustomNumberInput' })

      await rgbInputs[1].vm.$emit('update:modelValue', 128)

      expect(wrapper.emitted('update:modelValue')).toBeTruthy()
      expect(wrapper.emitted('update:modelValue')![0]).toEqual(['#ff8000'])
    })

    it('updates color when B value changes', async () => {
      const rgbInputs = wrapper.findAllComponents({ name: 'CustomNumberInput' })

      await rgbInputs[2].vm.$emit('update:modelValue', 128)

      expect(wrapper.emitted('update:modelValue')).toBeTruthy()
      expect(wrapper.emitted('update:modelValue')![0]).toEqual(['#ff0080'])
    })

    it('handles undefined RGB values', async () => {
      const rgbInputs = wrapper.findAllComponents({ name: 'CustomNumberInput' })

      await rgbInputs[0].vm.$emit('update:modelValue', undefined)

      // Should default to 0 for undefined values
      expect(wrapper.emitted('update:modelValue')).toBeTruthy()
      expect(wrapper.emitted('update:modelValue')![0]).toEqual(['#000000'])
    })
  })

  describe('Preset Colors', () => {
    it('selects preset color correctly', async () => {
      const presetColors = wrapper.findAll('.preset-color')

      // Click on second preset color (orange)
      await presetColors[1].trigger('click')

      expect(wrapper.emitted('update:modelValue')).toBeTruthy()
      // The color goes through HSV conversion which may cause slight variations due to rounding
      const emittedColor = wrapper.emitted('update:modelValue')![0][0] as string
      expect(emittedColor.toLowerCase()).toBe('#f5a422')
    })

    it('updates all inputs when preset is selected', async () => {
      const presetColors = wrapper.findAll('.preset-color')

      // Click on green preset
      await presetColors[4].trigger('click')
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
      expect(rgbInputs[0].props('modelValue')).toBe(128) // R
      expect(rgbInputs[1].props('modelValue')).toBe(64) // G
      expect(rgbInputs[2].props('modelValue')).toBe(192) // B
    })
  })
})
