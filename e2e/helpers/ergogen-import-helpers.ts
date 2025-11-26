import { Page, expect } from '@playwright/test'
import { WaitHelpers } from './wait-helpers'
import path from 'path'
import fs from 'fs'

/**
 * Helper class for ergogen-specific import operations in E2E tests.
 *
 * Provides reusable methods for:
 * - Importing Ergogen YAML files
 * - Importing from ergogen.xyz URLs
 * - Verifying import success
 * - Validating key positions
 *
 * @example
 * ```typescript
 * const ergogenHelper = new ErgogenImportHelper(page, waitHelpers)
 * await ergogenHelper.importErgogenFile('e2e/fixtures/ergogen/simple.yaml', 4)
 * ```
 */
export class ErgogenImportHelper {
  constructor(
    private page: Page,
    private waitHelpers: WaitHelpers,
  ) {}

  /**
   * Import an Ergogen YAML file using the Import dropdown.
   *
   * Handles the file chooser dialog and waits for the import to complete.
   *
   * @param filePath - Absolute or relative path to the YAML file to import
   * @param expectedKeyCount - Expected number of keys after import
   *
   * @example
   * ```typescript
   * await helper.importErgogenFile('e2e/fixtures/ergogen/simple.yaml', 4)
   * ```
   */
  async importErgogenFile(filePath: string, expectedKeyCount: number): Promise<void> {
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

    // Wait for the expected key count
    await expect(this.page.getByTestId('counter-keys')).toContainText(`Keys: ${expectedKeyCount}`, {
      timeout: 10000,
    })
  }

  /**
   * Import an Ergogen layout from a URL.
   *
   * Opens the URL import modal, enters the URL, and triggers the import.
   *
   * @param url - The ergogen.xyz URL with hash fragment
   * @param expectedKeyCount - Expected number of keys after import
   *
   * @example
   * ```typescript
   * await helper.importErgogenUrl('https://ergogen.xyz#config...', 40)
   * ```
   */
  async importErgogenUrl(url: string, expectedKeyCount: number): Promise<void> {
    // Click Import button
    const importButton = this.page.locator('button', { hasText: 'Import' })
    await importButton.click()

    // Wait for dropdown and click "From URL"
    await expect(this.page.locator('.dropdown-menu:has(a:has-text("From URL"))')).toBeVisible()
    await this.page.locator('a', { hasText: 'From URL' }).click()

    // Wait for modal to be visible
    const modal = this.page.locator('.modal-content')
    await expect(modal).toBeVisible()

    // Enter the URL
    const urlInput = this.page.locator('#urlInput')
    await expect(urlInput).toBeVisible()
    await urlInput.fill(url)

    // Click Import button in modal
    const modalImportButton = this.page.locator('.modal-content button', { hasText: 'Import' })
    await modalImportButton.click()

    // Wait for modal to close and import to complete
    await expect(modal).toBeHidden({ timeout: 10000 })

    // Wait for the expected key count
    await expect(this.page.getByTestId('counter-keys')).toContainText(`Keys: ${expectedKeyCount}`, {
      timeout: 10000,
    })
  }

  /**
   * Verify that the import success toast is shown.
   *
   * @param expectedMessage - Optional partial message to verify (e.g., "Ergogen layout imported")
   *
   * @example
   * ```typescript
   * await helper.verifyImportSuccess('Ergogen layout imported')
   * ```
   */
  async verifyImportSuccess(expectedMessage?: string): Promise<void> {
    const toast = this.page.locator('.toast-notification')
    await expect(toast).toBeVisible({ timeout: 5000 })

    const toastTitle = toast.locator('.toast-title')
    await expect(toastTitle).toContainText('Import Successful')

    if (expectedMessage) {
      const toastText = toast.locator('.toast-text')
      await expect(toastText).toContainText(expectedMessage)
    }
  }

  /**
   * Verify that an error toast is shown.
   *
   * @param expectedMessage - Optional partial error message to verify
   *
   * @example
   * ```typescript
   * await helper.verifyImportError('Invalid YAML')
   * ```
   */
  async verifyImportError(expectedMessage?: string): Promise<void> {
    const toast = this.page.locator('.toast-notification').first()
    await expect(toast).toBeVisible({ timeout: 5000 })

    const toastTitle = toast.locator('.toast-title')
    // Error toast might have title "Import Failed" or "Error"
    await expect(toastTitle).toBeVisible()

    if (expectedMessage) {
      const toastText = toast.locator('.toast-text')
      await expect(toastText).toContainText(expectedMessage)
    }
  }

  /**
   * Cancel URL import by closing the modal.
   *
   * @example
   * ```typescript
   * await helper.openUrlImportModal()
   * await helper.cancelUrlImport()
   * ```
   */
  async cancelUrlImport(): Promise<void> {
    // Click Cancel or X button
    const cancelButton = this.page.locator('.modal-content button', { hasText: 'Cancel' })
    await cancelButton.click()

    // Wait for modal to close
    const modal = this.page.locator('.modal-content')
    await expect(modal).toBeHidden()
  }

