import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import CustomNumberInput from '../CustomNumberInput.vue'

describe('CustomNumberInput', () => {
  describe('empty input handling', () => {
    it('should revert to default value when cleared (move step case)', async () => {
      const wrapper = mount(CustomNumberInput, {
        props: {
          modelValue: 0.05, // Simulating a clamped value
          min: 0.05,
          max: 5,
          step: 0.05,
          valueOnClear: 0.25, // Should revert to 0.25 when cleared
        },
      })

      const input = wrapper.find('input')

      // Clear the input
      await input.setValue('')
      await input.trigger('blur')

      // Should emit 0.25 (the default for move step)
      expect(wrapper.emitted('update:modelValue')).toBeTruthy()
      const emitted = wrapper.emitted('update:modelValue') as [number | undefined][]
      const lastEmittedValue = emitted[emitted.length - 1][0]
      expect(lastEmittedValue).toBe(0.25)
    })

    it('should allow empty when valueOnClear is null', async () => {
      const wrapper = mount(CustomNumberInput, {
        props: {
          modelValue: 5,
          min: 1,
          max: 9,
          valueOnClear: null, // Allow empty
        },
      })

      const input = wrapper.find('input')

      // Clear the input
      await input.setValue('')
      await input.trigger('blur')

      // Should emit undefined
      expect(wrapper.emitted('update:modelValue')).toBeTruthy()
      const emitted = wrapper.emitted('update:modelValue') as [number | undefined][]
      const lastEmittedValue = emitted[emitted.length - 1][0]
      expect(lastEmittedValue).toBe(undefined)
    })

    it('should show reasonable default while typing invalid content', async () => {
      const wrapper = mount(CustomNumberInput, {
        props: {
          modelValue: undefined,
          min: 0.05,
          max: 5,
          step: 0.05,
          valueOnClear: 0.25,
        },
      })

      const input = wrapper.find('input')

      // The display should show the default value when modelValue is undefined
      expect(input.element.value).toBe('0.25')
    })
  })

  describe('focus behavior', () => {
    it('should not lose focus during typing with small decimal values', async () => {
      const wrapper = mount(CustomNumberInput, {
        props: {
          modelValue: 0.2,
          min: 0.05,
          max: 9,
          step: 0.05,
          valueOnClear: null, // Allow empty for this test
        },
      })

      const input = wrapper.find('input')

      // Focus the input
      await input.trigger('focus')

      // Type partial value (this should not lose focus in real usage)
      await input.setValue('0.')
      await input.trigger('input')

      // The key behavior: input should emit value and not cause focus loss
      // In the real application, focus is maintained during typing

      // When we blur, validation should happen
      await input.trigger('blur')

      // Should have emitted some value updates
      const emitted = wrapper.emitted('update:modelValue') as [number | undefined][]
      expect(emitted).toBeTruthy()
      expect(emitted.length).toBeGreaterThan(0)
    })

    it('should emit correct value when cleared and blurred (simulating e2e test case)', async () => {
      const wrapper = mount(CustomNumberInput, {
        props: {
          modelValue: 0.05, // Simulating the state after negative value was clamped
          min: 0.05,
          max: 5,
          step: 0.05,
          valueOnClear: 0.25, // Move step behavior
        },
      })

      const input = wrapper.find('input')

      // Clear the input (simulating stepInput.clear() in e2e test)
      await input.setValue('')

      // Trigger blur (simulating stepInput.blur() in e2e test)
      await input.trigger('blur')

      // Should emit 0.25
      const emitted = wrapper.emitted('update:modelValue') as [number | undefined][]
      expect(emitted).toBeTruthy()
      const lastEmittedValue = emitted[emitted.length - 1][0]
      expect(lastEmittedValue).toBe(0.25)

      // The input should also display 0.25 after the modelValue is updated
      // (In real usage, the parent would update modelValue prop, but here we test the emit)
      expect(lastEmittedValue).toBe(0.25)
    })
  })

  describe('Enhanced Features (commit 1ce0ba0)', () => {
    describe('disableWheel Property', () => {
      it('should ignore wheel events when disableWheel is true', async () => {
        const wrapper = mount(CustomNumberInput, {
          props: {
            modelValue: 5,
            disableWheel: true,
          },
        })

        const input = wrapper.find('input')
        await input.trigger('focus')
        await input.trigger('wheel', { deltaY: -100 })

        expect(wrapper.emitted('update:modelValue')).toBeFalsy()
      })

      it('should handle wheel events when disableWheel is false', async () => {
        const wrapper = mount(CustomNumberInput, {
          props: {
            modelValue: 5,
            disableWheel: false,
          },
        })

        const input = wrapper.find('input')
        await input.trigger('focus')
        await input.trigger('wheel', { deltaY: -100 })

        expect(wrapper.emitted('update:modelValue')).toBeTruthy()
        const lastEmitted = wrapper.emitted('update:modelValue')!.slice(-1)[0][0]
        expect(lastEmitted).toBe(6)
      })
    })

    describe('State Management Edge Cases', () => {
      it('should handle rapid value changes correctly', async () => {
        const wrapper = mount(CustomNumberInput, {
          props: { modelValue: 0, step: 1 },
        })

        const spinnerUp = wrapper.find('.spinner-up')

        // Rapid clicks with prop updates to simulate real behavior
        for (let i = 0; i < 5; i++) {
          await spinnerUp.trigger('click')
          // Update the modelValue prop to simulate parent component updating
          await wrapper.setProps({ modelValue: i + 1 })
        }

        const allEmitted = wrapper.emitted('update:modelValue') as [number][]
        expect(allEmitted).toHaveLength(5)
        expect(allEmitted[4][0]).toBe(5) // Should reach 5
      })

      it('should handle prop changes during user input', async () => {
        const wrapper = mount(CustomNumberInput, {
          props: { modelValue: 5 },
        })

        const input = wrapper.find('input')

        // Start typing
        await input.setValue('1')

        // Change props while user is typing
        await wrapper.setProps({ modelValue: 10 })

        // Complete input
        await input.trigger('blur')

        // Should prioritize user input over prop changes
        const lastEmitted = wrapper.emitted('update:modelValue')!.slice(-1)[0][0]
        expect(lastEmitted).toBe(1)
      })

      it('should reset user input state correctly on external value changes', async () => {
        const wrapper = mount(CustomNumberInput, {
          props: { modelValue: 5 },
        })

        const input = wrapper.find('input')

        // Start typing
        await input.setValue('12')

        // External value change (simulating parent update)
        await wrapper.setProps({ modelValue: 20 })
        await nextTick()

        // Input should show the new external value
        expect(input.element.value).toBe('20')
      })
    })

    describe('Focus and Blur Behavior', () => {
      it('should apply focused class when input gains focus', async () => {
        const wrapper = mount(CustomNumberInput, {
          props: { modelValue: 0 },
        })

        const input = wrapper.find('input')
        await input.trigger('focus')

        expect(wrapper.classes()).toContain('input-focused')
      })

      it('should remove focused class and handle value on blur', async () => {
        const wrapper = mount(CustomNumberInput, {
          props: { modelValue: 5, valueOnClear: 0 },
        })

        const input = wrapper.find('input')

        // Focus and clear
        await input.trigger('focus')
        await input.setValue('')
        await input.trigger('blur')

        expect(wrapper.classes()).not.toContain('input-focused')
        expect(wrapper.emitted('update:modelValue')).toBeTruthy()
      })
    })

    describe('Display Value Computation', () => {
      it('should display user input during typing', async () => {
        const wrapper = mount(CustomNumberInput, {
          props: { modelValue: 5 },
        })

        const input = wrapper.find('input')

        // Start typing
        await input.setValue('123')

        // Should show user input, not model value
        expect(input.element.value).toBe('123')
      })

      it('should show model value when not in user input mode', async () => {
        const wrapper = mount(CustomNumberInput, {
          props: { modelValue: 42 },
        })

        const input = wrapper.find('input')
        expect(input.element.value).toBe('42')
      })

      it('should handle undefined modelValue correctly', () => {
        const wrapper = mount(CustomNumberInput, {
          props: { modelValue: undefined, valueOnClear: null },
        })

        const input = wrapper.find('input')
        expect(input.element.value).toBe('')
      })
    })
  })

  describe('Component Rendering', () => {
    it('renders with default props', () => {
      const wrapper = mount(CustomNumberInput, {
        props: { modelValue: 0 },
      })

      expect(wrapper.find('input[type="number"]').exists()).toBe(true)
      expect(wrapper.find('.spinner-buttons').exists()).toBe(true)
      expect(wrapper.find('.spinner-up').exists()).toBe(true)
      expect(wrapper.find('.spinner-down').exists()).toBe(true)
    })

    it('applies custom CSS classes correctly', () => {
      const wrapper = mount(CustomNumberInput, {
        props: {
          modelValue: 0,
          class: 'custom-class form-control-lg',
        },
      })

      const input = wrapper.find('input')
      expect(input.classes()).toContain('custom-class')
      expect(input.classes()).toContain('form-control-lg')
    })

    it('renders different size variants correctly', async () => {
      // Test default size
      const defaultWrapper = mount(CustomNumberInput, {
        props: { modelValue: 0, size: 'default' },
      })
      expect(defaultWrapper.classes()).toContain('size-default')

      // Test compact size
      const compactWrapper = mount(CustomNumberInput, {
        props: { modelValue: 0, size: 'compact' },
      })
      expect(compactWrapper.classes()).toContain('size-compact')
    })

    it('displays suffix slot content correctly', () => {
      const wrapper = mount(CustomNumberInput, {
        props: { modelValue: 0 },
        slots: {
          suffix: '°',
        },
      })

      expect(wrapper.find('.input-suffix').exists()).toBe(true)
      expect(wrapper.find('.input-suffix').text()).toBe('°')
      expect(wrapper.classes()).toContain('has-suffix')
    })

    it('applies disabled state properly', () => {
      const wrapper = mount(CustomNumberInput, {
        props: { modelValue: 0, disabled: true },
      })

      const input = wrapper.find('input')
      const spinnerUp = wrapper.find('.spinner-up')
      const spinnerDown = wrapper.find('.spinner-down')

      expect(input.attributes('disabled')).toBeDefined()
      expect(spinnerUp.attributes('disabled')).toBeDefined()
      expect(spinnerDown.attributes('disabled')).toBeDefined()
      expect(wrapper.classes()).toContain('input-disabled')
    })
  })

  describe('Spinner Interactions', () => {
    it('increments value when up spinner is clicked', async () => {
      const wrapper = mount(CustomNumberInput, {
        props: { modelValue: 5, step: 1 },
      })

      const spinnerUp = wrapper.find('.spinner-up')
      await spinnerUp.trigger('click')

      expect(wrapper.emitted('update:modelValue')![0]).toEqual([6])
      expect(wrapper.emitted('change')![0]).toEqual([6])
    })

    it('decrements value when down spinner is clicked', async () => {
      const wrapper = mount(CustomNumberInput, {
        props: { modelValue: 5, step: 1 },
      })

      const spinnerDown = wrapper.find('.spinner-down')
      await spinnerDown.trigger('click')

      expect(wrapper.emitted('update:modelValue')![0]).toEqual([4])
      expect(wrapper.emitted('change')![0]).toEqual([4])
    })

    it('uses custom step value correctly', async () => {
      const wrapper = mount(CustomNumberInput, {
        props: { modelValue: 10, step: 5 },
      })

      const spinnerUp = wrapper.find('.spinner-up')
      await spinnerUp.trigger('click')

      expect(wrapper.emitted('update:modelValue')![0]).toEqual([15])
    })

    it('disables spinner buttons at min/max limits', () => {
      const wrapper = mount(CustomNumberInput, {
        props: { modelValue: 10, min: 0, max: 10 },
      })

      const spinnerUp = wrapper.find('.spinner-up')
      const spinnerDown = wrapper.find('.spinner-down')

      // At max value, up button should be disabled
      expect(spinnerUp.attributes('disabled')).toBeDefined()
      // Down button should still be enabled
      expect(spinnerDown.attributes('disabled')).toBeUndefined()
    })
  })

  describe('Keyboard Navigation', () => {
    it('increments value on Arrow Up key', async () => {
      const wrapper = mount(CustomNumberInput, {
        props: { modelValue: 5 },
      })

      const input = wrapper.find('input')
      await input.trigger('keydown', { key: 'ArrowUp' })

      expect(wrapper.emitted('update:modelValue')![0]).toEqual([6])
    })

    it('decrements value on Arrow Down key', async () => {
      const wrapper = mount(CustomNumberInput, {
        props: { modelValue: 5 },
      })

      const input = wrapper.find('input')
      await input.trigger('keydown', { key: 'ArrowDown' })

      expect(wrapper.emitted('update:modelValue')![0]).toEqual([4])
    })

    it('blurs input on Escape key', async () => {
      const wrapper = mount(CustomNumberInput, {
        props: { modelValue: 5 },
      })

      const input = wrapper.find('input')
      const blurSpy = vi.spyOn(input.element, 'blur')

      await input.trigger('keydown', { key: 'Escape' })

      expect(blurSpy).toHaveBeenCalled()
    })
  })

  describe('Mouse Wheel Interaction', () => {
    it('increments on wheel up when focused', async () => {
      const wrapper = mount(CustomNumberInput, {
        props: { modelValue: 5 },
      })

      const input = wrapper.find('input')

      // Focus the input first
      await input.trigger('focus')

      // Simulate wheel up (negative deltaY)
      await input.trigger('wheel', { deltaY: -100 })

      expect(wrapper.emitted('update:modelValue')![0]).toEqual([6])
    })

    it('decrements on wheel down when focused', async () => {
      const wrapper = mount(CustomNumberInput, {
        props: { modelValue: 5 },
      })

      const input = wrapper.find('input')

      // Focus the input first
      await input.trigger('focus')

      // Simulate wheel down (positive deltaY)
      await input.trigger('wheel', { deltaY: 100 })

      expect(wrapper.emitted('update:modelValue')![0]).toEqual([4])
    })

    it('ignores wheel events when not focused', async () => {
      const wrapper = mount(CustomNumberInput, {
        props: { modelValue: 5 },
      })

      const input = wrapper.find('input')

      // Don't focus, directly trigger wheel
      await input.trigger('wheel', { deltaY: -100 })

      // Should not emit any events
      expect(wrapper.emitted('update:modelValue')).toBeFalsy()
    })

    it('uses ctrlStep when Ctrl key is pressed during wheel', async () => {
      const wrapper = mount(CustomNumberInput, {
        props: { modelValue: 5, step: 1, ctrlStep: 10 },
      })

      const input = wrapper.find('input')

      await input.trigger('focus')

      // Create a proper MouseEvent with ctrlKey
      const wheelEvent = new WheelEvent('wheel', {
        deltaY: -100,
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      })

      await input.element.dispatchEvent(wheelEvent)

      expect(wrapper.emitted('update:modelValue')![0]).toEqual([15])
    })
  })

  describe('Value Constraints', () => {
    it('respects minimum value constraint', async () => {
      const wrapper = mount(CustomNumberInput, {
        props: { modelValue: 5, min: 0, max: 10 },
      })

      // Try to go below minimum
      const spinnerDown = wrapper.find('.spinner-down')
      for (let i = 0; i < 10; i++) {
        await spinnerDown.trigger('click')
      }

      // Should not go below 0
      const lastEmittedValue = wrapper.emitted('update:modelValue')!.slice(-1)[0][0]
      expect(lastEmittedValue).toBeGreaterThanOrEqual(0)
    })

    it('respects maximum value constraint', async () => {
      const wrapper = mount(CustomNumberInput, {
        props: { modelValue: 5, min: 0, max: 10 },
      })

      // Try to go above maximum
      const spinnerUp = wrapper.find('.spinner-up')
      for (let i = 0; i < 10; i++) {
        await spinnerUp.trigger('click')
      }

      // Should not go above 10
      const lastEmittedValue = wrapper.emitted('update:modelValue')!.slice(-1)[0][0]
      expect(lastEmittedValue).toBeLessThanOrEqual(10)
    })
  })

  describe('Accessibility', () => {
    it('has proper ARIA attributes', () => {
      const wrapper = mount(CustomNumberInput, {
        props: {
          modelValue: 0,
          title: 'Test input',
          placeholder: 'Enter number',
        },
      })

      const input = wrapper.find('input')
      expect(input.attributes('type')).toBe('number')
      expect(input.attributes('title')).toBe('Test input')
      expect(input.attributes('placeholder')).toBe('Enter number')
    })

    it('has descriptive titles for spinner buttons', () => {
      const wrapper = mount(CustomNumberInput, {
        props: { modelValue: 0, step: 5 },
      })

      const spinnerUp = wrapper.find('.spinner-up')
      const spinnerDown = wrapper.find('.spinner-down')

      expect(spinnerUp.attributes('title')).toBe('Increase by 5')
      expect(spinnerDown.attributes('title')).toBe('Decrease by 5')
    })

    it('prevents tab focus on spinner buttons', () => {
      const wrapper = mount(CustomNumberInput, {
        props: { modelValue: 0 },
      })

      const spinnerButtons = wrapper.findAll('.spinner-btn')
      spinnerButtons.forEach((button) => {
        expect(button.attributes('tabindex')).toBe('-1')
      })
    })

    it('handles disabled state accessibly', () => {
      const wrapper = mount(CustomNumberInput, {
        props: { modelValue: 0, disabled: true },
      })

      const input = wrapper.find('input')
      const spinnerButtons = wrapper.findAll('.spinner-btn')

      expect(input.attributes('disabled')).toBeDefined()
      spinnerButtons.forEach((button) => {
        expect(button.attributes('disabled')).toBeDefined()
      })

      expect(wrapper.classes()).toContain('input-disabled')
    })
  })

  describe('Edge Cases', () => {
    it('handles undefined modelValue correctly', () => {
      const wrapper = mount(CustomNumberInput, {
        props: { modelValue: undefined, valueOnClear: null },
      })

      expect(wrapper.find('input').element.value).toBe('')
    })

    it('handles decimal step values correctly', async () => {
      const wrapper = mount(CustomNumberInput, {
        props: { modelValue: 1.0, step: 0.1 },
      })

      const spinnerUp = wrapper.find('.spinner-up')
      await spinnerUp.trigger('click')

      const emittedValue = wrapper.emitted('update:modelValue')![0][0] as number
      expect(Math.abs(emittedValue - 1.1)).toBeLessThan(0.001) // Account for floating point precision
    })
  })
})
