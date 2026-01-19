import { test, expect } from '@playwright/test'
import { KeyboardEditorPage } from './pages/KeyboardEditorPage'
import { PresetComponent } from './pages/components/PresetComponent'
import { ImportExportHelper } from './helpers/import-export-helpers'
import { WaitHelpers } from './helpers/wait-helpers'
import { SELECTORS } from './constants/selectors'

test.describe('Smart Dirty Detection', () => {
  test.beforeEach(async ({ page }) => {
    // Mock clipboard API for share link tests
    await page.addInitScript(() => {
      let clipboardData = ''
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          writeText: async (text: string) => {
            clipboardData = text
            return Promise.resolve()
          },
          readText: async () => {
            return Promise.resolve(clipboardData)
          },
        },
        writable: true,
      })
    })

    await page.goto('/')
  })

  test('should not show unsaved indicator on initial load', async ({ page }) => {
    const editor = new KeyboardEditorPage(page)
    await editor.expectNoUnsavedChanges()
  })

  test('should show unsaved indicator after adding a key', async ({ page }) => {
    const editor = new KeyboardEditorPage(page)

    await editor.expectNoUnsavedChanges()
    await editor.toolbar.addKey()
    await editor.expectUnsavedChanges()
  })

  test('should hide unsaved indicator after undoing all changes', async ({ page }) => {
    const editor = new KeyboardEditorPage(page)

    // Add a key - should show unsaved
    await editor.toolbar.addKey()
    await editor.expectUnsavedChanges()

    // Undo - should hide unsaved (back to baseline)
    await editor.toolbar.undo()
    await editor.expectNoUnsavedChanges()
  })

  test('should show unsaved indicator after redo', async ({ page }) => {
    const editor = new KeyboardEditorPage(page)

    // Add and undo
    await editor.toolbar.addKey()
    await editor.toolbar.undo()
    await editor.expectNoUnsavedChanges()

    // Redo - should show unsaved again
    await editor.toolbar.redo()
    await editor.expectUnsavedChanges()
  })

  test('should hide unsaved indicator after undoing multiple changes', async ({ page }) => {
    const editor = new KeyboardEditorPage(page)

    // Add multiple keys
    await editor.toolbar.addKey()
    await editor.toolbar.addKey()
    await editor.toolbar.addKey()
    await editor.expectUnsavedChanges()
    await editor.expectKeyCount(3)

    // Undo one - still dirty
    await editor.toolbar.undo()
    await editor.expectKeyCount(2)
    await editor.expectUnsavedChanges()

    // Undo another - still dirty
    await editor.toolbar.undo()
    await editor.expectKeyCount(1)
    await editor.expectUnsavedChanges()

    // Undo last - back to baseline, should be clean
    await editor.toolbar.undo()
    await editor.expectKeyCount(0)
    await editor.expectNoUnsavedChanges()
  })

  test('should hide unsaved indicator after downloading JSON', async ({ page }) => {
    const editor = new KeyboardEditorPage(page)

    // Add a key - should show unsaved
    await editor.toolbar.addKey()
    await editor.expectUnsavedChanges()

    // Set up download handler
    const downloadPromise = page.waitForEvent('download')

    // Open export dropdown and click download JSON
    await page.locator(SELECTORS.IMPORT_EXPORT.EXPORT_BUTTON).click()
    await page.locator(SELECTORS.IMPORT_EXPORT.DOWNLOAD_JSON).click()

    // Wait for download to start
    await downloadPromise

    // Should now be clean (baseline updated)
    await editor.expectNoUnsavedChanges()
  })

  test('should keep unsaved indicator after generating share link', async ({ page }) => {
    const editor = new KeyboardEditorPage(page)

    // Add a key - should show unsaved
    await editor.toolbar.addKey()
    await editor.expectUnsavedChanges()

    // Click share button (find by text since it doesn't have data-testid)
    await page.getByRole('button', { name: /share link/i }).click()

    // Wait for toast notification indicating success
    await expect(page.locator(SELECTORS.TOAST.NOTIFICATION)).toBeVisible({ timeout: 5000 })
    await expect(page.locator(SELECTORS.TOAST.TITLE)).toContainText(/copied|link/i)

    // Share link does NOT update baseline - should still show unsaved
    await editor.expectUnsavedChanges()
  })

  test('should become dirty again after modifying exported layout', async ({ page }) => {
    const editor = new KeyboardEditorPage(page)

    // Add a key
    await editor.toolbar.addKey()

    // Set up download and export
    const downloadPromise = page.waitForEvent('download')
    await page.locator(SELECTORS.IMPORT_EXPORT.EXPORT_BUTTON).click()
    await page.locator(SELECTORS.IMPORT_EXPORT.DOWNLOAD_JSON).click()
    await downloadPromise

    // Should be clean after export
    await editor.expectNoUnsavedChanges()

    // Add another key - should become dirty again
    await editor.toolbar.addKey()
    await editor.expectUnsavedChanges()
  })

  test('should not show unsaved after importing file (replaces dirty state)', async ({ page }) => {
    const editor = new KeyboardEditorPage(page)
    const waitHelpers = new WaitHelpers(page)
    const importHelper = new ImportExportHelper(page, waitHelpers)

    // Add a key - should show unsaved
    await editor.toolbar.addKey()
    await editor.expectUnsavedChanges()

    // Import a layout from file - this should establish new baseline
    await importHelper.importFromFile('e2e/fixtures/simple-layout.json', 8)

    // Should be clean after import (new baseline established)
    await editor.expectNoUnsavedChanges()
  })

  test('should not show unsaved after loading preset', async ({ page }) => {
    const editor = new KeyboardEditorPage(page)
    const waitHelpers = new WaitHelpers(page)
    const preset = new PresetComponent(page, waitHelpers)

    // Add a key - should show unsaved
    await editor.toolbar.addKey()
    await editor.expectUnsavedChanges()

    // Load a preset (this should establish a new baseline)
    await preset.selectPreset('Default 60%')

    // Wait for layout to load
    await expect(page.locator(SELECTORS.COUNTERS.KEYS)).not.toContainText('Keys: 1')

    // Should be clean after loading preset
    await editor.expectNoUnsavedChanges()
  })

  test('should detect when key is moved back to original position (smart detection)', async ({
    page,
  }) => {
    const editor = new KeyboardEditorPage(page)
    const waitHelpers = new WaitHelpers(page)
    const preset = new PresetComponent(page, waitHelpers)

    // Load a preset to have a baseline with keys
    await preset.selectPreset('Default 60%')

    // Wait for layout to load and be clean
    await expect(page.locator(SELECTORS.COUNTERS.KEYS)).toContainText('Keys: 61')
    await editor.expectNoUnsavedChanges()

    // Select a key and modify its position
    await editor.canvas.clickKey(0)
    await editor.expectSelectedCount(1)

    // Use keyboard to move the key
    await page.keyboard.press('ArrowRight')
    await editor.expectUnsavedChanges()

    // Move it back
    await page.keyboard.press('ArrowLeft')

    // Should be clean again (smart detection: state matches baseline)
    await editor.expectNoUnsavedChanges()
  })
})
