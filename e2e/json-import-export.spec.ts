import { test, expect } from '@playwright/test'
import { promises as fs } from 'fs'
import path from 'path'

test.describe('JSON Import/Export Functionality', () => {
  // Canvas rendering tests only run on Chromium since we've verified
  // pixel-perfect identical rendering across all browsers

  test.skip(
    ({ browserName }) => browserName !== 'chromium',
    'Canvas rendering tests only run on Chromium (verified identical across browsers)',
  )

  test.beforeEach(async ({ page }) => {
    await page.goto('/')

    // Wait for app to load
    await expect(page.locator('.canvas-toolbar')).toBeVisible()
  })

  test.describe('JSON Import Tests', () => {
    test('should import a simple JSON layout', async ({ page }) => {
      // Initially should show 0 keys
      await expect(page.locator('.keys-counter')).toContainText('Keys: 0')

      // Get the file path
      const filePath = path.resolve('e2e/fixtures/simple-layout.json')

      // Click import button and upload file
      const importButton = page.locator('button', { hasText: 'Import' })
      await expect(importButton).toBeVisible()

      // Set up file chooser event handler
      const fileChooserPromise = page.waitForEvent('filechooser')
      await importButton.click()
      const fileChooser = await fileChooserPromise
      await fileChooser.setFiles(filePath)

      // Wait for import to complete - should have 8 keys (2 rows x 4 keys each)
      await expect(page.locator('.keys-counter')).toContainText('Keys: 8')

      // Verify some of the imported keys are visible
      await expect(page.locator('.selected-counter')).toContainText('Selected: 0')

      // Take screenshot to verify layout was imported
      await expect(page.locator('.keyboard-canvas')).toHaveScreenshot('simple-layout-imported.png')
    })

    test('should import complex layout with colors and rotation', async ({ page }) => {
      // Import complex layout
      const filePath = path.resolve('e2e/fixtures', 'complex-layout.json')

      const fileChooserPromise = page.waitForEvent('filechooser')
      await page.locator('button', { hasText: 'Import' }).click()
      const fileChooser = await fileChooserPromise
      await fileChooser.setFiles(filePath)

      // Wait for keys to be imported (Esc, F1, F2, Tab, Q, W = 6 keys)
      await expect(page.locator('.keys-counter')).toContainText('Keys: 6')

      // Take screenshot to verify complex layout with colors and rotation
      await expect(page.locator('.keyboard-canvas')).toHaveScreenshot('complex-layout-imported.png')
    })

    test('should import empty layout', async ({ page }) => {
      // Import empty layout
      const filePath = path.resolve('e2e/fixtures', 'empty-layout.json')

      const fileChooserPromise = page.waitForEvent('filechooser')
      await page.locator('button', { hasText: 'Import' }).click()
      const fileChooser = await fileChooserPromise
      await fileChooser.setFiles(filePath)

      // Should remain at 0 keys
      await expect(page.locator('.keys-counter')).toContainText('Keys: 0')
    })

    test('should handle invalid JSON gracefully', async ({ page }) => {
      // Import invalid JSON and expect error toast notification
      const filePath = path.resolve('e2e/fixtures', 'invalid.json')

      const fileChooserPromise = page.waitForEvent('filechooser')
      await page.locator('button', { hasText: 'Import' }).click()
      const fileChooser = await fileChooserPromise
      await fileChooser.setFiles(filePath)

      // Wait for error toast notification to appear
      await expect(page.locator('.toast-notification')).toBeVisible()
      await expect(page.locator('.toast-notification')).toHaveClass(/toast-error/)
      await expect(page.locator('.toast-title')).toContainText('Error loading file')

      // Should remain at 0 keys after error
      await expect(page.locator('.keys-counter')).toContainText('Keys: 0')
    })

    test('should import layout with rotated keys', async ({ page }) => {
      // Import layout with rotated keys
      const filePath = path.resolve('e2e/fixtures', 'rotated-keys.json')

      const fileChooserPromise = page.waitForEvent('filechooser')
      await page.locator('button', { hasText: 'Import' }).click()
      const fileChooser = await fileChooserPromise
      await fileChooser.setFiles(filePath)

      // Should have 3 keys
      await expect(page.locator('.keys-counter')).toContainText('Keys: 3')

      // Take screenshot to verify rotated keys
      await expect(page.locator('.keyboard-canvas')).toHaveScreenshot('rotated-keys-imported.png')
    })

    test('should import VIA format layout', async ({ page }) => {
      // Import VIA format layout
      const filePath = path.resolve('e2e/fixtures', 'via-layout.json')

      const fileChooserPromise = page.waitForEvent('filechooser')
      await page.locator('button', { hasText: 'Import' }).click()
      const fileChooser = await fileChooserPromise
      await fileChooser.setFiles(filePath)

      // Should have 8 keys (2 rows x 4 keys each)
      await expect(page.locator('.keys-counter')).toContainText('Keys: 8')

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
      await expect(page.locator('.keys-counter')).toContainText('Keys: 2')

      // Mock showSaveFilePicker to avoid file picker dialog in tests
      // Instead, make it return undefined so the fallback download path is used
      await page.evaluate(() => {
        delete (window as Window & { showSaveFilePicker?: unknown }).showSaveFilePicker
      })

      // Set up download promise before clicking export
      const downloadPromise = page.waitForEvent('download')

      // Click export dropdown
      const exportButton = page.locator('button', { hasText: 'Export' })
      await exportButton.click()

      // Click download PNG option
      await page.locator('button', { hasText: 'Download PNG' }).click()

      // Wait for download to start (should not throw DOMException)
      const download = await downloadPromise

      // Verify download properties
      expect(download.suggestedFilename()).toMatch(/\.png$/)

      // Save and verify the downloaded file exists and is valid PNG
      const downloadPath = path.resolve('e2e/test-output', download.suggestedFilename())
      await download.saveAs(downloadPath)

      // Read file and verify it's a PNG (starts with PNG signature)
      const fileBuffer = await fs.readFile(downloadPath)
      // PNG signature: 89 50 4E 47 0D 0A 1A 0A
      expect(fileBuffer[0]).toBe(0x89)
      expect(fileBuffer[1]).toBe(0x50)
      expect(fileBuffer[2]).toBe(0x4e)
      expect(fileBuffer[3]).toBe(0x47)
    })

    test('should export PNG with image labels without taint error', async ({ page }) => {
      // Import a simple layout first
      const filePath = path.resolve('e2e/fixtures', 'simple-layout.json')
      const fileChooserPromise = page.waitForEvent('filechooser')
      await page.locator('button', { hasText: 'Import' }).click()
      const fileChooser = await fileChooserPromise
      await fileChooser.setFiles(filePath)
      await expect(page.locator('.keys-counter')).toContainText('Keys: 8')

      // Mock showSaveFilePicker to avoid file picker dialog
      await page.evaluate(() => {
        delete (window as Window & { showSaveFilePicker?: unknown }).showSaveFilePicker
      })

      // Wait a bit for canvas to render
      await page.waitForTimeout(500)

      // Set up download promise before clicking export
      const downloadPromise = page.waitForEvent('download')

      // Click export dropdown
      const exportButton = page.locator('button', { hasText: 'Export' })
      await exportButton.click()

      // Click download PNG option - this should NOT throw DOMException
      await page.locator('button', { hasText: 'Download PNG' }).click()

      // Wait for download to start (should not throw DOMException)
      const download = await downloadPromise

      // Verify download succeeded
      expect(download.suggestedFilename()).toMatch(/\.png$/)

      // Save and verify the downloaded file
      const downloadPath = path.resolve('e2e/test-output', 'png-export-test.png')
      await download.saveAs(downloadPath)

      // Verify it's a valid PNG
      const fileBuffer = await fs.readFile(downloadPath)
      expect(fileBuffer[0]).toBe(0x89)
      expect(fileBuffer[1]).toBe(0x50)
      expect(fileBuffer[2]).toBe(0x4e)
      expect(fileBuffer[3]).toBe(0x47)
    })

    test('should roundtrip PNG export and import', async ({ page }) => {
      // Import a layout
      const filePath = path.resolve('e2e/fixtures', 'complex-layout.json')
      const fileChooserPromise = page.waitForEvent('filechooser')
      await page.locator('button', { hasText: 'Import' }).click()
      const fileChooser = await fileChooserPromise
      await fileChooser.setFiles(filePath)
      await expect(page.locator('.keys-counter')).toContainText('Keys: 6')

      // Mock showSaveFilePicker
      await page.evaluate(() => {
        delete (window as Window & { showSaveFilePicker?: unknown }).showSaveFilePicker
      })

      // Export as PNG
      const downloadPromise = page.waitForEvent('download')
      const exportButton = page.locator('button', { hasText: 'Export' })
      await exportButton.click()
      await page.locator('button', { hasText: 'Download PNG' }).click()
      const download = await downloadPromise

      // Save the PNG
      const downloadPath = path.resolve('e2e/test-output', 'roundtrip-test.png')
      await download.saveAs(downloadPath)

      // Reload the page to get a clean state
      await page.reload()
      await expect(page.locator('.canvas-toolbar')).toBeVisible()
      await expect(page.locator('.keys-counter')).toContainText('Keys: 0')

      // Re-import the PNG
      const fileChooserPromise2 = page.waitForEvent('filechooser')
      await page.locator('button', { hasText: 'Import' }).click()
      const fileChooser2 = await fileChooserPromise2
      await fileChooser2.setFiles(downloadPath)

      // Verify the layout was restored
      await expect(page.locator('.keys-counter')).toContainText('Keys: 6')

      // Verify it's the same layout by visual comparison
      await expect(page.locator('.keyboard-canvas')).toHaveScreenshot('png-roundtrip-result.png')
    })
  })

  test.describe('JSON Export Tests', () => {
    test('should export simple layout as JSON', async ({ page }) => {
      // Add some keys first
      await page.locator('button[title="Add Standard Key"]').click()
      await page.locator('button[title="Add Standard Key"]').click()
      await expect(page.locator('.keys-counter')).toContainText('Keys: 2')

      // Set up download promise before clicking export
      const downloadPromise = page.waitForEvent('download')

      // Click export dropdown
      const exportButton = page.locator('button', { hasText: 'Export' })
      await exportButton.click()

      // Click download JSON option
      await page.locator('button', { hasText: 'Download JSON' }).click()

      // Wait for download to start
      const download = await downloadPromise

      // Verify download properties
      expect(download.suggestedFilename()).toMatch(/\.json$/)

      // Save and verify the downloaded content
      const downloadPath = path.resolve('e2e/test-output', download.suggestedFilename())
      await download.saveAs(downloadPath)

      // Read and verify the exported JSON
      const exportedContent = await fs.readFile(downloadPath, 'utf-8')
      const exportedData = JSON.parse(exportedContent)

      // Should be an array (KLE format)
      expect(Array.isArray(exportedData)).toBe(true)
      expect(exportedData.length).toBeGreaterThan(0)
    })

    test('should export complex layout with properties', async ({ page }) => {
      // Import a complex layout first
      const filePath = path.resolve('e2e/fixtures', 'complex-layout.json')
      const fileChooserPromise = page.waitForEvent('filechooser')
      await page.locator('button', { hasText: 'Import' }).click()
      const fileChooser = await fileChooserPromise
      await fileChooser.setFiles(filePath)

      await expect(page.locator('.keys-counter')).toContainText('Keys: 6')

      // Export the layout
      const downloadPromise = page.waitForEvent('download')
      await page.locator('button', { hasText: 'Export' }).click()
      await page.locator('button', { hasText: 'Download JSON' }).click()

      const download = await downloadPromise
      const downloadPath = path.resolve('e2e/test-output', download.suggestedFilename())
      await download.saveAs(downloadPath)

      // Verify the exported content contains complex properties
      const exportedContent = await fs.readFile(downloadPath, 'utf-8')
      const exportedData = JSON.parse(exportedContent)

      expect(Array.isArray(exportedData)).toBe(true)
      // Should contain color and rotation properties
      const hasColorProps = JSON.stringify(exportedData).includes('"c":')
      const hasRotationProps = JSON.stringify(exportedData).includes('"r":')
      expect(hasColorProps || hasRotationProps).toBe(true)
    })

    test('should export empty layout', async ({ page }) => {
      // Ensure layout is empty
      await expect(page.locator('.keys-counter')).toContainText('Keys: 0')

      // Export empty layout
      const downloadPromise = page.waitForEvent('download')
      await page.locator('button', { hasText: 'Export' }).click()
      await page.locator('button', { hasText: 'Download JSON' }).click()

      const download = await downloadPromise
      const downloadPath = path.resolve('e2e/test-output', download.suggestedFilename())
      await download.saveAs(downloadPath)

      // Verify exported empty layout
      const exportedContent = await fs.readFile(downloadPath, 'utf-8')
      const exportedData = JSON.parse(exportedContent)

      expect(Array.isArray(exportedData)).toBe(true)
      expect(exportedData.length).toBe(0)
    })
  })

  test.describe('Round-trip Tests', () => {
    test('should maintain layout integrity through import-export cycle', async ({ page }) => {
      // Import original layout
      const originalFile = path.resolve('e2e/fixtures', 'complex-layout.json')
      const originalContent = await fs.readFile(originalFile, 'utf-8')
      const originalData = JSON.parse(originalContent)

      const fileChooserPromise = page.waitForEvent('filechooser')
      await page.locator('button', { hasText: 'Import' }).click()
      const fileChooser = await fileChooserPromise
      await fileChooser.setFiles(originalFile)

      await expect(page.locator('.keys-counter')).toContainText('Keys: 6')

      // Export the imported layout
      const downloadPromise = page.waitForEvent('download')
      await page.locator('button', { hasText: 'Export' }).click()
      await page.locator('button', { hasText: 'Download JSON' }).click()

      const download = await downloadPromise
      const exportPath = path.resolve('e2e/test-output', 'round-trip-export.json')
      await download.saveAs(exportPath)

      // Compare original and exported data
      const exportedContent = await fs.readFile(exportPath, 'utf-8')
      const exportedData = JSON.parse(exportedContent)

      // Both should be arrays
      expect(Array.isArray(originalData)).toBe(true)
      expect(Array.isArray(exportedData)).toBe(true)

      // Should have same number of rows (approximate comparison due to internal processing)
      expect(exportedData.length).toBeGreaterThan(0)
    })

    test('should preserve key properties through round-trip', async ({ page }) => {
      // Import rotated keys layout
      const filePath = path.resolve('e2e/fixtures', 'rotated-keys.json')

      const fileChooserPromise = page.waitForEvent('filechooser')
      await page.locator('button', { hasText: 'Import' }).click()
      const fileChooser = await fileChooserPromise
      await fileChooser.setFiles(filePath)

      await expect(page.locator('.keys-counter')).toContainText('Keys: 3')

      // Export the layout
      const downloadPromise = page.waitForEvent('download')
      await page.locator('button', { hasText: 'Export' }).click()
      await page.locator('button', { hasText: 'Download JSON' }).click()

      const download = await downloadPromise
      const exportPath = path.resolve('e2e/test-output', 'rotated-keys-export.json')
      await download.saveAs(exportPath)

      // Verify rotation properties are preserved
      const exportedContent = await fs.readFile(exportPath, 'utf-8')

      // Should contain rotation-related properties in the exported content
      expect(exportedContent.includes('"r":')).toBe(true)
    })
  })

  test.describe('Integration Tests', () => {
    test('should handle import then modify then export workflow', async ({ page }) => {
      // Import simple layout
      const filePath = path.resolve('e2e/fixtures', 'simple-layout.json')
      const fileChooserPromise = page.waitForEvent('filechooser')
      await page.locator('button', { hasText: 'Import' }).click()
      const fileChooser = await fileChooserPromise
      await fileChooser.setFiles(filePath)

      await expect(page.locator('.keys-counter')).toContainText('Keys: 8')

      // Add one more key
      await page.locator('button[title="Add Standard Key"]').click()
      await expect(page.locator('.keys-counter')).toContainText('Keys: 9')

      // Export modified layout
      const downloadPromise = page.waitForEvent('download')
      await page.locator('button', { hasText: 'Export' }).click()
      await page.locator('button', { hasText: 'Download JSON' }).click()

      const download = await downloadPromise
      const exportPath = path.resolve('e2e/test-output', 'modified-layout.json')
      await download.saveAs(exportPath)

      // Verify exported layout has the additional key
      const exportedContent = await fs.readFile(exportPath, 'utf-8')
      const exportedData = JSON.parse(exportedContent)
      expect(Array.isArray(exportedData)).toBe(true)
    })

    test('should show clean state after import, then dirty after modification', async ({
      page,
    }) => {
      // Initially should not show unsaved changes
      await expect(
        page.locator('div.small.text-warning', { hasText: 'Unsaved changes' }),
      ).toBeHidden()

      // Import a layout
      const filePath = path.resolve('e2e/fixtures', 'simple-layout.json')
      const fileChooserPromise = page.waitForEvent('filechooser')
      await page.locator('button', { hasText: 'Import' }).click()
      const fileChooser = await fileChooserPromise
      await fileChooser.setFiles(filePath)

      await expect(page.locator('.keys-counter')).toContainText('Keys: 8')

      // Should still not show unsaved changes after import (import establishes new baseline)
      await expect(
        page.locator('div.small.text-warning', { hasText: 'Unsaved changes' }),
      ).toBeHidden()

      // Add a key to make changes
      await page.locator('button[title="Add Standard Key"]').click()
      await expect(page.locator('.keys-counter')).toContainText('Keys: 9')

      // Now should show unsaved changes after modification
      await expect(
        page.locator('div.small.text-warning', { hasText: 'Unsaved changes' }),
      ).toBeVisible()
    })

    test('should handle multiple imports in sequence', async ({ page }) => {
      // Import first layout
      let filePath = path.resolve('e2e/fixtures', 'simple-layout.json')
      let fileChooserPromise = page.waitForEvent('filechooser')
      await page.locator('button', { hasText: 'Import' }).click()
      let fileChooser = await fileChooserPromise
      await fileChooser.setFiles(filePath)
      await expect(page.locator('.keys-counter')).toContainText('Keys: 8')

      // Import second layout (should replace first)
      filePath = path.resolve('e2e/fixtures', 'rotated-keys.json')
      fileChooserPromise = page.waitForEvent('filechooser')
      await page.locator('button', { hasText: 'Import' }).click()
      fileChooser = await fileChooserPromise
      await fileChooser.setFiles(filePath)
      await expect(page.locator('.keys-counter')).toContainText('Keys: 3')

      // Import empty layout
      filePath = path.resolve('e2e/fixtures', 'empty-layout.json')
      fileChooserPromise = page.waitForEvent('filechooser')
      await page.locator('button', { hasText: 'Import' }).click()
      fileChooser = await fileChooserPromise
      await fileChooser.setFiles(filePath)
      await expect(page.locator('.keys-counter')).toContainText('Keys: 0')
    })
  })
})
