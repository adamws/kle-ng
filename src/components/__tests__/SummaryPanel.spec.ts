import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import SummaryPanel from '../SummaryPanel.vue'
import { useKeyboardStore } from '@/stores/keyboard'
import { Key } from '@adamws/kle-serial'

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(() => null),
}
global.localStorage = localStorageMock as Storage

describe('SummaryPanel', () => {
  let store: ReturnType<typeof useKeyboardStore>
  let pinia: ReturnType<typeof createPinia>

  beforeEach(() => {
    vi.clearAllMocks()
    pinia = createPinia()
    setActivePinia(pinia)
    store = useKeyboardStore()

    // Clear localStorage mock
    localStorageMock.getItem.mockReturnValue(null)
  })

  const createKey = (overrides: Partial<Key> = {}): Key => {
    const key = new Key()
    Object.assign(key, {
      width: 1,
      height: 1,
      width2: 1,
      height2: 1,
      x: 0,
      y: 0,
      color: '#cccccc',
      decal: false,
      stepped: false,
      ...overrides,
    })
    return key
  }

  describe('Basic functionality', () => {
    it('should render with default view mode "size"', () => {
      const wrapper = mount(SummaryPanel, {
        global: {
          plugins: [pinia],
        },
      })

      expect((wrapper.find('input[value="size"]').element as HTMLInputElement).checked).toBe(true)
      expect(wrapper.find('.table-section h6').text()).toBe('Keys by Size')
    })

    it('should switch between view modes', async () => {
      const wrapper = mount(SummaryPanel, {
        global: {
          plugins: [pinia],
        },
      })

      // Switch to size-color view
      await wrapper.find('input[value="size-color"]').setValue(true)

      expect((wrapper.find('input[value="size-color"]').element as HTMLInputElement).checked).toBe(
        true,
      )
      expect(wrapper.find('.table-section h6').text()).toBe('Keys by Size & Color')
    })

    it('should show empty table when no keys', () => {
      store.keys = []

      const wrapper = mount(SummaryPanel, {
        global: {
          plugins: [pinia],
        },
      })

      const rows = wrapper.findAll('tbody tr')
      // Should only have summary row (Total Keys: 0)
      expect(rows).toHaveLength(1)
      expect(rows[0].text()).toContain('Total Keys')
      expect(rows[0].text()).toContain('0')
    })
  })

  describe('Key size formatting', () => {
    it('should format regular keys correctly', () => {
      store.keys = [
        createKey({ width: 1, height: 1 }),
        createKey({ width: 2, height: 2 }),
        createKey({ width: 6.25, height: 1 }),
        createKey({ width: 1.25, height: 2 }),
      ]

      const wrapper = mount(SummaryPanel, {
        global: {
          plugins: [pinia],
        },
      })

      const tableText = wrapper.find('tbody').text()
      expect(tableText).toContain('1 × 1')
      expect(tableText).toContain('2 × 2')
      expect(tableText).toContain('6.25 × 1')
      expect(tableText).toContain('1.25 × 2')
    })

    it('should detect ISO Enter keys', () => {
      store.keys = [
        createKey({
          width: 1.25,
          height: 2,
          width2: 1.5,
          height2: 1,
          x2: -0.25,
          y2: 0,
        }),
      ]

      const wrapper = mount(SummaryPanel, {
        global: {
          plugins: [pinia],
        },
      })

      expect(wrapper.find('tbody').text()).toContain('ISO Enter')
    })

    it('should detect Big-Ass Enter keys', () => {
      store.keys = [
        createKey({
          width: 1.5,
          height: 2,
          width2: 2.25,
          height2: 1,
          x2: -0.75,
          y2: 1,
        }),
      ]

      const wrapper = mount(SummaryPanel, {
        global: {
          plugins: [pinia],
        },
      })

      expect(wrapper.find('tbody').text()).toContain('Big-Ass Enter')
    })

    it('should detect stepped keys', () => {
      store.keys = [
        createKey({
          width: 1.75,
          height: 1,
          width2: 1.5,
          height2: 1,
          stepped: true,
        }),
      ]

      const wrapper = mount(SummaryPanel, {
        global: {
          plugins: [pinia],
        },
      })

      expect(wrapper.find('tbody').text()).toContain('1.75 × 1+1.5 × 1 (stepped)')
    })

    it('should detect non-rectangular keys', () => {
      store.keys = [
        createKey({
          width: 2,
          height: 1,
          width2: 1,
          height2: 1,
          x2: 1,
          y2: 0,
        }),
      ]

      const wrapper = mount(SummaryPanel, {
        global: {
          plugins: [pinia],
        },
      })

      expect(wrapper.find('tbody').text()).toContain('2 × 1+1 × 1 (non-rectangular)')
    })
  })

  describe('Decal key handling', () => {
    it('should separate decal keys from regular keys', () => {
      store.keys = [
        createKey({ width: 1, height: 1, width2: 1, height2: 1, decal: false }),
        createKey({ width: 1, height: 1, width2: 1, height2: 1, decal: false }),
        createKey({ width: 1, height: 1, width2: 1, height2: 1, decal: true }),
        createKey({ width: 2, height: 1, width2: 2, height2: 1, decal: true }),
      ]

      const wrapper = mount(SummaryPanel, {
        global: {
          plugins: [pinia],
        },
      })

      const tableText = wrapper.find('tbody').text()
      expect(tableText).toContain('1 × 1') // Regular 1x1 keys (count: 2)
      expect(tableText).toContain('1 × 1 (decal)') // Decal 1x1 key (count: 1)
      expect(tableText).toContain('2 × 1 (decal)') // Decal 2x1 key (count: 1)
    })

    it('should show detailed totals when decals present', () => {
      store.keys = [
        createKey({ decal: false }),
        createKey({ decal: false }),
        createKey({ decal: true }),
      ]

      const wrapper = mount(SummaryPanel, {
        global: {
          plugins: [pinia],
        },
      })

      const summaryRows = wrapper.findAll('.table-active')
      expect(summaryRows).toHaveLength(3) // Total, Regular, Decal

      const tableText = wrapper.find('tbody').text()
      expect(tableText).toContain('Total Keys3')
      expect(tableText).toContain('Regular Keys2')
      expect(tableText).toContain('Decal Keys1')
    })

    it('should hide decal totals when no decals present', () => {
      store.keys = [createKey({ decal: false }), createKey({ decal: false })]

      const wrapper = mount(SummaryPanel, {
        global: {
          plugins: [pinia],
        },
      })

      const summaryRows = wrapper.findAll('.table-active')
      expect(summaryRows).toHaveLength(1) // Only Total Keys

      const tableText = wrapper.find('tbody').text()
      expect(tableText).toContain('Total Keys2')
      expect(tableText).not.toContain('Regular Keys')
      expect(tableText).not.toContain('Decal Keys')
    })
  })

  describe('Size and Color view', () => {
    it('should show color information in size-color view', async () => {
      store.keys = [
        createKey({ width: 1, height: 1, color: '#ff0000' }),
        createKey({ width: 1, height: 1, color: '#00ff00' }),
        createKey({ width: 1, height: 1, color: '#ff0000' }),
      ]

      const wrapper = mount(SummaryPanel, {
        global: {
          plugins: [pinia],
        },
      })

      // Switch to size-color view
      await wrapper.find('input[value="size-color"]').setValue(true)

      const colorSwatches = wrapper.findAll('.color-swatch')
      expect(colorSwatches.length).toBeGreaterThan(0)

      const colorCodes = wrapper.findAll('.color-code')
      expect(colorCodes.some((code) => code.text() === '#ff0000')).toBe(true)
      expect(colorCodes.some((code) => code.text() === '#00ff00')).toBe(true)
    })

    it('should group keys by size and color', async () => {
      store.keys = [
        createKey({ width: 1, height: 1, color: '#ff0000' }),
        createKey({ width: 1, height: 1, color: '#ff0000' }),
        createKey({ width: 1, height: 1, color: '#00ff00' }),
      ]

      const wrapper = mount(SummaryPanel, {
        global: {
          plugins: [pinia],
        },
      })

      // Switch to size-color view
      await wrapper.find('input[value="size-color"]').setValue(true)

      const rows = wrapper.findAll('tbody tr:not(.table-active)')
      expect(rows).toHaveLength(2) // Two different color groups

      // Should have one row with count 2 (red keys) and one with count 1 (green key)
      const tableText = wrapper.find('tbody').text()
      expect(tableText).toContain('2') // Count for red keys
      expect(tableText).toContain('1') // Count for green key
    })
  })

  describe('Key counting and totals', () => {
    it('should count keys correctly', () => {
      store.keys = [
        createKey({ width: 1, height: 1 }),
        createKey({ width: 1, height: 1 }),
        createKey({ width: 2, height: 1 }),
        createKey({ width: 6.25, height: 1 }),
      ]

      const wrapper = mount(SummaryPanel, {
        global: {
          plugins: [pinia],
        },
      })

      // Check individual counts
      const rows = wrapper.findAll('tbody tr:not(.table-active)')
      expect(rows).toHaveLength(3) // 1x1 (count 2), 2x1 (count 1), 6.25x1 (count 1)

      // Check total
      expect(wrapper.find('.table-active').text()).toContain('Total Keys4')
    })

    it('should sort keys by count descending', () => {
      store.keys = [
        createKey({ width: 1, height: 1 }),
        createKey({ width: 2, height: 1 }),
        createKey({ width: 2, height: 1 }),
        createKey({ width: 2, height: 1 }),
        createKey({ width: 6.25, height: 1 }),
      ]

      const wrapper = mount(SummaryPanel, {
        global: {
          plugins: [pinia],
        },
      })

      const dataRows = wrapper.findAll('tbody tr:not(.table-active)')

      // First row should be the most frequent (2x1 with count 3)
      expect(dataRows[0].text()).toContain('2 × 1')
      expect(dataRows[0].text()).toContain('3')

      // Second row should be less frequent (1x1 with count 1)
      expect(dataRows[1].text()).toContain('1 × 1')
      expect(dataRows[1].text()).toContain('1')
    })
  })

  describe('Column headers', () => {
    it('should show correct headers for size view', () => {
      const wrapper = mount(SummaryPanel, {
        global: {
          plugins: [pinia],
        },
      })

      const headers = wrapper.findAll('th')
      expect(headers[0].text()).toBe('Size (U)')
      expect(headers[1].text()).toBe('Count')
    })

    it('should show correct headers for size-color view', async () => {
      const wrapper = mount(SummaryPanel, {
        global: {
          plugins: [pinia],
        },
      })

      // Switch to size-color view
      await wrapper.find('input[value="size-color"]').setValue(true)

      const headers = wrapper.findAll('th')
      expect(headers[0].text()).toBe('Size (U)')
      expect(headers[1].text()).toBe('Color')
      expect(headers[2].text()).toBe('Count')
    })
  })
})
