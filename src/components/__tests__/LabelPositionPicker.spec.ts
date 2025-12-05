import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import LabelPositionPicker from '../LabelPositionPicker.vue'

describe('LabelPositionPicker', () => {
  it('renders all 12 positions with correct labels', () => {
    const wrapper = mount(LabelPositionPicker, {
      props: {
        modelValue: null,
        idPrefix: 'test',
      },
    })

    const expectedLabels = ['TL', 'TC', 'TR', 'CL', 'CC', 'CR', 'BL', 'BC', 'BR', 'FL', 'FC', 'FR']
    const labels = wrapper.findAll('.position-label')

    expect(labels).toHaveLength(12)
    expectedLabels.forEach((label, index) => {
      expect(labels[index]?.text()).toBe(label)
    })
  })

  it('generates unique IDs using idPrefix', () => {
    const wrapper = mount(LabelPositionPicker, {
      props: {
        modelValue: null,
        idPrefix: 'custom-prefix',
      },
    })

    const inputs = wrapper.findAll('.position-radio')
    expect(inputs).toHaveLength(12)

    inputs.forEach((input, index) => {
      expect(input?.attributes('id')).toBe(`custom-prefix-${index}`)
    })
  })

  it('shows checked state for modelValue', () => {
    const wrapper = mount(LabelPositionPicker, {
      props: {
        modelValue: 4, // Center Center
        idPrefix: 'test',
      },
    })

    const inputs = wrapper.findAll('.position-radio')
    expect((inputs[4]?.element as HTMLInputElement).checked).toBe(true)

    // Other positions should not be checked
    const otherInputs = inputs.filter((_, index) => index !== 4)
    otherInputs.forEach((input) => {
      expect((input?.element as HTMLInputElement).checked).toBe(false)
    })
  })

  it('emits update:modelValue when position is selected', async () => {
    const wrapper = mount(LabelPositionPicker, {
      props: {
        modelValue: null,
        idPrefix: 'test',
      },
    })

    const inputs = wrapper.findAll('.position-radio')
    await inputs[2]?.setValue(true) // Select TR (position 2)

    expect(wrapper.emitted('update:modelValue')).toBeTruthy()
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([2])
  })

  it('applies correct size class', () => {
    const mediumWrapper = mount(LabelPositionPicker, {
      props: {
        modelValue: null,
        idPrefix: 'test',
        size: 'medium',
      },
    })

    expect(mediumWrapper.find('.label-position-picker').classes()).toContain('size-medium')

    const smallWrapper = mount(LabelPositionPicker, {
      props: {
        modelValue: null,
        idPrefix: 'test',
        size: 'small',
      },
    })

    expect(smallWrapper.find('.label-position-picker').classes()).toContain('size-small')
  })

  it('defaults to medium size when size prop is not provided', () => {
    const wrapper = mount(LabelPositionPicker, {
      props: {
        modelValue: null,
        idPrefix: 'test',
      },
    })

    expect(wrapper.find('.label-position-picker').classes()).toContain('size-medium')
  })

  it('respects disabled prop', async () => {
    const wrapper = mount(LabelPositionPicker, {
      props: {
        modelValue: null,
        idPrefix: 'test',
        disabled: true,
      },
    })

    const inputs = wrapper.findAll('.position-radio')
    inputs.forEach((input) => {
      expect(input?.attributes('disabled')).toBeDefined()
    })

    // Try to select a position
    await inputs[0]?.setValue(true)

    // Should not emit when disabled
    expect(wrapper.emitted('update:modelValue')).toBeFalsy()
  })

  it('handles null modelValue correctly', () => {
    const wrapper = mount(LabelPositionPicker, {
      props: {
        modelValue: null,
        idPrefix: 'test',
      },
    })

    const inputs = wrapper.findAll('.position-radio')
    inputs.forEach((input) => {
      expect((input?.element as HTMLInputElement).checked).toBe(false)
    })
  })

  it('updates checked state when modelValue changes', async () => {
    const wrapper = mount(LabelPositionPicker, {
      props: {
        modelValue: 0,
        idPrefix: 'test',
      },
    })

    let inputs = wrapper.findAll('.position-radio')
    expect((inputs[0]?.element as HTMLInputElement).checked).toBe(true)

    await wrapper.setProps({ modelValue: 5 })

    inputs = wrapper.findAll('.position-radio')
    expect((inputs[0]?.element as HTMLInputElement).checked).toBe(false)
    expect((inputs[5]?.element as HTMLInputElement).checked).toBe(true)
  })

  it('renders with proper grid layout structure', () => {
    const wrapper = mount(LabelPositionPicker, {
      props: {
        modelValue: null,
        idPrefix: 'test',
      },
    })

    expect(wrapper.find('.key-outer').exists()).toBe(true)
    expect(wrapper.find('.key-bevel').exists()).toBe(true)
    expect(wrapper.find('.key-inner').exists()).toBe(true)
    expect(wrapper.find('.keylabels').exists()).toBe(true)

    // Check that positions have correct grid classes
    for (let i = 0; i < 12; i++) {
      expect(wrapper.find(`.keylabel${i}`).exists()).toBe(true)
    }
  })
})