  /**
   * Open the URL import modal without importing.
   *
   * @example
   * ```typescript
   * await helper.openUrlImportModal()
   * ```
   */
  async openUrlImportModal(): Promise<void> {
    // Click Import button
    const importButton = this.page.locator('button', { hasText: 'Import' })
    await importButton.click()

    // Wait for dropdown and click "From URL"
    await expect(this.page.locator('.dropdown-menu:has(a:has-text("From URL"))')).toBeVisible()
    await this.page.locator('a', { hasText: 'From URL' }).click()

    // Wait for modal to be visible
    const modal = this.page.locator('.modal-content')
    await expect(modal).toBeVisible()
  }

  /**
   * Load expected centers data from JSON file
   *
   * @param fileName - Name of the JSON file (without path)
   * @returns Object with keyCount and centers array
   *
   * @example
   * ```typescript
   * const expectedData = await helper.loadExpectedCenters('simple.json')
   * ```
   */
  async loadExpectedCenters(
    fileName: string,
  ): Promise<{ keyCount: number; centers: Array<{ x: number; y: number }> }> {
    // Use process.cwd() to get the project root directory
    const filePath = path.join(process.cwd(), 'e2e/fixtures/ergogen/expected-centers', fileName)
    const fileContent = fs.readFileSync(filePath, 'utf8')
    return JSON.parse(fileContent)
  }

  /**
   * Normalize positions for offset-independent comparison
   *
   * @param positions - Array of positions to normalize
   * @returns Array of normalized positions with origin at (0,0)
   *
   * @example
   * ```typescript
   * const normalized = helper.normalizePositions(positions)
   * ```
   */
  normalizePositions(positions: Array<{ x: number; y: number }>): Array<{ x: number; y: number }> {
    if (positions.length === 0) return []

    const minX = Math.min(...positions.map((pos) => pos.x))
    const minY = Math.min(...positions.map((pos) => pos.y))

    return positions.map((pos) => ({
      x: pos.x - minX,
      y: pos.y - minY,
    }))
  }

  /**
   * Apply Y-axis flip to positions (ergogen Y-up vs KLE Y-down)
   *
   * @param positions - Array of positions to flip
   * @returns Array of positions with Y-axis flipped
   *
   * @example
   * ```typescript
   * const flipped = helper.flipYAxis(positions)
   * ```
   */
  flipYAxis(positions: Array<{ x: number; y: number }>): Array<{ x: number; y: number }> {
    if (positions.length === 0) return []

    const minY = Math.min(...positions.map((pos) => pos.y))
    const maxY = Math.max(...positions.map((pos) => pos.y))

    return positions.map((pos) => ({
      x: pos.x,
      y: maxY - minY - (pos.y - minY),
    }))
  }

  /**
   * Compare UI positions with expected positions using closest matching
   *
   * @param uiPositions - Array of UI positions
   * @param expectedPositions - Array of expected positions
   *
   * @example
   * ```typescript
   * await helper.comparePositions(uiPositions, expectedPositions)
   * ```
   */
  async comparePositions(
    uiPositions: Array<{ x: number; y: number }>,
    expectedPositions: Array<{ x: number; y: number }>,
  ): Promise<void> {
    // Normalize both sets
    const normalizedUi = this.normalizePositions(uiPositions)
    const normalizedExpected = this.normalizePositions(expectedPositions)

    // For each UI position, find the closest expected position
    const matchedPositions: Array<{
      ui: { x: number; y: number }
      expected: { x: number; y: number }
    }> = []
    const usedExpectedIndices = new Set<number>()

    for (const uiPos of normalizedUi) {
      let closestIndex = -1
      let closestDistance = Infinity

      for (let i = 0; i < normalizedExpected.length; i++) {
        if (usedExpectedIndices.has(i)) continue

        const expectedPos = normalizedExpected[i]
        const distance = Math.sqrt(
          Math.pow(uiPos.x - expectedPos.x, 2) + Math.pow(uiPos.y - expectedPos.y, 2),
        )

        if (distance < closestDistance) {
          closestDistance = distance
          closestIndex = i
        }
      }

      if (closestIndex !== -1) {
        matchedPositions.push({
          ui: uiPos,
          expected: normalizedExpected[closestIndex],
        })
        usedExpectedIndices.add(closestIndex)
      }
    }

    expect(matchedPositions.len).toBe(uiPositions.len)
    // Compare matched positions with 5 decimal places precision
    for (const { ui, expected } of matchedPositions) {
      expect(ui.x).toBeCloseTo(expected.x, 5)
      expect(ui.y).toBeCloseTo(expected.y, 5)
    }
  }
}
