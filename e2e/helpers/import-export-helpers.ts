import { Page, expect } from '@playwright/test'
import { WaitHelpers } from './wait-helpers'
import { promises as fs } from 'fs'
import path from 'path'

/**
 * Helper class for import/export operations in E2E tests.
 *
 * Provides reusable methods for:
 * - Importing JSON/PNG files via file chooser
 * - Exporting to PNG/JSON with download handling
 * - Validating file formats (PNG signature, JSON structure)
 *
 * @example
 * ```typescript
 * const importExportHelper = new ImportExportHelper(page, waitHelpers)
 * await importExportHelper.importFromFile('e2e/fixtures/simple-layout.json')
 * const pngPath = await importExportHelper.exportToPNG('test-export.png')
 * ```
 */
export class ImportExportHelper {
  constructor(
    private page: Page,
    private waitHelpers: WaitHelpers,
  ) {}

  /**
   * Import a layout from a file using the Import dropdown.
   *
   * Handles the file chooser dialog and waits for the import to complete.
   *
   * @param filePath - Absolute or relative path to the file to import
   * @param expectedKeyCount - Optional number of keys expected after import (for verification)
   *
   * @example
   * ```typescript
   * await helper.importFromFile('e2e/fixtures/simple-layout.json', 8)
   * ```
   */
  async importFromFile(filePath: string, expectedKeyCount?: number): Promise<void> {
    // Resolve the file path to absolute
    const resolvedPath = path.resolve(filePath)

    // Set up file chooser event handler
    const fileChooserPromise = this.page.waitForEvent('filechooser')

    // Click Import button
    const importButton = this.page.locator('button', { hasText: 'Import' })
    await importButton.click()

    // Wait for dropdown to be visible and click "From File"
    await expect(this.page.locator('.dropdown-menu:has(a:has-text("From File"))')).toBeVisible()
    await this.page.locator('a', { hasText: 'From File' }).click()

    // Select the file
    const fileChooser = await fileChooserPromise
    await fileChooser.setFiles(resolvedPath)

    // If expectedKeyCount is provided, wait for it
    if (expectedKeyCount !== undefined) {
      await expect(this.page.locator('.keys-counter')).toContainText(`Keys: ${expectedKeyCount}`)
    }
  }

  /**
   * Export the current layout as a PNG file.
   *
   * Mocks the showSaveFilePicker API to avoid file picker dialog,
   * triggers the download, and saves the file to the test-output directory.
   *
   * @param filename - Name for the exported file (e.g., 'my-layout.png')
   * @returns Path to the saved PNG file
   *
   * @example
   * ```typescript
   * const pngPath = await helper.exportToPNG('test-layout.png')
   * await helper.verifyPNGSignature(pngPath)
   * ```
   */
  async exportToPNG(filename: string): Promise<string> {
    // Mock showSaveFilePicker to avoid file picker dialog
    await this.page.evaluate(() => {
      delete (window as Window & { showSaveFilePicker?: unknown }).showSaveFilePicker
    })

    // Wait for canvas to render using RAF instead of hard timeout
    await this.waitHelpers.waitForDoubleAnimationFrame()

    // Set up download promise
    const downloadPromise = this.page.waitForEvent('download')

    // Click Export button and select Download PNG
    const exportButton = this.page.locator('button', { hasText: 'Export' })
    await exportButton.click()
    await this.page.locator('a', { hasText: 'Download PNG' }).click()

    // Wait for download
    const download = await downloadPromise

    // Verify filename
    expect(download.suggestedFilename()).toMatch(/\.png$/)

    // Save the file
    const downloadPath = path.resolve('e2e/test-output', filename)
    await download.saveAs(downloadPath)

    return downloadPath
  }

  /**
   * Export the current layout as a JSON file.
   *
   * Triggers the JSON download and saves the file to the test-output directory.
   *
   * @param filename - Name for the exported file (e.g., 'my-layout.json')
   * @returns Path to the saved JSON file
   *
   * @example
   * ```typescript
   * const jsonPath = await helper.exportToJSON('test-layout.json')
   * const content = await helper.verifyJSONContent(jsonPath)
   * ```
   */
  async exportToJSON(filename: string): Promise<string> {
    // Set up download promise
    const downloadPromise = this.page.waitForEvent('download')

    // Click Export button and select Download JSON
    const exportButton = this.page.locator('button', { hasText: 'Export' })
    await exportButton.click()
    await this.page.locator('a', { hasText: 'Download JSON' }).click()

    // Wait for download
    const download = await downloadPromise

    // Verify filename
    expect(download.suggestedFilename()).toMatch(/\.json$/)

    // Save the file
    const downloadPath = path.resolve('e2e/test-output', filename)
    await download.saveAs(downloadPath)

    return downloadPath
  }

  /**
   * Verify that a file is a valid PNG by checking its signature.
   *
   * PNG files start with the signature: 89 50 4E 47 0D 0A 1A 0A
   * This method checks the first 4 bytes.
   *
   * @param filePath - Path to the PNG file to verify
   *
   * @example
   * ```typescript
   * const pngPath = await helper.exportToPNG('test.png')
   * await helper.verifyPNGSignature(pngPath)
   * ```
   */
  async verifyPNGSignature(filePath: string): Promise<void> {
    const fileBuffer = await fs.readFile(filePath)

    // PNG signature: 89 50 4E 47 (0D 0A 1A 0A)
    expect(fileBuffer[0]).toBe(0x89)
    expect(fileBuffer[1]).toBe(0x50)
    expect(fileBuffer[2]).toBe(0x4e)
    expect(fileBuffer[3]).toBe(0x47)
  }

  /**
   * Read and parse a JSON file, verifying it's valid JSON.
   *
   * @param filePath - Path to the JSON file to read
   * @returns Parsed JSON content as an object
   *
   * @example
   * ```typescript
   * const jsonPath = await helper.exportToJSON('test.json')
   * const content = await helper.verifyJSONContent(jsonPath)
   * expect(content).toHaveProperty('keys')
   * ```
   */
  async verifyJSONContent(filePath: string): Promise<unknown> {
    const fileContent = await fs.readFile(filePath, 'utf-8')
    const jsonContent = JSON.parse(fileContent)
    return jsonContent
  }
}
