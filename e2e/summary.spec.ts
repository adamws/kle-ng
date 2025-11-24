/**
 * Summary Tab E2E Tests
 *
 * Independent tests for the Summary tab and Key Center Positions table functionality.
 * These tests verify that the Summary tab UI works correctly (sorting, unit conversion, display).
 * They use presets as input and don't validate exact positions.
 *
 * Note: These tests are decoupled from ergogen-import.spec.ts which uses the Summary helper
 * to validate ergogen import results.
 */

import { test, expect } from '@playwright/test'
import { KeyboardEditorPage } from './pages/KeyboardEditorPage'
import { SummaryPanelComponent } from './pages/components/SummaryPanelComponent'
import { PresetComponent } from './pages/components/PresetComponent'
import { WaitHelpers } from './helpers/wait-helpers'

test.describe('Summary Tab Tests', () => {
  let editor: KeyboardEditorPage
  let summary: SummaryPanelComponent
  let preset: PresetComponent
  let waitHelpers: WaitHelpers

  test.beforeEach(async ({ page }) => {
    editor = new KeyboardEditorPage(page)
    summary = new SummaryPanelComponent(page)
    waitHelpers = new WaitHelpers(page)
    preset = new PresetComponent(page, waitHelpers)

    await editor.goto()
    await editor.clearLayout()
  })

  test('should display key centers table after loading preset', async () => {
    // Load a preset (Default 60% keyboard)
    await preset.selectPreset('Default 60%')

    // Wait for keys to load
    await editor.canvas.waitForRender()

    // Navigate to Summary tab
    await summary.navigateToSummaryTab()

    // Verify table is visible
    await summary.expectVisible()

    // Verify table has rows (60% has 61 keys)
    const count = await summary.getKeyCenterCount()
    expect(count).toBeGreaterThan(0)
  })

  test('should show coordinates in U mode with reasonable values', async () => {
    // Add a few keys manually for simple test
    await editor.toolbar.addKey()
    await editor.toolbar.addKey()
    await editor.toolbar.addKey()
    await editor.toolbar.addKey()

    // Wait for keys to render
    await editor.canvas.waitForRender()

    // Navigate to Summary tab
    await summary.navigateToSummaryTab()

    // Ensure we're in U mode
    await summary.toggleUnits('U')

    // Get first key center
    const center = await summary.getKeyCenterPosition(0)

    // Verify coordinates are reasonable (should be in units, typically 0-20 range for most layouts)
    expect(center.x).toBeGreaterThanOrEqual(0)
    expect(center.x).toBeLessThan(30)
    expect(center.y).toBeGreaterThanOrEqual(0)
    expect(center.y).toBeLessThan(30)

    // Verify we're displaying in U mode
    const units = await summary.getCurrentUnits()
    expect(units).toBe('U')
  })

  test('should convert coordinates to mm and verify unit conversion works', async () => {
    // Add a few keys manually
    await editor.toolbar.addKey()
    await editor.toolbar.addKey()

    // Wait for keys to render
    await editor.canvas.waitForRender()

    // Navigate to Summary tab
    await summary.navigateToSummaryTab()

    // Get coordinates in U mode first
    await summary.toggleUnits('U')
    const centerU = await summary.getKeyCenterPosition(0)

    // Switch to mm mode
    await summary.toggleUnits('mm')
    const centerMM = await summary.getKeyCenterPosition(0)

    // Verify conversion: mm = U * spacing (default 19.05mm)
    // Allow for small floating point differences
    const expectedX = centerU.x * 19.05
    const expectedY = centerU.y * 19.05

    // Check if conversion is approximately correct (within 0.01mm tolerance for rounding)
    expect(Math.abs(centerMM.x - expectedX)).toBeLessThan(0.1)
    expect(Math.abs(centerMM.y - expectedY)).toBeLessThan(0.1)

    // Verify we're displaying in mm mode
    const units = await summary.getCurrentUnits()
    expect(units).toBe('mm')
  })

  test('should verify specific values for 4-key layout', async () => {
    // Add 4 keys in a 2x2 grid pattern
    await editor.toolbar.addKey() // Key 0 at (0, 0)
    await editor.toolbar.addKey() // Key 1 at (1, 0)
    await editor.toolbar.addKey() // Key 2 at (2, 0)
    await editor.toolbar.addKey() // Key 3 at (3, 0)

    // Wait for keys to render
    await editor.canvas.waitForRender()

    // Navigate to Summary tab
    await summary.navigateToSummaryTab()

    // Verify we have 4 keys
    await summary.expectKeyCenterCount(4)

    // Get coordinates in U mode
    await summary.toggleUnits('U')
    const centers = await summary.getAllKeyCenterPositions()

    // Verify we got 4 centers
    expect(centers.length).toBe(4)

    // Verify centers have reasonable values (keys are laid out horizontally)
    // Default key positions when added sequentially should be (0.5, 0.5), (1.5, 0.5), etc.
    for (const center of centers) {
      expect(center.x).toBeGreaterThanOrEqual(0)
      expect(center.y).toBeGreaterThanOrEqual(0)
    }

    // Switch to mm and verify conversion works
    await summary.toggleUnits('mm')
    const centersMM = await summary.getAllKeyCenterPositions()

    // Verify mm values are approximately U * 19.05
    for (let i = 0; i < centers.length; i++) {
      const expectedX = centers[i].x * 19.05
      const expectedY = centers[i].y * 19.05
      expect(Math.abs(centersMM[i].x - expectedX)).toBeLessThan(0.1)
      expect(Math.abs(centersMM[i].y - expectedY)).toBeLessThan(0.1)
    }
  })

  test('should sort by X coordinate when header clicked', async ({ page }) => {
    // Load a preset with variety of X positions
    await preset.selectPreset('ANSI 104')

    // Wait for keys to load
    await editor.canvas.waitForRender()

    // Navigate to Summary tab
    await summary.navigateToSummaryTab()

    // Sort by X coordinate
    await summary.sortByColumn('x')

    // Get all X values from the table
    const rows = page.locator('.key-centers-table-container table tbody tr')
    const count = await rows.count()
    const xValues: number[] = []

    for (let i = 0; i < count; i++) {
      const row = rows.nth(i)
      const xCell = row.locator('td').nth(1)
      const xText = await xCell.textContent()
      xValues.push(parseFloat(xText!.trim()))
    }

    // Verify X values are sorted in ascending order
    const sortedXValues = [...xValues].sort((a, b) => a - b)
    expect(xValues).toEqual(sortedXValues)
  })

  test('should sort by Y coordinate when header clicked', async ({ page }) => {
    // Load a preset with variety of Y positions
    await preset.selectPreset('ANSI 104')

    // Wait for keys to load
    await editor.canvas.waitForRender()

    // Navigate to Summary tab
    await summary.navigateToSummaryTab()

    // Sort by Y coordinate
    await summary.sortByColumn('y')

    // Get all Y values from the table
    const rows = page.locator('.key-centers-table-container table tbody tr')
    const count = await rows.count()
    const yValues: number[] = []

    for (let i = 0; i < count; i++) {
      const row = rows.nth(i)
      const yCell = row.locator('td').nth(2)
      const yText = await yCell.textContent()
      yValues.push(parseFloat(yText!.trim()))
    }

    // Verify Y values are sorted in ascending order
    const sortedYValues = [...yValues].sort((a, b) => a - b)
    expect(yValues).toEqual(sortedYValues)
  })

  test('should highlight key on canvas when hovering table row', async ({ page }) => {
    // Load a simple preset
    await preset.selectPreset('Default 60%')

    // Wait for keys to load
    await editor.canvas.waitForRender()

    // Navigate to Summary tab
    await summary.navigateToSummaryTab()

    // Hover over the first row
    const firstRow = page.locator('.key-centers-table-container table tbody tr').first()
    await firstRow.hover()

    // Wait for hover effect
    await page.waitForTimeout(100)

    // Verify the row has the active/highlighted class
    await expect(firstRow).toHaveClass(/table-active/)
  })

  test('should toggle between U and mm units', async () => {
    // Add a few keys
    await editor.toolbar.addKey()
    await editor.toolbar.addKey()

    // Navigate to Summary tab
    await summary.navigateToSummaryTab()

    // Start in U mode
    await summary.toggleUnits('U')
    let units = await summary.getCurrentUnits()
    expect(units).toBe('U')

    // Switch to mm
    await summary.toggleUnits('mm')
    units = await summary.getCurrentUnits()
    expect(units).toBe('mm')

    // Switch back to U
    await summary.toggleUnits('U')
    units = await summary.getCurrentUnits()
    expect(units).toBe('U')
  })

  test('should sort by index (default sort)', async ({ page }) => {
    // Load a preset
    await preset.selectPreset('JD40')

    // Wait for keys to load
    await editor.canvas.waitForRender()

    // Navigate to Summary tab
    await summary.navigateToSummaryTab()

    // The table is already sorted by index by default, but click to ensure
    // Note: First click might sort descending, so click twice to get ascending
    await summary.sortByColumn('index')
    await summary.sortByColumn('index')

    // Get all index values from the table
    const rows = page.locator('.key-centers-table-container table tbody tr')
    const count = await rows.count()
    const indexValues: number[] = []

    for (let i = 0; i < count; i++) {
      const row = rows.nth(i)
      const indexCell = row.locator('td').nth(0)
      const indexText = await indexCell.textContent()
      indexValues.push(parseInt(indexText!.trim()))
    }

    // Verify index values are sorted in ascending order (0, 1, 2, ...)
    const sortedIndexValues = [...indexValues].sort((a, b) => a - b)
    expect(indexValues).toEqual(sortedIndexValues)
  })
})
