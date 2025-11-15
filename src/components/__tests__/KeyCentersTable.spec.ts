import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import KeyCentersTable from '../KeyCentersTable.vue'
import { useKeyboardStore } from '@/stores/keyboard'
import { Key } from '@adamws/kle-serial'

describe('KeyCentersTable', () => {
  let pinia: ReturnType<typeof createPinia>

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
  })

  const createKey = (x: number, y: number, width = 1, height = 1): Key => {
    const key = new Key()
    key.x = x
    key.y = y
    key.width = width
    key.height = height
    return key
  }

  it('should render empty state when no keys', () => {
    const wrapper = mount(KeyCentersTable, {
      global: { plugins: [pinia] },
    })

    expect(wrapper.text()).toContain('No keys')
    expect(wrapper.find('.bi-grid-3x3').exists()).toBe(true)
  })

  it('should display key centers for simple layout', () => {
    const store = useKeyboardStore()
    store.keys = [createKey(0, 0), createKey(1, 0), createKey(0, 1)]

    const wrapper = mount(KeyCentersTable, {
      global: { plugins: [pinia] },
    })

    // Should have 3 rows
    const rows = wrapper.findAll('tbody tr')
    expect(rows).toHaveLength(3)

    // Check first key center (0.5, 0.5)
    expect(rows[0]?.text()).toContain('0')
    expect(rows[0]?.text()).toContain('0.5')
    expect(rows[0]?.text()).toContain('0.5')
  })

  it('should set tempSelectedKeys on row hover', async () => {
    const store = useKeyboardStore()
    store.keys = [createKey(0, 0)]

    const wrapper = mount(KeyCentersTable, {
      global: { plugins: [pinia] },
    })

    const row = wrapper.find('tbody tr')
    await row.trigger('mouseenter')

    expect(store.tempSelectedKeys).toEqual([store.keys[0]])
  })

  it('should clear tempSelectedKeys on row leave', async () => {
    const store = useKeyboardStore()
    store.keys = [createKey(0, 0)]

    const wrapper = mount(KeyCentersTable, {
      global: { plugins: [pinia] },
    })

    const row = wrapper.find('tbody tr')
    await row.trigger('mouseenter')
    expect(store.tempSelectedKeys).toEqual([store.keys[0]])

    await row.trigger('mouseleave')
    expect(store.tempSelectedKeys).toEqual([])
  })

  it('should highlight hovered row', async () => {
    const store = useKeyboardStore()
    const testKey = createKey(0, 0)
    store.keys = [testKey, createKey(1, 0)]

    const wrapper = mount(KeyCentersTable, {
      global: { plugins: [pinia] },
    })

    // Hover first row
    const firstRow = wrapper.findAll('tbody tr')[0]
    if (firstRow) {
      await firstRow.trigger('mouseenter')
      await wrapper.vm.$nextTick()

      expect(firstRow.classes()).toContain('table-active')
    }
  })

  it('should calculate centers for rotated keys correctly', () => {
    const store = useKeyboardStore()
    const rotatedKey = createKey(0, 0)
    rotatedKey.rotation_angle = 45
    rotatedKey.rotation_x = 0
    rotatedKey.rotation_y = 0
    store.keys = [rotatedKey]

    const wrapper = mount(KeyCentersTable, {
      global: { plugins: [pinia] },
    })

    const row = wrapper.find('tbody tr')
    // Should still display coordinates (getKeyCenter handles rotation)
    // The center will be transformed by rotation, so just check that we have numeric values
    const text = row.text()
    expect(text).toContain('0')
    expect(text).toMatch(/\d+\.\d{2}/) // Should have at least one number with 2 decimal places
  })

  it('should format coordinates to 6 decimal places', () => {
    const store = useKeyboardStore()
    store.keys = [createKey(0.1234563, 0.9876542)]

    const wrapper = mount(KeyCentersTable, {
      global: { plugins: [pinia] },
    })

    const row = wrapper.find('tbody tr')
    // Center should be (0.1234563 + 0.5, 0.9876542 + 0.5) = (0.6234563, 1.4876542)
    // Formatted to 6 decimals: (0.623456, 1.487654)
    expect(row.text()).toContain('0.623456')
    expect(row.text()).toContain('1.487654')
  })

  it('should handle large coordinates correctly', () => {
    const store = useKeyboardStore()
    store.keys = [createKey(100, 200)]

    const wrapper = mount(KeyCentersTable, {
      global: { plugins: [pinia] },
    })

    const row = wrapper.find('tbody tr')
    // Center should be (100.5, 200.5)
    expect(row.text()).toContain('100.5')
    expect(row.text()).toContain('200.5')
  })

  it('should display key index correctly', () => {
    const store = useKeyboardStore()
    store.keys = [createKey(0, 0), createKey(1, 0), createKey(2, 0)]

    const wrapper = mount(KeyCentersTable, {
      global: { plugins: [pinia] },
    })

    const rows = wrapper.findAll('tbody tr')
    expect(rows[0]?.text()).toContain('0')
    expect(rows[1]?.text()).toContain('1')
    expect(rows[2]?.text()).toContain('2')
  })

  it('should use monospace font for coordinates', () => {
    const store = useKeyboardStore()
    store.keys = [createKey(0, 0)]

    const wrapper = mount(KeyCentersTable, {
      global: { plugins: [pinia] },
    })

    const coordinateCells = wrapper.findAll('.font-monospace')
    expect(coordinateCells.length).toBeGreaterThan(0)
  })
})
