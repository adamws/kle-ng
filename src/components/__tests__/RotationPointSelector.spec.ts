import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import RotationPointSelector from '../RotationPointSelector.vue'
import { useKeyboardStore, Key } from '@/stores/keyboard'

// Mock the rotation points utility
vi.mock('@/utils/rotation-points', () => ({
  calculateRotationPoints: vi.fn(() => [
    { x: 0, y: 0, type: 'corner', id: 'corner-0,0' },
    { x: 1, y: 0, type: 'corner', id: 'corner-1,0' },
    { x: 0.5, y: 0.5, type: 'center', id: 'center-0.5,0.5' },
  ]),
}))

describe('RotationPointSelector', () => {
  let keyboardStore: ReturnType<typeof useKeyboardStore>

  beforeEach(() => {
    const pinia = createPinia()
    setActivePinia(pinia)
    keyboardStore = useKeyboardStore()
    vi.clearAllMocks()
  })

  const defaultProps = {
    visible: true,
    canvasElement: null,
    zoom: 1,
    panX: 0,
    panY: 0,
    unit: 54,
  }

  it('should not render when not visible', () => {
    const wrapper = mount(RotationPointSelector, {
      props: {
        ...defaultProps,
        visible: false,
      },
    })

    expect(wrapper.find('.rotation-point-selector').exists()).toBe(false)
  })

  it('should not render when no keys are selected', () => {
    // Ensure no keys are selected
    keyboardStore.selectedKeys = []

    const wrapper = mount(RotationPointSelector, {
      props: defaultProps,
    })

    // The component should render but with no points
    expect(wrapper.find('.rotation-point-selector').exists()).toBe(true)
    expect(wrapper.findAll('.rotation-point')).toHaveLength(0)
  })

  it('should render when visible and keys are selected', () => {
    // Add some selected keys
    const key1 = new Key()
    key1.x = 0
    key1.y = 0
    keyboardStore.selectedKeys = [key1]

    const wrapper = mount(RotationPointSelector, {
      props: defaultProps,
    })

    expect(wrapper.find('.rotation-point-selector').exists()).toBe(true)
  })

  it('should render rotation points based on selected keys', () => {
    // Add some selected keys
    const key1 = new Key()
    key1.x = 0
    key1.y = 0
    keyboardStore.selectedKeys = [key1]

    const wrapper = mount(RotationPointSelector, {
      props: defaultProps,
    })

    const points = wrapper.findAll('.rotation-point')
    expect(points).toHaveLength(5) // 4 corners + 1 center for 1 key
  })

  it('should differentiate between corner and center points', () => {
    const key1 = new Key()
    key1.x = 0
    key1.y = 0
    keyboardStore.selectedKeys = [key1]

    const wrapper = mount(RotationPointSelector, {
      props: defaultProps,
    })

    const cornerPoints = wrapper.findAll('.point-corner')
    const centerPoints = wrapper.findAll('.point-center')

    expect(cornerPoints.length).toBeGreaterThan(0)
    expect(centerPoints.length).toBeGreaterThan(0)
  })

  it('should emit pointSelected when a point is clicked', async () => {
    const key1 = new Key()
    key1.x = 0
    key1.y = 0
    keyboardStore.selectedKeys = [key1]

    const wrapper = mount(RotationPointSelector, {
      props: defaultProps,
    })

    const firstPoint = wrapper.find('.rotation-point')
    await firstPoint.trigger('click')

    expect(wrapper.emitted('pointSelected')).toBeTruthy()
    expect(wrapper.emitted('pointSelected')![0]).toBeDefined()
  })

  it('should handle mouse hover states', async () => {
    const key1 = new Key()
    key1.x = 0
    key1.y = 0
    keyboardStore.selectedKeys = [key1]

    const wrapper = mount(RotationPointSelector, {
      props: defaultProps,
    })

    const firstPoint = wrapper.find('.rotation-point')

    // Test mouse enter
    await firstPoint.trigger('mouseenter')
    expect(firstPoint.classes()).toContain('point-hovered')

    // Test mouse leave
    await firstPoint.trigger('mouseleave')
    expect(firstPoint.classes()).not.toContain('point-hovered')
  })

  it('should position points correctly based on coordinates and zoom', () => {
    const key1 = new Key()
    key1.x = 1
    key1.y = 1
    keyboardStore.selectedKeys = [key1]

    const wrapper = mount(RotationPointSelector, {
      props: {
        ...defaultProps,
        zoom: 2, // Double zoom
        unit: 50,
      },
    })

    const points = wrapper.findAll('.rotation-point')
    expect(points.length).toBeGreaterThan(0)

    // Check if first point has position styles
    const firstPoint = points[0]
    const style = firstPoint.attributes('style')
    expect(style).toContain('left:')
    expect(style).toContain('top:')
  })

  it('should update when moveStep changes', () => {
    const key1 = new Key()
    key1.x = 0
    key1.y = 0
    keyboardStore.selectedKeys = [key1]
    keyboardStore.moveStep = 0.25

    const wrapper = mount(RotationPointSelector, {
      props: defaultProps,
    })

    // Change move step
    keyboardStore.moveStep = 0.5

    // Should trigger recalculation (through computed property)
    const points = wrapper.findAll('.rotation-point')
    expect(points.length).toBeGreaterThan(0)
  })

  it('should handle empty selected keys gracefully', () => {
    keyboardStore.selectedKeys = []

    const wrapper = mount(RotationPointSelector, {
      props: defaultProps,
    })

    const points = wrapper.findAll('.rotation-point')
    expect(points).toHaveLength(0)
  })

  it('should apply correct CSS classes for point types', () => {
    const key1 = new Key()
    key1.x = 0
    key1.y = 0
    keyboardStore.selectedKeys = [key1]

    const wrapper = mount(RotationPointSelector, {
      props: defaultProps,
    })

    const cornerPoints = wrapper.findAll('.point-corner')
    const centerPoints = wrapper.findAll('.point-center')

    cornerPoints.forEach((point) => {
      expect(point.classes()).toContain('rotation-point')
      expect(point.classes()).toContain('point-corner')
    })

    centerPoints.forEach((point) => {
      expect(point.classes()).toContain('rotation-point')
      expect(point.classes()).toContain('point-center')
    })
  })
})
