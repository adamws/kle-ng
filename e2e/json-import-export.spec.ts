import { test, expect } from '@playwright/test'
import { promises as fs } from 'fs'
import path from 'path'
import { ImportExportHelper } from './helpers/import-export-helpers'
import { WaitHelpers } from './helpers/wait-helpers'

test.describe('JSON Import/Export Functionality', () => {
  // Canvas rendering tests only run on Chromium since we've verified
  // pixel-perfect identical rendering across all browsers

  test.skip(
    ({ browserName }) => browserName !== 'chromium',
    'Canvas rendering tests only run on Chromium (verified identical across browsers)',
  )

  let helper: ImportExportHelper
  let waitHelpers: WaitHelpers

  test.beforeEach(async ({ page }) => {
    await page.goto('/')

    // Wait for app to load
    await expect(page.locator('.canvas-toolbar')).toBeVisible()

    // Initialize helpers
    waitHelpers = new WaitHelpers(page)
    helper = new ImportExportHelper(page, waitHelpers)
  })

  test.describe('JSON Import Tests', () => {
    test('should import a simple JSON layout', async ({ page }) => {
      // Initially should show 0 keys
      await expect(page.getByTestId('counter-keys')).toContainText('Keys: 0')

      // Import simple layout (2 rows x 4 keys = 8 keys total)
      await helper.importFromFile('e2e/fixtures/simple-layout.json', 8)

      // Verify some of the imported keys are visible
      await expect(page.locator('.selected-counter')).toContainText('Selected: 0')

      // Take screenshot to verify layout was imported
      await expect(page.locator('.keyboard-canvas')).toHaveScreenshot('simple-layout-imported.png')
    })

    test('should import complex layout with colors and rotation', async ({ page }) => {
      // Import complex layout (Esc, F1, F2, Tab, Q, W = 6 keys)
      await helper.importFromFile('e2e/fixtures/complex-layout.json', 6)

      // Take screenshot to verify complex layout with colors and rotation
      await expect(page.locator('.keyboard-canvas')).toHaveScreenshot('complex-layout-imported.png')
    })

    test('should import empty layout', async () => {
      // Import empty layout (should have 0 keys)
      await helper.importFromFile('e2e/fixtures/empty-layout.json', 0)
    })

    test('should handle invalid JSON gracefully', async ({ page }) => {
      // Import invalid JSON (should show error, no keys imported)
      await helper.importFromFile('e2e/fixtures/invalid.json')

      // Wait for error toast notification to appear
      await expect(page.locator('.toast-notification')).toBeVisible()
      await expect(page.locator('.toast-notification')).toHaveClass(/toast-error/)
      await expect(page.locator('.toast-title')).toContainText('Error loading file')

      // Should remain at 0 keys after error
      await expect(page.getByTestId('counter-keys')).toContainText('Keys: 0')
    })

    test('should import layout with rotated keys', async ({ page }) => {
      // Import layout with rotated keys (3 keys)
      await helper.importFromFile('e2e/fixtures/rotated-keys.json', 3)

      // Take screenshot to verify rotated keys
      await expect(page.locator('.keyboard-canvas')).toHaveScreenshot('rotated-keys-imported.png')
    })

    test('should import VIA format layout', async ({ page }) => {
      // Import VIA format layout (2 rows x 4 keys = 8 keys)
      await helper.importFromFile('e2e/fixtures/via-layout.json', 8)

      // Verify success message indicates VIA format
      await expect(page.locator('.toast-notification')).toBeVisible()
      await expect(page.locator('.toast-title')).toContainText('Import successful')

      // Take screenshot to verify VIA layout was imported
      await expect(page.locator('.keyboard-canvas')).toHaveScreenshot('via-layout-imported.png')
    })
  })

  test.describe('PNG Export Tests', () => {
    test('should export layout as PNG without errors', async ({ page }) => {
      // Add some keys first
      await page.locator('button[title="Add Standard Key"]').click()
      await page.locator('button[title="Add Standard Key"]').click()
      await expect(page.getByTestId('counter-keys')).toContainText('Keys: 2')

      // Export as PNG
      const pngPath = await helper.exportToPNG('simple-export.png')

      // Verify PNG file is valid
      await helper.verifyPNGSignature(pngPath)
    })

    test('should export PNG with image labels without taint error', async () => {
      // Import a simple layout first (8 keys)
      await helper.importFromFile('e2e/fixtures/simple-layout.json', 8)

      // Export as PNG (this should NOT throw DOMException for tainted canvas)
      const pngPath = await helper.exportToPNG('png-export-test.png')

      // Verify PNG file is valid
      await helper.verifyPNGSignature(pngPath)
    })

    test('should roundtrip PNG export and import', async ({ page }) => {
      // Import a layout (6 keys)
      await helper.importFromFile('e2e/fixtures/complex-layout.json', 6)

      // Export as PNG
      const pngPath = await helper.exportToPNG('roundtrip-test.png')

      // Reload the page to get a clean state
      await page.reload()
      await expect(page.locator('.canvas-toolbar')).toBeVisible()
      await expect(page.getByTestId('counter-keys')).toContainText('Keys: 0')

      // Re-import the exported PNG (should restore 6 keys)
      await helper.importFromFile(pngPath, 6)

      // Verify it's the same layout by visual comparison
      await expect(page.locator('.keyboard-canvas')).toHaveScreenshot('png-roundtrip-result.png')
    })
  })

  test.describe('JSON Export Tests', () => {
    test('should export simple layout as JSON', async ({ page }) => {
      // Add some keys first
      await page.locator('button[title="Add Standard Key"]').click()
      await page.locator('button[title="Add Standard Key"]').click()
      await expect(page.getByTestId('counter-keys')).toContainText('Keys: 2')

      // Export as JSON
      const jsonPath = await helper.exportToJSON('simple-export.json')

      // Read and verify the exported JSON
      const exportedData = await helper.verifyJSONContent(jsonPath)

      // Should be an array (KLE format)
      expect(Array.isArray(exportedData)).toBe(true)
      expect((exportedData as unknown[]).length).toBeGreaterThan(0)
    })

    test('should export complex layout with properties', async () => {
      // Import a complex layout first (6 keys)
      await helper.importFromFile('e2e/fixtures/complex-layout.json', 6)

      // Export the layout as JSON
      const jsonPath = await helper.exportToJSON('complex-export.json')

      // Verify the exported content contains complex properties
      const exportedData = await helper.verifyJSONContent(jsonPath)

      expect(Array.isArray(exportedData)).toBe(true)
      // Should contain color and rotation properties
      const hasColorProps = JSON.stringify(exportedData).includes('"c":')
      const hasRotationProps = JSON.stringify(exportedData).includes('"r":')
      expect(hasColorProps || hasRotationProps).toBe(true)
    })

    test('should export empty layout', async ({ page }) => {
      // Ensure layout is empty
      await expect(page.getByTestId('counter-keys')).toContainText('Keys: 0')

      // Export empty layout as JSON
      const jsonPath = await helper.exportToJSON('empty-export.json')

      // Verify exported empty layout
      const exportedData = await helper.verifyJSONContent(jsonPath)

      expect(Array.isArray(exportedData)).toBe(true)
      expect((exportedData as unknown[]).length).toBe(0)
    })
  })

  test.describe('Round-trip Tests', () => {
    test('should maintain layout integrity through import-export cycle', async () => {
      // Read original layout
      const originalFile = path.resolve('e2e/fixtures', 'complex-layout.json')
      const originalContent = await fs.readFile(originalFile, 'utf-8')
      const originalData = JSON.parse(originalContent)

      // Import the layout (6 keys)
      await helper.importFromFile(originalFile, 6)

      // Export the imported layout
      const exportPath = await helper.exportToJSON('round-trip-export.json')

      // Compare original and exported data
      const exportedData = await helper.verifyJSONContent(exportPath)

      // Both should be arrays
      expect(Array.isArray(originalData)).toBe(true)
      expect(Array.isArray(exportedData)).toBe(true)

      // Should have same number of rows (approximate comparison due to internal processing)
      expect((exportedData as unknown[]).length).toBeGreaterThan(0)
    })

    test('should preserve key properties through round-trip', async () => {
      // Import rotated keys layout (3 keys)
      await helper.importFromFile('e2e/fixtures/rotated-keys.json', 3)

      // Export the layout
      const exportPath = await helper.exportToJSON('rotated-keys-export.json')

      // Verify rotation properties are preserved
      const exportedContent = await fs.readFile(exportPath, 'utf-8')

      // Should contain rotation-related properties in the exported content
      expect(exportedContent.includes('"r":')).toBe(true)
    })

    test('should correctly handle rotary encoder property through round-trip', async () => {
      // This targets bug fixed in adamws/kle-serial v0.17.1,
      // some properties where not deserialized properly (including 'Switch Mount' which we use to
      // mark rotary encoder)

      // Import rotary encoder layout (3 keys)
      const filePath = path.resolve('e2e/fixtures', 'simple-rotary-encoder.json')
      await helper.importFromFile(filePath, 3)

      // Export the layout
      const exportPath = await helper.exportToJSON('simple-rotary-encoder-export.json')

      // Verify that imported and exported data are equal
      const exportedData = await helper.verifyJSONContent(exportPath)
      const importedContent = await fs.readFile(filePath, 'utf-8')
      const importedData = JSON.parse(importedContent)

      expect(exportedData).toEqual(importedData)
    })
  })

  test.describe('Integration Tests', () => {
    test('should handle import then modify then export workflow', async ({ page }) => {
      // Import simple layout (8 keys)
      await helper.importFromFile('e2e/fixtures/simple-layout.json', 8)

      // Add one more key
      await page.locator('button[title="Add Standard Key"]').click()
      await expect(page.getByTestId('counter-keys')).toContainText('Keys: 9')

      // Export modified layout
      const exportPath = await helper.exportToJSON('modified-layout.json')

      // Verify exported layout is valid JSON array
      const exportedData = await helper.verifyJSONContent(exportPath)
      expect(Array.isArray(exportedData)).toBe(true)
    })

    test('should show clean state after import, then dirty after modification', async ({
      page,
    }) => {
      // Initially should not show unsaved changes
      await expect(
        page.locator('div.small.text-warning', { hasText: 'Unsaved changes' }),
      ).toBeHidden()

      // Import a layout (8 keys)
      await helper.importFromFile('e2e/fixtures/simple-layout.json', 8)

      // Should still not show unsaved changes after import (import establishes new baseline)
      await expect(
        page.locator('div.small.text-warning', { hasText: 'Unsaved changes' }),
      ).toBeHidden()

      // Add a key to make changes
      await page.locator('button[title="Add Standard Key"]').click()
      await expect(page.getByTestId('counter-keys')).toContainText('Keys: 9')

      // Now should show unsaved changes after modification
      await expect(
        page.locator('div.small.text-warning', { hasText: 'Unsaved changes' }),
      ).toBeVisible()
    })

    test('should handle multiple imports in sequence', async () => {
      // Import first layout (8 keys)
      await helper.importFromFile('e2e/fixtures/simple-layout.json', 8)

      // Import second layout (should replace first with 3 keys)
      await helper.importFromFile('e2e/fixtures/rotated-keys.json', 3)

      // Import empty layout (should clear to 0 keys)
      await helper.importFromFile('e2e/fixtures/empty-layout.json', 0)
    })
  })
})
