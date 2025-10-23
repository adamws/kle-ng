import { test, expect } from '@playwright/test'
import { promises as fs } from 'fs'

// Helper function to export and parse layout JSON
async function exportLayoutJSON(page: import('@playwright/test').Page) {
  // Click Export button
  const exportButton = page.locator('button', { hasText: 'Export' })
  await expect(exportButton).toBeVisible()
  await exportButton.click()

  // Set up download handler
  const downloadPromise = page.waitForEvent('download')
  await page.locator('a', { hasText: 'Download JSON' }).click()

  const download = await downloadPromise
  const downloadPath = `e2e/test-output/matrix-drawing-${Date.now()}.json`
  await download.saveAs(downloadPath)

  // Read and parse the exported JSON
  const exportedContent = await fs.readFile(downloadPath, 'utf-8')
  const layout = JSON.parse(exportedContent)

  // Clean up test file
  await fs.unlink(downloadPath)

  return layout
}

// Helper function to import layout via JSON file
async function importLayoutJSON(page: import('@playwright/test').Page, layoutData: unknown) {
  // Create temporary JSON file
  const tempFilePath = `e2e/test-output/temp-import-${Date.now()}.json`
  await fs.writeFile(tempFilePath, JSON.stringify(layoutData))

  // Set up file chooser handler
  const fileChooserPromise = page.waitForEvent('filechooser')

  // Click Import button and select "From File"
  const importButton = page.locator('button', { hasText: 'Import' })
  await expect(importButton).toBeVisible()
  await importButton.click()

  // Wait for dropdown to be visible
  await expect(page.locator('.dropdown-menu:has(a:has-text("From File"))')).toBeVisible()
  await page.locator('a', { hasText: 'From File' }).click()

  const fileChooser = await fileChooserPromise
  await fileChooser.setFiles(tempFilePath)

  // Wait for import to complete
  await page.waitForTimeout(500)

  // Clean up temporary file
  await fs.unlink(tempFilePath)
}

