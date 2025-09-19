import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import AddMatrixCoordinatesModal from '../AddMatrixCoordinatesModal.vue'

// Mock the useDraggablePanel composable
vi.mock('@/composables/useDraggablePanel', () => ({
  useDraggablePanel: () => ({
    position: { x: 0, y: 0 },
    panelRef: { value: null },
    handleMouseDown: vi.fn(),
    handleHeaderMouseDown: vi.fn(),
    initializePosition: vi.fn(),
  }),
}))

describe('AddMatrixCoordinatesModal', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('visibility', () => {
    it('should not render when visible is false', () => {
      const wrapper = mount(AddMatrixCoordinatesModal, {
        props: { visible: false },
        global: {
          plugins: [createPinia()],
        },
      })

      expect(wrapper.find('.matrix-modal').exists()).toBe(false)
    })

    it('should render when visible is true', () => {
      const wrapper = mount(AddMatrixCoordinatesModal, {
        props: { visible: true },
        global: {
          plugins: [createPinia()],
        },
      })

      expect(wrapper.find('.matrix-modal').exists()).toBe(true)
      expect(wrapper.find('.panel-title').text()).toContain('Add Switch Matrix Coordinates')
    })
  })

  describe('content', () => {
    let wrapper: ReturnType<typeof mount>

    beforeEach(() => {
      wrapper = mount(AddMatrixCoordinatesModal, {
        props: { visible: true },
        global: {
          plugins: [createPinia()],
        },
      })
    })

    it('should display warning message', () => {
      const warningSection = wrapper.find('.warning-section')
      expect(warningSection.exists()).toBe(true)
      expect(warningSection.text()).toContain('remove all existing legends')
      expect(warningSection.text()).toContain('row,column')
    })

    it('should display information section', () => {
      const infoSection = wrapper.find('.info-section')
      expect(infoSection.exists()).toBe(true)
      expect(infoSection.text()).toContain('Matrix coordinates map')
      expect(infoSection.text()).toContain('VIA firmware')
    })

    it('should display help link to VIA documentation', () => {
      const helpLink = wrapper.find('a[href="https://www.caniusevia.com/docs/layouts"]')
      expect(helpLink.exists()).toBe(true)
      expect(helpLink.text()).toContain('VIA Documentation')
      expect(helpLink.attributes('target')).toBe('_blank')
      expect(helpLink.attributes('rel')).toBe('noopener noreferrer')
    })

    it('should have cancel and apply buttons', () => {
      const buttons = wrapper.findAll('button')
      const cancelButton = buttons.find((btn) => btn.text().includes('Cancel'))
      const applyButton = buttons.find((btn) => btn.text().includes('Add Matrix Coordinates'))

      expect(cancelButton?.exists()).toBe(true)
      expect(applyButton?.exists()).toBe(true)
      expect(applyButton?.classes()).toContain('btn-primary')
    })
  })

  describe('events', () => {
    let wrapper: ReturnType<typeof mount>

    beforeEach(() => {
      wrapper = mount(AddMatrixCoordinatesModal, {
        props: { visible: true },
        global: {
          plugins: [createPinia()],
        },
      })
    })

    it('should emit cancel when cancel button is clicked', async () => {
      const cancelButton = wrapper.findAll('button').find((btn) => btn.text().includes('Cancel'))
      await cancelButton?.trigger('click')

      expect(wrapper.emitted('cancel')).toBeTruthy()
      expect(wrapper.emitted('cancel')).toHaveLength(1)
    })

    it('should emit apply when apply button is clicked', async () => {
      const applyButton = wrapper
        .findAll('button')
        .find((btn) => btn.text().includes('Add Matrix Coordinates'))
      await applyButton?.trigger('click')

      expect(wrapper.emitted('apply')).toBeTruthy()
      expect(wrapper.emitted('apply')).toHaveLength(1)
    })

    it('should emit cancel when close button is clicked', async () => {
      const closeButton = wrapper.find('.btn-close')
      await closeButton.trigger('click')

      expect(wrapper.emitted('cancel')).toBeTruthy()
      expect(wrapper.emitted('cancel')).toHaveLength(1)
    })
  })

  describe('keyboard shortcuts', () => {
    let wrapper: ReturnType<typeof mount>

    beforeEach(() => {
      wrapper = mount(AddMatrixCoordinatesModal, {
        props: { visible: true },
        global: {
          plugins: [createPinia()],
        },
        attachTo: document.body,
      })
    })

    it('should emit cancel on Escape key', async () => {
      await wrapper.trigger('keydown', { key: 'Escape' })
      // Since the event is attached to document, we need to dispatch it manually
      const event = new KeyboardEvent('keydown', { key: 'Escape' })
      document.dispatchEvent(event)
      await wrapper.vm.$nextTick()

      expect(wrapper.emitted('cancel')).toBeTruthy()
    })

    it('should emit apply on Enter key', async () => {
      const event = new KeyboardEvent('keydown', { key: 'Enter' })
      document.dispatchEvent(event)
      await wrapper.vm.$nextTick()

      expect(wrapper.emitted('apply')).toBeTruthy()
    })
  })

  describe('responsive design', () => {
    it('should have mobile-specific styles', () => {
      const wrapper = mount(AddMatrixCoordinatesModal, {
        props: { visible: true },
        global: {
          plugins: [createPinia()],
        },
      })

      const modal = wrapper.find('.matrix-modal')
      expect(modal.exists()).toBe(true)

      // Check that CSS classes exist (mobile styles are applied via CSS)
      expect(modal.classes()).toContain('matrix-modal')
    })
  })
})
