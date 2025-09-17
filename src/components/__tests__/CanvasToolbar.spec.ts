import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import CanvasToolbar from '../CanvasToolbar.vue'
import { useKeyboardStore } from '@/stores/keyboard'

describe('CanvasToolbar', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('special keys functionality', () => {
    it('should toggle special keys dropdown', async () => {
      const wrapper = mount(CanvasToolbar, {
        global: {
          plugins: [createPinia()],
        },
      })

      // Initially dropdown should be hidden
      expect(wrapper.find('.special-keys-dropdown').exists()).toBe(false)

      // Click the special keys dropdown button (within add-key-group)
      const dropdownBtn = wrapper.find('.add-key-group .dropdown-btn')
      expect(dropdownBtn.exists()).toBe(true)

      await dropdownBtn.trigger('click')
      await wrapper.vm.$nextTick()

      // Dropdown should now be visible
      expect(wrapper.find('.special-keys-dropdown').exists()).toBe(true)

      // Should have dropdown header
      expect(wrapper.find('.dropdown-header').text()).toBe('Special Keys')

      // Should have exactly 2 special key items
      const dropdownItems = wrapper.findAll('.dropdown-item')
      expect(dropdownItems.length).toBe(2)

      // Check for specific special keys
      const itemTexts = dropdownItems.map((item) => item.text())
      expect(itemTexts).toContain('ISO Enter')
      expect(itemTexts).toContain('Big-Ass Enter')
    })

    it('should add special key when selected from dropdown', async () => {
      const wrapper = mount(CanvasToolbar, {
        global: {
          plugins: [createPinia()],
        },
      })

      const store = useKeyboardStore()
      const initialKeyCount = store.keys.length

      // Open dropdown
      const dropdownBtn = wrapper.find('.add-key-group .dropdown-btn')
      await dropdownBtn.trigger('click')
      await wrapper.vm.$nextTick()

      // Click on ISO Enter
      const isoEnterItem = wrapper
        .findAll('.dropdown-item')
        .find((item) => item.text() === 'ISO Enter')
      expect(isoEnterItem).toBeDefined()

      await isoEnterItem!.trigger('click')
      await wrapper.vm.$nextTick()

      // Should have added a key
      expect(store.keys.length).toBe(initialKeyCount + 1)

      // The new key should have ISO Enter characteristics
      const newKey = store.keys[store.keys.length - 1]
      expect(newKey.width).toBe(1.25)
      expect(newKey.height).toBe(2)
      expect(newKey.width2).toBe(1.5)
      expect(newKey.height2).toBe(1)
      expect(newKey.x2).toBe(-0.25)
      expect(newKey.labels[4]).toBe('Enter')

      // Dropdown should be closed after selection
      expect(wrapper.find('.special-keys-dropdown').exists()).toBe(false)
    })

    it('should add standard key with regular add button', async () => {
      const wrapper = mount(CanvasToolbar, {
        global: {
          plugins: [createPinia()],
        },
      })

      const store = useKeyboardStore()
      const initialKeyCount = store.keys.length

      // Click the main add button
      const addBtn = wrapper.find('.primary-add-btn')
      await addBtn.trigger('click')

      // Should have added a standard key
      expect(store.keys.length).toBe(initialKeyCount + 1)

      // The new key should be a standard 1x1 key
      const newKey = store.keys[store.keys.length - 1]
      expect(newKey.width).toBe(1)
      expect(newKey.height).toBe(1)
      // Standard keys have width2/height2 equal to width/height (not undefined)
      expect(newKey.width2).toBe(1)
      expect(newKey.height2).toBe(1)
    })
  })

  describe('existing toolbar functionality', () => {
    it('should have all tool sections', () => {
      const wrapper = mount(CanvasToolbar, {
        global: {
          plugins: [createPinia()],
        },
      })

      const sections = wrapper.findAll('.toolbar-section')
      // We now have 3 sections: Tools, Edit, History
      // Debug tools are now part of Tools as "Extra tools" dropdown
      // Clipboard operations removed (users use keyboard shortcuts)
      expect(sections.length).toBe(3)

      const labels = sections.map((section) => section.find('.section-label').text())
      expect(labels).toContain('Tools')
      expect(labels).toContain('Edit')
      expect(labels).toContain('History')
    })

    it('should enable/disable buttons based on state', async () => {
      const wrapper = mount(CanvasToolbar, {
        global: {
          plugins: [createPinia()],
        },
      })

      const store = useKeyboardStore()

      // Add a key and select it
      store.addKey()
      store.selectKey(store.keys[0])
      await wrapper.vm.$nextTick()

      // Delete button should be enabled
      const deleteBtn = wrapper.find('button[title="Delete Keys"]')
      expect(deleteBtn.attributes('disabled')).toBeUndefined()

      // Deselect all keys
      store.selectedKeys.length = 0
      await wrapper.vm.$nextTick()

      // Delete button should be disabled
      expect(deleteBtn.attributes('disabled')).toBeDefined()
    })

    it('should enable/disable mirror tools based on selection', async () => {
      const wrapper = mount(CanvasToolbar, {
        global: {
          plugins: [createPinia()],
        },
      })

      const store = useKeyboardStore()

      // Initially no keys selected - mirror tools should be disabled
      const mirrorBtn = wrapper.find('button[title="Mirror Vertical"]')
      const mirrorDropdownBtn = wrapper.find('.mirror-group .dropdown-btn')

      expect(mirrorBtn.attributes('disabled')).toBeDefined()
      expect(mirrorDropdownBtn.attributes('disabled')).toBeDefined()

      // Add and select a key
      store.addKey()
      store.selectKey(store.keys[0])
      await wrapper.vm.$nextTick()

      // Mirror tools should now be enabled
      expect(mirrorBtn.attributes('disabled')).toBeUndefined()
      expect(mirrorDropdownBtn.attributes('disabled')).toBeUndefined()

      // Deselect all keys
      store.selectedKeys.length = 0
      await wrapper.vm.$nextTick()

      // Mirror tools should be disabled again
      expect(mirrorBtn.attributes('disabled')).toBeDefined()
      expect(mirrorDropdownBtn.attributes('disabled')).toBeDefined()
    })
  })
})