test.describe('Matrix Drawing - Interactive Drawing Tests', () => {
  // Matrix drawing tests only run on Chromium for visual consistency
  test.skip(
    ({ browserName }) => browserName !== 'chromium',
    'Matrix drawing tests only run on Chromium for visual consistency',
  )

  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('should draw rows and columns on 3x3 grid with automatic intermediate key selection', async ({
    page,
  }) => {
    // 3x3 grid layout fixture (KLE format: nested arrays with empty strings for keys)
    const fixtureData = [
      ['', '', ''],
      ['', '', ''],
      ['', '', ''],
    ]

    // Import layout via JSON
    await importLayoutJSON(page, fixtureData)

    // Verify layout has 9 keys via UI
    await expect(page.locator('.keys-counter')).toContainText('Keys: 9')

    // Small delay to ensure canvas renders
    await page.waitForTimeout(500)

    // Open Matrix Coordinates Modal
    await page.locator('.extra-tools-group button').click()
    await page
      .locator('.extra-tools-dropdown .dropdown-item')
      .filter({
        hasText: 'Add Switch Matrix Coordinates',
      })
      .click()

    // Wait for modal to be visible
    const matrixModal = page.locator('.matrix-modal')
    await expect(matrixModal).toBeVisible()

    // Wait for modal content to load (should skip directly to drawing step since no labels)
    await page.waitForTimeout(500)

    // Select "Row" mode (should be default, but click to be sure)
    const rowRadio = page.locator('.matrix-modal input[type="radio"][value="row"]')
    await rowRadio.click()

    // Click the draw button to enable drawing mode
    //Note: We locate the button generically and click it, then verify it says "Stop"
    const drawButton = page
      .locator('.matrix-modal button')
      .filter({ hasText: /Draw|Stop/ })
      .first()

    // If button says "Draw", click it to enable. If it already says "Stop", we're good
    const buttonText = await drawButton.textContent()
    if (buttonText?.includes('Draw') && !buttonText?.includes('Stop')) {
      await drawButton.click()
    }

    // Wait for the button text to confirm drawing mode is enabled
    await expect(drawButton).toHaveText(/Stop/)

    // Now the overlay should be visible
    const overlay = page.locator('canvas.matrix-annotation-overlay')
    await expect(overlay).toBeVisible()

    // Get canvas bounding box for click calculations
    const overlayBox = await overlay.boundingBox()
    if (!overlayBox) throw new Error('Matrix overlay not found')

    // Calculate key centers in screen coordinates
    // 3x3 grid: keys at (0,0), (1,0), (2,0), (0,1), (1,1), (2,1), (0,2), (1,2), (2,2)
    // With unit=54px and canvas border, keys are at:
    // Row 0: 27px, 81px, 135px (y=27px)
    // Row 1: 27px, 81px, 135px (y=81px)
    // Row 2: 27px, 81px, 135px (y=135px)

    const unit = 54 // Default unit size
    const border = 9 // Canvas border
    const offset = unit / 2 + border // Center of first key

    // First row: click first key (0,0) and last key (2,0)
    // The middle key (1,0) should be automatically added via line intersection
    // Second click automatically finishes the sequence
    await overlay.click({ position: { x: offset, y: offset } })
    await page.waitForTimeout(100)

    await overlay.click({ position: { x: offset + unit * 2, y: offset } })
    await page.waitForTimeout(200)

    // Second row: click first key (0,1) and last key (2,1)
    // The middle key (1,1) should be automatically added
    await overlay.click({ position: { x: offset, y: offset + unit } })
    await page.waitForTimeout(100)

    await overlay.click({ position: { x: offset + unit * 2, y: offset + unit } })
    await page.waitForTimeout(200)

    // Third row: click first key (0,2) and last key (2,2)
    // The middle key (1,2) should be automatically added
    await overlay.click({ position: { x: offset, y: offset + unit * 2 } })
    await page.waitForTimeout(100)

    await overlay.click({ position: { x: offset + unit * 2, y: offset + unit * 2 } })
    await page.waitForTimeout(200)

    // Switch to column mode by clicking the column radio button
    const columnRadio = page.locator('.matrix-modal input[type="radio"][value="column"]')
    await columnRadio.click()
    await page.waitForTimeout(100)

    // The drawing should still be active, but now in column mode
    // Button text should contain "Cols" now
    await expect(drawButton).toHaveText(/Stop.*Cols/)

    // First column: click top key (0,0) and bottom key (0,2)
    // The middle key (0,1) should be automatically added
    await overlay.click({ position: { x: offset, y: offset } })
    await page.waitForTimeout(100)

    await overlay.click({ position: { x: offset, y: offset + unit * 2 } })
    await page.waitForTimeout(200)

    // Second column: click top key (1,0) and bottom key (1,2)
    // The middle key (1,1) should be automatically added
    await overlay.click({ position: { x: offset + unit, y: offset } })
    await page.waitForTimeout(100)

    await overlay.click({ position: { x: offset + unit, y: offset + unit * 2 } })
    await page.waitForTimeout(200)

    // Third column: click top key (2,0) and bottom key (2,2)
    // The middle key (2,1) should be automatically added
    await overlay.click({ position: { x: offset + unit * 2, y: offset } })
    await page.waitForTimeout(100)

    await overlay.click({ position: { x: offset + unit * 2, y: offset + unit * 2 } })
    await page.waitForTimeout(200)

    // Take screenshot for visual verification
    // Should show 3 rows and 3 columns, all with 3 keys each (first, middle, last)
    await expect(overlay).toHaveScreenshot('matrix-drawing-3x3-grid.png')
  })

  test('should annotate 3x3 grid automatically with same result as manual drawing', async ({
    page,
  }) => {
    // 3x3 grid layout fixture (KLE format: nested arrays with empty strings for keys)
    const fixtureData = [
      ['', '', ''],
      ['', '', ''],
      ['', '', ''],
    ]

    // Import layout via JSON
    await importLayoutJSON(page, fixtureData)

    // Verify layout has 9 keys via UI
    await expect(page.locator('.keys-counter')).toContainText('Keys: 9')

    // Small delay to ensure canvas renders
    await page.waitForTimeout(500)

    // Open Matrix Coordinates Modal
    await page.locator('.extra-tools-group button').click()
    await page
      .locator('.extra-tools-dropdown .dropdown-item')
      .filter({
        hasText: 'Add Switch Matrix Coordinates',
      })
      .click()

    // Wait for modal to be visible
    const matrixModal = page.locator('.matrix-modal')
    await expect(matrixModal).toBeVisible()

    // Wait for modal content to load (should skip directly to drawing step since no labels)
    await page.waitForTimeout(500)

    // Click the "Annotate Automatically" button
    const autoAnnotateButton = page
      .locator('.matrix-modal button')
      .filter({ hasText: 'Annotate Automatically' })
    await autoAnnotateButton.click()

    // Wait for annotation to complete
    await page.waitForTimeout(500)

    // Verify the overlay is visible and showing the annotated matrix
    const overlay = page.locator('canvas.matrix-annotation-overlay')
    await expect(overlay).toBeVisible()

    // Take screenshot for visual verification - should match manual drawing result
    // Should show 3 rows and 3 columns automatically computed from key positions
    await expect(overlay).toHaveScreenshot('matrix-drawing-3x3-grid-automatic.png')

    // Verify that the completion message is shown
    const completionAlert = page
      .locator('.alert-success')
      .filter({ hasText: 'Annotation Complete' })
    await expect(completionAlert).toBeVisible()

    // Verify progress stats show all keys assigned
    const rowsProgress = page.locator('.progress-label').filter({ hasText: 'Rows:' })
    await expect(rowsProgress).toContainText('3 defined')

    const colsProgress = page.locator('.progress-label').filter({ hasText: 'Columns:' })
    await expect(colsProgress).toContainText('3 defined')

    // Verify "0 keys left" for both rows and columns
    const keysLeftRows = page
      .locator('.progress-item')
      .filter({ has: rowsProgress })
      .locator('.progress-stats')
    await expect(keysLeftRows).toContainText('Complete')

    const keysLeftCols = page
      .locator('.progress-item')
      .filter({ has: colsProgress })
      .locator('.progress-stats')
    await expect(keysLeftCols).toContainText('Complete')
  })

  test('should only catch clicked keys with default sensitivity (0.5) on diagonal line', async ({
    page,
  }) => {
    // Layout with diagonal opportunity: first row has 2x 1U keys, second row has 1.5U + 1U keys
    // User spec: [[{"a":0},"",""], [{"w":1.5},"",""]]
    // Actual keys created:
    // Row 0: key at (0,0) w=1U center (0.5, 0.5), key at (1,0) w=1U center (1.5, 0.5)
    // Row 1: key at (0,1) w=1.5U center (0.75, 1.5), key at (1.5,1) w=1U center (2.0, 1.5)
    // Drawing from first key (0,0) to last key (1.5,1) diagonally
    // With default sensitivity (0.5), should catch ONLY the 2 clicked keys, not the 2 intermediate ones
    const fixtureData = [
      [{ a: 0 }, '', ''],
      [{ w: 1.5 }, '', ''],
    ]

    // Import layout via JSON
    await importLayoutJSON(page, fixtureData)

    // Verify layout has 4 keys via UI
    await expect(page.locator('.keys-counter')).toContainText('Keys: 4')

    // Small delay to ensure canvas renders
    await page.waitForTimeout(500)

    // Default sensitivity is 0.5 - we assume this is the default value
    // The test logic will verify behavior through UI interactions and JSON export

    // Open Matrix Coordinates Modal
    await page.locator('.extra-tools-group button').click()
    await page
      .locator('.extra-tools-dropdown .dropdown-item')
      .filter({
        hasText: 'Add Switch Matrix Coordinates',
      })
      .click()

    // Wait for modal to be visible
    const matrixModal = page.locator('.matrix-modal')
    await expect(matrixModal).toBeVisible()

    // Wait for modal content to load (should skip directly to drawing step since no labels)
    await page.waitForTimeout(500)

    // Select "Row" mode
    const rowRadio = page.locator('.matrix-modal input[type="radio"][value="row"]')
    await rowRadio.click()

    // Click the draw button to enable drawing mode
    const drawButton = page
      .locator('.matrix-modal button')
      .filter({ hasText: /Draw|Stop/ })
      .first()

    const buttonText = await drawButton.textContent()
    if (buttonText?.includes('Draw') && !buttonText?.includes('Stop')) {
      await drawButton.click()
    }

    // Wait for the button text to confirm drawing mode is enabled
    await expect(drawButton).toHaveText(/Stop/)

    // Now the overlay should be visible
    const overlay = page.locator('canvas.matrix-annotation-overlay')
    await expect(overlay).toBeVisible()

    // Get canvas bounding box for click calculations
    const overlayBox = await overlay.boundingBox()
    if (!overlayBox) throw new Error('Matrix overlay not found')

    const unit = 54 // Default unit size
    const border = 9 // Canvas border
    const offset = unit / 2 + border // Center offset for first unit

    // First key at layout position (0,0) width 1U has center at layout (0.5, 0.5)
    // Canvas position: (offset, offset)
    const firstKeyX = offset
    const firstKeyY = offset

    // Last key at layout position (1.5, 1) width 1U has center at layout (2.0, 1.5)
    // Canvas position: x = offset + 1.5*unit, y = offset + 1*unit
    const lastKeyX = offset + 1.5 * unit
    const lastKeyY = offset + 1.0 * unit

    // First click: top-left key
    await overlay.click({ position: { x: firstKeyX, y: firstKeyY } })
    await page.waitForTimeout(100)

    // Second click: bottom-right key - this should complete the sequence
    // With default sensitivity (0.5), should catch ONLY the 2 clicked keys, not intermediate ones
    // Use force:true because the overlay may be re-rendering after first click, causing instability
    await overlay.click({ position: { x: lastKeyX, y: lastKeyY }, force: true })
    await page.waitForTimeout(200)

    // Verify that exactly 1 row was created with exactly 2 keys
    // We verify this through UI state and visual confirmation since we can't access store directly
    // The screenshot verification will confirm the expected behavior

    // Take screenshot for visual verification
    await expect(overlay).toHaveScreenshot('matrix-drawing-diagonal-default-sensitivity.png')
  })
})
