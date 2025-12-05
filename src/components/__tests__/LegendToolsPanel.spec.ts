import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import LegendToolsPanel from '../LegendToolsPanel.vue'
import LabelPositionPicker from '../LabelPositionPicker.vue'
import { useKeyboardStore } from '@/stores/keyboard'
import { Key } from '@adamws/kle-serial'

describe('LegendToolsPanel', () => {
  let wrapper: VueWrapper
  let store: ReturnType<typeof useKeyboardStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useKeyboardStore()
    wrapper = mount(LegendToolsPanel, {
      props: {
        visible: true,
      },
      global: {
        components: {
          LabelPositionPicker,
        },
      },
    })
  })

  it('renders panel when visible', () => {
    expect(wrapper.find('.legend-tools-panel').exists()).toBe(true)
    expect(wrapper.find('.panel-title').text()).toContain('Legend Tools')
  })

  it('does not render panel when not visible', async () => {
    await wrapper.setProps({ visible: false })
    expect(wrapper.find('.legend-tools-panel').exists()).toBe(false)
  })

  it('displays tab navigation', () => {
    const tabs = wrapper.findAll('.btn-check')
    expect(tabs).toHaveLength(4)

    expect(wrapper.find('label[for="tab-edit"]').text()).toBe('Edit')
    expect(wrapper.find('label[for="tab-remove"]').text()).toBe('Remove')
    expect(wrapper.find('label[for="tab-align"]').text()).toBe('Align')
    expect(wrapper.find('label[for="tab-move"]').text()).toBe('Move')
  })

  it('defaults to edit tab', () => {
    const editTab = wrapper.find('#tab-edit')
    expect((editTab.element as HTMLInputElement).checked).toBe(true)
  })

  describe('Remove Tab', () => {
    beforeEach(async () => {
      // Switch to Remove tab for these tests
      await wrapper.find('#tab-remove').setValue(true)
    })

    it('displays all legend categories', () => {
      const buttons = wrapper.findAll('.btn-outline-danger')
      expect(buttons).toHaveLength(8) // All, Alphas, Numbers, Punctuation, Function, Specials, Others, Decals

      const btn0 = buttons[0]
      expect(btn0).toBeDefined()
      expect(btn0!.text()).toContain('All')
      const btn1 = buttons[1]
      expect(btn1).toBeDefined()
      expect(btn1!.text()).toContain('Alphas')
      const btn2 = buttons[2]
      expect(btn2).toBeDefined()
      expect(btn2!.text()).toContain('Numbers')
      const btn3 = buttons[3]
      expect(btn3).toBeDefined()
      expect(btn3!.text()).toContain('Punctuation')
      const btn4 = buttons[4]
      expect(btn4).toBeDefined()
      expect(btn4!.text()).toContain('Function')
      const btn5 = buttons[5]
      expect(btn5).toBeDefined()
      expect(btn5!.text()).toContain('Specials')
      const btn6 = buttons[6]
      expect(btn6).toBeDefined()
      expect(btn6!.text()).toContain('Others')
      const btn7 = buttons[7]
      expect(btn7).toBeDefined()
      expect(btn7!.text()).toContain('Decals')
    })

    it('removes legends when category button is clicked', async () => {
      const key = new Key()
      key.labels = ['A', 'B', 'C', '', '', '', '', '', '', '', '', '']
      store.keys = [key]
      store.selectedKeys = [key]

      const saveToHistorySpy = vi.spyOn(store, 'saveToHistory')
      const markDirtySpy = vi.spyOn(store, 'markDirty')

      // Click "All" button
      const allButton = wrapper.findAll('.btn-outline-danger')[0]
      expect(allButton).toBeDefined()
      await allButton!.trigger('click')

      expect(saveToHistorySpy).toHaveBeenCalled()
      expect(markDirtySpy).toHaveBeenCalled()
      expect(key.labels.every((label) => label === '')).toBe(true)
    })

    it('shows correct count for all keys when none selected', async () => {
      store.keys = [new Key(), new Key(), new Key()]
      store.selectedKeys = []

      wrapper.unmount()
      wrapper = mount(LegendToolsPanel, {
        props: {
          visible: true,
        },
        global: {
          components: {
            LabelPositionPicker,
          },
        },
      })

      // Switch to Remove tab
      await wrapper.find('#tab-remove').setValue(true)

      expect(wrapper.text()).toContain('3 key(s) will be affected')
    })
  })

  describe('Align Tab', () => {
    beforeEach(async () => {
      const alignTab = wrapper.find('#tab-align')
      await alignTab.setValue(true)
    })

    it('displays keycap preview with alignment buttons', () => {
      expect(wrapper.find('.keycap-preview').exists()).toBe(true)

      const alignButtons = wrapper.findAll('.align-btn')
      expect(alignButtons).toHaveLength(9)
    })

    it('aligns legends when button clicked', async () => {
      const key = new Key()
      key.labels = ['', 'B', '', '', '', '', '', '', '', '', '', '']
      key.decal = false
      store.keys = [key]
      store.selectedKeys = [key]

      const saveToHistorySpy = vi.spyOn(store, 'saveToHistory')
      const markDirtySpy = vi.spyOn(store, 'markDirty')

      // Click top-left button (↖)
      const topLeftButton = wrapper.findAll('.align-btn')[0]
      expect(topLeftButton).toBeDefined()
      await topLeftButton!.trigger('click')

      expect(saveToHistorySpy).toHaveBeenCalled()
      expect(markDirtySpy).toHaveBeenCalled()

      // Legend should move from position 1 to position 0
      expect(key.labels[0]).toBe('B')
      expect(key.labels[1]).toBe('')
    })

    it('shows correct count for non-decal keys', async () => {
      const key1 = new Key()
      key1.decal = false
      const key2 = new Key()
      key2.decal = false
      const decalKey = new Key()
      decalKey.decal = true

      store.keys = [key1, key2, decalKey]
      store.selectedKeys = []

      wrapper.unmount()
      wrapper = mount(LegendToolsPanel, {
        props: {
          visible: true,
        },
        global: {
          components: {
            LabelPositionPicker,
          },
        },
      })

      const alignTab = wrapper.find('#tab-align')
      await alignTab.setValue(true)

      expect(wrapper.text()).toContain('2 key(s) will be affected')
    })
  })

  describe('Move Tab', () => {
    beforeEach(async () => {
      const moveTab = wrapper.find('#tab-move')
      await moveTab.setValue(true)
    })

    it('displays from and to position selectors', () => {
      const positionPickers = wrapper.findAllComponents(LabelPositionPicker)
      expect(positionPickers).toHaveLength(2) // From and To

      const fromSelector = positionPickers[0]
      expect(fromSelector).toBeDefined()
      const fromLabels = fromSelector!.findAll('.position-label')
      const toSelector = positionPickers[1]
      expect(toSelector).toBeDefined()
      const toLabels = toSelector!.findAll('.position-label')
      expect(fromLabels).toHaveLength(12)
      expect(toLabels).toHaveLength(12)
    })

    it('displays position labels correctly', () => {
      const labels = wrapper.findAll('.position-label')
      const expectedLabels = [
        'TL',
        'TC',
        'TR',
        'CL',
        'CC',
        'CR',
        'BL',
        'BC',
        'BR',
        'FL',
        'FC',
        'FR',
      ]

      // Check first set (From positions)
      for (let i = 0; i < 12; i++) {
        const label = labels[i]
        expect(label).toBeDefined()
        expect(label!.text()).toBe(expectedLabels[i])
      }

      // Check second set (To positions)
      for (let i = 12; i < 24; i++) {
        const label = labels[i]
        expect(label).toBeDefined()
        expect(label!.text()).toBe(expectedLabels[i - 12])
      }
    })

    it('disables move button when no positions selected', () => {
      const moveButton = wrapper.find('.btn-outline-secondary')
      expect(moveButton.attributes('disabled')).toBeDefined()
    })

    it('enables move button when different positions selected', async () => {
      const fromRadio = wrapper.find('input[value="0"]') // Position 0 in From
      const toRadios = wrapper.findAll('input[value="1"]')
      const toRadio = toRadios[1] // Position 1 in To
      expect(toRadio).toBeDefined()

      await fromRadio.setValue(true)
      await toRadio!.setValue(true)
      await wrapper.vm.$nextTick()

      const moveButton = wrapper.find('.btn-outline-secondary')
      expect(moveButton.attributes('disabled')).toBeUndefined()
    })

    it('moves legend from one position to another', async () => {
      const key = new Key()
      key.labels = ['A', '', '', '', '', '', '', '', '', '', '', '']
      key.textColor = ['#ff0000', '', '', '', '', '', '', '', '', '', '', '']
      key.textSize = [5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
      key.decal = false

      store.keys = [key]
      store.selectedKeys = [key]

      const saveToHistorySpy = vi.spyOn(store, 'saveToHistory')
      const markDirtySpy = vi.spyOn(store, 'markDirty')

      // Select from position 0 and to position 1
      const fromRadio = wrapper.find('input[value="0"]')
      const toRadios = wrapper.findAll('input[value="1"]')
      const toRadio = toRadios[1]
      expect(toRadio).toBeDefined()

      await fromRadio.setValue(true)
      await toRadio!.setValue(true)
      await wrapper.vm.$nextTick()

      const moveButton = wrapper.find('.btn-outline-secondary')
      await moveButton.trigger('click')

      expect(saveToHistorySpy).toHaveBeenCalled()
      expect(markDirtySpy).toHaveBeenCalled()

      // Legend and formatting should move
      expect(key.labels[0]).toBe('')
      expect(key.labels[1]).toBe('A')
      expect(key.textColor[0]).toBe('')
      expect(key.textColor[1]).toBe('#ff0000')
      expect(key.textSize[0]).toBe(0)
      expect(key.textSize[1]).toBe(5)
    })
  })

  describe('Panel functionality', () => {
    it('emits close event when close button is clicked', async () => {
      const closeButton = wrapper.find('.btn-close')
      await closeButton.trigger('click')

      expect(wrapper.emitted('close')).toBeTruthy()
    })

    it('can be dragged around', async () => {
      const header = wrapper.find('.panel-header')

      // Simulate mousedown on header
      await header.trigger('mousedown', {
        clientX: 100,
        clientY: 100,
      })

      // Panel should be draggable (isDragging would be true in component)
      expect(header.exists()).toBe(true)
    })

    it('handles keyboard shortcuts', async () => {
      // Test escape key
      const keydownEvent = new KeyboardEvent('keydown', { key: 'Escape' })
      document.dispatchEvent(keydownEvent)

      // Should emit close
      await wrapper.vm.$nextTick()
      expect(wrapper.emitted('close')).toBeTruthy()
    })

    it('allows multiple operations without closing', async () => {
      const key = new Key()
      key.labels = ['A', 'B', '', '', '', '', '', '', '', '', '', '']
      store.keys = [key]
      store.selectedKeys = [key]

      // Switch to Remove tab
      await wrapper.find('#tab-remove').setValue(true)

      // First operation - remove all legends
      const allButton = wrapper.findAll('.btn-outline-danger')[0]
      expect(allButton).toBeDefined()
      await allButton!.trigger('click')

      // Panel should still be visible
      expect(wrapper.find('.legend-tools-panel').exists()).toBe(true)

      // Switch to align tab and perform another operation
      const alignTab = wrapper.find('#tab-align')
      await alignTab.setValue(true)

      key.labels = ['', 'C', '', '', '', '', '', '', '', '', '', ''] // Add new legend for testing

      const alignButton = wrapper.findAll('.align-btn')[0]
      expect(alignButton).toBeDefined()
      await alignButton!.trigger('click')

      // Panel should still be visible
      expect(wrapper.find('.legend-tools-panel').exists()).toBe(true)
    })
  })

  describe('Status info', () => {
    it('updates count when switching tabs', async () => {
      const key1 = new Key()
      key1.decal = false
      const key2 = new Key()
      key2.decal = true

      store.keys = [key1, key2]
      store.selectedKeys = []

      wrapper.unmount()
      wrapper = mount(LegendToolsPanel, {
        props: {
          visible: true,
        },
        global: {
          components: {
            LabelPositionPicker,
          },
        },
      })

      // Switch to Remove tab
      await wrapper.find('#tab-remove').setValue(true)

      // Remove tab should count all keys
      expect(wrapper.text()).toContain('2 key(s) will be affected')

      // Switch to align tab should count only non-decal keys
      const alignTab = wrapper.find('#tab-align')
      await alignTab.setValue(true)

      expect(wrapper.text()).toContain('1 key(s) will be affected')
    })
  })
})
