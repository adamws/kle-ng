import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { Key } from '@adamws/kle-serial'
import KeyCentersTable from '../KeyCentersTable.vue'
import { useKeyboardStore } from '@/stores/keyboard'

// Mock the geometry utility
vi.mock('@/utils/keyboard-geometry', () => ({
  getKeyCenter: (key: Key) => ({
    x: key.x + (key.width || 1) / 2,
    y: key.y + (key.height || 1) / 2,
  }),
}))

describe('KeyCentersTable', () => {
  let store: ReturnType<typeof useKeyboardStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useKeyboardStore()

    // Add some test keys
    const keys = [
      { x: 0, y: 0, width: 1, height: 1 } as Key, // Center: (0.5, 0.5)
      { x: 2, y: 1, width: 1, height: 1 } as Key, // Center: (2.5, 1.5)
      { x: 1, y: 2, width: 1, height: 1 } as Key, // Center: (1.5, 2.5)
    ]

    store.keys.push(...keys)
  })

  it('should render table with keys', () => {
    const wrapper = mount(KeyCentersTable, {
      props: {
        units: 'U',
        spacing: { x: 19.05, y: 19.05 },
      },
    })

    expect(wrapper.find('table').exists()).toBe(true)
    expect(wrapper.findAll('tbody tr')).toHaveLength(3)
  })

  it('should show sortable headers', () => {
    const wrapper = mount(KeyCentersTable, {
      props: {
        units: 'U',
        spacing: { x: 19.05, y: 19.05 },
      },
    })

    const headers = wrapper.findAll('th.sortable-header')
    expect(headers).toHaveLength(3)
  })

  it('should sort by index by default', () => {
    const wrapper = mount(KeyCentersTable, {
      props: {
        units: 'U',
        spacing: { x: 19.05, y: 19.05 },
      },
    })

    const rows = wrapper.findAll('tbody tr')
    expect(rows.length).toBeGreaterThan(0)
    const firstIndexCell = rows[0]!.find('td').text()
    expect(firstIndexCell).toBe('0')
  })

  it('should handle header clicks for sorting', async () => {
    const wrapper = mount(KeyCentersTable, {
      props: {
        units: 'U',
        spacing: { x: 19.05, y: 19.05 },
      },
    })

    // Click on X column header
    const headers = wrapper.findAll('th.sortable-header')
    expect(headers.length).toBeGreaterThan(1)
    const xHeader = headers[1]!
    await xHeader.trigger('click')

    // Should be sorted by X coordinate ascending (0.5, 1.5, 2.5)
    const rows = wrapper.findAll('tbody tr')
    expect(rows.length).toBeGreaterThan(0)
    const firstIndexCell = rows[0]!.find('td').text()
    expect(firstIndexCell).toBe('0') // Key at x=0 (center 0.5) should be first

    // Click again to reverse sort
    await xHeader.trigger('click')
    const reversedRows = wrapper.findAll('tbody tr')
    expect(reversedRows.length).toBeGreaterThan(0)
    const firstIndexCellReversed = reversedRows[0]!.find('td').text()
    expect(firstIndexCellReversed).toBe('1') // Key at x=2 (center 2.5) should be first
  })

  it('should convert coordinates to mm when units=mm', () => {
    const wrapper = mount(KeyCentersTable, {
      props: {
        units: 'mm',
        spacing: { x: 18, y: 17 },
      },
    })

    const rows = wrapper.findAll('tbody tr')
    expect(rows.length).toBeGreaterThan(0)
    const firstRow = rows[0]!.findAll('td')
    expect(firstRow.length).toBeGreaterThanOrEqual(3)

    // Check if coordinate values are converted (should be larger than U values)
    const xValue = parseFloat(firstRow[1]!.text())
    const yValue = parseFloat(firstRow[2]!.text())

    expect(xValue).toBeGreaterThan(1) // 0.5 * 18 = 9
    expect(yValue).toBeGreaterThan(1) // 0.5 * 17 = 8.5
  })
})
