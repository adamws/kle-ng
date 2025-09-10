import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { Key } from '@ijprest/kle-serial'
import KeyboardCanvas from '../KeyboardCanvas.vue'
import { useKeyboardStore } from '@/stores/keyboard'

// Mock window methods
const mockDispatchEvent = vi.fn()
Object.defineProperty(window, 'dispatchEvent', {
  value: mockDispatchEvent,
  writable: true,
})

// Mock canvas context
const mockContext = {
  clearRect: vi.fn(),
  fillRect: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  quadraticCurveTo: vi.fn(),
  closePath: vi.fn(),
  fill: vi.fn(),
  stroke: vi.fn(),
  fillText: vi.fn(),
  measureText: vi.fn().mockReturnValue({ width: 50 }),
  save: vi.fn(),
  restore: vi.fn(),
  translate: vi.fn(),
  rotate: vi.fn(),
  setLineDash: vi.fn(),
  setTransform: vi.fn(),
  createLinearGradient: vi.fn().mockReturnValue({
    addColorStop: vi.fn(),
  }),
  createRadialGradient: vi.fn().mockReturnValue({
    addColorStop: vi.fn(),
  }),
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 1,
  font: '',
  textAlign: 'left' as CanvasTextAlign,
  textBaseline: 'top' as CanvasTextBaseline,
  globalAlpha: 1,
  canvas: {
    width: 800,
    height: 600,
  },
}

// Mock HTMLCanvasElement
HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(mockContext)
HTMLCanvasElement.prototype.getBoundingClientRect = vi.fn().mockReturnValue({
  left: 0,
  top: 0,
  width: 800,
  height: 600,
})

// Mock ResizeObserver
class MockResizeObserver {
  observe = vi.fn()
  disconnect = vi.fn()
  unobserve = vi.fn()
}
global.ResizeObserver = MockResizeObserver

