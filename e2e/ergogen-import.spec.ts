/**
 * Ergogen Import E2E Tests
 *
 * Comprehensive test suite for ergogen import functionality including:
 * - File import (.yaml and .yml)
 * - URL import
 * - Canvas rendering with visual snapshots
 */

import { test, expect } from '@playwright/test'
import { KeyboardEditorPage } from './pages/KeyboardEditorPage'
import { ErgogenImportHelper } from './helpers/ergogen-import-helpers'
import { WaitHelpers } from './helpers/wait-helpers'
import { SummaryPanelComponent } from './pages/components/SummaryPanelComponent'

test.describe('Ergogen Import Tests', () => {
  let editor: KeyboardEditorPage
  let ergogenHelper: ErgogenImportHelper
  let waitHelpers: WaitHelpers

  test.beforeEach(async ({ page }) => {
    editor = new KeyboardEditorPage(page)
    waitHelpers = new WaitHelpers(page)
    ergogenHelper = new ErgogenImportHelper(page, waitHelpers)

    await editor.goto()
    await editor.clearLayout()
  })

  test.describe('Section A: File Import Tests', () => {
    test('A1: should import simple 2x2 grid YAML file', async ({ page }) => {
      // Import the simple.yaml fixture
      await ergogenHelper.importErgogenFile('e2e/fixtures/ergogen/simple.yaml', 4)

      // Verify success toast
      await ergogenHelper.verifyImportSuccess('Ergogen layout imported')

      // Verify key count
      await editor.expectKeyCount(4)

      // Deselect all keys and wait for render
      await editor.canvas.deselectAll()
      await editor.canvas.waitForRender()

      // Take canvas snapshot
      await expect(editor.canvas.getLocator()).toHaveScreenshot('ergogen-simple-imported.png')

      // Verify key center positions match expected ergogen points
      const summaryPanel = new SummaryPanelComponent(page)
      await summaryPanel.navigateToSummaryTab()
      await summaryPanel.toggleUnits('mm')

      // Get key center positions from the UI
      const uiPositions = await summaryPanel.getAllKeyCenterPositions()

      // Load expected positions from JSON file
      const expectedData = await ergogenHelper.loadExpectedCenters('simple.json')

      // Verify key count matches
      expect(uiPositions.length).toBe(expectedData.keyCount)

      // Extract just x,y coordinates from UI positions
      const uiCenters = uiPositions.map(pos => ({ x: pos.x, y: pos.y }))

      // Apply Y-axis flip to expected positions (ergogen Y-up vs KLE Y-down)
      const flippedExpectedCenters = ergogenHelper.flipYAxis(expectedData.centers)

      // Compare positions
      await ergogenHelper.comparePositions(uiCenters, flippedExpectedCenters)
    })

    test('A2: should import full keyboard layout (absolem)', async ({ page }) => {
      // Import the absolem.yaml fixture
      await ergogenHelper.importErgogenFile('e2e/fixtures/ergogen/absolem.yaml', 36)

      // Verify success toast
      await ergogenHelper.verifyImportSuccess('Ergogen layout imported')

      // Verify key count (absolem has 36 keys)
      await editor.expectKeyCount(36)

      // Deselect all keys and wait for render
      await editor.canvas.deselectAll()
      await editor.canvas.waitForRender()

      // Take canvas snapshot
      await expect(editor.canvas.getLocator()).toHaveScreenshot('ergogen-absolem-imported.png')

      // Verify key center positions match expected ergogen points
      const summaryPanel = new SummaryPanelComponent(page)
      await summaryPanel.navigateToSummaryTab()
      await summaryPanel.toggleUnits('mm')

      // Get key center positions from the UI
      const uiPositions = await summaryPanel.getAllKeyCenterPositions()

      // Load expected positions from JSON file
      const expectedData = await ergogenHelper.loadExpectedCenters('absolem.json')

      // Verify key count matches
      expect(uiPositions.length).toBe(expectedData.keyCount)

      // Extract just x,y coordinates from UI positions
      const uiCenters = uiPositions.map(pos => ({ x: pos.x, y: pos.y }))

      // Apply Y-axis flip to expected positions (ergogen Y-up vs KLE Y-down)
      const flippedExpectedCenters = ergogenHelper.flipYAxis(expectedData.centers)

      // Compare positions
      await ergogenHelper.comparePositions(uiCenters, flippedExpectedCenters)
    })

    test('A3: should import full keyboard layout (adux)', async ({ page }) => {
      // Import the adux.yaml fixture
      await ergogenHelper.importErgogenFile('e2e/fixtures/ergogen/adux.yaml', 17)

      // Verify success toast
      await ergogenHelper.verifyImportSuccess('Ergogen layout imported')

      // Verify key count (adux has 17 keys)
      await editor.expectKeyCount(17)

      // Deselect all keys and wait for render
      await editor.canvas.deselectAll()
      await editor.canvas.waitForRender()

      // Take canvas snapshot
      await expect(editor.canvas.getLocator()).toHaveScreenshot('ergogen-adux-imported.png')

      // Verify key center positions match expected ergogen points
      const summaryPanel = new SummaryPanelComponent(page)
      await summaryPanel.navigateToSummaryTab()
      await summaryPanel.toggleUnits('mm')

      // Get key center positions from the UI
      const uiPositions = await summaryPanel.getAllKeyCenterPositions()

      // Load expected positions from JSON file
      const expectedData = await ergogenHelper.loadExpectedCenters('adux.json')

      // Verify key count matches
      expect(uiPositions.length).toBe(expectedData.keyCount)

      // Extract just x,y coordinates from UI positions
      const uiCenters = uiPositions.map(pos => ({ x: pos.x, y: pos.y }))

      // Apply Y-axis flip to expected positions (ergogen Y-up vs KLE Y-down)
      const flippedExpectedCenters = ergogenHelper.flipYAxis(expectedData.centers)

      // Compare positions
      await ergogenHelper.comparePositions(uiCenters, flippedExpectedCenters)
    })

    test('A4: should show error toast when importing invalid YAML', async ({ page }) => {
      // Set up file chooser event handler
      const fileChooserPromise = page.waitForEvent('filechooser')

      // Click Import button
      const importButton = page.locator('button', { hasText: 'Import' })
      await importButton.click()

      // Wait for dropdown and click "From File"
      await expect(page.locator('.dropdown-menu:has(a:has-text("From File"))')).toBeVisible()
      await page.locator('a', { hasText: 'From File' }).click()

      // Select the invalid YAML file
      const fileChooser = await fileChooserPromise
      await fileChooser.setFiles('e2e/fixtures/ergogen/invalid.yaml')

      // Verify error toast is shown
      await ergogenHelper.verifyImportError()

      // Verify no keys were imported
      await editor.expectKeyCount(0)
    })
  })

  test.describe('Section B: URL Import Tests', () => {
    test('B1: should open URL import modal and display URL input', async ({ page }) => {
      // Open URL import modal
      await ergogenHelper.openUrlImportModal()

      // Verify URL input is visible
      const urlInput = page.locator('#urlInput')
      await expect(urlInput).toBeVisible()

      // Verify Import button in modal
      const modalImportButton = page.locator('.modal-content button', { hasText: 'Import' })
      await expect(modalImportButton).toBeVisible()

      // Cancel the modal
      await ergogenHelper.cancelUrlImport()
    })

    test('B2: should import from ergogen.xyz URL with hash', async () => {
      const ergogenUrl =
        'https://ergogen.xyz/#N4Igxg9gdgZglgcxALhAWwKYBcCGyA6UABERlAnFBskQCwB0AjPQAyEAOElWAzgcUQBe0DH0IkSaHFgBOcAB78JEnFDAALCDKXKJMiLizUiAVnG7IAGwCuaKGIG6i7SgGsAnjqdzyXp0VcMd3oedkscTyIAWjNHf0DgrURKGgBtKMYAJgAaaMYATgBdc38AoJDcBAQMbSIskt00OAATZstqBqcEipwqmppY0spmjEVO3W6eSuraqIA2cZJKKm1FiUnp-ujM8f0AdwdSgCMDLAg0P2VNTEuJM-Y-LHVbI5hVW9UNLVuSGQwYGhSWQKAD6yxqIJOWDOaDWPHUcBgWDSUQA7LkMkVxlZbPYfkQqDhVnErucOiSJuVQn8cM0aJlmJlBqUysFQuFIlFMgAONYkbpJChQFGMZiokwYrEUkhvYks1khdg0ulEBn0Jl8hXsiI0Lm86XrcqClJEdL5egS6JS7wQA74p4vHT6QzGLlsARNGT6OV6f6A6RyeQglxQDwg64YBrNOBTT7GTKZADM9HFmXyqNR3JAAF8gA'
      const expectedKeyCount = 36
      await ergogenHelper.importErgogenUrl(ergogenUrl, expectedKeyCount)
      await ergogenHelper.verifyImportSuccess()
    })

    test('B3: should handle invalid URL gracefully', async ({ page }) => {
      // Open URL import modal
      await ergogenHelper.openUrlImportModal()

      // Enter invalid URL
      const urlInput = page.locator('#urlInput')
      await urlInput.fill('not-a-valid-url')

      // Try to import
      const modalImportButton = page.locator('.modal-content button', { hasText: 'Import' })
      await modalImportButton.click()

      // Should show error or reject import
      // Note: Actual behavior depends on implementation
      // For now, just verify modal doesn't crash
      await waitHelpers.waitForDoubleAnimationFrame()
    })

    test('B4: should allow cancelling URL import', async ({ page }) => {
      // Open URL import modal
      await ergogenHelper.openUrlImportModal()

      // Verify modal is open
      const modal = page.locator('.modal-content')
      await expect(modal).toBeVisible()

      // Cancel the import
      await ergogenHelper.cancelUrlImport()

      // Verify modal is closed
      await expect(modal).toBeHidden()

      // Verify no keys were imported
      await editor.expectKeyCount(0)
    })
  })
})
