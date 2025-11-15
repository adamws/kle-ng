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
    })

    it('should show empty table when no keys', () => {
      store.keys = []

      const wrapper = mount(SummaryPanel, {
        global: {
          plugins: [pinia],
        },
      })

      // Select only rows from the first column (Keys Statistics)
      const rows = wrapper.findAll('.col-lg-3:first-child tbody tr')
      // Should only have summary row (Total Keys: 0)
      expect(rows).toHaveLength(1)
      const firstRow = rows[0]
      expect(firstRow).toBeDefined()
      expect(firstRow!.text()).toContain('Total Keys')
      expect(firstRow!.text()).toContain('0')
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

      // Select only rows from the first column (Keys Statistics)
      const rows = wrapper.findAll('.col-lg-3:first-child tbody tr:not(.table-active)')
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
      // Select only rows from the first column (Keys Statistics)
      const rows = wrapper.findAll('.col-lg-3:first-child tbody tr:not(.table-active)')
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

      // Select only rows from the first column (Keys Statistics)
      const dataRows = wrapper.findAll('.col-lg-3:first-child tbody tr:not(.table-active)')

      // First row should be the most frequent (2x1 with count 3)
      const firstDataRow = dataRows[0]
      expect(firstDataRow).toBeDefined()
      expect(firstDataRow!.text()).toContain('2 × 1')
      expect(firstDataRow!.text()).toContain('3')

      // Second row should be less frequent (1x1 with count 1)
      const secondDataRow = dataRows[1]
      expect(secondDataRow).toBeDefined()
      expect(secondDataRow!.text()).toContain('1 × 1')
      expect(secondDataRow!.text()).toContain('1')
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
      const firstHeader = headers[0]
      expect(firstHeader).toBeDefined()
      expect(firstHeader!.text()).toBe('Size (U)')
      const secondHeader = headers[1]
      expect(secondHeader).toBeDefined()
      expect(secondHeader!.text()).toBe('Count')
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
      const firstHeader = headers[0]
      expect(firstHeader).toBeDefined()
      expect(firstHeader!.text()).toBe('Size (U)')
      const secondHeader = headers[1]
      expect(secondHeader).toBeDefined()
      expect(secondHeader!.text()).toBe('Color')
      const thirdHeader = headers[2]
      expect(thirdHeader).toBeDefined()
      expect(thirdHeader!.text()).toBe('Count')
    })
  })

  describe('Keyboard Dimensions', () => {
    it('should display dimensions section header', () => {
      const wrapper = mount(SummaryPanel, {
        global: {
          plugins: [pinia],
        },
      })

      expect(wrapper.text()).toContain('Keyboard Dimensions')
    })

    it('should display dimensions for simple 2x2 layout', () => {
      store.keys = [
        createKey({ x: 0, y: 0, width: 1, height: 1 }),
        createKey({ x: 1, y: 0, width: 1, height: 1 }),
        createKey({ x: 0, y: 1, width: 1, height: 1 }),
        createKey({ x: 1, y: 1, width: 1, height: 1 }),
      ]

      const wrapper = mount(SummaryPanel, {
        global: {
          plugins: [pinia],
        },
      })

      const rows = wrapper.findAll('.col-lg-3:last-child tbody tr')
      expect(rows).toHaveLength(1)

      // Should display dimensions section
      const firstRow = rows[0]
      expect(firstRow).toBeDefined()
      const cols = firstRow!.findAll('td')
      expect(cols).toHaveLength(2)
      expect(cols[0]!.text()).toBe('2') // Width
      expect(cols[1]!.text()).toBe('2') // Height
    })

    it('should display dimensions for Planck-style 12×4 layout', () => {
      const keys = []
      for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 12; col++) {
          keys.push(createKey({ x: col, y: row, width: 1, height: 1 }))
        }
      }
      store.keys = keys

      const wrapper = mount(SummaryPanel, {
        global: {
          plugins: [pinia],
        },
      })

      // Should show 12x4 dimensions - check each dimension explicitly
      const rows = wrapper.findAll('.col-lg-3:last-child tbody tr')
      expect(rows).toHaveLength(1)

      const firstRow = rows[0]
      expect(firstRow).toBeDefined()
      const cols = firstRow!.findAll('td')
      expect(cols).toHaveLength(2)
      expect(cols[0]!.text()).toBe('12') // Width
      expect(cols[1]!.text()).toBe('4') // Height
    })

    it('should show empty state when no physical keys', () => {
      store.keys = []

      const wrapper = mount(SummaryPanel, {
        global: {
          plugins: [pinia],
        },
      })

      expect(wrapper.text()).toContain('No physical keys')
    })

    it('should show empty state when only decal keys present', () => {
      store.keys = [createKey({ x: 0, y: 0, width: 1, height: 1, decal: true })]

      const wrapper = mount(SummaryPanel, {
        global: {
          plugins: [pinia],
        },
      })

      expect(wrapper.text()).toContain('No physical keys')
    })

    it('should ignore decal keys in dimension calculation', () => {
      store.keys = [
        createKey({ x: 0, y: 0, width: 1, height: 1 }),
        createKey({ x: 10, y: 10, width: 5, height: 5, decal: true }),
      ]

      const wrapper = mount(SummaryPanel, {
        global: {
          plugins: [pinia],
        },
      })

      // Width and height should both be 1
      const rows = wrapper.findAll('.col-lg-3:last-child tbody tr')
      expect(rows).toHaveLength(1)

      const firstRow = rows[0]
      expect(firstRow).toBeDefined()
      const cols = firstRow!.findAll('td')
      expect(cols).toHaveLength(2)
      expect(cols[0]!.text()).toBe('1') // Width
      expect(cols[1]!.text()).toBe('1') // Height
    })

    it('should ignore ghost keys in dimension calculation', () => {
      store.keys = [
        createKey({ x: 0, y: 0, width: 1, height: 1 }),
        createKey({ x: 20, y: 20, width: 5, height: 5, ghost: true }),
      ]

      const wrapper = mount(SummaryPanel, {
        global: {
          plugins: [pinia],
        },
      })

      // Should only consider the 1x1 key - check explicitly
      const rows = wrapper.findAll('.col-lg-3:last-child tbody tr')
      expect(rows).toHaveLength(1)

      const firstRow = rows[0]
      expect(firstRow).toBeDefined()
      const cols = firstRow!.findAll('td')
      expect(cols).toHaveLength(2)
      expect(cols[0]!.text()).toBe('1') // Width
      expect(cols[1]!.text()).toBe('1') // Height
    })

    it('should display dimension displays with proper formatting', () => {
      store.keys = [createKey({ x: 0, y: 0, width: 1.25, height: 2.625 })]

      const wrapper = mount(SummaryPanel, {
        global: {
          plugins: [pinia],
        },
      })

      const rows = wrapper.findAll('.col-lg-3:last-child tbody tr')
      expect(rows).toHaveLength(1)

      const firstRow = rows[0]
      expect(firstRow).toBeDefined()
      const cols = firstRow!.findAll('td')
      expect(cols).toHaveLength(2)
      expect(cols[0]!.text()).toBe('1.25') // Width
      expect(cols[1]!.text()).toBe('2.625') // Height
    })

    it('should update dimensions when keys change', async () => {
      store.keys = [createKey({ x: 0, y: 0, width: 1, height: 1 })]

      const wrapper = mount(SummaryPanel, {
        global: {
          plugins: [pinia],
        },
      })

      // Initial dimensions should be 1.0 x 1.0
      const rows = wrapper.findAll('.col-lg-3:last-child tbody tr')
      expect(rows).toHaveLength(1)

      const firstRow = rows[0]
      expect(firstRow).toBeDefined()
      let cols = firstRow!.findAll('td')
      expect(cols).toHaveLength(2)
      expect(cols[0]!.text()).toBe('1') // Width
      expect(cols[1]!.text()).toBe('1') // Height

      // Add more keys
      store.keys = [
        createKey({ x: 0, y: 0, width: 1, height: 1 }),
        createKey({ x: 1, y: 0, width: 1, height: 1 }),
        createKey({ x: 2, y: 0, width: 1, height: 1 }),
      ]

      await wrapper.vm.$nextTick()

      // Dimensions should update to 3x1
      cols = firstRow!.findAll('td')
      expect(cols).toHaveLength(2)
      expect(cols[0]!.text()).toBe('3') // Width
      expect(cols[1]!.text()).toBe('1') // Height
    })

    it('should handle keys with different sizes', () => {
      store.keys = [
        createKey({ x: 0, y: 0, width: 1, height: 1 }),
        createKey({ x: 1, y: 0, width: 2.25, height: 1 }),
        createKey({ x: 0, y: 1, width: 1.5, height: 1 }),
        createKey({ x: 1.5, y: 1, width: 6.25, height: 1 }),
      ]

      const wrapper = mount(SummaryPanel, {
        global: {
          plugins: [pinia],
        },
      })

      // Width: 1.5 + 6.25 = 7.75, Height: 2 rows
      const rows = wrapper.findAll('.col-lg-3:last-child tbody tr')
      expect(rows).toHaveLength(1)

      const firstRow = rows[0]
      expect(firstRow).toBeDefined()
      const cols = firstRow!.findAll('td')
      expect(cols).toHaveLength(2)
      expect(cols[0]!.text()).toBe('7.75') // Width
      expect(cols[1]!.text()).toBe('2') // Height
    })
  })
})