describe('KeyboardCanvas', () => {
  let store: ReturnType<typeof useKeyboardStore>

  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    store = useKeyboardStore()

    // Set up default keys for testing
    const key = new Key()
    key.x = 0
    key.y = 0
    key.width = 1
    key.height = 1
    key.labels = ['Q']
    key.textSize = [3]
    key.textColor = ['#000000']
    key.color = '#cccccc'

    store.keys = [key]
  })

  describe('mouse position calculation', () => {
    it('should calculate correct mouse coordinates relative to key positions', async () => {
      const wrapper = mount(KeyboardCanvas, {
        global: {
          plugins: [createPinia()],
        },
      })

      // Wait for component to mount
      await wrapper.vm.$nextTick()

      // Get the canvas element
      const canvas = wrapper.find('canvas').element

      // First trigger mouse enter to enable position tracking
      const enterEvent = new MouseEvent('mouseenter')
      canvas.dispatchEvent(enterEvent)

      // Mock mouse event at position where key at (0,0) should be
      // Key at (0,0) is now rendered at canvas position (9, 9) with 9px border
      const mouseEvent = new MouseEvent('mousemove', {
        clientX: 9, // 9px border offset
        clientY: 9, // 9px border offset
      })

      // Trigger mouse move
      canvas.dispatchEvent(mouseEvent)

      await wrapper.vm.$nextTick()

      // Verify that mouse position event was dispatched with correct coordinates
      expect(mockDispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'canvas-mouse-position',
          detail: expect.objectContaining({
            x: 0, // Should be 0,0 not 0.37,0.37
            y: 0,
            visible: true,
          }),
        }),
      )
    })

    it('should handle mouse position calculation with zoom and pan', async () => {
      const wrapper = mount(KeyboardCanvas, {
        global: {
          plugins: [createPinia()],
        },
      })

      await wrapper.vm.$nextTick()

      // Simulate zoom and pan (these are internal state, so we test the behavior indirectly)
      const canvas = wrapper.find('canvas').element

      // First trigger mouse enter to enable position tracking
      const enterEvent = new MouseEvent('mouseenter')
      canvas.dispatchEvent(enterEvent)

      // Mouse event at a different position
      const mouseEvent = new MouseEvent('mousemove', {
        clientX: 63, // 1 unit (54px) + 9px border offset
        clientY: 63, // 1 unit (54px) + 9px border offset
      })

      canvas.dispatchEvent(mouseEvent)
      await wrapper.vm.$nextTick()

      // Should calculate position for key at (1,1)
      expect(mockDispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'canvas-mouse-position',
          detail: expect.objectContaining({
            x: 1,
            y: 1,
            visible: true,
          }),
        }),
      )
    })

    it('should show/hide mouse position based on mouse enter/leave', async () => {
      const wrapper = mount(KeyboardCanvas, {
        global: {
          plugins: [createPinia()],
        },
      })

      await wrapper.vm.$nextTick()

      const canvas = wrapper.find('canvas').element

      // Mouse enter
      const enterEvent = new MouseEvent('mouseenter')
      canvas.dispatchEvent(enterEvent)

      // Mouse move after enter
      const moveEvent = new MouseEvent('mousemove', {
        clientX: 20,
        clientY: 20,
      })
      canvas.dispatchEvent(moveEvent)
      await wrapper.vm.$nextTick()

      // Should show position
      expect(mockDispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: expect.objectContaining({
            visible: true,
          }),
        }),
      )

      // Mouse leave
      const leaveEvent = new MouseEvent('mouseleave')
      canvas.dispatchEvent(leaveEvent)
      await wrapper.vm.$nextTick()

      // Should hide position
      expect(mockDispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: expect.objectContaining({
            visible: false,
          }),
        }),
      )
    })
  })

  describe('canvas interaction', () => {
    it('should handle key selection on click', async () => {
      const pinia = createPinia()
      setActivePinia(pinia)
      const componentStore = useKeyboardStore()

      // Add a key to the component's store
      const key = new Key()
      key.x = 0
      key.y = 0
      key.width = 1
      key.height = 1
      key.labels = ['Q']
      key.textColor = ['#000000']
      key.color = '#cccccc'
      componentStore.keys = [key]

      // Create spy on the component's store
      const selectKeySpy = vi.spyOn(componentStore, 'selectKey')

      const wrapper = mount(KeyboardCanvas, {
        global: {
          plugins: [pinia],
        },
      })

      await wrapper.vm.$nextTick()

      const canvas = wrapper.find('canvas').element

      // Click at key position (0,0)
      const clickEvent = new MouseEvent('click', {
        clientX: 47, // padding + half unit (to center of key)
        clientY: 47,
      })

      canvas.dispatchEvent(clickEvent)
      await wrapper.vm.$nextTick()

      // Should select the key
      expect(selectKeySpy).toHaveBeenCalled()
    })
  })

  describe('keyboard shortcuts', () => {
    it('should add new key when A is pressed', async () => {
      const pinia = createPinia()
      setActivePinia(pinia)
      const componentStore = useKeyboardStore()

      const addKeySpy = vi.spyOn(componentStore, 'addKey')

      const wrapper = mount(KeyboardCanvas, {
        global: {
          plugins: [pinia],
        },
      })

      await wrapper.vm.$nextTick()

      const canvas = wrapper.find('canvas').element
      canvas.focus()

      // Press 'A' key
      const keyEvent = new KeyboardEvent('keydown', {
        key: 'A',
        bubbles: true,
        cancelable: true,
      })

      canvas.dispatchEvent(keyEvent)
      await wrapper.vm.$nextTick()

      expect(addKeySpy).toHaveBeenCalled()
    })

    it('should adjust width when Shift+Left/Right arrows are pressed', async () => {
      const pinia = createPinia()
      setActivePinia(pinia)
      const componentStore = useKeyboardStore()

      // Add and select a key
      const key = new Key()
      key.x = 0
      key.y = 0
      key.width = 1
      key.height = 1
      key.labels = ['Q']
      key.textColor = ['#000000']
      key.color = '#cccccc'
      componentStore.keys = [key]
      componentStore.selectedKeys = [key]

      const saveStateSpy = vi.spyOn(componentStore, 'saveState')

      const wrapper = mount(KeyboardCanvas, {
        global: {
          plugins: [pinia],
        },
      })

      await wrapper.vm.$nextTick()

      const canvas = wrapper.find('canvas').element
      canvas.focus()

      const originalWidth = key.width

      // Press Shift+Right Arrow to increase width
      const keyEvent = new KeyboardEvent('keydown', {
        key: 'ArrowRight',
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      })

      canvas.dispatchEvent(keyEvent)
      await wrapper.vm.$nextTick()

      expect(key.width).toBeGreaterThan(originalWidth)
      expect(saveStateSpy).toHaveBeenCalled()
    })

    it('should adjust height when Shift+Up/Down arrows are pressed', async () => {
      const pinia = createPinia()
      setActivePinia(pinia)
      const componentStore = useKeyboardStore()

      // Add and select a key
      const key = new Key()
      key.x = 0
      key.y = 0
      key.width = 1
      key.height = 1
      key.labels = ['Q']
      key.textColor = ['#000000']
      key.color = '#cccccc'
      componentStore.keys = [key]
      componentStore.selectedKeys = [key]

      const saveStateSpy = vi.spyOn(componentStore, 'saveState')

      const wrapper = mount(KeyboardCanvas, {
        global: {
          plugins: [pinia],
        },
      })

      await wrapper.vm.$nextTick()

      const canvas = wrapper.find('canvas').element
      canvas.focus()

      const originalHeight = key.height

      // Press Shift+Down Arrow to increase height
      const keyEvent = new KeyboardEvent('keydown', {
        key: 'ArrowDown',
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      })

      canvas.dispatchEvent(keyEvent)
      await wrapper.vm.$nextTick()

      expect(key.height).toBeGreaterThan(originalHeight)
      expect(saveStateSpy).toHaveBeenCalled()
    })

    it('should not allow negative dimensions when adjusting size', async () => {
      const pinia = createPinia()
      setActivePinia(pinia)
      const componentStore = useKeyboardStore()

      // Add and select a key with small dimensions
      const key = new Key()
      key.x = 0
      key.y = 0
      key.width = 0.25
      key.height = 0.25
      key.labels = ['Q']
      key.textColor = ['#000000']
      key.color = '#cccccc'
      componentStore.keys = [key]
      componentStore.selectedKeys = [key]

      const wrapper = mount(KeyboardCanvas, {
        global: {
          plugins: [pinia],
        },
      })

      await wrapper.vm.$nextTick()

      const canvas = wrapper.find('canvas').element
      canvas.focus()

      // Press Shift+Left Arrow multiple times to try to make width negative
      for (let i = 0; i < 5; i++) {
        const keyEvent = new KeyboardEvent('keydown', {
          key: 'ArrowLeft',
          shiftKey: true,
          bubbles: true,
          cancelable: true,
        })

        canvas.dispatchEvent(keyEvent)
        await wrapper.vm.$nextTick()
      }

      // Width should not go below or equal to 0
      expect(key.width).toBeGreaterThan(0)
    })
  })
})
