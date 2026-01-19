import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import JsonEditorPanel from '../JsonEditorPanel.vue'

describe('JsonEditorPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
  })

  describe('JSON formatting', () => {
    it('should render the JSON editor interface', async () => {
      const wrapper = mount(JsonEditorPanel, {
        global: {
          plugins: [createPinia()],
        },
      })

      await wrapper.vm.$nextTick()

      // Should have the main elements
      const textarea = wrapper.find('textarea')
      expect(textarea.exists()).toBe(true)

      const buttons = wrapper.findAll('button')
      const formatButton = buttons.find((button) => button.text().includes('Format'))
      const applyButton = buttons.find((button) => button.text().includes('Apply Changes'))

      expect(formatButton).toBeDefined()
      expect(applyButton).toBeDefined()
    })

    it('should handle array formatting correctly', async () => {
      const wrapper = mount(JsonEditorPanel, {
        global: {
          plugins: [createPinia()],
        },
      })

      await wrapper.vm.$nextTick()

      // Mock a KLE-style array data
      const mockData = [{ name: 'test' }, ['Q', 'W', 'E'], ['A', 'S', 'D']]

      // Simulate the formatJsonCompact function behavior
      const component = wrapper.vm as { formatJsonCompact?: (data: unknown[]) => string }
      expect(component.formatJsonCompact).toBeDefined()

      const result = component.formatJsonCompact!(mockData)
      expect(result.startsWith('[')).toBe(true)
      expect(result.endsWith(']')).toBe(true)
      expect(result).toContain('"name":"test"')
    })

    it('should validate JSON and show errors for invalid JSON', async () => {
      const wrapper = mount(JsonEditorPanel, {
        global: {
          plugins: [createPinia()],
        },
      })

      await wrapper.vm.$nextTick()

      const textarea = wrapper.find('textarea')

      // Enter invalid JSON
      await textarea.setValue('{ invalid json }')
      await textarea.trigger('input')
      await wrapper.vm.$nextTick()

      // Should show error
      const errorElement = wrapper.find('.text-danger')
      expect(errorElement.exists()).toBe(true)

      // Format and Apply buttons should be disabled
      const buttons = wrapper.findAll('button')
      const formatButton = buttons.find((button) => button.text().includes('Format'))
      const applyButton = buttons.find((button) => button.text().includes('Apply Changes'))

      expect(formatButton?.attributes('disabled')).toBeDefined()
      expect(applyButton?.attributes('disabled')).toBeDefined()
    })
  })

  describe('JSON validation', () => {
    it('should accept valid KLE JSON format', async () => {
      const wrapper = mount(JsonEditorPanel, {
        global: {
          plugins: [createPinia()],
        },
      })

      await wrapper.vm.$nextTick()

      const textarea = wrapper.find('textarea')

      // Enter valid KLE JSON
      const validKleJson = '[["Q","W","E"],["A","S","D"]]'
      await textarea.setValue(validKleJson)
      await textarea.trigger('input')
      await wrapper.vm.$nextTick()

      // Should not show error
      const errorElement = wrapper.find('.text-danger')
      expect(errorElement.exists()).toBe(false)

      // Should show unsaved changes indicator (since we just changed the JSON)
      const changesElement = wrapper.find('.text-warning')
      expect(changesElement.exists()).toBe(true)
    })
  })

  describe('clear button', () => {
    it('should clear JSON to empty array when clear button is clicked', async () => {
      const wrapper = mount(JsonEditorPanel, {
        global: {
          plugins: [createPinia()],
        },
      })

      await wrapper.vm.$nextTick()

      const textarea = wrapper.find('textarea')

      // First set some valid JSON content
      await textarea.setValue('[["Q","W","E"]]')
      await textarea.trigger('input')
      await wrapper.vm.$nextTick()

      // Find the clear button (has trash icon, is the first button)
      const clearButton = wrapper.find('button.btn-outline-danger')
      expect(clearButton.exists()).toBe(true)

      // Click the clear button
      await clearButton.trigger('click')
      await wrapper.vm.$nextTick()

      // Textarea should now contain empty array
      expect((textarea.element as HTMLTextAreaElement).value).toBe('[]')

      // Should not show error (empty array is valid JSON)
      const errorElement = wrapper.find('.text-danger')
      expect(errorElement.exists()).toBe(false)
    })
  })

  describe('undefined property handling', () => {
    it('should omit undefined properties from JSON output', async () => {
      const wrapper = mount(JsonEditorPanel, {
        global: {
          plugins: [createPinia()],
        },
      })

      await wrapper.vm.$nextTick()

      // Test object with undefined properties
      const testObj = {
        width: 1.25,
        height: 2,
        width2: undefined,
        height2: undefined,
        x2: -0.25,
        y2: 0,
        stepped: undefined,
        labels: ['Q'],
      }

      // Get the component's formatting function
      const component = wrapper.vm as { toJsonCompactLine?: (obj: unknown) => string }

      // This tests the actual formatting behavior implemented in the component
      expect(component.toJsonCompactLine).toBeDefined()

      const result = component.toJsonCompactLine!(testObj)

      // Should include defined properties
      expect(result).toContain('"width":1.25')
      expect(result).toContain('"height":2')
      expect(result).toContain('"x2":-0.25')
      expect(result).toContain('"y2":0')
      expect(result).toContain('"labels":["Q"]')

      // Should NOT include undefined properties
      expect(result).not.toContain('width2')
      expect(result).not.toContain('height2')
      expect(result).not.toContain('stepped')
      expect(result).not.toContain('undefined')
    })
  })
})
